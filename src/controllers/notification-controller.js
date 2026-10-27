import { ApplicationError } from '../errors/application-error.js';
import { logger } from '../logger.js';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_STREAMS } from '../services/notification-service.js';

const VALID_PLATFORMS = ['ios', 'android', 'web'];
const VALID_ENGAGEMENT_TYPES = ['read', 'dismissed', 'tapped'];

export class NotificationController {
  constructor({ notificationRepo, notificationService, notificationDispatchService }) {
    this.repo     = notificationRepo;
    this.dispatch = notificationService || notificationDispatchService;
  }

  registerToken = async (req, res) => {
    const memberId = req.memberId;
    const { platform, token, appVersion, deviceModel } = req.body ?? {};

    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      throw new ApplicationError('platform must be one of: ios, android, web', 400, 'validation_error');
    }
    if (!token || typeof token !== 'string' || token.length < 10) {
      throw new ApplicationError('token must be a non-empty string (min 10 chars)', 400, 'validation_error');
    }

    const row = await this.repo.upsertDeviceToken(memberId, { platform, token, appVersion, deviceModel });
    logger.info(`[NotifCtrl] Token registered memberId=${memberId} platform=${platform}`);

    res.status(201).json({ deviceToken: this.#mapToken(row) });
  };

  deregisterToken = async (req, res) => {
    const memberId = req.memberId;
    const { token } = req.params;

    const removed = await this.repo.deactivateToken(memberId, decodeURIComponent(token));
    if (!removed) throw new ApplicationError('Token not found', 404, 'not_found');

    res.json({ message: 'Token deregistered successfully' });
  };

  listPreferences = async (req, res) => {
    const memberId = req.memberId;
    const rows = await this.repo.getPreferences(memberId);

    const configured = new Map(rows.map((r) => [r.category, r]));
    const allCategories = Object.values(NOTIFICATION_CATEGORIES);

    const prefs = allCategories.map((cat) => configured.get(cat) ?? this.#defaultPref(memberId, cat));
    res.json({ preferences: prefs.map(this.#mapPref) });
  };

  updatePreference = async (req, res) => {
    const memberId = req.memberId;
    const { category } = req.params;

    if (!Object.values(NOTIFICATION_CATEGORIES).includes(category)) {
      throw new ApplicationError(`Unknown category: ${category}`, 400, 'validation_error');
    }

    const {
      isEnabled, quietHoursStart, quietHoursEnd, quietHoursTz,
      smartSend, maxPerDay,
    } = req.body ?? {};

    if (maxPerDay !== undefined && (typeof maxPerDay !== 'number' || maxPerDay < 0 || maxPerDay > 50)) {
      throw new ApplicationError('maxPerDay must be a number between 0 and 50', 400, 'validation_error');
    }

    const updated = await this.repo.upsertPreference(memberId, category, {
      isEnabled, quietHoursStart, quietHoursEnd, quietHoursTz, smartSend, maxPerDay,
    });

    res.json({ preference: this.#mapPref(updated) });
  };

  listNotifications = async (req, res) => {
    const memberId = req.memberId;
    const { status, category, stream, limit = '50', offset = '0' } = req.query;

    const notifications = await this.repo.listForMember(memberId, {
      status:   status ?? null,
      category: category ?? null,
      limit:    Math.min(parseInt(limit, 10) || 50, 200),
      offset:   parseInt(offset, 10) || 0,
    });

    let mapped = notifications.map(this.#mapNotification);

    if (stream) {
      mapped = mapped.filter((n) => {
        const itemStream = n.metadata?.stream;
        if (itemStream === stream) return true;
        if (stream === 'stream1_emergency' && (n.priority === 'critical' || n.category === 'emergency_protocol' || n.category === 'safety_alert')) return true;
        if (stream === 'stream2_circadian' && (n.category === 'circadian_goal' || n.category === 'goal_achievement' || n.category === 'hydration_reminder')) return true;
        if (stream === 'stream3_chrono_regimen' && (n.category === 'chrono_regimen' || n.category === 'medication_reminder')) return true;
        if (stream === 'stream4_sleep_guard' && (n.category === 'sleep_guard' || n.metadata?.stepDebtSuppressed)) return true;
        return false;
      });
    }

    res.json({ notifications: mapped });
  };

  getStats = async (req, res) => {
    const memberId = req.memberId;
    const days = parseInt(req.query.days, 10) || 7;
    const stats = await this.repo.getDeliveryStats(memberId, days);
    res.json({ stats, periodDays: days });
  };

  recordEngagement = async (req, res) => {
    const memberId = req.memberId;
    const { id: notificationId } = req.params;
    const { eventType } = req.body ?? {};

    if (!VALID_ENGAGEMENT_TYPES.includes(eventType)) {
      throw new ApplicationError(`eventType must be one of: ${VALID_ENGAGEMENT_TYPES.join(', ')}`, 400, 'validation_error');
    }

    await this.dispatch.recordEngagement(memberId, notificationId, eventType);
    res.json({ message: `Engagement '${eventType}' recorded` });
  };

  executeAction = async (req, res) => {
    const memberId = req.memberId;
    const { id: notificationId } = req.params;
    const { actionLabel, payload = {} } = req.body ?? {};

    if (!actionLabel) {
      throw new ApplicationError('actionLabel is required', 400, 'validation_error');
    }

    const result = await this.dispatch.executeAction(memberId, notificationId, actionLabel, payload);
    res.json(result);
  };

  simulateStream = async (req, res) => {
    const memberId = req.memberId;
    const { streamKey, options = {} } = req.body ?? {};

    if (!streamKey) {
      throw new ApplicationError('streamKey is required (e.g. stream1_hypoglycemia, stream1_tachycardia, stream2_morning_hydration, etc.)', 400, 'validation_error');
    }

    const result = await this.dispatch.simulateStream(memberId, streamKey, options);
    res.json({
      success: true,
      streamKey,
      result,
      message: `Stream "${streamKey}" successfully triggered and evaluated!`,
    });
  };

  createChronoRegimen = async (req, res) => {
    const memberId = req.memberId;
    const { date, prescriptionId } = req.body ?? {};

    const results = await this.dispatch.createChronoRegimenFromPrescription(memberId, { date, prescriptionId });
    res.status(201).json({
      success: true,
      message: 'MediBot 5-dose prescription chrono-regimen created and scheduled',
      doses: results,
    });
  };

  getStreamsSummary = async (req, res) => {
    const memberId = req.memberId;
    const notifications = await this.repo.listForMember(memberId, { limit: 100 });
    const mapped = notifications.map(this.#mapNotification);

    const streamCounts = {
      stream1_emergency: mapped.filter((n) => n.priority === 'critical' || n.category === 'emergency_protocol' || n.metadata?.stream === 'stream1_emergency').length,
      stream2_circadian: mapped.filter((n) => n.category === 'circadian_goal' || n.metadata?.stream === 'stream2_circadian' || n.category === 'goal_achievement').length,
      stream3_chrono_regimen: mapped.filter((n) => n.category === 'chrono_regimen' || n.metadata?.stream === 'stream3_chrono_regimen' || n.category === 'medication_reminder').length,
      stream4_sleep_guard: mapped.filter((n) => n.category === 'sleep_guard' || n.metadata?.stream === 'stream4_sleep_guard').length,
    };

    const unreadCount = mapped.filter((n) => n.status !== 'read' && n.status !== 'dismissed').length;

    res.json({
      streams: {
        stream1: {
          name: 'Tier 1: Critical Telemetry & Emergency Protocols',
          dispatchPolicy: 'Immediate 0s Bypass (Quiet hours & caps bypassed)',
          activeCount: streamCounts.stream1_emergency,
          keyTriggers: ['Hypoglycemia <70 mg/dL', 'Tachycardia >120 bpm', 'Hypoxia <90%', 'Drug Interactions'],
        },
        stream2: {
          name: 'Tier 2: Daily Wellness Goals (Circadian Paced)',
          dispatchPolicy: 'Paced Across Waking Hours (07:00 – 23:00)',
          activeCount: streamCounts.stream2_circadian,
          keyTriggers: ['07:15 AM Metabolic Kickstart', '02:30 PM Adaptive Catch-up', '05:30 PM Trail Boost'],
        },
        stream3: {
          name: 'Tier 3: Active Prescription Medications (MediBot Regimen)',
          dispatchPolicy: 'Chrono-Regimen: Meal-Cushioned & Bedtime Timing',
          activeCount: streamCounts.stream3_chrono_regimen,
          keyTriggers: ['07:30 PPI Empty Stomach', '08:30 Breakfast Metformin/Amox', '13:30 Lunch Amox', '19:30 Dinner Metformin/Amox', '21:45 Bedtime Statin'],
        },
        stream4: {
          name: 'Tier 4: Bedtime Sleep Protection & Nocturia Guard',
          dispatchPolicy: 'Active 2 Hours Before Bedtime (21:30 – 23:00)',
          activeCount: streamCounts.stream4_sleep_guard,
          keyTriggers: ['21:30 Nocturia 150ml Fluid Taper', '22:00 Inactivity Debt Silencing & Streak Reset'],
        },
      },
      unreadCount,
      totalCount: mapped.length,
    });
  };

  sendTestNotification = async (req, res) => {
    const memberId = req.memberId;
    const {
      category = 'medibot_ping',
      title    = '🧪 Test Notification',
      body     = 'This is a test push notification from MediBot.',
    } = req.body ?? {};

    const result = await this.dispatch.dispatch({
      memberId,
      category,
      priority: 'normal',
      title,
      body,
      sourceType: 'manual_test',
      idempotencyKey: `test_${memberId}_${Date.now()}`,
    });

    res.json({ ...result, message: 'Test notification dispatched' });
  };

  #mapToken(row) {
    return {
      id:          row.id,
      platform:    row.platform,
      token:       row.token.slice(0, 15) + '…',
      isActive:    row.is_active,
      appVersion:  row.app_version,
      deviceModel: row.device_model,
      lastSeenAt:  row.last_seen_at,
      createdAt:   row.created_at,
    };
  }

  #mapPref(pref) {
    return {
      category:         pref.category,
      isEnabled:        pref.is_enabled,
      quietHoursStart:  pref.quiet_hours_start,
      quietHoursEnd:    pref.quiet_hours_end,
      quietHoursTz:     pref.quiet_hours_tz,
      smartSend:        pref.smart_send,
      maxPerDay:        pref.max_per_day,
      updatedAt:        pref.updated_at,
    };
  }

  #mapNotification(n) {
    return {
      id:             n.id,
      category:       n.category,
      priority:       n.priority,
      status:         n.status,
      title:          n.title,
      body:           n.body,
      imageUrl:       n.image_url,
      deepLink:       n.deep_link,
      actionLabel:    n.action_label,
      actionUrl:      n.action_url,
      sourceType:     n.source_type,
      sourceRefId:    n.source_ref_id,
      rulesTriggered: n.rules_triggered,
      metadata:       n.metadata,
      scheduledAt:    n.scheduled_at,
      sentAt:         n.sent_at,
      deliveredAt:    n.delivered_at,
      readAt:         n.read_at,
      createdAt:      n.created_at,
    };
  }

  #defaultPref(memberId, category) {
    return {
      category,
      is_enabled:        true,
      quiet_hours_start: null,
      quiet_hours_end:   null,
      quiet_hours_tz:    'UTC',
      smart_send:        true,
      max_per_day:       5,
      updated_at:        null,
    };
  }
}
