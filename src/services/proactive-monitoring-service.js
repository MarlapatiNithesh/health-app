import { logger } from '../logger.js';

export class ProactiveMonitoringService {
  constructor({ clinicalRepo, encounterRepo, llmService, notificationDispatchService = null }) {
    this.clinicalRepo = clinicalRepo;
    this.encounterRepo = encounterRepo;
    this.llmService = llmService;
    this.notificationDispatch = notificationDispatchService;
  }

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

  async evaluatePatient(patientId) {
    const context = await this.clinicalRepo.getPatientContext(patientId);

    const isDiabetic = (context.activeConditions || []).some(
      (c) => /diabet/i.test(c.name || ''),
    );

    const rulesTriggered = [];

    const recentHbA1c = (context.recentLabs || []).find((l) => /hba1c/i.test(l.name || l.testName));
    if (recentHbA1c && parseFloat(recentHbA1c.value) >= 8.0) {
      rulesTriggered.push({
        type: 'high_hba1c_alert',
        reason: `Recent HbA1c is high (${recentHbA1c.value}%). Needs diet and medication check-in.`,
      });
    }

    const takesMetformin = (context.activeMedications || []).some((m) => /metformin/i.test(m.name));
    if (isDiabetic && takesMetformin) {
      rulesTriggered.push({
        type: 'medication_lifestyle_check',
        reason: 'Patient takes Metformin. Requires routine check on gastrointestinal side effects and daily step count.',
      });
    }

    const recentBP = (context.recentLabs || []).find((l) => /blood.pressure|bp|systolic/i.test(l.name || ''));
    if (recentBP && parseFloat(recentBP.value) > 140) {
      rulesTriggered.push({
        type: 'high_bp_alert',
        reason: `Elevated blood pressure reading (${recentBP.value} mmHg). Lifestyle check-in warranted.`,
      });
    }

    const steps = context.recentMetrics?.steps;
    if (steps !== undefined && Number(steps) < 2000) {
      rulesTriggered.push({
        type: 'inactivity_alert',
        reason: `Step count very low (${steps} steps). Encouraging movement.`,
      });
    }

    if (rulesTriggered.length === 0) return;

    await this.#generateAndDispatchPing(patientId, context, rulesTriggered);
  }

  async #generateAndDispatchPing(patientId, context, rulesTriggered) {
    logger.info(`Generating proactive ping for ${patientId}`, { rules: rulesTriggered.map((r) => r.type) });

    const systemPrompt = `You are MediBot, a proactive, premium AI health assistant for ${context.patient?.fullName || 'the patient'}.
Your background monitoring system has flagged the following clinical reasons to reach out today:
${rulesTriggered.map((r, i) => `${i + 1}. ${r.reason}`).join('\n')}

INSTRUCTIONS:
1. Write a short, caring, proactive push notification body (2-3 sentences max).
2. Acknowledge the patient's specific medical context.
3. End with an engaging question to prompt them to reply and start a chat session.
4. Do NOT give medical advice or change their dosage. Just check in on how they are feeling.
5. Output ONLY the notification body text. No title, no labels.`;

    const messages = [{ role: 'user', content: 'Generate my daily proactive health ping.' }];

    let pingMessage = 'Hi! MediBot is checking in on you today. How are you feeling? Tap to chat with your health assistant.';
    try {
      const result = await this.llmService.generateWithToolCalling({
        messages,
        systemPrompt,
        requestedModel: 'medgamma',
      });
      pingMessage = result.content || pingMessage;
    } catch (llmErr) {
      logger.warn(`[ProactiveMonitor] LLM call failed, using default ping`, { err: llmErr.message });
    }

    const healthEvent = await this.clinicalRepo.createHealthEvent(patientId, {
      eventType: 'proactive_ping',
      summary: pingMessage,
      structuredData: { rulesTriggered: rulesTriggered.map((r) => r.type) },
      sourceId: 'medibot_proactive_worker',
    });

    logger.info(`[ProactiveMonitor] Health event created eventId=${healthEvent?.id}`);

    if (this.notificationDispatch) {
      await this.notificationDispatch.onProactivePing(patientId, {
        pingMessage,
        rulesTriggered,
        sourceRefId: healthEvent?.id ?? `proactive_${patientId}_${Date.now()}`,
      });
    } else {
      logger.warn('[ProactiveMonitor] notificationDispatchService not injected - ping not sent as push');
    }
  }
}
