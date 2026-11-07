/**
 * Comprehensive Verification Test Suite:
 * 1. Prescribed Medication Regimen, Chronotherapy & Persistent Escalation Loop (from 8 AM)
 * 2. Manual Medication Addition & Post-Take OCR Verification (Matching & Mismatch Alert)
 * 3. Wearable Telemetry Anomaly Detection & LangChain LLM Emergency Clinical Triage
 * 4. Circadian Lifestyle, Caloric Budgeting (BMR/TDEE) & Adaptive Exercise Safety Throttling
 */

import { MedicationScheduleService } from './src/services/medication-schedule-service.js';
import { MedicationOcrService } from './src/services/medication-ocr-service.js';
import { TelemetryAnomalyService } from './src/services/telemetry-anomaly-service.js';
import { MetabolicPacingService } from './src/services/metabolic-pacing-service.js';
import {
  NotificationService,
  NotificationRulesService,
  NotificationDispatchService,
  NotificationPushService,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_STREAMS,
} from './src/services/notification-service.js';

// In-Memory Repository Mock for hermetic, fast and deterministic verification
class MockMedicationRepo {
  constructor() {
    this.schedules = [];
    this.intakes = [];
    this.anomalies = [];
    this.metabolics = new Map();
  }

  async createSchedule(data) {
    const record = { id: `sched-${this.schedules.length + 1}`, ...data };
    this.schedules.push(record);
    return record;
  }

  async getActiveSchedules(patientId) {
    return this.schedules.filter((s) => s.patientId === patientId && s.isActive);
  }

  async findScheduleById(id) {
    return this.schedules.find((s) => s.id === id) || null;
  }

  async createIntakeLog(data) {
    const record = { id: `intake-${this.intakes.length + 1}`, ...data };
    this.intakes.push(record);
    return record;
  }

  async updateIntakeLog(id, updates) {
    const item = this.intakes.find((i) => i.id === id);
    if (item) Object.assign(item, updates);
    return item || null;
  }

  async findPendingIntake(patientId, scheduleId, targetDateStr) {
    return this.intakes.find(
      (i) => i.patientId === patientId && i.scheduleId === scheduleId
    ) || null;
  }

  async recordTelemetryAnomaly(data) {
    const record = { id: `anom-${this.anomalies.length + 1}`, ...data, created_at: new Date() };
    this.anomalies.push(record);
    return record;
  }

  async getTodayAnomalies(patientId) {
    return this.anomalies.filter((a) => a.patientId === patientId);
  }

  async upsertMetabolicLog(data) {
    const key = `${data.patientId}_${data.logDate}`;
    const existing = this.metabolics.get(key) || {};
    const updated = {
      ...existing,
      ...data,
      calories_consumed_kcal: data.caloriesConsumedKcal ?? data.calories_consumed_kcal ?? existing.calories_consumed_kcal ?? 0,
      water_intake_ml: data.waterIntakeMl ?? data.water_intake_ml ?? existing.water_intake_ml ?? 0,
      active_burn_kcal: data.activeBurnKcal ?? data.active_burn_kcal ?? existing.active_burn_kcal ?? 0,
      bmr_kcal: data.bmrKcal ?? data.bmr_kcal ?? existing.bmr_kcal ?? 1650,
      total_tdee_kcal: data.totalTdeeKcal ?? data.total_tdee_kcal ?? existing.total_tdee_kcal ?? 2150,
      target_active_burn_kcal: data.targetActiveBurnKcal ?? data.target_active_burn_kcal ?? existing.target_active_burn_kcal ?? 500,
      meals_logged: data.mealsLogged ?? data.meals_logged ?? existing.meals_logged ?? [],
      anomalies_occurred: data.anomaliesOccurred ?? data.anomalies_occurred ?? existing.anomalies_occurred ?? false,
    };
    this.metabolics.set(key, updated);
    return updated;
  }

  async getMetabolicLog(patientId, logDate) {
    return this.metabolics.get(`${patientId}_${logDate}`) || null;
  }
}

let createdNotifications = [];
let deliveries = [];
const mockNotifRepo = {
  createNotification: async (payload) => {
    const id = `notif-${createdNotifications.length + 1}`;
    const record = {
      id,
      ...payload,
      member_id: payload.memberId,
      action_label: payload.actionLabel ?? payload.action_label ?? null,
      scheduled_at: payload.scheduledAt ?? payload.scheduled_at ?? null,
      status: payload.scheduledAt ? 'scheduled' : 'sent',
      created_at: new Date().toISOString(),
    };
    createdNotifications.push(record);
    return record;
  },
  getById: async (id) => createdNotifications.find((n) => n.id === id) || null,
  getPreferenceForCategory: async () => null,
  getDailyCount: async () => 1,
  incrementDailyCount: async () => {},
  getOptimalSendHours: async () => [],
  getActiveTokens: async () => [
    { id: 'dt-1', platform: 'ios', token: 'token-ios-1234567890' },
    { id: 'dt-2', platform: 'android', token: 'token-android-1234567890' },
  ],
  markEnqueued: async (id) => createdNotifications.find((n) => n.id === id),
  markSent: async (id) => createdNotifications.find((n) => n.id === id),
  markFailed: async (id) => createdNotifications.find((n) => n.id === id),
  suppress: async (id) => createdNotifications.find((n) => n.id === id),
  createDelivery: async (delivery) => {
    deliveries.push(delivery);
    return delivery;
  },
  logEngagement: async () => {},
  markEngaged: async () => {},
};

async function runTestSuite() {
  console.log('='.repeat(75));
  console.log('  ADVANCED AI HEALTH NOTIFICATION & MEDICATION VERIFICATION TEST SUITE');
  console.log('='.repeat(75));

  const memberId = 'member-patient-001';
  const rules = new NotificationRulesService({ notificationRepo: mockNotifRepo });
  const push = new NotificationPushService({ notificationRepo: mockNotifRepo });
  const notifDispatch = new NotificationDispatchService({
    notificationRulesService: rules,
    notificationPushService: push,
    notificationRepo: mockNotifRepo,
  });
  const notifService = new NotificationService({
    notificationRepo: mockNotifRepo,
    dispatchService: notifDispatch,
    pushService: push,
  });

  const medRepo = new MockMedicationRepo();
  const medScheduleService = new MedicationScheduleService({
    medicationRepo: medRepo,
    notificationService: notifService,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DOMAIN 1: PRESCRIBED MEDICATION REGIMEN & PERSISTENT ESCALATION LOOP
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n💊 DOMAIN 1: PRESCRIBED MEDICATION REGIMEN & ESCALATION LOOP');

  // Test 1: Add manual medication (twice daily) -> must start at 08:00 AM
  console.log('\n[TEST 1] Add Manual Medication with 2x Daily Schedule (Starts at 8:00 AM)');
  const schedule = await medScheduleService.addManualMedication(memberId, {
    medicationName: 'Metformin',
    dosage: '500mg',
    frequency: 'twice_daily',
    withFood: true,
  });
  console.log(`  Medication: ${schedule.medicationName} ${schedule.dosage}`);
  console.log(`  Scheduled Daily Times: ${JSON.stringify(schedule.scheduledTimes)}`);
  if (schedule.scheduledTimes[0] === '08:00:00' && schedule.scheduledTimes[1] === '20:00:00') {
    console.log('  Result: ✅ PASS: Standard morning chronotherapy correctly starts at 08:00 AM');
  } else {
    throw new Error('Test 1 failed: scheduledTimes did not start at 08:00 AM');
  }

  // Test 2: T+0 Primary Scheduled Reminder at 08:00 AM
  console.log('\n[TEST 2] T+0 Primary Scheduled Notification at 08:00 AM');
  const t0Date = new Date();
  t0Date.setHours(8, 2, 0, 0); // 08:02 AM -> 2 mins past 08:00
  const t0Results = await medScheduleService.evaluateAndDispatchDoseReminders(memberId, t0Date);
  console.log(`  Dispatched: "${t0Results[0]?.notification?.notification?.title || 'Notification'}"`);
  console.log(`  Escalation Stage: ${t0Results[0]?.escalationStage} (T+0 primary reminder)`);
  if (t0Results.length === 1 && t0Results[0].escalationStage === 0) {
    console.log('  Result: ✅ PASS: Primary dose prompt delivered on time');
  } else {
    throw new Error('Test 2 failed');
  }

  // Test 3: T+15m Gentle Escalation Reminder at 08:16 AM
  console.log('\n[TEST 3] T+15m Unacknowledged Escalation Reminder (08:16 AM)');
  const t15Date = new Date();
  t15Date.setHours(8, 16, 0, 0);
  const t15Results = await medScheduleService.evaluateAndDispatchDoseReminders(memberId, t15Date);
  console.log(`  Escalation Title: "${t15Results[0]?.notification?.notification?.title}"`);
  console.log(`  Escalation Stage: ${t15Results[0]?.escalationStage}`);
  if (t15Results[0]?.escalationStage === 1) {
    console.log('  Result: ✅ PASS: T+15m reminder active');
  } else {
    throw new Error('Test 3 failed: T+15m escalation not triggered');
  }

  // Test 4: T+30m Clinical Overdue Escalation at 08:35 AM
  console.log('\n[TEST 4] T+30m Clinical Overdue Escalation (08:35 AM)');
  const t30Date = new Date();
  t30Date.setHours(8, 35, 0, 0);
  const t30Results = await medScheduleService.evaluateAndDispatchDoseReminders(memberId, t30Date);
  console.log(`  Escalation Title: "${t30Results[0]?.notification?.notification?.title}"`);
  console.log(`  Escalation Stage: ${t30Results[0]?.escalationStage}`);
  if (t30Results[0]?.escalationStage === 2) {
    console.log('  Result: ✅ PASS: T+30m clinical escalation triggered');
  } else {
    throw new Error('Test 4 failed: T+30m escalation not triggered');
  }

  // Test 5: T+60m Critical Adherence Escalation at 09:05 AM
  console.log('\n[TEST 5] T+60m Critical Adherence Alert (09:05 AM)');
  const t60Date = new Date();
  t60Date.setHours(9, 5, 0, 0);
  const t60Results = await medScheduleService.evaluateAndDispatchDoseReminders(memberId, t60Date);
  console.log(`  Critical Alert: "${t60Results[0]?.notification?.notification?.title}"`);
  console.log(`  Escalation Stage: ${t60Results[0]?.escalationStage}`);
  if (t60Results[0]?.escalationStage === 3) {
    console.log('  Result: ✅ PASS: T+60m critical adherence warning triggered');
  } else {
    throw new Error('Test 5 failed: T+60m escalation not triggered');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOMAIN 1: MULTIMODAL OCR POST-TAKE VERIFICATION & MISMATCH WARNING
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔍 DOMAIN 1: MULTIMODAL OCR POST-TAKE VERIFICATION');

  const mockGeminiClient = {
    apiKey: 'mock-key',
    async transcribeImage(buf) {
      return buf.toString('utf8');
    },
  };

  const ocrService = new MedicationOcrService({
    geminiClient: mockGeminiClient,
    medicationScheduleService: medScheduleService,
    confidenceThreshold: 85.0,
  });

  // Test 6: Correct Medication Verification (Match Score >= 85%)
  console.log('\n[TEST 6] OCR Scan: Correct Medication Blister (Metformin 500mg)');
  const validBlister = Buffer.from('Rx Metformin Hydrochloride Tablets USP 500 mg - Batch #B9201 Exp 12/2028');
  const validVerification = await ocrService.verifyMedicationScan(memberId, {
    imageBuffer: validBlister,
    expectedMedication: 'Metformin',
    expectedDosage: '500mg',
    scheduleId: schedule.id,
    intakeLogId: t0Results[0].intakeId,
  });
  console.log(`  Extracted Dose: ${validVerification.extractedDose}`);
  console.log(`  Confidence Match: ${validVerification.confidence}%`);
  console.log(`  Verified: ${validVerification.verified}`);
  console.log(`  Feedback: ${validVerification.feedback}`);
  if (validVerification.verified && validVerification.confidence >= 85) {
    console.log('  Result: ✅ PASS: Dose verified with high confidence, exact adherence logged');
  } else {
    throw new Error('Test 6 failed: OCR verification failed for matching medication');
  }

  // Test 7: Mismatch Medication Warning (Different drug scanned)
  console.log('\n[TEST 7] OCR Scan: Potential Medication Mismatch Warning (Atorvastatin vs Metformin)');
  const wrongBlister = Buffer.from('Rx Atorvastatin Calcium Tablets 20 mg - Batch #A4021');
  const mismatchVerification = await ocrService.verifyMedicationScan(memberId, {
    imageBuffer: wrongBlister,
    expectedMedication: 'Metformin',
    expectedDosage: '500mg',
    scheduleId: schedule.id,
  });
  console.log(`  Confidence Match: ${mismatchVerification.confidence}%`);
  console.log(`  Verified: ${mismatchVerification.verified}`);
  console.log(`  Warning: ${mismatchVerification.mismatchWarning}`);
  if (!mismatchVerification.verified && mismatchVerification.confidence < 85 && mismatchVerification.mismatchWarning) {
    console.log('  Result: ✅ PASS: Potential mismatch detected and safety warning issued');
  } else {
    throw new Error('Test 7 failed: Mismatch was not properly flagged');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOMAIN 2: WEARABLE TELEMETRY ANOMALY & LANGCHAIN LLM EMERGENCY TRIAGE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🚨 DOMAIN 2: WEARABLE ANOMALIES & LANGCHAIN LLM EMERGENCY TRIAGE');

  const telemetryAnomalyService = new TelemetryAnomalyService({
    notificationService: notifService,
    medicationRepo: medRepo,
  });

  // Test 8: Blood Pressure Spike (Hypertensive Crisis: 185/125 mmHg)
  console.log('\n[TEST 8] Acute Hypertensive Crisis (185/125 mmHg) -> LLM Triage & 0s Bypass');
  const bpResult = await telemetryAnomalyService.processTelemetry(memberId, {
    metricType: 'bp',
    value: 185,
    extra: { diastolic: 125 },
  });
  console.log(`  Urgency Level: ${bpResult.triage.urgency}`);
  console.log(`  Clinical Mechanism: ${bpResult.triage.clinicalMechanism}`);
  console.log(`  Immediate Action Protocol: ${bpResult.triage.actionProtocol}`);
  console.log(`  Notification Title: "${bpResult.triage.notificationTitle}"`);
  console.log(`  Call Emergency CTA: ${bpResult.triage.callEmergency ? 'YES (112/911)' : 'NO'}`);
  if (bpResult.isAnomaly && bpResult.triage.urgency === 'CRITICAL_EMERGENCY') {
    console.log('  Result: ✅ PASS: Tier-1 0s bypass emergency alert dispatched with clinical protocol');
  } else {
    throw new Error('Test 8 failed: BP spike anomaly not handled correctly');
  }

  // Test 9: Acute Hypoglycemia (<70 mg/dL e.g. 58 mg/dL)
  console.log('\n[TEST 9] Acute Hypoglycemia Telemetry (58 mg/dL) -> Rule of 15 Protocol');
  const hypoResult = await telemetryAnomalyService.processTelemetry(memberId, {
    metricType: 'glucose',
    value: 58,
  });
  console.log(`  Urgency Level: ${hypoResult.triage.urgency}`);
  console.log(`  Action Protocol: ${hypoResult.triage.actionProtocol}`);
  console.log(`  CTA Button: ${hypoResult.triage.ctaLabel}`);
  if (hypoResult.isAnomaly && hypoResult.triage.actionProtocol.includes('Rule of 15')) {
    console.log('  Result: ✅ PASS: Fast carbohydrates stabilization protocol issued');
  } else {
    throw new Error('Test 9 failed: Hypoglycemia triage failed');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOMAIN 3: CIRCADIAN LIFESTYLE, CALORIC BUDGETING & DYNAMIC EXERCISE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🏃 DOMAIN 3: CIRCADIAN LIFESTYLE, CALORIE PACING & ADAPTIVE EXERCISE');

  const metabolicPacingService = new MetabolicPacingService({
    medicationRepo: medRepo,
    notificationService: notifService,
  });

  // Test 10: Mifflin-St Jeor BMR Calculation
  console.log('\n[TEST 10] Mifflin-St Jeor Formula Verification');
  // Male: 75kg, 178cm, 35yo -> 10*75 + 6.25*178 - 5*35 + 5 = 750 + 1112.5 - 175 + 5 = 1692.5 ~ 1693 kcal
  const maleBmr = MetabolicPacingService.calculateBMR({ weightKg: 75, heightCm: 178, age: 35, gender: 'male' });
  // Female: 62kg, 165cm, 32yo -> 10*62 + 6.25*165 - 5*32 - 161 = 620 + 1031.25 - 160 - 161 = 1330.25 ~ 1330 kcal
  const femaleBmr = MetabolicPacingService.calculateBMR({ weightKg: 62, heightCm: 165, age: 32, gender: 'female' });
  console.log(`  Calculated Male BMR: ${maleBmr} kcal (Formula standard: ~1693 kcal)`);
  console.log(`  Calculated Female BMR: ${femaleBmr} kcal (Formula standard: ~1330 kcal)`);
  if (maleBmr === 1693 && femaleBmr === 1330) {
    console.log('  Result: ✅ PASS: Mifflin-St Jeor metabolic baseline exact');
  } else {
    throw new Error('Test 10 failed: BMR math incorrect');
  }

  // Test 11: Dynamic Exercise Effort Translation
  console.log('\n[TEST 11] Exercise Calorie Burn Effort Translation (Remaining 220 kcal)');
  const effort = MetabolicPacingService.calculateExerciseEffort(220);
  console.log(`  Remaining Kcal: ${effort.remainingKcal}`);
  effort.modalities.forEach((m) => {
    console.log(`    - ${m.activity}: ${m.durationMinutes} mins`);
  });
  if (effort.modalities.length === 3 && effort.modalities[0].durationMinutes === 40) {
    console.log('  Result: ✅ PASS: Effort correctly translated into walking, cycling, and aerobics');
  } else {
    throw new Error('Test 11 failed: Exercise effort translation mismatch');
  }

  // Test 12: Adaptive Biometric Safety Throttling (Anomaly Happened Today)
  console.log('\n[TEST 12] Adaptive Exercise Safety Throttling (High exertion suppressed due to BP anomaly)');
  const summary = await metabolicPacingService.getDailyMetabolicSummary(memberId);
  console.log(`  Anomalies Occurred Today: ${summary.anomaliesOccurred}`);
  console.log(`  Exercise Guidance: "${summary.exercisePlan.message}"`);
  console.log(`  Suppressed Due to Anomaly: ${summary.exercisePlan.suppressedDueToAnomaly}`);
  if (summary.anomaliesOccurred && summary.exercisePlan.suppressedDueToAnomaly) {
    console.log('  Result: ✅ PASS: High-intensity workouts successfully suppressed for patient safety');
  } else {
    throw new Error('Test 12 failed: Safety throttling did not activate');
  }

  // Test 13: Circadian Meal Notifications (Breakfast, Lunch, Dinner Windows)
  console.log('\n[TEST 13] Circadian Meal Timing & Portion Reminders');
  const breakfastNotif = await metabolicPacingService.dispatchCircadianMealNotification(memberId, { hour: 8 });
  const lunchNotif = await metabolicPacingService.dispatchCircadianMealNotification(memberId, { hour: 13 });
  const dinnerNotif = await metabolicPacingService.dispatchCircadianMealNotification(memberId, { hour: 19 });

  console.log(`  Breakfast: "${breakfastNotif?.notification?.title}"`);
  console.log(`  Lunch: "${lunchNotif?.notification?.title}"`);
  console.log(`  Dinner: "${dinnerNotif?.notification?.title}"`);
  if (breakfastNotif && lunchNotif && dinnerNotif) {
    console.log('  Result: ✅ PASS: All 3 circadian meal windows successfully dispatched');
  } else {
    throw new Error('Test 13 failed: Meal notifications not generated');
  }

  // Test 14: Meal & Hydration Logging
  console.log('\n[TEST 14] Meal and Water Logging Integration');
  await metabolicPacingService.logMeal(memberId, { mealType: 'breakfast', calories: 420 });
  await metabolicPacingService.logWater(memberId, { volumeMl: 350 });
  const updatedSummary = await metabolicPacingService.getDailyMetabolicSummary(memberId);
  console.log(`  Calories Consumed: ${updatedSummary.caloriesConsumedKcal} kcal`);
  console.log(`  Water Intake: ${updatedSummary.waterIntakeMl} ml`);
  if (updatedSummary.caloriesConsumedKcal === 420 && updatedSummary.waterIntakeMl === 350) {
    console.log('  Result: ✅ PASS: Nutritional and hydration intake logged accurately');
  } else {
    throw new Error('Test 14 failed: Logging failed');
  }

  // Test 15: Bedtime Sleep Guard Past 21:30
  console.log('\n[TEST 15] Bedtime Sleep Guard Window Check');
  const dayTime = new Date('2026-11-06T15:00:00');
  const nightTime = new Date('2026-11-06T22:15:00');
  const dayActive = MetabolicPacingService.isSleepGuardActive(dayTime);
  const nightActive = MetabolicPacingService.isSleepGuardActive(nightTime);
  console.log(`  15:00 Sleep Guard Active: ${dayActive} (Expected: false)`);
  console.log(`  22:15 Sleep Guard Active: ${nightActive} (Expected: true)`);
  if (!dayActive && nightActive) {
    console.log('  Result: ✅ PASS: Bedtime sleep guard (21:30 - 07:00) strictly protects nocturnal rest');
  } else {
    throw new Error('Test 15 failed: Sleep guard window evaluation incorrect');
  }

  console.log('\n' + '='.repeat(75));
  console.log('  ALL 15 ADVANCED NOTIFICATION, MEDICATION & TELEMETRY TESTS PASSED! 🎉');
  console.log('='.repeat(75));
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Error:', err);
  process.exit(1);
});
