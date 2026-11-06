import { logger } from '../logger.js';
import { MediBotLLMFactory } from '../medibot/models/llm-factory.js';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_STREAMS } from './notification-service.js';

export class TelemetryAnomalyService {
  constructor({
    notificationService,
    medicationRepo = null,
    clinicalRepo = null,
    llmModel = null,
  } = {}) {
    this.notificationService = notificationService;
    this.medicationRepo = medicationRepo;
    this.clinicalRepo = clinicalRepo;
    this.llmModel = llmModel || MediBotLLMFactory.createChatModel({ temperature: 0.2 });
  }

  /**
   * Check if reading violates clinical safety gates.
   */
  static evaluateVitalsThreshold(metricType, value, extra = {}) {
    const type = (metricType || '').toLowerCase();
    const num = parseFloat(value);

    switch (type) {
      case 'glucose':
      case 'blood_glucose':
        if (num < 54) {
          return { isAnomaly: true, severity: 'critical', subType: 'severe_hypoglycemia', unit: 'mg/dL' };
        }
        if (num < 70) {
          return { isAnomaly: true, severity: 'high', subType: 'hypoglycemia', unit: 'mg/dL' };
        }
        if (num > 250) {
          return { isAnomaly: true, severity: 'critical', subType: 'severe_hyperglycemia', unit: 'mg/dL' };
        }
        if (num > 180) {
          return { isAnomaly: true, severity: 'moderate', subType: 'hyperglycemia', unit: 'mg/dL' };
        }
        return { isAnomaly: false };

      case 'bp':
      case 'blood_pressure': {
        const systolic = parseFloat(value);
        const diastolic = parseFloat(extra.diastolic || 80);
        if (systolic >= 180 || diastolic >= 120) {
          return { isAnomaly: true, severity: 'critical', subType: 'hypertensive_crisis', unit: 'mmHg', systolic, diastolic };
        }
        if (systolic >= 140 || diastolic >= 90) {
          return { isAnomaly: true, severity: 'high', subType: 'stage2_hypertension', unit: 'mmHg', systolic, diastolic };
        }
        if (systolic < 90 || diastolic < 60) {
          return { isAnomaly: true, severity: 'moderate', subType: 'hypotension', unit: 'mmHg', systolic, diastolic };
        }
        return { isAnomaly: false };
      }

      case 'spo2':
      case 'oxygen_saturation':
        if (num < 90) {
          return { isAnomaly: true, severity: 'critical', subType: 'critical_hypoxia', unit: '%' };
        }
        if (num < 95) {
          return { isAnomaly: true, severity: 'high', subType: 'hypoxemia_warning', unit: '%' };
        }
        return { isAnomaly: false };

      case 'heart_rate':
      case 'hr':
      case 'pulse':
        if (num >= 120) {
          return { isAnomaly: true, severity: 'critical', subType: 'critical_tachycardia', unit: 'bpm' };
        }
        if (num >= 100) {
          return { isAnomaly: true, severity: 'high', subType: 'resting_tachycardia', unit: 'bpm' };
        }
        if (num < 45) {
          return { isAnomaly: true, severity: 'high', subType: 'severe_bradycardia', unit: 'bpm' };
        }
        return { isAnomaly: false };

      case 'hydration':
      case 'heat_exhaustion': {
        const temp = parseFloat(extra.temp || 37.0);
        const hr = parseFloat(extra.hr || 75);
        const waterLogged = parseFloat(extra.waterLoggedMl || 0);
        if (temp > 38.0 && hr > 100 && waterLogged < 600) {
          return { isAnomaly: true, severity: 'critical', subType: 'acute_dehydration_heat_stress', unit: 'temp/hr' };
        }
        return { isAnomaly: false };
      }

      default:
        return { isAnomaly: false };
    }
  }

  /**
   * Run LangChain LLM Emergency Clinical Triage on the anomaly.
   */
  async runLlmEmergencyTriage(patientContext, anomaly) {
    const prompt = `You are an Emergency Clinical Specialist AI evaluating an urgent wearable telemetry anomaly.
Patient Context:
- Age: ${patientContext.age || 'Unknown'}
- Known Conditions: ${JSON.stringify(patientContext.conditions || ['Not specified'])}
- Active Prescribed Medications: ${JSON.stringify(patientContext.medications || ['Not specified'])}
- Recent Vitals: ${JSON.stringify(patientContext.vitals || {})}

Urgent Biometric Anomaly Detected:
- Metric: ${anomaly.metricType}
- Value: ${anomaly.value} ${anomaly.unit || ''}
- Severity: ${anomaly.severity}
- Category: ${anomaly.subType}

Please provide an immediate clinical emergency evaluation in JSON format with exactly these keys:
{
  "urgency": "CRITICAL_EMERGENCY" | "HIGH_RISK" | "MODERATE_ALERT",
  "clinicalMechanism": "Brief explanation connecting this abnormal reading with the patient's conditions or active medications",
  "actionProtocol": "Step-by-step immediate non-pharmacological or first-line stabilization protocol (e.g. Rule of 15, Vagal Reset 4-2-6 breathing, hydration, stop exertion)",
  "callEmergency": true | false,
  "ctaLabel": "Action CTA for notification button",
  "notificationTitle": "Urgent alert title with emoji",
  "notificationBody": "Actionable, calm, clinically rigorous emergency instructions (max 2 sentences)"
}`;

    try {
      const response = await this.llmModel.invoke([
        { role: 'system', content: 'You are an emergency triage doctor. Respond strictly in valid JSON.' },
        { role: 'user', content: prompt },
      ]);

      const text = typeof response?.content === 'string' ? response.content : JSON.stringify(response);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      logger.warn('[TelemetryAnomaly] LLM emergency triage fallback used', { error: err.message });
    }

    // High reliability clinical fallback triage
    return this.#generateClinicalFallbackTriage(anomaly, patientContext);
  }

  #generateClinicalFallbackTriage(anomaly, patientContext) {
    switch (anomaly.subType) {
      case 'severe_hypoglycemia':
      case 'hypoglycemia':
        return {
          urgency: anomaly.severity === 'critical' ? 'CRITICAL_EMERGENCY' : 'HIGH_RISK',
          clinicalMechanism: `Blood glucose of ${anomaly.value} mg/dL risks neuroglycopenia. Especially critical if on insulin or secretagogues.`,
          actionProtocol: 'Rule of 15: Ingest 15g of fast-acting glucose immediately (juice/glucose tablets), rest, retest in 15 minutes.',
          callEmergency: anomaly.value < 50,
          ctaLabel: 'LOG FAST CARBS & RETEST',
          notificationTitle: `⚡ Low Sugar Urgent Alert: ${anomaly.value} mg/dL`,
          notificationBody: `Blood glucose has dropped to ${anomaly.value} mg/dL. Take 15-20g fast-acting carbs now and sit down.`,
        };

      case 'hypertensive_crisis':
      case 'stage2_hypertension':
        return {
          urgency: anomaly.severity === 'critical' ? 'CRITICAL_EMERGENCY' : 'HIGH_RISK',
          clinicalMechanism: `Blood pressure of ${anomaly.value} mmHg represents acute hemodynamic stress. Check for chest pain, headache, or vision changes.`,
          actionProtocol: 'Sit quietly for 5 minutes, practice diaphragmatic breathing, refrain from sudden exertion, and retake measurement.',
          callEmergency: anomaly.severity === 'critical',
          ctaLabel: 'START 2-MIN RESET',
          notificationTitle: `⚠️ Blood Pressure Spike: ${anomaly.value} mmHg`,
          notificationBody: `Your blood pressure reading is acutely elevated (${anomaly.value} mmHg). Rest calmly, avoid exertion, and monitor closely.`,
        };

      case 'critical_hypoxia':
      case 'hypoxemia_warning':
        return {
          urgency: 'CRITICAL_EMERGENCY',
          clinicalMechanism: `SpO2 reading of ${anomaly.value}% indicates inadequate arterial oxygen saturation.`,
          actionProtocol: 'Sit upright, take slow deep breaths, check probe position, and seek immediate medical evaluation if persistent.',
          callEmergency: anomaly.value < 88,
          ctaLabel: 'CALL 112 / 911 NOW',
          notificationTitle: `🚨 Low Blood Oxygen — ${anomaly.value}%`,
          notificationBody: `Oxygen saturation is ${anomaly.value}%. Sit upright immediately, breathe deeply, and recheck. Seek medical help if below 90%.`,
        };

      case 'critical_tachycardia':
      case 'resting_tachycardia':
        return {
          urgency: anomaly.severity === 'critical' ? 'CRITICAL_EMERGENCY' : 'HIGH_RISK',
          clinicalMechanism: `Elevated resting heart rate (${anomaly.value} bpm) increases myocardial oxygen demand.`,
          actionProtocol: 'Execute vagal parasympathetic reset: 4s inhale, 2s hold, 6s exhale diaphragmatic breathing, cool water sip.',
          callEmergency: anomaly.value > 140,
          ctaLabel: 'START 2-MIN RESET',
          notificationTitle: `💓 Heart Pulse Check: ${anomaly.value} bpm`,
          notificationBody: `Your pulse is running high at rest (${anomaly.value} bpm). Sit comfortably, take slow deep belly breaths, and sip cool water.`,
        };

      case 'acute_dehydration_heat_stress':
        return {
          urgency: 'HIGH_RISK',
          clinicalMechanism: 'Combination of elevated temperature, high heart rate, and low fluid intake indicates acute thermal dehydration.',
          actionProtocol: 'Immediately move to a cool shade, drink 400-500ml electrolyte water, and rest.',
          callEmergency: false,
          ctaLabel: 'LOG 400ML ELECTROLYTE',
          notificationTitle: '💧 Heat & Dehydration Alert',
          notificationBody: 'Your thermal vitals and heart rate indicate acute dehydration. Seek cool shelter and rehydrate immediately.',
        };

      default:
        return {
          urgency: 'MODERATE_ALERT',
          clinicalMechanism: `Telemetry reading of ${anomaly.value} deviates from your standard baseline.`,
          actionProtocol: 'Rest, hydrate, and recheck measurement in 15 minutes.',
          callEmergency: false,
          ctaLabel: 'VIEW VITALS',
          notificationTitle: `⚠️ Health Telemetry Alert: ${anomaly.metricType}`,
          notificationBody: `An abnormal ${anomaly.metricType} reading was recorded. Please rest and re-evaluate.`,
        };
    }
  }

  /**
   * Evaluate incoming wearable telemetry stream, run triage, and trigger 0-second bypass notification.
   */
  async processTelemetry(patientId, { metricType, value, extra = {} }) {
    const evaluation = TelemetryAnomalyService.evaluateVitalsThreshold(metricType, value, extra);

    if (!evaluation.isAnomaly) {
      return { isAnomaly: false };
    }

    // 1. Gather patient context (conditions, medications, vitals)
    let patientContext = { age: null, conditions: [], medications: [], vitals: {} };
    if (this.clinicalRepo) {
      try {
        const profile = await this.clinicalRepo.findPatientById(patientId).catch(() => null);
        if (profile) {
          patientContext.age = profile.dob ? new Date().getFullYear() - new Date(profile.dob).getFullYear() : null;
        }
      } catch (err) {
        logger.debug('[TelemetryAnomaly] Failed to fetch profile', { err: err.message });
      }
    }

    if (this.medicationRepo) {
      try {
        const activeMeds = await this.medicationRepo.getActiveSchedules(patientId).catch(() => []);
        patientContext.medications = activeMeds.map((m) => `${m.medication_name} ${m.dosage}`);
      } catch (err) {
        logger.debug('[TelemetryAnomaly] Failed to fetch active medications', { err: err.message });
      }
    }

    // 2. Run LangChain LLM Emergency Clinical Triage
    const triage = await this.runLlmEmergencyTriage(patientContext, {
      metricType,
      value,
      unit: evaluation.unit,
      severity: evaluation.severity,
      subType: evaluation.subType,
    });

    // 3. Dispatch Tier-1 0-second Immediate Emergency Bypass Notification
    let notificationResult = null;
    if (this.notificationService?.dispatch) {
      notificationResult = await this.notificationService.dispatch({
        memberId: patientId,
        category: NOTIFICATION_CATEGORIES.EMERGENCY_PROTOCOL,
        priority: 'critical',
        title: triage.notificationTitle,
        body: triage.notificationBody,
        actionLabel: triage.ctaLabel,
        actionUrl: triage.callEmergency ? 'tel:112' : `medibot://vitals/reset/${metricType}`,
        deepLink: `medibot://vitals/reset/${metricType}`,
        sourceType: 'telemetry_anomaly_engine',
        sourceRefId: `${metricType}_${Date.now()}`,
        idempotencyKey: `anom_${metricType}_${patientId}_${Date.now()}`,
        metadata: {
          tier: 1,
          stream: NOTIFICATION_STREAMS.STREAM_1,
          metricType,
          value,
          severity: evaluation.severity,
          urgency: triage.urgency,
          clinicalMechanism: triage.clinicalMechanism,
          actionProtocol: triage.actionProtocol,
          callEmergency: triage.callEmergency,
        },
      });
    }

    // 4. Record anomaly event in database
    let eventRecord = null;
    if (this.medicationRepo?.recordTelemetryAnomaly) {
      eventRecord = await this.medicationRepo.recordTelemetryAnomaly({
        patientId,
        metricType,
        metricValue: value,
        metricUnit: evaluation.unit || '',
        severity: evaluation.severity,
        llmTriageAssessment: triage,
        actionProtocolDispatched: triage.actionProtocol,
        notificationId: notificationResult?.notification?.id || null,
      });
    }

    // 5. Update daily metabolic log to mark that an anomaly occurred (triggers exercise suppression)
    if (this.medicationRepo?.upsertMetabolicLog) {
      const today = new Date().toISOString().slice(0, 10);
      const existing = await this.medicationRepo.getMetabolicLog(patientId, today).catch(() => null);
      await this.medicationRepo.upsertMetabolicLog({
        patientId,
        logDate: today,
        bmrKcal: existing?.bmr_kcal || 1650,
        activeBurnKcal: existing?.active_burn_kcal || 0,
        totalTdeeKcal: existing?.total_tdee_kcal || 2150,
        anomaliesOccurred: true,
      }).catch(() => {});
    }

    return {
      isAnomaly: true,
      severity: evaluation.severity,
      metricType,
      value,
      triage,
      notification: notificationResult,
      eventRecord,
    };
  }
}
