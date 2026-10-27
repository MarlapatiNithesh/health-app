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
  CIRCADIAN_GOAL: 'circadian_goal',
  CHRONO_REGIMEN: 'chrono_regimen',
  SLEEP_GUARD: 'sleep_guard',
  EMERGENCY_PROTOCOL: 'emergency_protocol',
};

export const NOTIFICATION_STREAMS = {
  STREAM_1: 'stream1_emergency',
  STREAM_2: 'stream2_circadian',
  STREAM_3: 'stream3_chrono_regimen',
  STREAM_4: 'stream4_sleep_guard',
};

export const HYDRATION_SAFETY_CEILING_ML = 4500; // 4.5L safety ceiling

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
  NOTIFICATION_CATEGORIES.EMERGENCY_PROTOCOL,
]);

const BYPASS_SMART_SEND = new Set([
  NOTIFICATION_CATEGORIES.SAFETY_ALERT,
  NOTIFICATION_CATEGORIES.HEALTH_ALERT,
  NOTIFICATION_CATEGORIES.EMERGENCY_PROTOCOL,
  NOTIFICATION_CATEGORIES.VITALS_ANOMALY,
  NOTIFICATION_CATEGORIES.LAB_RESULT,
  NOTIFICATION_CATEGORIES.MEDICATION_REMINDER,
  NOTIFICATION_CATEGORIES.CHRONO_REGIMEN,
]);

const HR_MESSAGES = (hr) => ({
  high: {
    title: `💓 Heart Pulse Check: ${hr} bpm`,
    body: 'Your pulse is running high at rest. Sit comfortably, take 4 slow deep belly breaths (inhale 4s, exhale 6s), and sip cool water. 🧘',
    actionLabel: 'START 2-MIN RESET',
  },
  low: {
    title: `Low Heart Rate Detected — ${hr} bpm`,
    body: 'Your heart rate dropped below 45 bpm. If you feel dizzy, short of breath, or faint, seek medical attention immediately.',
    actionLabel: 'View Vitals',
  },
});

const SPO2_MESSAGES = (spo2) => ({
  title: `Low Blood Oxygen — ${spo2}%`,
  body: spo2 < 90
    ? `Your SpO2 is critically low (${spo2}%). Move to fresh air and call emergency services if you feel breathless.`
    : `Your blood oxygen is slightly below normal (${spo2}%). Rest, breathe deeply, and recheck in 10 minutes.`,
  actionLabel: spo2 < 90 ? 'Call Emergency Services' : 'View Details',
});

const GLUCOSE_MESSAGES = (val) => ({
  high: {
    title: `High Blood Glucose Alert — ${val} mg/dL`,
    body: 'Your blood sugar reading is elevated. Check your insulin or medication plan and drink water.',
    actionLabel: 'Check Glucose',
  },
  low: {
    title: `⚡ Low Sugar Urgent Alert: ${val} mg/dL`,
    body: 'Quick energy needed! Take 15-20g fast carbs (half cup juice or 1 tbsp honey) immediately. Re-test glucose in 15 mins.',
    actionLabel: 'LOG FAST CARBS & RETEST',
  },
});

const BP_MESSAGES = (val) => ({
  title: `Elevated Blood Pressure — ${val} mmHg`,
  body: 'Your blood pressure reading is higher than your target range. Take a moment to rest and re-measure.',
  actionLabel: 'View Blood Pressure',
});

/**
 * Unified Notification Service
 * Combines Rules Engine, Push Gateway, 4-Tier Circadian/Emergency Stream Dispatch & Interactive Action Execution.
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
  // 1. RULES & EVALUATION ENGINE (DUAL-TIER DISPATCH)
  // ─────────────────────────────────────────────────────────────

  async evaluate(notification) {
    const { memberId, category, priority = 'normal', metadata = {} } = notification;

    // Tier 1 — Critical Emergency Alerts: Immediate 0-second bypass of quiet hours, caps, and smart send
    const bypassAll = BYPASS_ALL_RULES.has(category) || priority === 'critical';
    const bypassSend = BYPASS_SMART_SEND.has(category) || priority === 'high' || bypassAll;

    const rawPref = await this.repo.getPreferenceForCategory(memberId, category);
    const pref = { ...DEFAULT_PREF, ...rawPref };

    // Tier 4 — Bedtime Sleep Protection & Step Debt Suppression:
    // Past 21:30 (until 07:00), suppress all inactivity and step deficit prompts to protect restorative sleep.
    const isStepPrompt = category === NOTIFICATION_CATEGORIES.INACTIVITY ||
      metadata?.isStepDebtPrompt ||
      category === 'step_debt';

    if (isStepPrompt && !bypassAll && this.#isBedtimeSuppressionActive(pref.quiet_hours_tz)) {
      logger.info(`[NotifRules] Bedtime step debt alert suppressed past 21:30 member=${memberId}`);
      const created = await this.repo.createNotification({ ...notification, priority });
      if (created) await this.repo.suppress(created.id, 'bedtime_step_debt_suppression');
      return { notificationId: created?.id ?? null, decision: 'suppressed', reason: 'bedtime_step_debt_suppression' };
    }

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
    logger.info(`[NotifRules] ${decision} id=${created.id} cat=${category} member=${memberId} bypass=${bypassAll}`);
    return { notificationId: created.id, decision };
  }

  #isBedtimeSuppressionActive(tz = 'UTC') {
    try {
      const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz || 'UTC' }));
      const localMin = nowLocal.getHours() * 60 + nowLocal.getMinutes();
      // Bedtime buffer: 21:30 (1290m) to 07:00 (420m)
      return localMin >= 1290 || localMin < 420;
    } catch {
      return false;
    }
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
      emergency_protocol: 'health_critical',
      vitals_anomaly: 'health_critical',
      medication_reminder: 'medication',
      chrono_regimen: 'medication',
      medibot_ping: 'medibot',
      lab_result: 'clinical',
      wellness_tip: 'wellness',
      circadian_goal: 'wellness',
      goal_achievement: 'wellness',
      inactivity: 'wellness',
      hydration_reminder: 'wellness',
      nutrition_reminder: 'wellness',
      sleep_guard: 'sleep_guard',
      appointment: 'appointment',
      document_ready: 'documents',
    };
    return CHANNEL_MAP[category] ?? 'general';
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ADAPTIVE DISPATCH & 4-TIER HEALTH ENGINE
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

  // ── TIER 1: CRITICAL TELEMETRY & EMERGENCY PROTOCOLS (0S DISPATCH) ──

  async onHypoglycemiaAlert(memberId, { glucose, sampleKey = `${Date.now()}` }) {
    const val = Number(glucose);
    const msg = GLUCOSE_MESSAGES(val).low;
    return this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.EMERGENCY_PROTOCOL,
      priority: 'critical', // Immediate 0-second bypass of quiet hours and daily caps
      title: msg.title,
      body: msg.body,
      actionLabel: msg.actionLabel,
      actionUrl: 'health://glucose/retest',
      deepLink: 'health://glucose/rule-of-15',
      sourceType: 'emergency_telemetry',
      idempotencyKey: `hypoglycemia_${memberId}_${sampleKey}`,
      metadata: {
        tier: 1,
        stream: NOTIFICATION_STREAMS.STREAM_1,
        glucose: val,
        protocol: 'Clinical Rule of 15',
        clinicalActions: ['Take 15-20g fast carbs', 'Sit down', 'Retest in 15 mins'],
      },
    });
  }

  async onRestingTachycardiaAlert(memberId, { hr, sampleKey = `${Date.now()}` }) {
    const rate = Number(hr);
    const msg = HR_MESSAGES(rate).high;
    return this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.EMERGENCY_PROTOCOL,
      priority: 'critical', // Immediate 0-second bypass
      title: msg.title,
      body: msg.body,
      actionLabel: msg.actionLabel,
      actionUrl: 'health://vitals/vagal-reset',
      deepLink: 'health://vitals/vagal-reset',
      sourceType: 'emergency_telemetry',
      idempotencyKey: `tachycardia_${memberId}_${sampleKey}`,
      metadata: {
        tier: 1,
        stream: NOTIFICATION_STREAMS.STREAM_1,
        hr: rate,
        protocol: 'Vagal Parasympathetic Reset',
        breathingCadence: 'Inhale 4s, Hold 2s, Exhale 6s',
        fluidRecommendation: '200ml cool water',
      },
    });
  }

  async onCriticalHypoxiaAlert(memberId, { spo2, sampleKey = `${Date.now()}` }) {
    const val = Number(spo2);
    const msg = SPO2_MESSAGES(val);
    return this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.EMERGENCY_PROTOCOL,
      priority: 'critical', // Immediate 0-second bypass
      title: msg.title,
      body: msg.body,
      actionLabel: msg.actionLabel,
      actionUrl: 'tel:911',
      deepLink: 'health://vitals/spo2',
      sourceType: 'emergency_telemetry',
      idempotencyKey: `hypoxia_${memberId}_${sampleKey}`,
      metadata: {
        tier: 1,
        stream: NOTIFICATION_STREAMS.STREAM_1,
        spo2: val,
      },
    });
  }

  // ── TIER 2: DAILY WELLNESS GOALS (CIRCADIAN WAKE-TO-SLEEP PACING) ──

  async onMorningHydrationKickstart(memberId, { date = new Date().toISOString().slice(0, 10) } = {}) {
    return this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.CIRCADIAN_GOAL,
      priority: 'normal',
      title: '🌅 Morning Metabolic Ignition 💧',
      body: 'Good morning! Drink a fresh 300ml glass of water to wake up your mind and kickstart your daily energy!',
      actionLabel: 'LOG 300ML GLASS',
      actionUrl: 'health://goals/water?amount=300',
      deepLink: 'health://goals/water',
      sourceType: 'circadian_engine',
      idempotencyKey: `morning_hydration_${memberId}_${date}`,
      metadata: {
        tier: 2,
        stream: NOTIFICATION_STREAMS.STREAM_2,
        circadianSlot: '07:15',
        intakeMl: 300,
        glassNumber: 1,
        totalGlasses: 8,
      },
    });
  }

  async onMiddayPacing(memberId, {
    currentWaterMl = 1000,
    currentSteps = 3500,
    targetWaterMl = 2000,
    targetSteps = 10000,
    date = new Date().toISOString().slice(0, 10),
  } = {}) {
    // Safety cap: If user configured extreme 10L goal, cap to 4.5L safety ceiling
    const effectiveWaterTarget = Math.min(Number(targetWaterMl), HYDRATION_SAFETY_CEILING_ML);
    const remainingGlasses = Math.max(1, Math.ceil((effectiveWaterTarget - currentWaterMl) / 350));

    return this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.CIRCADIAN_GOAL,
      priority: 'normal',
      title: '🚶 15-Min Power Walk & Refill ⚡',
      body: `Drink 350ml water now and take a 15-min post-lunch stroll (+1,650 steps). ${remainingGlasses} glasses left to conquer today's target!`,
      actionLabel: 'START 15-MIN WALK',
      actionUrl: 'health://activity/brisk-walk?duration=15',
      deepLink: 'health://activity/walk',
      sourceType: 'circadian_engine',
      idempotencyKey: `midday_pacing_${memberId}_${date}`,
      metadata: {
        tier: 2,
        stream: NOTIFICATION_STREAMS.STREAM_2,
        circadianSlot: '14:30',
        currentWaterMl,
        currentSteps,
        effectiveWaterTarget,
        waterCeilingApplied: targetWaterMl > HYDRATION_SAFETY_CEILING_ML,
        recommendedWalkMin: 15,
        stepsRecovery: 1650,
      },
    });
  }

  async onEveningTrailBoost(memberId, {
    currentWaterMl = 1500,
    distanceKm = 1.5,
    date = new Date().toISOString().slice(0, 10),
  } = {}) {
    return this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.CIRCADIAN_GOAL,
      priority: 'normal',
      title: '📍 Trail Boost: 1.5 km to Victory! 🏃',
      body: 'Sip 300ml water and complete a quick 1.5 km loop to crush today\'s distance target before sunset!',
      actionLabel: 'TRACK 1.5 KM LOOP',
      actionUrl: 'health://activity/trail?distance=1.5',
      deepLink: 'health://activity/trail',
      sourceType: 'circadian_engine',
      idempotencyKey: `evening_trail_${memberId}_${date}`,
      metadata: {
        tier: 2,
        stream: NOTIFICATION_STREAMS.STREAM_2,
        circadianSlot: '17:30',
        distanceKm,
        waterIntakeMl: 300,
        glassNumber: 5,
        totalGlasses: 8,
      },
    });
  }

  // ── TIER 3: ACTIVE PRESCRIPTION MEDICATIONS (MEDIBOT CHRONO-REGIMEN) ──

  async createChronoRegimenFromPrescription(memberId, {
    date = new Date().toISOString().slice(0, 10),
    prescriptionId = 'rx-standard',
  } = {}) {
    const regimenSchedule = [
      {
        slot: '07:30',
        title: '💊 MediBot Care: Pantoprazole (40mg) Time',
        body: 'Please take your 1 tablet Pantoprazole (40mg) on an empty stomach with a glass of water. Breakfast in 35 mins!',
        actionLabel: 'MARK TABLET TAKEN',
        deepLink: 'medibot://medications/pantoprazole',
        key: `rx_pantoprazole_${memberId}_${date}`,
        metadata: {
          medication: 'Pantoprazole',
          dosage: '40mg',
          type: 'ppi_empty_stomach',
          instructions: 'Swallow whole with water 30-45 mins before breakfast',
        },
      },
      {
        slot: '08:30',
        title: '🍳 Breakfast Energy & Morning Meds 💊',
        body: 'Take 1 tablet Metformin (500mg) and 1 capsule Amoxicillin (500mg) with your breakfast to protect your stomach.',
        actionLabel: 'MARK BREAKFAST MEDS TAKEN',
        deepLink: 'medibot://medications/breakfast-batch',
        key: `rx_breakfast_${memberId}_${date}`,
        metadata: {
          medications: [
            { name: 'Metformin', dosage: '500mg', reason: 'meal-cushioned glycemic control' },
            { name: 'Amoxicillin', dosage: '500mg', doseIndex: 1, totalDoses: 3 },
          ],
          type: 'meal_cushioned',
        },
      },
      {
        slot: '13:30',
        title: '🥗 Lunchtime Antibiotic Care 💊',
        body: 'Time for Dose 2 of Amoxicillin (500mg) after your lunch with 250ml water. Balanced nutrition keeps your recovery on track!',
        actionLabel: 'MARK DOSE 2 TAKEN',
        deepLink: 'medibot://medications/amoxicillin-dose-2',
        key: `rx_lunch_${memberId}_${date}`,
        metadata: {
          medication: 'Amoxicillin',
          dosage: '500mg',
          doseIndex: 2,
          totalDoses: 3,
          type: 'antibiotic_equidistance',
        },
      },
      {
        slot: '19:30',
        title: '🍲 Dinner Nourishment & Evening Meds 💊',
        body: 'Take your evening Metformin (500mg) with dinner + final daily Amoxicillin (500mg). Sip 250ml water!',
        actionLabel: 'MARK DINNER MEDS TAKEN',
        deepLink: 'medibot://medications/dinner-batch',
        key: `rx_dinner_${memberId}_${date}`,
        metadata: {
          medications: [
            { name: 'Metformin', dosage: '500mg', doseIndex: 2 },
            { name: 'Amoxicillin', dosage: '500mg', doseIndex: 3, totalDoses: 3 },
          ],
          type: 'evening_glycemic_support',
        },
      },
      {
        slot: '21:45',
        title: '🌙 Bedtime Statin Care: Atorvastatin (20mg)',
        body: 'Take your 1 tablet Atorvastatin (20mg) at bedtime for maximum nighttime cholesterol synthesis. Rest well tonight!',
        actionLabel: 'MARK ATORVASTATIN TAKEN',
        deepLink: 'medibot://medications/atorvastatin',
        key: `rx_atorvastatin_${memberId}_${date}`,
        metadata: {
          medication: 'Atorvastatin',
          dosage: '20mg',
          type: 'bedtime_statin_chronotherapy',
          clinicalRATIONALE: 'Peak hepatic cholesterol synthesis (HMG-CoA reductase) occurs overnight',
        },
      },
    ];

    const results = [];
    for (const item of regimenSchedule) {
      const res = await this.dispatch({
        memberId,
        category: NOTIFICATION_CATEGORIES.CHRONO_REGIMEN,
        priority: 'high',
        title: item.title,
        body: item.body,
        actionLabel: item.actionLabel,
        actionUrl: item.deepLink,
        deepLink: item.deepLink,
        sourceType: 'medibot_prescriptions',
        sourceRefId: prescriptionId,
        idempotencyKey: item.key,
        metadata: {
          tier: 3,
          stream: NOTIFICATION_STREAMS.STREAM_3,
          circadianSlot: item.slot,
          ...item.metadata,
        },
      });
      results.push({ slot: item.slot, ...res });
    }

    return results;
  }

  // ── TIER 4: BEDTIME SLEEP PROTECTION & NOCTURIA SAFEGUARDS ──

  async onBedtimeNocturiaTaper(memberId, { date = new Date().toISOString().slice(0, 10) } = {}) {
    return this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.SLEEP_GUARD,
      priority: 'normal',
      title: '🌙 Gentle Sips Tonight 🛏',
      body: 'Great progress logging your hydration today! Take just a gentle 150ml sip now so your sleep stays deep and restful.',
      actionLabel: 'LOG 150ML GENTLE SIP',
      actionUrl: 'health://goals/water?amount=150&taper=true',
      deepLink: 'health://sleep/hygiene',
      sourceType: 'sleep_guard',
      idempotencyKey: `nocturia_taper_${memberId}_${date}`,
      metadata: {
        tier: 4,
        stream: NOTIFICATION_STREAMS.STREAM_4,
        circadianSlot: '21:30',
        maxRecommendedSipMl: 150,
        purpose: 'Prevents nocturnal bladder distension to protect stage-3 slow wave sleep and REM cycles',
      },
    });
  }

  async onBedtimeStreakReset(memberId, { date = new Date().toISOString().slice(0, 10), stepsLogged = 0 } = {}) {
    return this.dispatch({
      memberId,
      category: NOTIFICATION_CATEGORIES.SLEEP_GUARD,
      priority: 'normal',
      title: '🌙 Rest & Recharge for Tomorrow 🛌',
      body: 'Rest up tonight! Tomorrow morning is a fresh runway to kick off a brand new walking streak. Sleep tight!',
      actionLabel: 'VIEW DAY SUMMARY',
      actionUrl: 'health://summary/today',
      deepLink: 'health://summary/today',
      sourceType: 'sleep_guard',
      idempotencyKey: `streak_reset_${memberId}_${date}`,
      metadata: {
        tier: 4,
        stream: NOTIFICATION_STREAMS.STREAM_4,
        circadianSlot: '22:00',
        stepsLogged,
        psychologicalGuard: 'Step debt alarms silenced to prevent pre-sleep anxiety',
      },
    });
  }

  // ── INTERACTIVE ACTION EXECUTION ENGINE ──

  async executeAction(memberId, notificationId, actionLabel, payload = {}) {
    logger.info(`[NotifAction] Executing "${actionLabel}" for notif=${notificationId} member=${memberId}`);
    const notif = notificationId ? await this.repo.getById(notificationId) : null;

    let response = {
      success: true,
      action: actionLabel,
      notificationId,
      message: 'Action completed successfully',
      feedbackToast: null,
      telemetryUpdate: null,
    };

    switch (actionLabel) {
      case 'LOG FAST CARBS & RETEST': {
        // Clinical Rule of 15: Log carbs + automatically schedule 15-minute retest prompt
        const carbsGrams = payload.carbsGrams || 15;
        response.feedbackToast = `Logged ${carbsGrams}g fast carbs. 15-minute re-test countdown active!`;
        response.telemetryUpdate = { metric: 'fast_carbs', value: carbsGrams, unit: 'g' };

        // Schedule 15-min re-test reminder (Tier 1 Protocol)
        const retestTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await this.dispatch({
          memberId,
          category: NOTIFICATION_CATEGORIES.EMERGENCY_PROTOCOL,
          priority: 'critical',
          scheduledAt: retestTime,
          title: '⚡ Glucose 15-Min Re-Test Check',
          body: '15 minutes have passed since fast carbohydrates. Please re-check your blood glucose now to verify recovery above 70 mg/dL.',
          actionLabel: 'LOG RETEST GLUCOSE',
          deepLink: 'health://glucose/retest',
          sourceType: 'emergency_protocol',
          idempotencyKey: `retest_check_${memberId}_${Date.now()}`,
          metadata: { tier: 1, fastCarbsLoggedAt: new Date().toISOString() },
        }).catch((err) => logger.warn('[NotifAction] failed to schedule retest', { err: err.message }));
        break;
      }

      case 'START 2-MIN RESET': {
        response.feedbackToast = 'Vagal parasympathetic reset initiated: 4s inhale, 2s hold, 6s exhale diaphragmatic breathing.';
        response.protocolData = {
          inhaleSeconds: 4,
          holdSeconds: 2,
          exhaleSeconds: 6,
          coolWaterMl: 200,
          cycles: 4,
        };
        break;
      }

      case 'LOG 300ML GLASS': {
        response.feedbackToast = '🌅 Glass 1 of 8 logged! 300ml fresh water added to metabolic ignition.';
        response.telemetryUpdate = { metric: 'water', value: 300, unit: 'ml' };
        break;
      }

      case 'LOG 150ML GENTLE SIP': {
        response.feedbackToast = '🌙 Gentle 150ml sip recorded. Nocturia guard active for deep restorative sleep.';
        response.telemetryUpdate = { metric: 'water', value: 150, unit: 'ml', sleepGuardTaper: true };
        break;
      }

      case 'START 15-MIN WALK': {
        response.feedbackToast = '🚶 15-minute walk tracker started (+1,650 steps). Post-lunch pacing on track!';
        response.telemetryUpdate = { metric: 'steps', value: 1650, unit: 'steps', durationMin: 15 };
        break;
      }

      case 'TRACK 1.5 KM LOOP': {
        response.feedbackToast = '📍 1.5 km trail loop active! Hydration and movement synced.';
        response.telemetryUpdate = { metric: 'distance', value: 1.5, unit: 'km', water: 300 };
        break;
      }

      case 'MARK TABLET TAKEN': {
        response.feedbackToast = '💊 Pantoprazole 40mg confirmed taken on empty stomach. Breakfast window open in 35 mins.';
        response.medicationLog = { name: 'Pantoprazole', dose: '40mg', emptyStomach: true, takenAt: new Date().toISOString() };
        break;
      }

      case 'MARK BREAKFAST MEDS TAKEN': {
        response.feedbackToast = '🍳 Breakfast medications (Metformin 500mg + Amoxicillin 500mg) confirmed taken with meal cushion.';
        response.medicationLog = { medications: ['Metformin 500mg', 'Amoxicillin 500mg'], takenAt: new Date().toISOString() };
        break;
      }

      case 'MARK DOSE 2 TAKEN': {
        response.feedbackToast = '🥗 Amoxicillin 500mg Dose 2 confirmed taken with 250ml water.';
        response.medicationLog = { medication: 'Amoxicillin', dose: '500mg', doseIndex: 2, takenAt: new Date().toISOString() };
        break;
      }

      case 'MARK DINNER MEDS TAKEN': {
        response.feedbackToast = '🍲 Dinner medications (Metformin 500mg + Amoxicillin 500mg Dose 3) confirmed taken.';
        response.medicationLog = { medications: ['Metformin 500mg', 'Amoxicillin 500mg (Dose 3)'], takenAt: new Date().toISOString() };
        break;
      }

      case 'MARK ATORVASTATIN TAKEN': {
        response.feedbackToast = '🌙 Atorvastatin 20mg confirmed taken at bedtime for nocturnal chronotherapy.';
        response.medicationLog = { medication: 'Atorvastatin', dose: '20mg', takenAt: new Date().toISOString() };
        break;
      }

      case 'VIEW DAY SUMMARY': {
        response.feedbackToast = 'Today\'s health summary loaded. Rest well and recharge for tomorrow!';
        response.summary = {
          streakProtected: true,
          status: 'Day successfully logged',
        };
        break;
      }

      default: {
        response.feedbackToast = `Action "${actionLabel}" confirmed.`;
        break;
      }
    }

    if (notificationId) {
      await this.recordEngagement(memberId, notificationId, 'tapped');
    }

    return response;
  }

  // ── SIMULATION / TEST DISPATCHER FOR ALL 4 STREAMS ──

  async simulateStream(memberId, streamKey, options = {}) {
    logger.info(`[NotifService] Simulating stream=${streamKey} for member=${memberId}`);

    switch (streamKey) {
      case 'stream1_hypoglycemia':
        return this.onHypoglycemiaAlert(memberId, { glucose: options.glucose || 62 });

      case 'stream1_tachycardia':
        return this.onRestingTachycardiaAlert(memberId, { hr: options.hr || 135 });

      case 'stream1_hypoxia':
        return this.onCriticalHypoxiaAlert(memberId, { spo2: options.spo2 || 88 });

      case 'stream1_drug_interaction':
        return this.onDrugInteractionDetected(memberId, {
          drug: options.drug || 'Warfarin',
          interactingWith: options.interactingWith || 'Aspirin',
          severity: 'UNSAFE',
          reason: 'Severe risk of internal gastrointestinal hemorrhage and bleeding.',
        });

      case 'stream2_morning_hydration':
        return this.onMorningHydrationKickstart(memberId);

      case 'stream2_midday_pacing':
        return this.onMiddayPacing(memberId, {
          currentWaterMl: options.currentWaterMl || 1000,
          currentSteps: options.currentSteps || 3500,
          targetWaterMl: options.targetWaterMl || 2000,
          targetSteps: options.targetSteps || 10000,
        });

      case 'stream2_evening_trail':
        return this.onEveningTrailBoost(memberId, {
          distanceKm: options.distanceKm || 1.5,
          currentWaterMl: options.currentWaterMl || 1500,
        });

      case 'stream3_medibot_regimen':
        return this.createChronoRegimenFromPrescription(memberId);

      case 'stream4_bedtime_taper':
        return this.onBedtimeNocturiaTaper(memberId);

      case 'stream4_step_suppression':
        return this.onBedtimeStreakReset(memberId, { stepsLogged: options.stepsLogged || 7800 });

      default:
        throw new Error(`Unknown streamKey: ${streamKey}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. TELEMETRY INGESTION HOOKS
  // ─────────────────────────────────────────────────────────────

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
      const targetMl = Math.min(Number(goals.waterMl || goals.waterGoal || 2000), HYDRATION_SAFETY_CEILING_ML);
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

      if (hr > 120) {
        // STREAM 1: Resting Tachycardia Spike (>120 bpm at rest) -> Immediate 0s Bypass
        await this.onRestingTachycardiaAlert(memberId, { hr, sampleKey });
      } else if (hr < 45) {
        const msg = HR_MESSAGES(hr).low;
        await this.dispatch({
          memberId,
          category: NOTIFICATION_CATEGORIES.VITALS_ANOMALY,
          priority: 'critical',
          title: msg.title,
          body: msg.body,
          actionLabel: msg.actionLabel,
          deepLink: 'health://vitals/heart-rate',
          sourceType: 'health_ingest',
          idempotencyKey: `hr_low_${memberId}_${sampleKey}`,
          metadata: { hr, direction: 'low' },
        });
      }
    }

    const spo2Sample = samples.find((s) => s.metric === 'spo2' || s.metric === 'blood_oxygen');
    if (spo2Sample) {
      const spo2 = Number(spo2Sample.value);
      const sampleKey = spo2Sample.externalId || spo2Sample.external_id || spo2Sample.recordedAt || `${Date.now()}`;

      if (spo2 < 90) {
        // STREAM 1: Critical Hypoxia (<90%) -> Immediate 0s Bypass
        await this.onCriticalHypoxiaAlert(memberId, { spo2, sampleKey });
      } else if (spo2 < 94) {
        const msg = SPO2_MESSAGES(spo2);
        await this.dispatch({
          memberId,
          category: NOTIFICATION_CATEGORIES.VITALS_ANOMALY,
          priority: 'high',
          title: msg.title,
          body: msg.body,
          actionLabel: msg.actionLabel,
          deepLink: 'health://vitals/spo2',
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

      if (val < 70) {
        // STREAM 1: Acute Hypoglycemia (<70 mg/dL) -> Immediate 0s Bypass
        await this.onHypoglycemiaAlert(memberId, { glucose: val, sampleKey });
      } else if (val > 180) {
        const msg = GLUCOSE_MESSAGES(val).high;
        await this.dispatch({
          memberId,
          category: NOTIFICATION_CATEGORIES.VITALS_ANOMALY,
          priority: 'high',
          title: msg.title,
          body: msg.body,
          actionLabel: msg.actionLabel,
          deepLink: 'health://vitals/glucose',
          sourceType: 'health_ingest',
          idempotencyKey: `glucose_high_${memberId}_${sampleKey}`,
          metadata: { glucose: val, direction: 'high' },
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
          actionLabel: msg.actionLabel,
          deepLink: 'health://vitals/bp',
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
        metadata: { currentSteps: steps, targetSteps: target, isStepDebtPrompt: true },
      });
    }
  }

  async onWaterGoalProgress(memberId, { currentMl, targetMl = 2000 }) {
    const todayDate = new Date().toISOString().slice(0, 10);
    const water = Number(currentMl);
    const target = Math.min(Number(targetMl), HYDRATION_SAFETY_CEILING_ML);

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
        body: 'Don\'t forget to log your meals today to track your nutrition and maintain balanced energy.',
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
      priority: 'critical', // Immediate 0-second bypass
      title: '⚠️ Drug Safety Warning',
      body: severity === 'UNSAFE'
        ? `Do not take ${drug} with ${interactingWith}. ${reason} Contact your doctor before taking this medication.`
        : `Caution: ${drug} may interact with ${interactingWith}. ${reason} Ask your doctor or pharmacist.`,
      deepLink: 'medibot://safety/interactions',
      actionLabel: 'Review with Doctor',
      sourceType: 'clinical_rules',
      rulesTriggered: [{ type: 'drug_interaction', drug, interactingWith, severity }],
      idempotencyKey: `drug_${safeKey(drug)}_${safeKey(interactingWith)}_${memberId}`,
      metadata: { drug, interactingWith, severity, tier: 1 },
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
