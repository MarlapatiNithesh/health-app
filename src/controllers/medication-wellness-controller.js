import multer from 'multer';
import { logger } from '../logger.js';
import { ApplicationError } from '../errors/application-error.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

export class MedicationWellnessController {
  constructor({
    medicationScheduleService,
    medicationOcrService,
    telemetryAnomalyService,
    metabolicPacingService,
  } = {}) {
    this.medicationScheduleService = medicationScheduleService;
    this.medicationOcrService = medicationOcrService;
    this.telemetryAnomalyService = telemetryAnomalyService;
    this.metabolicPacingService = metabolicPacingService;
    this.uploadMiddleware = upload.single('image');
  }

  // ── 1. Medication Endpoints ──────────────────────────────────────────────

  async addManualMedication(req, res, next) {
    try {
      const patientId = req.member?.id || req.body.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const {
        medicationName,
        dosage,
        form = 'tablet',
        frequency = 'twice_daily',
        scheduledTimes,
        withFood = false,
        emptyStomach = false,
      } = req.body;

      if (!medicationName || !dosage) {
        throw new ApplicationError('medicationName and dosage are required', 400, 'validation_error');
      }

      const schedule = await this.medicationScheduleService.addManualMedication(patientId, {
        medicationName,
        dosage,
        form,
        frequency,
        scheduledTimes,
        withFood,
        emptyStomach,
      });

      res.status(201).json({
        success: true,
        data: schedule,
      });
    } catch (err) {
      next(err);
    }
  }

  async getActiveMedications(req, res, next) {
    try {
      const patientId = req.member?.id || req.query.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const schedules = await this.medicationScheduleService.getActiveMedications(patientId);
      res.json({
        success: true,
        data: schedules,
      });
    } catch (err) {
      next(err);
    }
  }

  async markDose(req, res, next) {
    try {
      const patientId = req.member?.id || req.body.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const { scheduleId, intakeLogId, status = 'taken', reason } = req.body;

      let result;
      if (status === 'skipped') {
        result = await this.medicationScheduleService.markDoseSkipped(patientId, {
          scheduleId,
          intakeLogId,
          reason,
        });
      } else {
        result = await this.medicationScheduleService.markDoseTaken(patientId, {
          scheduleId,
          intakeLogId,
          takenAt: new Date(),
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyMedicationOcr(req, res, next) {
    try {
      const patientId = req.member?.id || req.body.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      let buffer = req.file?.buffer;
      let mimeType = req.file?.mimetype || 'image/jpeg';

      // Accept base64 string in body if file not provided via multipart
      if (!buffer && req.body.imageBase64) {
        const cleanBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(cleanBase64, 'base64');
      }

      if (!buffer) {
        throw new ApplicationError('Image file or imageBase64 is required for OCR verification', 400, 'bad_request');
      }

      const { expectedMedication, expectedDosage, scheduleId, intakeLogId } = req.body;
      if (!expectedMedication) {
        throw new ApplicationError('expectedMedication is required', 400, 'bad_request');
      }

      const verification = await this.medicationOcrService.verifyMedicationScan(patientId, {
        imageBuffer: buffer,
        mimeType,
        expectedMedication,
        expectedDosage,
        scheduleId,
        intakeLogId,
      });

      res.json({
        success: true,
        data: verification,
      });
    } catch (err) {
      next(err);
    }
  }

  async evaluateDoseReminders(req, res, next) {
    try {
      const patientId = req.member?.id || req.body.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const results = await this.medicationScheduleService.evaluateAndDispatchDoseReminders(patientId, new Date());
      res.json({
        success: true,
        count: results.length,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  }

  // ── 2. Wearables & Telemetry Anomaly Endpoints ────────────────────────────

  async evaluateTelemetryAnomaly(req, res, next) {
    try {
      const patientId = req.member?.id || req.body.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const { metricType, value, extra = {} } = req.body;
      if (!metricType || value === undefined) {
        throw new ApplicationError('metricType and value are required', 400, 'bad_request');
      }

      const outcome = await this.telemetryAnomalyService.processTelemetry(patientId, {
        metricType,
        value,
        extra,
      });

      res.json({
        success: true,
        data: outcome,
      });
    } catch (err) {
      next(err);
    }
  }

  async getActiveAnomalies(req, res, next) {
    try {
      const patientId = req.member?.id || req.query.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const anomalies = await this.telemetryAnomalyService.medicationRepo?.getTodayAnomalies(patientId) || [];
      res.json({
        success: true,
        data: anomalies,
      });
    } catch (err) {
      next(err);
    }
  }

  // ── 3. Metabolic & Lifestyle Endpoints ────────────────────────────────────

  async getMetabolicSummary(req, res, next) {
    try {
      const patientId = req.member?.id || req.query.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const summary = await this.metabolicPacingService.getDailyMetabolicSummary(patientId);
      res.json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  async logMeal(req, res, next) {
    try {
      const patientId = req.member?.id || req.body.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const { mealType, calories, description, time } = req.body;
      const log = await this.metabolicPacingService.logMeal(patientId, {
        mealType,
        calories,
        description,
        time: time ? new Date(time) : new Date(),
      });

      res.status(201).json({
        success: true,
        data: log,
      });
    } catch (err) {
      next(err);
    }
  }

  async logWater(req, res, next) {
    try {
      const patientId = req.member?.id || req.body.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const { volumeMl } = req.body;
      const log = await this.metabolicPacingService.logWater(patientId, {
        volumeMl,
      });

      res.json({
        success: true,
        data: log,
      });
    } catch (err) {
      next(err);
    }
  }

  async recalculateExercise(req, res, next) {
    try {
      const patientId = req.member?.id || req.body.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const { activeBurnKcal } = req.body;
      if (activeBurnKcal !== undefined) {
        await this.metabolicPacingService.updateWearableActiveBurn(patientId, activeBurnKcal);
      }

      const summary = await this.metabolicPacingService.getDailyMetabolicSummary(patientId);
      res.json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  async dispatchMealNotification(req, res, next) {
    try {
      const patientId = req.member?.id || req.body.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const { hour } = req.body;
      const notif = await this.metabolicPacingService.dispatchCircadianMealNotification(patientId, {
        hour: hour !== undefined ? parseInt(hour, 10) : undefined,
      });

      res.json({
        success: true,
        data: notif,
      });
    } catch (err) {
      next(err);
    }
  }

  async dispatchExerciseNotification(req, res, next) {
    try {
      const patientId = req.member?.id || req.body.patientId;
      if (!patientId) {
        throw new ApplicationError('Patient identity required', 400, 'bad_request');
      }

      const notif = await this.metabolicPacingService.dispatchExerciseEffortReminder(patientId);
      res.json({
        success: true,
        data: notif,
      });
    } catch (err) {
      next(err);
    }
  }
}
