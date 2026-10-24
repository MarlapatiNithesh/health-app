import { logger } from '../logger.js';

export const NOTIFICATION_CATEGORIES = {
  HEALTH_ALERT: 'health_alert',
  VITALS_ANOMALY: 'vitals_anomaly',
  MEDICATION_REMINDER: 'medication_reminder',
  MEDIBOT_PING: 'medibot_ping',
  LAB_RESULT: 'lab_result',
  WELLNESS_TIP: 'wellness_tip',
  GOAL_ACHIEVEMENT: 'goal_achievement',
  INACTIVITY: 'inactivity',
  HYDRATION_REMINDER: 'hydration_reminder',
  NUTRITION_REMINDER: 'nutrition_reminder',
  APPOINTMENT: 'appointment',
  DOCUMENT_READY: 'document_ready',
  SAFETY_ALERT: 'safety_alert',
};

const DEFAULT_PREF = {
  is_enabled: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
  quiet_hours_tz: 'UTC',
  smart_send: true,
  max_per_day: 5,
};

const BYPASS_ALL_RULES = new Set([
  NOTIFICATION_CATEGORIES.SAFETY_ALERT,
  NOTIFICATION_CATEGORIES.HEALTH_ALERT,
]);

const BYPASS_SMART_SEND = new Set([
  NOTIFICATION_CATEGORIES.SAFETY_ALERT,
  NOTIFICATION_CATEGORIES.HEALTH_ALERT,
  NOTIFICATION_CATEGORIES.VITALS_ANOMALY,
  NOTIFICATION_CATEGORIES.LAB_RESULT,
  NOTIFICATION_CATEGORIES.MEDICATION_REMINDER,
]);

const HR_MESSAGES = (hr) => ({
  high: {
    title: `High Heart Rate Detected — ${hr} bpm`,
    body: 'Your heart rate is above 120 bpm at rest. Sit down, breathe slowly, and stay hydrated. If this persists, contact your doctor.',
  },
  low: {
    title: `Low Heart Rate Detected — ${hr} bpm`,
    body: 'Your heart rate dropped below 45 bpm. If you feel dizzy, short of breath, or faint, seek medical attention immediately.',
  },
});

const SPO2_MESSAGES = (spo2) => ({
  title: `Low Blood Oxygen — ${spo2}%`,
  body: spo2 < 90
    ? 'Your SpO2 is critically low. Move to fresh air and call emergency services if you feel breathless.'
    : 'Your blood oxygen is slightly below normal. Rest, breathe deeply, and recheck in 10 minutes.',
});

const GLUCOSE_MESSAGES = (val) => ({
  high: {
    title: `High Blood Glucose Alert — ${val} mg/dL`,
    body: 'Your blood sugar reading is elevated. Check your insulin or medication plan and drink water.',
  },
  low: {
    title: `Low Blood Glucose Alert — ${val} mg/dL`,
    body: 'Your blood sugar is low. Consume 15-20g of fast-acting carbohydrates immediately and recheck in 15 minutes.',
  },
});

const BP_MESSAGES = (val) => ({
  title: `Elevated Blood Pressure — ${val} mmHg`,
  body: 'Your blood pressure reading is higher than your target range. Take a moment to rest and re-measure.',
});

/**
 * Unified Notification Service
 * Combines Rules Engine, Push Gateway & Adaptive Dispatch into one cohesive domain service.
 */
export class NotificationService {
  constructor({
    notificationRepo,
    fcmClient = null,
    apnsClient = null,
    queue = null,
    notificationRulesService = null,
    notificationPushService = null,
  } = {}) {
    this.repo = notificationRepo;
    this.fcm = fcmClient;
    this.apns = apnsClient;
    this.queue = queue;

    // Internal delegation references for modular compatibility
    this.rules = notificationRulesService || this;
    this.push = notificationPushService || this;
  }

  // ─────────────────────────────────────────────────────────────
  // 1. RULES & EVALUATION ENGINE
  // ─────────────────────────────────────────────────────────────

  async evaluate(notification) {
    const { memberId, category, priority = 'normal' } = notification;
    const bypassAll = BYPASS_ALL_RULES.has(category) || priority === 'critical';
    const bypassSend = BYPASS_SMART_SEND.has(category) || priority === 'high' || bypassAll;

    const rawPref = await this.repo.getPreferenceForCategory(memberId, category);
    const pref = { ...DEFAULT_PREF, ...rawPref };

    if (!pref.is_enabled && !bypassAll) {
      const created = await this.repo.createNotification({ ...notification, priority });
      if (created) await this.repo.suppress(created.id, 'category_disabled');
      return { notificationId: created?.id ?? null, decision: 'suppressed' };
    }

    if (!bypassAll) {
      const todayCount = await this.repo.getDailyCount(memberId, category);
      if (todayCount >= pref.max_per_day) {
        logger.debug(`[NotifRules] cap hit cat=${category} member=${memberId} count=${todayCount}`);
        const created = await this.repo.createNotification({ ...notification, priority });
        if (created) await this.repo.suppress(created.id, 'daily_cap_exceeded');
        return { notificationId: created?.id ?? null, decision: 'suppressed' };
      }
    }

    let scheduledAt = notification.scheduledAt ?? null;

    if (!bypassAll && !scheduledAt && pref.quiet_hours_start && pref.quiet_hours_end) {
      const deferred = this.#calcDeferredTime(pref);
      if (deferred) {
        scheduledAt = deferred;
        const created = await this.repo.createNotification({ ...notification, priority, scheduledAt });
        if (created) await this.repo.incrementDailyCount(memberId, category);
        return { notificationId: created?.id ?? null, decision: 'deferred' };
      }
    }

    if (!bypassSend && !scheduledAt && pref.smart_send) {
      const optimalHours = await this.repo.getOptimalSendHours(memberId);
      if (optimalHours.length > 0) {
        const optimal = this.#pickNextOptimalSlot(optimalHours, pref.quiet_hours_tz);
        if (optimal) scheduledAt = optimal;
      }
    }

    const created = await this.repo.createNotification({ ...notification, priority, scheduledAt });
    if (!created) {
      return { notificationId: null, decision: 'suppressed' };
    }

    await this.repo.incrementDailyCount(memberId, category);

    const decision = scheduledAt ? 'deferred' : 'allowed';
    logger.info(`[NotifRules] ${decision} id=${created.id} cat=${category} member=${memberId}`);
    return { notificationId: created.id, decision };
  }

  #calcDeferredTime(pref) {
    try {
      const tz = pref.quiet_hours_tz || 'UTC';
      const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
      const [startH, startM] = pref.quiet_hours_start.split(':').map(Number);
      const [endH, endM] = pref.quiet_hours_end.split(':').map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      const nowMin = nowLocal.getHours() * 60 + nowLocal.getMinutes();

      const inQuiet = startMin <= endMin
        ? nowMin >= startMin && nowMin < endMin
        : nowMin >= startMin || nowMin < endMin;

      if (!inQuiet) return null;

      const endDate = new Date(nowLocal);
      endDate.setHours(endH, endM, 0, 0);
      if (endDate <= nowLocal) endDate.setDate(endDate.getDate() + 1);
      return endDate.toISOString();
    } catch {
      return null;
    }
  }

  #pickNextOptimalSlot(hours, tz = 'UTC') {
    try {
      const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
      const nowMin = nowLocal.getHours() * 60 + nowLocal.getMinutes();

      for (const h of hours) {
        if (h * 60 > nowMin + 5) {
          const t = new Date(nowLocal);
          t.setHours(h, 0, 0, 0);
          return t.toISOString();
        }
      }

      const t = new Date(nowLocal);
      t.setDate(t.getDate() + 1);
      t.setHours(hours[0], 0, 0, 0);
      return t.toISOString();
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. PUSH DELIVERY GATEWAY
  // ─────────────────────────────────────────────────────────────

  async enqueue(notificationId) {
    if (this.queue) {
      await this.queue.add(
        'push_notification',
        { notificationId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
      logger.debug(`[PushSvc] Enqueued notificationId=${notificationId}`);
    } else {
      await this.sendById(notificationId);
    }
  }

  async sendById(notificationId) {
    const notif = await this.repo.getById(notificationId);
    if (!notif) {
      logger.warn(`[PushSvc] Notification not found id=${notificationId}`);
      return;
    }

    await this.repo.markEnqueued(notificationId);

    const tokens = await this.repo.getActiveTokens(notif.member_id);
    if (!tokens.length) {
      logger.info(`[PushSvc] No active tokens for member=${notif.member_id}, marking sent`);
      await this.repo.markSent(notificationId);
      return;
    }

    const deliveryPromises = tokens.map((tok) => this.#sendToToken(notif, tok));
    const results = await Promise.allSettled(deliveryPromises);

    const anySuccess = results.some((r) => r.status === 'fulfilled' && r.value?.success);
    if (anySuccess) {
      await this.repo.markSent(notificationId);
    } else {
      await this.repo.markFailed(notificationId, 'All token deliveries failed');
    }
  }

  async #sendToToken(notif, deviceToken) {
    const start = Date.now();
    try {
      let providerMsgId = null;

      if (deviceToken.platform === 'android' && this.fcm) {
        providerMsgId = await this.#sendFCM(notif, deviceToken.token);
      } else if (deviceToken.platform === 'ios' && this.apns) {
        providerMsgId = await this.#sendAPNs(notif, deviceToken.token);
      } else {
        providerMsgId = `sim_${Date.now()}`;
        logger.info(`[PushSvc][SIM] -> ${deviceToken.platform} token=${deviceToken.token.slice(0, 20)}... title="${notif.title}"`);
      }

      const latencyMs = Date.now() - start;
      await this.repo.createDelivery({
        notificationId: notif.id,
        deviceTokenId: deviceToken.id,
        provider: deviceToken.platform === 'ios' ? 'apns' : deviceToken.platform === 'android' ? 'fcm' : 'web_push',
        providerMsgId,
        status: 'sent',
        latencyMs,
      });

      return { success: true, providerMsgId };
    } catch (err) {
      const latencyMs = Date.now() - start;
      logger.error(`[PushSvc] Delivery failed platform=${deviceToken.platform}`, { err: err.message });

      if (['InvalidRegistration', 'NotRegistered', 'BadDeviceToken'].includes(err.code)) {
        await this.repo.deactivateToken(notif.member_id, deviceToken.token);
      }

      await this.repo.createDelivery({
        notificationId: notif.id,
        deviceTokenId: deviceToken.id,
        provider: deviceToken.platform,
        status: 'failed',
        latencyMs,
        errorCode: err.code || 'DELIVERY_ERROR',
        errorMessage: err.message || 'Unknown error',
      });

      return { success: false };
    }
  }

  async #sendFCM(notif, fcmToken) {
    const message = {
      token: fcmToken,
      notification: { title: notif.title, body: notif.body },
      data: {
        notificationId: String(notif.id),
        category: String(notif.category),
        deepLink: String(notif.deep_link ?? ''),
      },
      android: {
        priority: notif.priority === 'critical' || notif.priority === 'high' ? 'high' : 'normal',
        notification: {
          channelId: this.#androidChannelId(notif.category),
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
    };
    const response = await this.fcm.messaging().send(message);
    return response;
  }

  async #sendAPNs(notif, deviceToken) {
    const note = new this.apns.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 3600;
    note.badge = 1;
    note.alert = { title: notif.title, body: notif.body };
    note.topic = process.env.APNS_BUNDLE_ID;
    note.payload = {
      notificationId: notif.id,
      category: notif.category,
      deepLink: notif.deep_link ?? '',
    };

    const result = await this.apns.send(note, deviceToken);
    if (result.failed?.length) throw Object.assign(new Error('APNs failure'), { code: result.failed[0].error });
    return `apns_${Date.now()}`;
  }

  #androidChannelId(category) {
    const CHANNEL_MAP = {
      safety_alert: 'health_critical',
      health_alert: 'health_critical',
      vitals_anomaly: 'health_critical',
      medication_reminder: 'medication',
      medibot_ping: 'medibot',
      lab_result: 'clinical',
      wellness_tip: 'wellness',
      goal_achievement: 'wellness',
      inactivity: 'wellness',
      hydration_reminder: 'wellness',
      nutrition_reminder: 'wellness',
      appointment: 'appointment',
      document_ready: 'documents',
    };
    return CHANNEL_MAP[category] ?? 'general';
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ADAPTIVE DISPATCH & HEALTH TRIGGERS
  // ─────────────────────────────────────────────────────────────

  async dispatch(payload) {
    try {
      const result = await (this.rules || this).evaluate(payload);

      if (result.decision === 'allowed' && result.notificationId && (this.push || this)) {
        (this.push || this).enqueue(result.notificationId).catch((err) => {
          logger.error('[NotifDispatch] enqueue failed', { err: err.message, id: result.notificationId });
        });
      }

      return result;
    } catch (err) {
      logger.error('[NotifDispatch] dispatch error', {
        err: err.message,
        memberId: payload.memberId,
        category: payload.category,
      });
      return { notificationId: null, decision: 'failed' };
    }
  }

  async recordEngagement(memberId, notificationId, eventType) {
    const now = new Date();
    await this.repo.logEngagement(memberId, notificationId, eventType, now.getUTCHours(), now.getUTCDay());
    await this.repo.markEngaged(notificationId, eventType);
    logger.debug(`[NotifDispatch] engagement member=${memberId} id=${notificationId} type=${eventType}`);
  }

  async onHealthDataIngested(memberId, { samples = [], goals = {} }) {
    const stepSample = samples.find((s) => s.metric === 'steps' || s.metric === 'step_count');
    if (stepSample) {
      const steps = Number(stepSample.value);
      const targetSteps = Number(goals.steps || goals.stepGoal || 10000);
      await this.onStepGoalProgress(memberId, { currentSteps: steps, targetSteps });
    }

    const waterSample = samples.find((s) => s.metric === 'water' || s.metric === 'water_intake' || s.metric === 'hydration');
    if (waterSample) {
      const currentMl = Number(waterSample.value);
      const targetMl = Number(goals.waterMl || goals.waterGoal || 2000);
      await this.onWaterGoalProgress(memberId, { currentMl, targetMl });
    }

    const nutritionSample = samples.find((s) => s.metric === 'calories' || s.metric === 'nutrition' || s.metric === 'dietary_energy');
    if (nutritionSample) {
      const calories = Number(nutritionSample.value);
      const targetCalories = Number(goals.calories || goals.nutritionCalories || 2000);
      await this.onNutritionGoalProgress(memberId, { currentCalories: calories, targetCalories });
    }

    const hrSample = samples.find((s) => s.metric === 'heart_rate' || s.metric === 'resting_heart_rate');
    if (hrSample) {
      const hr = Number(hrSample.value);
      const sampleKey = hrSample.externalId || hrSample.external_id || hrSample.recordedAt || `${Date.now()}`;

      if (hr > 120 || hr < 45) {
        const direction = hr > 120 ? 'high' : 'low';
        const msg = HR_MESSAGES(hr)[direction];
        await this.dispatch({
          memberId,
          category: NOTIFICATION_CATEGORIES.VITALS_ANOMALY,
          priority: 'high',
          title: msg.title,
          body: msg.body,
          deepLink: 'health://vitals/heart-rate',
          actionLabel: 'View Vitals',
          sourceType: 'health_ingest',
          idempotencyKey: `hr_${direction}_${memberId}_${sampleKey}`,
          metadata: { hr, direction },
        });
      }
    }

    const spo2Sample = samples.find((s) => s.metric === 'spo2' || s.metric === 'blood_oxygen');
    if (spo2Sample) {
      const spo2 = Number(spo2Sample.value);
      const sampleKey = spo2Sample.externalId || spo2Sample.external_id || spo2Sample.recordedAt || `${Date.now()}`;

      if (spo2 < 94) {
        const msg = SPO2_MESSAGES(spo2);
        await this.dispatch({
          memberId,
          category: NOTIFICATION_CATEGORIES.VITALS_ANOMALY,
          priority: spo2 < 90 ? 'critical' : 'high',
          title: msg.title,
          body: msg.body,
          deepLink: 'health://vitals/spo2',
          actionLabel: 'View Details',
          sourceType: 'health_ingest',
          idempotencyKey: `spo2_low_${memberId}_${sampleKey}`,
          metadata: { spo2 },
        });
      }
    }

    const glucoseSample = samples.find((s) => s.metric === 'blood_glucose' || s.metric === 'glucose');
    if (glucoseSample) {
      const val = Number(glucoseSample.value);
      const sampleKey = glucoseSample.externalId || glucoseSample.external_id || glucoseSample.recordedAt || `${Date.now()}`;

      if (val > 180 || val < 70) {
        const direction = val > 180 ? 'high' : 'low';
        const msg = GLUCOSE_MESSAGES(val)[direction];
        await this.dispatch({
          memberId,
          category: NOTIFICATION_CATEGORIES.VITALS_ANOMALY,
          priority: 'high',
          title: msg.title,
          body: msg.body,
          deepLink: 'health://vitals/glucose',
          actionLabel: 'Check Glucose',
          sourceType: 'health_ingest',
          idempotencyKey: `glucose_${direction}_${memberId}_${sampleKey}`,
          metadata: { glucose: val, direction },
        });
      }
    }

    const bpSample = samples.find((s) => s.metric === 'blood_pressure' || s.metric === 'systolic');
    if (bpSample) {
      const val = Number(bpSample.value);
      const sampleKey = bpSample.externalId || bpSample.external_id || bpSample.recordedAt || `${Date.now()}`;

      if (val > 140) {
        const msg = BP_MESSAGES(val);
        await this.dispatch({
          memberId,
          category: NOTIFICATION_CATEGORIES.VITALS_ANOMALY,
          priority: 'high',
          title: msg.title,
          body: msg.body,
          deepLink: 'health://vitals/bp',
          actionLabel: 'View Blood Pressure',
          sourceType: 'health_ingest',
          idempotencyKey: `bp_high_${memberId}_${sampleKey}`,
          metadata: { bloodPressure: val },
        });
      }
    }
  }

  async onStepGoalProgress(memberId, { currentSteps, targetSteps = 10000 }) {
    const todayDate = new Date().toISOString().slice(0, 10);
    const steps = Number(currentSteps);
    const target = Number(targetSteps);

    if (steps >= target) {
      await this.dispatch({
        memberId,
        category: NOTIFICATION_CATEGORIES.GOAL_ACHIEVEMENT,
        priority: 'normal',
        title: '🎯 Daily Step Goal Achieved!',
        body: `You reached your goal of ${target.toLocaleString()} steps today (${steps.toLocaleString()} steps logged)! Amazing job staying active.`,
        deepLink: 'health://goals/steps',
        actionLabel: 'View Step Progress',
        sourceType: 'goal_tracker',
        idempotencyKey: `step_goal_completed_${memberId}_${todayDate}`,
        metadata: { currentSteps: steps, targetSteps: target, percentage: 100 },
      });
      return;
    }

    if (steps >= target * 0.5) {
      await this.dispatch({
        memberId,
        category: NOTIFICATION_CATEGORIES.GOAL_ACHIEVEMENT,
        priority: 'normal',
        title: '🚶 Halfway to your Step Goal!',
        body: `You're halfway there with ${steps.toLocaleString()} of your ${target.toLocaleString()} steps. Keep moving to reach your goal today!`,
        deepLink: 'health://goals/steps',
        actionLabel: 'Track Steps',
        sourceType: 'goal_tracker',
        idempotencyKey: `step_goal_halfway_${memberId}_${todayDate}`,
        metadata: { currentSteps: steps, targetSteps: target, percentage: Math.round((steps / target) * 100) },
      });
      return;
    }

    const utcHour = new Date().getUTCHours();
    if (utcHour >= 17 && steps < target * 0.5) {
      const messageBody = steps === 0
        ? `You haven't recorded any steps today. A short walk will help you work towards your ${target.toLocaleString()} step goal.`
        : `Only ${steps.toLocaleString()} steps recorded today. A walk now will help you get closer to your ${target.toLocaleString()} step goal.`;

      await this.dispatch({
        memberId,
        category: NOTIFICATION_CATEGORIES.INACTIVITY,
        priority: 'normal',
        title: 'Time to move 🚶',
        body: messageBody,
        deepLink: 'health://activity',
        actionLabel: 'Start a Walk',
        sourceType: 'goal_tracker',
        idempotencyKey: `inactivity_${memberId}_${todayDate}`,
        metadata: { currentSteps: steps, targetSteps: target },
      });
    }
  }

  async onWaterGoalProgress(memberId, { currentMl, targetMl = 2000 }) {
    const todayDate = new Date().toISOString().slice(0, 10);
    const water = Number(currentMl);
    const target = Number(targetMl);

    if (water >= target) {
      await this.dispatch({
        memberId,
        category: NOTIFICATION_CATEGORIES.GOAL_ACHIEVEMENT,
        priority: 'normal',
        title: '💧 Hydration Goal Achieved!',
        body: `Great job! You reached your daily hydration goal with ${water.toLocaleString()} ml of water logged today. Your body is well-hydrated!`,
        deepLink: 'health://goals/water',
        actionLabel: 'View Hydration',
        sourceType: 'goal_tracker',
        idempotencyKey: `water_goal_completed_${memberId}_${todayDate}`,
        metadata: { currentMl: water, targetMl: target, percentage: 100 },
      });
      return;
    }

    const utcHour = new Date().getUTCHours();
    if (utcHour >= 14 && water < target * 0.6) {
      await this.dispatch({
        memberId,
        category: NOTIFICATION_CATEGORIES.HYDRATION_REMINDER,
        priority: 'normal',
        title: '💧 Remember to stay hydrated!',
        body: `You've logged ${water.toLocaleString()} ml of water today. Drink a glass of water to stay on track for your ${target.toLocaleString()} ml goal.`,
        deepLink: 'health://goals/water',
        actionLabel: 'Log Water',
        sourceType: 'goal_tracker',
        idempotencyKey: `water_reminder_${memberId}_${todayDate}`,
        metadata: { currentMl: water, targetMl: target },
      });
    }
  }

  async onNutritionGoalProgress(memberId, { currentCalories, targetCalories = 2000, mealsCount = null }) {
    const todayDate = new Date().toISOString().slice(0, 10);
    const calories = Number(currentCalories);
    const target = Number(targetCalories);

    if (calories > 0 && calories >= target * 0.8 && calories <= target * 1.15) {
      await this.dispatch({
        memberId,
        category: NOTIFICATION_CATEGORIES.GOAL_ACHIEVEMENT,
        priority: 'normal',
        title: '🥗 Nutrition Goal on Track!',
        body: `Awesome job! You reached your daily nutrition target with ${calories.toLocaleString()} kcal logged today. Balanced nutrition fuels your body and mind.`,
        deepLink: 'health://goals/nutrition',
        actionLabel: 'View Nutrition',
        sourceType: 'goal_tracker',
        idempotencyKey: `nutrition_goal_completed_${memberId}_${todayDate}`,
        metadata: { currentCalories: calories, targetCalories: target, mealsCount },
      });
      return;
    }

    const utcHour = new Date().getUTCHours();
    if (utcHour >= 12 && calories === 0) {
      await this.dispatch({
        memberId,
        category: NOTIFICATION_CATEGORIES.NUTRITION_REMINDER,
        priority: 'normal',
        title: '🥑 Nutrition Check-in',
        body: "Don't forget to log your meals today to track your nutrition and maintain balanced energy.",
        deepLink: 'health://goals/nutrition',
        actionLabel: 'Log Meal',
        sourceType: 'goal_tracker',
        idempotencyKey: `nutrition_reminder_${memberId}_${todayDate}`,
        metadata: { currentCalories: calories, targetCalories: target },
      });
    }
  }

  async onProactivePing(memberId, { pingMessage, rulesTriggered, sourceRefId }) {
    const ruleLabels = (rulesTriggered || []).map((r) => r.type || r);
    await this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.MEDIBOT_PING,
      priority: 'normal',
      title: 'MediBot checked in on you 👋',
      body: pingMessage,
      deepLink: 'medibot://chat',
      actionLabel: 'Reply to MediBot',
      sourceType: 'proactive_monitor',
      sourceRefId,
      rulesTriggered: ruleLabels,
      idempotencyKey: `medibot_ping_${memberId}_${sourceRefId}`,
    });
  }

  async onLabResultAvailable(memberId, { labName, labValue, labUnit, encounterId, isAbnormal = false }) {
    const flag = isAbnormal ? ' ⚠️ Abnormal' : '';
    await this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.LAB_RESULT,
      priority: isAbnormal ? 'high' : 'normal',
      title: `Lab Result Ready: ${labName}${flag}`,
      body: isAbnormal
        ? `Your ${labName} result is ${labValue} ${labUnit ?? ''} — outside the normal range. Your care team has been notified. Tap to review.`
        : `Your ${labName} result is ${labValue} ${labUnit ?? ''}. Tap to review it with your care team.`,
      deepLink: `medibot://encounter/${encounterId}/labs`,
      actionLabel: 'View Result',
      sourceType: 'clinical_event',
      sourceRefId: encounterId,
      idempotencyKey: `lab_${memberId}_${encounterId}_${labName.toLowerCase().replace(/\s+/g, '_')}`,
      metadata: { labName, labValue, labUnit, isAbnormal },
    });
  }

  async onDrugInteractionDetected(memberId, { drug, interactingWith, severity, reason }) {
    const safeKey = (s) => s.toLowerCase().replace(/\s+/g, '_');
    await this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.SAFETY_ALERT,
      priority: 'critical',
      title: '⚠️ Drug Safety Warning',
      body: severity === 'UNSAFE'
        ? `Do not take ${drug} with ${interactingWith}. ${reason} Contact your doctor before taking this medication.`
        : `Caution: ${drug} may interact with ${interactingWith}. ${reason} Ask your doctor or pharmacist.`,
      deepLink: 'medibot://safety/interactions',
      actionLabel: 'Review with Doctor',
      sourceType: 'clinical_rules',
      rulesTriggered: [{ type: 'drug_interaction', drug, interactingWith, severity }],
      idempotencyKey: `drug_${safeKey(drug)}_${safeKey(interactingWith)}_${memberId}`,
      metadata: { drug, interactingWith, severity },
    });
  }

  async onDocumentReady(memberId, { documentId, documentName, documentType = null }) {
    const typeLabel = documentType ? ` (${documentType})` : '';
    await this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.DOCUMENT_READY,
      priority: 'normal',
      title: 'Your health document is ready 📄',
      body: `"${documentName}"${typeLabel} has been processed and added to your health records.`,
      deepLink: `medibot://documents/${documentId}`,
      actionLabel: 'Open Document',
      sourceType: 'document_pipeline',
      sourceRefId: documentId,
      idempotencyKey: `doc_ready_${documentId}`,
    });
  }

  async onMedicationReminder(memberId, { medicationName, dosage, scheduledTime, medicationId }) {
    await this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.MEDICATION_REMINDER,
      priority: 'high',
      title: '💊 Medication reminder',
      body: `Time to take ${dosage} of ${medicationName}. Tap to log it as taken.`,
      deepLink: `medibot://medications/${medicationId ?? ''}`,
      actionLabel: 'Mark as Taken',
      sourceType: 'medication_schedule',
      scheduledAt: scheduledTime ?? null,
      idempotencyKey: `med_${memberId}_${medicationName.replace(/\s+/g, '_')}_${scheduledTime}`,
      metadata: { medicationName, dosage, scheduledTime },
    });
  }

  async onAppointmentReminder(memberId, { encounterId, encounterDate, providerName, reminderType = '24h' }) {
    const when = reminderType === '1h' ? 'in 1 hour' : 'tomorrow';
    await this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.APPOINTMENT,
      priority: 'normal',
      title: `📅 Appointment ${when}`,
      body: providerName
        ? `You have an appointment with ${providerName} ${when}. Tap to view details and prepare your questions.`
        : `You have a health appointment ${when}. Tap to view and prepare.`,
      deepLink: `medibot://encounter/${encounterId}`,
      actionLabel: 'View Appointment',
      sourceType: 'appointment_scheduler',
      sourceRefId: encounterId,
      idempotencyKey: `appt_${encounterId}_${reminderType}`,
      metadata: { encounterId, encounterDate, providerName, reminderType },
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Compatibility Aliases (Seamlessly export all singletons/classes)
// ─────────────────────────────────────────────────────────────

export class NotificationRulesService {
  constructor({ notificationRepo }) {
    this.service = new NotificationService({ notificationRepo });
  }
  evaluate(notification) {
    return this.service.evaluate(notification);
  }
}

export class NotificationPushService {
  constructor({ notificationRepo, fcmClient = null, apnsClient = null, queue = null }) {
    this.service = new NotificationService({ notificationRepo, fcmClient, apnsClient, queue });
  }
  enqueue(notificationId) {
    return this.service.enqueue(notificationId);
  }
  sendById(notificationId) {
    return this.service.sendById(notificationId);
  }
}

export class NotificationDispatchService extends NotificationService {}

export default NotificationService;
