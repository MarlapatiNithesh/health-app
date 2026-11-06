import { logger } from '../logger.js';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_STREAMS } from './notification-service.js';

export class MetabolicPacingService {
  constructor({
    medicationRepo,
    notificationService = null,
    clinicalRepo = null,
    wearableRepo = null,
  } = {}) {
    this.medicationRepo = medicationRepo;
    this.notificationService = notificationService;
    this.clinicalRepo = clinicalRepo;
    this.wearableRepo = wearableRepo;
  }

  /**
   * Calculate BMR using the Mifflin-St Jeor formula.
   */
  static calculateBMR({ weightKg = 70, heightCm = 175, age = 35, gender = 'male' } = {}) {
    const isFemale = (gender || '').toLowerCase().startsWith('f');
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return Math.round(isFemale ? base - 161 : base + 5);
  }

  /**
   * Convert remaining calories to burn into actionable exercise modalities.
   */
  static calculateExerciseEffort(remainingKcal) {
    if (remainingKcal <= 0) {
      return {
        targetMet: true,
        remainingKcal: 0,
        message: '🎉 Daily active burn target achieved! Focus on gentle cool-down or hydration.',
        modalities: [],
      };
    }

    // Typical MET caloric burns per minute for ~70kg individual:
    // Walking (3.5 mph / 5.6 km/h) ~ 5.5 kcal/min
    // Cycling (light 10-12 mph) ~ 8.0 kcal/min
    // Jogging / Aerobic (5 mph) ~ 10.0 kcal/min
    const walkMins = Math.round(remainingKcal / 5.5);
    const cycleMins = Math.round(remainingKcal / 8.0);
    const jogMins = Math.round(remainingKcal / 10.0);

    return {
      targetMet: false,
      remainingKcal,
      message: `Burn remaining ${remainingKcal} kcal to reach your goal:`,
      modalities: [
        { activity: 'Brisk Walking', durationMinutes: walkMins, estimatedKcal: remainingKcal },
        { activity: 'Light Cycling', durationMinutes: cycleMins, estimatedKcal: remainingKcal },
        { activity: 'Jogging / Aerobics', durationMinutes: jogMins, estimatedKcal: remainingKcal },
      ],
    };
  }

  /**
   * Retrieve or initialize today's metabolic summary.
   */
  async getDailyMetabolicSummary(patientId, dateStr = new Date().toISOString().slice(0, 10)) {
    let patient = null;
    if (this.clinicalRepo?.findPatientById) {
      patient = await this.clinicalRepo.findPatientById(patientId).catch(() => null);
    }

    // Determine demographic metrics
    const age = patient?.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : 35;
    const gender = patient?.gender || 'male';
    const weightKg = patient?.lifestyle?.weightKg || 72;
    const heightCm = patient?.lifestyle?.heightCm || 175;

    const bmr = MetabolicPacingService.calculateBMR({ weightKg, heightCm, age, gender });

    // Check existing daily log
    let log = await this.medicationRepo?.getMetabolicLog(patientId, dateStr);

    // Check if any telemetry anomalies occurred today
    const anomaliesToday = await this.medicationRepo?.getTodayAnomalies(patientId, dateStr).catch(() => []);
    const hasAnomaly = (anomaliesToday && anomaliesToday.length > 0) || Boolean(log?.anomalies_occurred || log?.anomaliesOccurred);

    const activeBurn = log?.active_burn_kcal ?? log?.activeBurnKcal ?? 0;
    const targetBurn = log?.target_active_burn_kcal ?? log?.targetActiveBurnKcal ?? 500;
    const caloriesConsumed = log?.calories_consumed_kcal ?? log?.caloriesConsumedKcal ?? 0;
    const waterIntake = log?.water_intake_ml ?? log?.waterIntakeMl ?? 0;
    const hydrationTarget = log?.hydration_target_ml ?? log?.hydrationTargetMl ?? 2500;
    const mealsLogged = log?.meals_logged ?? log?.mealsLogged ?? [];
    const tdee = bmr + activeBurn;
    const remainingBurn = Math.max(0, targetBurn - activeBurn);

    const exercisePlan = hasAnomaly
      ? {
          targetMet: false,
          remainingKcal: remainingBurn,
          suppressedDueToAnomaly: true,
          message: '⚠️ Active exertion paused today due to earlier abnormal biometric reading. Focus on gentle 10-minute stretching, steady hydration, and restorative rest.',
          modalities: [
            { activity: 'Restorative Breathing & Stretching', durationMinutes: 10, estimatedKcal: 25 },
          ],
        }
      : MetabolicPacingService.calculateExerciseEffort(remainingBurn);

    const summary = {
      date: dateStr,
      patientId,
      bmrKcal: bmr,
      activeBurnKcal: activeBurn,
      totalTdeeKcal: tdee,
      targetActiveBurnKcal: targetBurn,
      remainingBurnKcal: remainingBurn,
      caloriesConsumedKcal: caloriesConsumed,
      netCalories: caloriesConsumed - tdee,
      waterIntakeMl: waterIntake,
      hydrationTargetMl: hydrationTarget,
      mealsLogged,
      anomaliesOccurred: hasAnomaly,
      exercisePlan,
      recommendedMealBreakdown: {
        breakfastTargetKcal: Math.round(tdee * 0.28),
        lunchTargetKcal: Math.round(tdee * 0.38),
        dinnerTargetKcal: Math.round(tdee * 0.30),
      },
    };

    // Save/update log
    if (this.medicationRepo?.upsertMetabolicLog) {
      await this.medicationRepo.upsertMetabolicLog({
        patientId,
        logDate: dateStr,
        bmrKcal: bmr,
        activeBurnKcal: activeBurn,
        totalTdeeKcal: tdee,
        caloriesConsumedKcal: log?.calories_consumed_kcal ?? 0,
        targetActiveBurnKcal: targetBurn,
        remainingBurnKcal: remainingBurn,
        waterIntakeMl: log?.water_intake_ml ?? 0,
        hydrationTargetMl: log?.hydration_target_ml ?? 2500,
        mealsLogged: log?.meals_logged || [],
        anomaliesOccurred: hasAnomaly,
      }).catch(() => {});
    }

    return summary;
  }

  /**
   * Log meal calories and timing.
   */
  async logMeal(patientId, { mealType = 'lunch', calories = 450, description = 'Meal', time = new Date() }) {
    const dateStr = time instanceof Date ? time.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const existing = await this.medicationRepo?.getMetabolicLog(patientId, dateStr);

    const currentMeals = Array.isArray(existing?.meals_logged)
      ? existing.meals_logged
      : (Array.isArray(existing?.mealsLogged) ? existing.mealsLogged : []);
    const newMeal = {
      mealType,
      calories: parseInt(calories, 10) || 0,
      description,
      time: time instanceof Date ? time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '12:00',
    };
    currentMeals.push(newMeal);

    const totalConsumed = currentMeals.reduce((acc, m) => acc + (m.calories || 0), 0);

    const bmr = existing?.bmr_kcal ?? existing?.bmrKcal ?? 1650;
    const activeBurn = existing?.active_burn_kcal ?? existing?.activeBurnKcal ?? 0;
    const targetBurn = existing?.target_active_burn_kcal ?? existing?.targetActiveBurnKcal ?? 500;
    const tdee = bmr + activeBurn;

    return this.medicationRepo.upsertMetabolicLog({
      patientId,
      logDate: dateStr,
      bmrKcal: bmr,
      activeBurnKcal: activeBurn,
      totalTdeeKcal: tdee,
      caloriesConsumedKcal: totalConsumed,
      targetActiveBurnKcal: targetBurn,
      remainingBurnKcal: Math.max(0, targetBurn - activeBurn),
      waterIntakeMl: existing?.water_intake_ml ?? existing?.waterIntakeMl ?? 0,
      hydrationTargetMl: existing?.hydration_target_ml ?? existing?.hydrationTargetMl ?? 2500,
      mealsLogged: currentMeals,
      anomaliesOccurred: existing?.anomalies_occurred ?? existing?.anomaliesOccurred ?? false,
    });
  }

  /**
   * Log water intake volume (ml).
   */
  async logWater(patientId, { volumeMl = 250, time = new Date() }) {
    const dateStr = time instanceof Date ? time.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const existing = await this.medicationRepo?.getMetabolicLog(patientId, dateStr);

    const currentWater = (existing?.water_intake_ml ?? existing?.waterIntakeMl ?? 0) + (parseInt(volumeMl, 10) || 0);
    const bmr = existing?.bmr_kcal ?? existing?.bmrKcal ?? 1650;
    const activeBurn = existing?.active_burn_kcal ?? existing?.activeBurnKcal ?? 0;
    const tdee = bmr + activeBurn;

    return this.medicationRepo.upsertMetabolicLog({
      patientId,
      logDate: dateStr,
      bmrKcal: bmr,
      activeBurnKcal: activeBurn,
      totalTdeeKcal: tdee,
      caloriesConsumedKcal: existing?.calories_consumed_kcal ?? existing?.caloriesConsumedKcal ?? 0,
      targetActiveBurnKcal: existing?.target_active_burn_kcal ?? existing?.targetActiveBurnKcal ?? 500,
      remainingBurnKcal: existing?.remaining_burn_kcal ?? existing?.remainingBurnKcal ?? 500,
      waterIntakeMl: currentWater,
      hydrationTargetMl: existing?.hydration_target_ml ?? existing?.hydrationTargetMl ?? 2500,
      mealsLogged: existing?.meals_logged ?? existing?.mealsLogged ?? [],
      anomaliesOccurred: existing?.anomalies_occurred ?? existing?.anomaliesOccurred ?? false,
    });
  }

  /**
   * Update active calories burned from wearable telemetry.
   */
  async updateWearableActiveBurn(patientId, activeBurnKcal) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const existing = await this.medicationRepo?.getMetabolicLog(patientId, dateStr);

    const bmr = existing?.bmr_kcal || 1650;
    const burn = parseInt(activeBurnKcal, 10) || 0;
    const tdee = bmr + burn;
    const targetBurn = existing?.target_active_burn_kcal || 500;
    const remaining = Math.max(0, targetBurn - burn);

    return this.medicationRepo.upsertMetabolicLog({
      patientId,
      logDate: dateStr,
      bmrKcal: bmr,
      activeBurnKcal: burn,
      totalTdeeKcal: tdee,
      caloriesConsumedKcal: existing?.calories_consumed_kcal || 0,
      targetActiveBurnKcal: targetBurn,
      remainingBurnKcal: remaining,
      waterIntakeMl: existing?.water_intake_ml || 0,
      hydrationTargetMl: existing?.hydration_target_ml || 2500,
      mealsLogged: existing?.meals_logged || [],
      anomaliesOccurred: existing?.anomalies_occurred || false,
    });
  }

  /**
   * Dispatch circadian meal notification based on current hour.
   * Breakfast: 07:30 - 09:00
   * Lunch: 12:30 - 14:00
   * Dinner: 19:00 - 20:30
   */
  async dispatchCircadianMealNotification(patientId, { hour = new Date().getHours() } = {}) {
    if (!this.notificationService?.dispatch) return null;

    const summary = await this.getDailyMetabolicSummary(patientId);
    let title = '';
    let body = '';
    let mealType = '';
    let targetKcal = 0;

    if (hour >= 7 && hour < 10) {
      mealType = 'breakfast';
      targetKcal = summary.recommendedMealBreakdown.breakfastTargetKcal;
      title = '🍳 Morning Metabolic Ignition: Balanced Breakfast';
      body = `Target ~${targetKcal} kcal: Prioritize 25-30g clean protein with low-GI complex carbs to stabilize morning blood glucose and energy.`;
    } else if (hour >= 12 && hour < 15) {
      mealType = 'lunch';
      targetKcal = summary.recommendedMealBreakdown.lunchTargetKcal;
      title = '🥗 Midday Fueling & Steady Focus';
      body = `Target ~${targetKcal} kcal: Balanced portion of lean protein, dietary fiber, and leafy greens to prevent afternoon post-prandial slump.`;
    } else if (hour >= 18 && hour < 21) {
      mealType = 'dinner';
      targetKcal = summary.recommendedMealBreakdown.dinnerTargetKcal;
      title = '🍲 Evening Restorative Dinner';
      body = `Target ~${targetKcal} kcal: Nourishing light meal without heavy refined carbs to support healthy nocturnal glucose and REM sleep.`;
    } else {
      return null;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    return this.notificationService.dispatch({
      memberId: patientId,
      category: NOTIFICATION_CATEGORIES.NUTRITION_REMINDER,
      priority: 'normal',
      title,
      body,
      actionLabel: `LOG ${mealType.toUpperCase()} CALORIES`,
      actionUrl: `medibot://meals/log?type=${mealType}`,
      deepLink: `medibot://meals/log?type=${mealType}`,
      sourceType: 'circadian_metabolic_engine',
      sourceRefId: `${mealType}_${dateStr}`,
      idempotencyKey: `circadian_meal_${mealType}_${patientId}_${dateStr}`,
      metadata: {
        tier: 2,
        stream: NOTIFICATION_STREAMS.STREAM_2,
        mealType,
        targetKcal,
        bmrKcal: summary.bmrKcal,
        totalTdeeKcal: summary.totalTdeeKcal,
      },
    });
  }

  /**
   * Dispatch dynamic exercise effort reminder.
   * Suppresses high intensity exertion if anomalies occurred today.
   */
  async dispatchExerciseEffortReminder(patientId) {
    if (!this.notificationService?.dispatch) return null;

    const summary = await this.getDailyMetabolicSummary(patientId);
    const dateStr = new Date().toISOString().slice(0, 10);

    if (summary.anomaliesOccurred) {
      return this.notificationService.dispatch({
        memberId: patientId,
        category: NOTIFICATION_CATEGORIES.CIRCADIAN_GOAL,
        priority: 'normal',
        title: '🧘 Rest & Gentle Recovery Today',
        body: 'Active exertion is paused today due to earlier biometric anomalies. Take a relaxing 10-minute stretch and focus on restorative hydration.',
        actionLabel: 'START 10-MIN STRETCH',
        actionUrl: 'medibot://exercise/recovery',
        deepLink: 'medibot://exercise/recovery',
        sourceType: 'adaptive_exercise_pacer',
        sourceRefId: `rest_${dateStr}`,
        idempotencyKey: `exercise_rest_${patientId}_${dateStr}`,
        metadata: {
          tier: 2,
          stream: NOTIFICATION_STREAMS.STREAM_2,
          suppressedDueToAnomaly: true,
        },
      });
    }

    const plan = summary.exercisePlan;
    if (plan.targetMet) {
      return null;
    }

    const walkOption = plan.modalities.find((m) => m.activity === 'Brisk Walking');
    const title = `🏃 Remaining Daily Burn: ${plan.remainingKcal} kcal`;
    const body = `Hit your 500 kcal goal with ${walkOption ? `${walkOption.durationMinutes} mins brisk walk` : 'light activity'}. Stay active, stay healthy!`;

    return this.notificationService.dispatch({
      memberId: patientId,
      category: NOTIFICATION_CATEGORIES.CIRCADIAN_GOAL,
      priority: 'normal',
      title,
      body,
      actionLabel: 'TRACK WORKOUT',
      actionUrl: 'medibot://exercise/track',
      deepLink: 'medibot://exercise/track',
      sourceType: 'adaptive_exercise_pacer',
      sourceRefId: `burn_${dateStr}`,
      idempotencyKey: `exercise_burn_${patientId}_${dateStr}`,
      metadata: {
        tier: 2,
        stream: NOTIFICATION_STREAMS.STREAM_2,
        remainingKcal: plan.remainingKcal,
        modalities: plan.modalities,
      },
    });
  }

  /**
   * Sleep guard checker: verifies whether current time is in sleep guard (21:30 - 07:00).
   */
  static isSleepGuardActive(date = new Date()) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeVal = hours * 60 + minutes;

    // 21:30 = 21 * 60 + 30 = 1290 mins
    // 07:00 = 7 * 60 = 420 mins
    return timeVal >= 1290 || timeVal < 420;
  }
}
