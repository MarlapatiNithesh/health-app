import { logger } from '../logger.js';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_STREAMS } from './notification-service.js';

export class MedicationScheduleService {
  constructor({ medicationRepo, notificationService, clinicalRepo = null } = {}) {
    this.medicationRepo = medicationRepo;
    this.notificationService = notificationService;
    this.clinicalRepo = clinicalRepo;
  }

  /**
   * Compute standard chronotherapy times starting from 08:00 AM.
   */
  static computeDefaultTimes(frequency) {
    const freq = (frequency || '').toLowerCase().trim();
    switch (freq) {
      case '1x':
      case 'once_daily':
      case 'daily':
      case 'od':
      case 'qd':
        return ['08:00:00'];
      case '2x':
      case 'twice_daily':
      case 'bid':
      case 'b.i.d.':
        return ['08:00:00', '20:00:00'];
      case '3x':
      case 'thrice_daily':
      case 'tid':
      case 't.i.d.':
        return ['08:00:00', '14:00:00', '20:00:00'];
      case '4x':
      case 'four_times_daily':
      case 'qid':
      case 'q.i.d.':
        return ['08:00:00', '12:00:00', '16:00:00', '20:00:00'];
      default:
        return ['08:00:00'];
    }
  }

  /**
   * Register a medication manually.
   */
  async addManualMedication(patientId, {
    medicationName,
    dosage,
    form = 'tablet',
    frequency = 'twice_daily',
    scheduledTimes = null,
    withFood = false,
    emptyStomach = false,
  }) {
    if (!medicationName || !dosage) {
      throw new Error('medicationName and dosage are required');
    }

    const times = Array.isArray(scheduledTimes) && scheduledTimes.length > 0
      ? scheduledTimes
      : MedicationScheduleService.computeDefaultTimes(frequency);

    const schedule = await this.medicationRepo.createSchedule({
      patientId,
      medicationName: medicationName.trim(),
      dosage: dosage.trim(),
      form,
      frequency,
      scheduledTimes: times,
      withFood: Boolean(withFood),
      emptyStomach: Boolean(emptyStomach),
      source: 'manual_entry',
      isActive: true,
    });

    logger.info('[MedicationSchedule] Manual medication added', {
      patientId,
      medicationName,
      times,
    });

    return schedule;
  }

  /**
   * Get all active medication schedules for a patient.
   */
  async getActiveMedications(patientId) {
    return this.medicationRepo.getActiveSchedules(patientId);
  }

  /**
   * Evaluate medication adherence and dispatch persistent escalations.
   * Runs at scheduled time, T+15m, T+30m, T+60m until marked taken.
   */
  async evaluateAndDispatchDoseReminders(patientId, currentTime = new Date()) {
    const schedules = await this.medicationRepo.getActiveSchedules(patientId);
    if (!schedules || schedules.length === 0) return [];

    const dateStr = currentTime.toISOString().slice(0, 10);
    const results = [];

    for (const schedule of schedules) {
      const scheduledTimes = schedule.scheduled_times || schedule.scheduledTimes || [];
      const medicationName = schedule.medication_name || schedule.medicationName;
      const dosage = schedule.dosage;
      const withFood = schedule.with_food ?? schedule.withFood ?? false;
      const emptyStomach = schedule.empty_stomach ?? schedule.emptyStomach ?? false;

      for (const timeStr of scheduledTimes) {
        // Build expected scheduled Date
        const [h, m, s] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
        const scheduledDate = new Date(currentTime);
        scheduledDate.setHours(h, m, s, 0);

        const diffMinutes = Math.floor((currentTime.getTime() - scheduledDate.getTime()) / 60000);

        // If scheduled time has not yet arrived today, skip
        if (diffMinutes < 0) continue;

        // Check if an intake log already exists for this slot today
        let intake = await this.medicationRepo.findPendingIntake(
          patientId,
          schedule.id,
          dateStr
        );

        if (intake && (intake.status === 'taken' || intake.status === 'skipped')) {
          // Dose was already taken or intentionally skipped
          continue;
        }

        // Determine escalation level based on minutes overdue
        let escalationStage = 0;
        let title = '';
        let body = '';
        let priority = 'normal';

        const foodInst = withFood
          ? ' with meals'
          : emptyStomach
          ? ' on an empty stomach with a full glass of water'
          : ' with water';

        if (diffMinutes >= 60) {
          // T+60m escalation
          escalationStage = 3;
          title = `🚨 Critical Adherence Alert: ${medicationName} (${dosage})`;
          body = `Your dose is 60 minutes overdue. Consistent timing ensures therapeutic drug levels and prevents complications. Tap to mark taken or verify.`;
          priority = 'high';
        } else if (diffMinutes >= 30) {
          // T+30m escalation
          escalationStage = 2;
          title = `⚠️ Overdue Medication: ${medicationName} (${dosage})`;
          body = `Your scheduled dose is 30 minutes late. Please take now${foodInst} or confirm if taken.`;
          priority = 'high';
        } else if (diffMinutes >= 15) {
          // T+15m gentle reminder
          escalationStage = 1;
          title = `⏰ Reminder: ${medicationName} (${dosage}) Pending`;
          body = `Still pending: please remember your dose${foodInst} to stay on schedule.`;
          priority = 'normal';
        } else if (diffMinutes >= 0 && diffMinutes < 15) {
          // T+0 primary scheduled notification
          escalationStage = 0;
          title = `💊 Time for ${medicationName} (${dosage})`;
          body = `Scheduled time: please take your dose${foodInst}. Tap to confirm or scan pill label.`;
          priority = 'normal';
        }

        const currentCount = intake ? (intake.escalation_count ?? intake.escalationCount ?? 0) : 0;

        // Check if we already logged this intake or escalation count
        if (!intake) {
          intake = await this.medicationRepo.createIntakeLog({
            scheduleId: schedule.id,
            patientId,
            medicationName,
            doseTaken: dosage,
            scheduledTime: scheduledDate,
            status: 'pending',
            escalationCount: escalationStage,
          });
        } else if (currentCount < escalationStage) {
          intake = await this.medicationRepo.updateIntakeLog(intake.id, {
            escalationCount: escalationStage,
            status: 'escalated',
          });
        } else if (diffMinutes >= 15 && intake.status === 'pending') {
          // Keep active
        }

        // Dispatch persistent notification via NotificationService
        const idempotencyKey = `med_remind_${schedule.id}_${dateStr}_stage_${escalationStage}`;
        let dispatchRes = null;

        if (this.notificationService?.dispatch) {
          dispatchRes = await this.notificationService.dispatch({
            memberId: patientId,
            category: NOTIFICATION_CATEGORIES.MEDICATION_REMINDER,
            priority,
            title,
            body,
            actionLabel: `MARK ${medicationName.toUpperCase()} TAKEN`,
            actionUrl: `medibot://medications/verify/${schedule.id}`,
            deepLink: `medibot://medications/verify/${schedule.id}`,
            sourceType: 'medication_schedules',
            sourceRefId: schedule.id,
            idempotencyKey,
            metadata: {
              tier: 3,
              stream: NOTIFICATION_STREAMS.STREAM_3,
              scheduleId: schedule.id,
              intakeLogId: intake.id,
              escalationStage,
              minutesOverdue: diffMinutes,
              medicationName,
              dosage,
            },
          });
        }

        results.push({
          scheduleId: schedule.id,
          intakeId: intake.id,
          medicationName,
          escalationStage,
          diffMinutes,
          notification: dispatchRes,
        });
      }
    }

    return results;
  }

  /**
   * Mark dose as taken, optionally recording OCR verification results.
   */
  async markDoseTaken(patientId, {
    scheduleId,
    intakeLogId = null,
    takenAt = new Date(),
    ocrVerified = false,
    ocrConfidence = null,
    ocrExtractedText = null,
    mismatchWarning = null,
  }) {
    let log = null;

    if (intakeLogId) {
      log = await this.medicationRepo.updateIntakeLog(intakeLogId, {
        status: 'taken',
        takenAt,
        ocrVerified,
        ocrConfidence,
        ocrExtractedText,
        mismatchWarning,
      });
    } else {
      const schedule = scheduleId ? await this.medicationRepo.findScheduleById(scheduleId) : null;
      log = await this.medicationRepo.createIntakeLog({
        scheduleId: schedule?.id || null,
        patientId,
        medicationName: schedule?.medication_name || 'Manual Medication',
        doseTaken: schedule?.dosage || 'Prescribed dose',
        scheduledTime: takenAt,
        takenAt,
        status: 'taken',
        ocrVerified,
        ocrConfidence,
        ocrExtractedText,
        mismatchWarning,
      });
    }

    logger.info('[MedicationSchedule] Medication confirmed taken', {
      patientId,
      scheduleId,
      ocrVerified,
      mismatchWarning: mismatchWarning ? true : false,
    });

    return log;
  }

  /**
   * Mark dose as skipped.
   */
  async markDoseSkipped(patientId, { scheduleId, intakeLogId = null, reason = 'Patient opted to skip' }) {
    if (intakeLogId) {
      return this.medicationRepo.updateIntakeLog(intakeLogId, {
        status: 'skipped',
        mismatchWarning: reason,
      });
    }
    const schedule = scheduleId ? await this.medicationRepo.findScheduleById(scheduleId) : null;
    return this.medicationRepo.createIntakeLog({
      scheduleId: schedule?.id || null,
      patientId,
      medicationName: schedule?.medication_name || 'Medication',
      doseTaken: '0',
      scheduledTime: new Date(),
      status: 'skipped',
      mismatchWarning: reason,
    });
  }
}
