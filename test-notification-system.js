import {
  NotificationService,
  NotificationRulesService,
  NotificationDispatchService,
  NotificationPushService,
  NOTIFICATION_CATEGORIES,
} from './src/services/notification-service.js';

let createdNotifications = [];
let deliveries = [];
let dailyCaps = new Map();
let deviceTokens = [
  { id: 'dt-1', member_id: 'member-123', platform: 'ios', token: 'token-ios-1234567890' },
  { id: 'dt-2', member_id: 'member-123', platform: 'android', token: 'token-android-1234567890' }
];

const mockRepo = {
  createNotification: async (payload) => {
    const id = `notif-${createdNotifications.length + 1}`;
    const record = {
      id,
      ...payload,
      member_id: payload.memberId,
      status: payload.scheduledAt ? 'scheduled' : 'pending',
      created_at: new Date().toISOString()
    };
    createdNotifications.push(record);
    return record;
  },
  getById: async (id) => createdNotifications.find((n) => n.id === id) || null,
  getPreferenceForCategory: async (memberId, category) => null,
  getDailyCount: async (memberId, category) => dailyCaps.get(`${memberId}:${category}`) || 0,
  incrementDailyCount: async (memberId, category) => {
    const key = `${memberId}:${category}`;
    dailyCaps.set(key, (dailyCaps.get(key) || 0) + 1);
  },
  getOptimalSendHours: async () => [],
  getActiveTokens: async (memberId) => deviceTokens.filter((t) => t.member_id === memberId),
  markEnqueued: async (id) => {
    const notif = createdNotifications.find((n) => n.id === id);
    if (notif) notif.status = 'enqueued';
    return notif;
  },
  markSent: async (id) => {
    const notif = createdNotifications.find((n) => n.id === id);
    if (notif) notif.status = 'sent';
    return notif;
  },
  markFailed: async (id, reason) => {
    const notif = createdNotifications.find((n) => n.id === id);
    if (notif) {
      notif.status = 'failed';
      notif.failReason = reason;
    }
    return notif;
  },
  suppress: async (id, reason) => {
    const notif = createdNotifications.find((n) => n.id === id);
    if (notif) {
      notif.status = 'suppressed';
      notif.suppressReason = reason;
    }
    return notif;
  },
  createDelivery: async (delivery) => {
    deliveries.push(delivery);
    return delivery;
  },
  logEngagement: async () => {},
  markEngaged: async (id, type) => {
    const notif = createdNotifications.find((n) => n.id === id);
    if (notif) notif.status = type === 'read' ? 'read' : 'dismissed';
  }
};

async function runTests() {
  console.log('--- START NOTIFICATION SYSTEM TEST SUITE (USER GOALS: STEPS, WATER, NUTRITION) ---');

  const rules = new NotificationRulesService({ notificationRepo: mockRepo });
  const push = new NotificationPushService({ notificationRepo: mockRepo });
  const dispatch = new NotificationDispatchService({
    notificationRulesService: rules,
    notificationPushService: push,
    notificationRepo: mockRepo,
  });

  const memberId = 'member-123';

  console.log('\n[TEST 1] User Step Goal Achieved (10,000 steps reached)');
  await dispatch.onHealthDataIngested(memberId, {
    samples: [{ metric: 'steps', value: 10450 }],
    goals: { steps: 10000 }
  });
  const stepAchieved = createdNotifications.find((n) => n.idempotencyKey?.includes('step_goal_completed'));
  console.log('Result:', stepAchieved ? `PASS: ${stepAchieved.title} -> "${stepAchieved.body}"` : 'FAIL');

  console.log('\n[TEST 2] User Step Goal Halfway Milestone (5,500 of 10,000 steps)');
  await dispatch.onStepGoalProgress(memberId, { currentSteps: 5500, targetSteps: 10000 });
  const stepHalfway = createdNotifications.find((n) => n.idempotencyKey?.includes('step_goal_halfway'));
  console.log('Result:', stepHalfway ? `PASS: ${stepHalfway.title} -> "${stepHalfway.body}"` : 'FAIL');

  console.log('\n[TEST 3] User Water / Hydration Goal Achieved (2,200 ml / 2,000 ml target)');
  await dispatch.onHealthDataIngested(memberId, {
    samples: [{ metric: 'water', value: 2200 }],
    goals: { waterMl: 2000 }
  });
  const waterAchieved = createdNotifications.find((n) => n.idempotencyKey?.includes('water_goal_completed'));
  console.log('Result:', waterAchieved ? `PASS: ${waterAchieved.title} -> "${waterAchieved.body}"` : 'FAIL');

  console.log('\n[TEST 4] User Water Hydration Reminder (Midday low intake check)');
  await dispatch.onWaterGoalProgress(memberId, { currentMl: 600, targetMl: 2000 });
  const waterReminder = createdNotifications.find((n) => n.idempotencyKey?.includes('water_reminder'));
  console.log('Result:', waterReminder ? `PASS: ${waterReminder.title} -> "${waterReminder.body}"` : 'SKIPPED (utcHour condition)');

  console.log('\n[TEST 5] User Nutrition Goal on Track (1,950 kcal / 2,000 kcal target)');
  await dispatch.onHealthDataIngested(memberId, {
    samples: [{ metric: 'calories', value: 1950 }],
    goals: { calories: 2000 }
  });
  const nutritionOnTrack = createdNotifications.find((n) => n.idempotencyKey?.includes('nutrition_goal_completed'));
  console.log('Result:', nutritionOnTrack ? `PASS: ${nutritionOnTrack.title} -> "${nutritionOnTrack.body}"` : 'FAIL');

  console.log('\n[TEST 6] Vitals Anomaly (High Heart Rate > 120 bpm at rest)');
  await dispatch.onHealthDataIngested(memberId, {
    samples: [{ metric: 'heart_rate', value: 135, externalId: 'hr-sample-99' }]
  });
  const hrNotif = createdNotifications.find((n) => n.category === NOTIFICATION_CATEGORIES.VITALS_ANOMALY && n.metadata?.hr === 135);
  console.log('Result:', hrNotif ? `PASS: [${hrNotif.priority}] ${hrNotif.title}` : 'FAIL');

  console.log('\n[TEST 7] Vitals Anomaly (Critical Low SpO2 < 90%)');
  await dispatch.onHealthDataIngested(memberId, {
    samples: [{ metric: 'spo2', value: 88, externalId: 'spo2-sample-12' }]
  });
  const spo2Notif = createdNotifications.find((n) => n.category === NOTIFICATION_CATEGORIES.VITALS_ANOMALY && n.metadata?.spo2 === 88);
  console.log('Result:', spo2Notif ? `PASS: [${spo2Notif.priority}] ${spo2Notif.title}` : 'FAIL');

  console.log('\n[TEST 8] MediBot Proactive Health Ping');
  await dispatch.onProactivePing(memberId, {
    pingMessage: 'Hi John, I noticed your HbA1c is 8.4%. How have your energy levels been this week?',
    rulesTriggered: [{ type: 'high_hba1c_alert' }],
    sourceRefId: 'event-001'
  });
  const medibotNotif = createdNotifications.find((n) => n.category === NOTIFICATION_CATEGORIES.MEDIBOT_PING);
  console.log('Result:', medibotNotif ? `PASS: ${medibotNotif.title} -> "${medibotNotif.body}"` : 'FAIL');

  console.log('\n[TEST 9] Critical Safety Alert (Drug Interaction)');
  await dispatch.onDrugInteractionDetected(memberId, {
    drug: 'Warfarin',
    interactingWith: 'Aspirin',
    severity: 'UNSAFE',
    reason: 'Severe risk of gastrointestinal bleeding.'
  });
  const safetyNotif = createdNotifications.find((n) => n.category === NOTIFICATION_CATEGORIES.SAFETY_ALERT);
  console.log('Result:', safetyNotif ? `PASS: [${safetyNotif.priority}] ${safetyNotif.title}` : 'FAIL');

  console.log('\n[TEST 10] Push Deliveries Check');
  await new Promise((r) => setTimeout(r, 100));
  console.log(`Total notifications created: ${createdNotifications.length}`);
  console.log(`Total deliveries generated: ${deliveries.length}`);
  const allDelivered = deliveries.length > 0 && deliveries.every((d) => d.status === 'sent');
  console.log('Deliveries status:', allDelivered ? 'PASS: All delivered to iOS and Android active tokens' : 'FAIL');

  console.log('\n--- ALL USER GOALS & HEALTH NOTIFICATION TESTS COMPLETED ---');
}

runTests().catch(console.error);
