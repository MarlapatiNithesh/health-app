/**
 * Comprehensive Verification: Specialist Doctor Questioning Loop & RLHF Feedback
 * Tests:
 * 1. Specialist Bedside Manner & SOCRATES Adaptive Questioning Loop
 * 2. Follow-up quick-response chips under "### Follow-up & Feedback Questions:"
 * 3. Thorough clinical synthesis once sufficient diagnostic info is gathered
 * 4. Closing follow-up ("anything else?") check
 * 5. Model accuracy feedback prompt for future clinical AI training
 * 6. Feedback submission to POST /medibot/chat/feedback and verification in PostgreSQL `chat_feedback` table
 */

import http from 'node:http';
import assert from 'node:assert';
import { createApp } from './src/app.js';
import { loadConfig } from './src/config/env.js';
import { createDatabasePool } from './src/database/pool.js';
import { createRepositories } from './src/repositories/index.js';

console.log('========================================================================');
console.log('  SPECIALIST DOCTOR QUESTIONING LOOP & RLHF ACCURACY FEEDBACK TEST');
console.log('========================================================================\n');

async function main() {
  const config = loadConfig();
  const pool = createDatabasePool(config.databaseUrl);
  const repositories = createRepositories(pool);

  const { app } = createApp({
    ...config,
    pool,
    repositories,
    startNotificationScheduler: false,
  });

  const testPort = 4042;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(testPort, '127.0.0.1', resolve));
  console.log(`[Express API] Running on http://127.0.0.1:${testPort}`);

  const baseUrl = `http://127.0.0.1:${testPort}`;

  try {
    // ── 1. Authentication & Consent ──────────────────────────────────────────
    console.log('[STEP 1] Authenticating member & granting AI processing consent...');
    const phone = '+14155552688';
    await fetch(`${baseUrl}/phone/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const verifyRes = await fetch(`${baseUrl}/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: '123456' }),
    });
    const auth = await verifyRes.json();
    const token = auth.token;
    const memberId = auth.memberId || auth.member?.id;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    await fetch(`${baseUrl}/medibot/consents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ scope: 'ai_processing', granted: true }),
    });
    console.log(`✅ Authenticated member: ${memberId}\n`);

    // ── 2. Turn 1: Patient reports initial symptom ────────────────────────────
    console.log('[STEP 2] Turn 1: Patient presents initial symptom ("I have a throbbing headache since morning")');
    const turn1Res = await fetch(`${baseUrl}/medibot/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: 'I have a throbbing headache since morning.',
      }),
    });
    assert.strictEqual(turn1Res.status, 200);
    const turn1Data = await turn1Res.json();
    const encounterId = turn1Data.encounterId;

    console.log(`Encounter ID: ${encounterId}`);
    console.log(`Primary Symptom identified: ${turn1Data.symptomAssessment?.primarySymptom}`);
    console.log(`Assessment isComplete: ${turn1Data.symptomAssessment?.isComplete}`);
    console.log(`Next Field to inquire: ${turn1Data.symptomAssessment?.nextField}`);
    console.log('\n--- MediBot Specialist Response (Turn 1) ---');
    console.log(turn1Data.content);
    console.log('--------------------------------------------\n');

    assert(turn1Data.content.includes('### Follow-up & Feedback Questions:'), 'Must include interactive follow-up question chips');
    assert.strictEqual(turn1Data.symptomAssessment?.isComplete, false, 'Assessment should be in-progress gathering details');

    // ── 3. Turn 2: Patient answers follow-up with severity & aggravating factor ─
    console.log('[STEP 3] Turn 2: Patient responds to follow-up ("Severity is 8/10 and bright light makes it worse")');
    const turn2Res = await fetch(`${baseUrl}/medibot/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        encounterId,
        message: 'Severity is 8/10 and bright light makes it worse.',
      }),
    });
    assert.strictEqual(turn2Res.status, 200);
    const turn2Data = await turn2Res.json();

    console.log(`Assessment isComplete: ${turn2Data.symptomAssessment?.isComplete}`);
    console.log(`Next Field to inquire: ${turn2Data.symptomAssessment?.nextField}`);
    console.log(`Collected Fields: ${JSON.stringify(turn2Data.symptomAssessment?.collectedFields)}`);
    console.log('\n--- MediBot Specialist Response (Turn 2 - Follow-up Question) ---');
    console.log(turn2Data.content);
    console.log('--------------------------------------------------------------------\n');

    assert(turn2Data.content.includes('### Follow-up & Feedback Questions:'), 'Must include interactive follow-up question chips');

    // ── 4. Turn 3: Patient provides location and onset (Completing Minimum Information) ───
    console.log('[STEP 4] Turn 3: Patient provides location & onset ("It is on my right temple and developed gradually")');
    const turn3Res = await fetch(`${baseUrl}/medibot/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        encounterId,
        message: 'It is focused on my right temple and it developed gradually over the morning.',
      }),
    });
    assert.strictEqual(turn3Res.status, 200);
    const turn3Data = await turn3Res.json();

    console.log(`Assessment isComplete: ${turn3Data.symptomAssessment?.isComplete}`);
    console.log(`Collected Fields: ${JSON.stringify(turn3Data.symptomAssessment?.collectedFields)}`);
    console.log('\n--- MediBot Specialist Response (Turn 3 - Full Clinical Consultation) ---');
    console.log(turn3Data.content);
    console.log('--------------------------------------------------------------------\n');

    // Assert that the consultation response satisfies all specialist requirements:
    assert(
      turn3Data.content.toLowerCase().includes('differential') ||
      turn3Data.content.toLowerCase().includes('impression') ||
      turn3Data.content.toLowerCase().includes('migraine') ||
      turn3Data.content.toLowerCase().includes('tension') ||
      turn3Data.content.toLowerCase().includes('headache'),
      'Must include clinical impression / differential considerations'
    );
    assert(
      turn3Data.content.toLowerCase().includes('red flag') ||
      turn3Data.content.toLowerCase().includes('emergency') ||
      turn3Data.content.toLowerCase().includes('immediate') ||
      turn3Data.content.toLowerCase().includes('warning'),
      'Must include red flag warning signs'
    );
    assert(
      turn3Data.content.toLowerCase().includes('anything else') ||
      turn3Data.content.toLowerCase().includes('other symptoms') ||
      turn3Data.content.toLowerCase().includes('further questions') ||
      turn3Data.content.toLowerCase().includes('help you with'),
      'Must ask if there is anything else concerning the patient'
    );
    assert(
      turn3Data.content.toLowerCase().includes('helpful') ||
      turn3Data.content.toLowerCase().includes('feedback') ||
      turn3Data.content.toLowerCase().includes('train') ||
      turn3Data.content.toLowerCase().includes('accuracy'),
      'Must ask for model accuracy feedback'
    );
    assert(turn3Data.content.includes('### Follow-up & Feedback Questions:'), 'Must include interactive follow-up chips');

    const assistantMessageId = turn3Data.messageId;
    console.log(`Assistant Message ID for feedback: ${assistantMessageId}`);

    // ── 5. Turn 4: Patient submits RLHF feedback for model accuracy ───────────
    console.log('\n[STEP 5] Submitting Patient Feedback to POST /medibot/chat/feedback...');
    const feedbackRes = await fetch(`${baseUrl}/medibot/chat/feedback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messageId: assistantMessageId,
        encounterId,
        rating: 'thumbs_up',
        feedbackText: 'Accurate clinical differential and very clear at-home guidance.',
        tags: ['accurate_assessment', 'clear_guidance', 'empathetic'],
      }),
    });
    assert.strictEqual(feedbackRes.status, 200);
    const feedbackData = await feedbackRes.json();
    console.log('Feedback API Response:', feedbackData);
    assert.strictEqual(feedbackData.status, 'success');
    assert.strictEqual(feedbackData.feedback.rating, 'thumbs_up');

    // ── 6. Verify feedback in PostgreSQL chat_feedback table ─────────────────
    console.log('\n[STEP 6] Verifying stored feedback in PostgreSQL table `chat_feedback`...');
    const dbFeedback = await pool.query(
      `SELECT id, message_id, patient_id, session_id AS encounter_id, rating, feedback_text, tags, created_at
         FROM chat_feedback
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [encounterId]
    );

    assert(dbFeedback.rows.length > 0, 'Feedback row must exist in PostgreSQL chat_feedback table');
    const row = dbFeedback.rows[0];
    console.log('Verified Database Row in `chat_feedback`:');
    console.log(`- ID: ${row.id}`);
    console.log(`- Encounter ID: ${row.encounter_id}`);
    console.log(`- Rating: ${row.rating}`);
    console.log(`- Feedback Text: "${row.feedback_text}"`);
    console.log(`- Tags:`, row.tags);
    console.log(`- Created At: ${row.created_at}`);

    assert.strictEqual(row.rating, 'thumbs_up');
    assert.strictEqual(row.feedback_text, 'Accurate clinical differential and very clear at-home guidance.');

    console.log('\n========================================================================');
    console.log('  SPECIALIST DOCTOR LOOP & RLHF ACCURACY FEEDBACK TEST PASSED! 🎉');
    console.log('========================================================================\n');
  } finally {
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
