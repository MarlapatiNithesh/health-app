import { logger } from '../logger.js';
import { ClinicalOrchestratorService } from './chat-service.js';

/**
 * ProactiveMonitoringService
 * 
 * This service runs in the background (via cron or worker).
 * It scans patient context and deterministic rules to decide if a "Pro" 
 * proactive health ping should be generated for the patient.
 */
export class ProactiveMonitoringService {
  constructor({ clinicalRepo, encounterRepo, llmService }) {
    this.clinicalRepo = clinicalRepo;
    this.encounterRepo = encounterRepo;
    this.llmService = llmService;
  }

  /**
   * Run the nightly or hourly scan across a batch of patients.
   */
  async runHealthScanForPatients(patientIds) {
    logger.info(`Starting Proactive Health Scan for ${patientIds.length} patients.`);
    
    for (const patientId of patientIds) {
      try {
        await this.evaluatePatient(patientId);
      } catch (err) {
        logger.error(`Error evaluating patient ${patientId}`, { error: err.message });
      }
    }
  }

  /**
   * Evaluate a single patient against deterministic rules.
   */
  async evaluatePatient(patientId) {
    const context = await this.clinicalRepo.getPatientContext(patientId);
    
    // Check patient conditions and profile
    const conditions = context.activeConditions || [];
    const meds = context.activeMedications || [];
    const labs = context.recentLabs || [];

    const isDiabetic = conditions.some((c) => /diabet/i.test(c.name || ''));
    const isHypertensive = conditions.some((c) => /hypertens|bp|blood pressure/i.test(c.name || ''));

    const rulesTriggered = [];

    // Rule 1: High HbA1c or Glucose Follow-up
    const recentHbA1c = labs.find((l) => /hba1c/i.test(l.name || l.testName));
    if (recentHbA1c) {
      const val = parseFloat(recentHbA1c.value);
      if (!isNaN(val) && val >= 7.0) {
        rulesTriggered.push({
          type: 'high_hba1c_alert',
          reason: `Recent HbA1c is elevated (${recentHbA1c.value}%). Needs diet, hydration, and medication check-in.`,
        });
      }
    }

    // Rule 2: Medication Adherence / Check-in
    const takesMetformin = meds.some((m) => /metformin/i.test(m.name));
    if (takesMetformin) {
      rulesTriggered.push({
        type: 'medication_lifestyle_check',
        reason: 'Patient takes Metformin. Requires routine check on gastrointestinal side effects, hydration, and daily step count.',
      });
    }

    const takesBpMed = meds.some((m) => /amlodipine|losartan|lisinopril|atenolol/i.test(m.name));
    if (takesBpMed && rulesTriggered.length === 0) {
      rulesTriggered.push({
        type: 'bp_medication_check',
        reason: 'Patient is on antihypertensive therapy. Requires routine follow-up on resting blood pressure and vitals.',
      });
    }

    // Rule 3: General Chronic Care Wellness Follow-up
    if (rulesTriggered.length === 0 && (isDiabetic || isHypertensive || conditions.length > 0)) {
      const conditionName = conditions[0]?.name || 'active health management';
      rulesTriggered.push({
        type: 'chronic_wellness_check',
        reason: `Routine clinical check-in regarding ${conditionName} and recent activity trends.`,
      });
    }

    // If rules triggered, generate a proactive ping using the LLM
    if (rulesTriggered.length > 0) {
      return await this.#generateAndDispatchPing(patientId, context, rulesTriggered);
    }
    return null;
  }

  /**
   * Retrieves latest recent ping from health_events, or evaluates immediately if none exists.
   */
  async getLatestPingOrEvaluate(patientId) {
    if (typeof this.clinicalRepo.getRecentHealthEvents === 'function') {
      const recent = await this.clinicalRepo.getRecentHealthEvents(patientId, 'proactive_ping', 1);
      if (recent && recent.length > 0) {
        return {
          id: recent[0].id,
          pingMessage: recent[0].summary,
          rulesTriggered: recent[0].structuredData?.rulesTriggered || [],
          eventTime: recent[0].eventTime,
          isNew: false,
        };
      }
    }
    return await this.evaluatePatient(patientId);
  }

  /**
   * Use the Medical LLM to draft a highly personalized, caring message.
   */
  async #generateAndDispatchPing(patientId, context, rulesTriggered) {
    logger.info(`Generating proactive ping for ${patientId}`, { rules: rulesTriggered.map(r => r.type) });
    const patientName = context.patient?.fullName || 'there';

    const systemPrompt = `You are Dr. MediBot, a proactive, premium AI physician assistant for ${patientName}.
The patient is enrolled in clinical health monitoring.
Your background monitoring system has flagged the following clinical reasons to reach out today:
${rulesTriggered.map((r, i) => `${i + 1}. ${r.reason}`).join('\n')}

INSTRUCTIONS:
1. Write a short, caring, proactive push notification (2-3 sentences max) to check in on the patient.
2. Acknowledge their specific medical context (e.g. mention their HbA1c, Metformin, or blood pressure).
3. End with an engaging question to prompt them to reply and start a chat session.
4. Do NOT give medical advice or change their dosage. Just check in on how they are feeling today.`;

    const messages = [{ role: 'user', content: 'Generate my daily proactive health ping.' }];

    let pingMessage = '';
    try {
      const result = await this.llmService.generateWithToolCalling({
        messages,
        systemPrompt,
        tools: [],
        requestedModel: 'medgamma' // Using HF MedGemma or Gemini router
      });
      pingMessage = result.content;
    } catch (err) {
      logger.warn(`LLM call failed for proactive ping, using clinical template: ${err.message}`);
      const primaryReason = rulesTriggered[0]?.reason || 'your wellness schedule';
      pingMessage = `Hello ${patientName}! Dr. MediBot here with your clinical check-in. Regarding ${primaryReason.toLowerCase()}, how are you feeling with your medication and energy levels today?`;
    }

    if (!pingMessage || pingMessage.trim().length === 0) {
      pingMessage = `Hello ${patientName}! Dr. MediBot here with your proactive clinical check-in. How are you feeling with your health routines and energy today?`;
    }

    // Persist this ping to the database as a Health Event
    const cleanSummary = pingMessage.trim().slice(0, 495);
    const event = await this.clinicalRepo.createHealthEvent(patientId, {
      eventType: 'proactive_ping',
      summary: cleanSummary,
      structuredData: { rulesTriggered: rulesTriggered.map(r => r.type) },
      sourceId: 'medibot_proactive_worker'
    });

    logger.info(`Dispatched Ping to Patient: ${pingMessage}`);

    return {
      id: event?.id,
      pingMessage,
      rulesTriggered: rulesTriggered.map(r => r.type),
      eventTime: event?.eventTime || new Date(),
      isNew: true,
    };
  }
}
