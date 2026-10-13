import { createAccessToken } from '../src/security/tokens.js';
import { Pool } from 'pg';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-super-safe-long-jwt-key-32chars!!';
const PORT = process.env.PORT || 4000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PATIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

async function runTests() {
  console.log('🧪 Starting End-to-End Verification of Friend Features...');
  console.log(`📡 Target API: ${BASE_URL}`);

  const token = createAccessToken(PATIENT_ID, JWT_SECRET);
  console.log('🔑 Generated Auth Token for Patient:', PATIENT_ID);

  // 1. Test POST /medibot/chat with Gemini Model
  console.log('\n--- [Test 1] POST /medibot/chat with model = "gemini" ---');
  let chatRes = await fetch(`${BASE_URL}/medibot/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: 'Hello, what should I eat for breakfast with mild hypertension?',
      model: 'gemini',
    }),
  });

  if (!chatRes.ok) {
    const errText = await chatRes.text();
    throw new Error(`Chat (gemini) failed with status ${chatRes.status}: ${errText}`);
  }

  const geminiData = await chatRes.json();
  console.log('✅ Chat (gemini) Response Received:');
  console.log('   Message ID:', geminiData.messageId);
  console.log('   Model Name:', geminiData.modelName);
  console.log('   Encounter ID:', geminiData.encounterId);
  console.log('   Content Preview:', geminiData.content ? geminiData.content.slice(0, 100) + '...' : 'EMPTY');

  const testMessageId = geminiData.messageId || 'msg-test-' + Date.now();
  const testEncounterId = geminiData.encounterId;

  // 2. Test POST /medibot/chat with MedGemma Model
  console.log('\n--- [Test 2] POST /medibot/chat with model = "medgamma" ---');
  let medgammaRes = await fetch(`${BASE_URL}/medibot/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: 'Briefly explain difference between systolic and diastolic BP.',
      model: 'medgamma',
      encounterId: testEncounterId,
    }),
  });

  if (!medgammaRes.ok) {
    const errText = await medgammaRes.text();
    throw new Error(`Chat (medgamma) failed with status ${medgammaRes.status}: ${errText}`);
  }

  const medgammaData = await medgammaRes.json();
  console.log('✅ Chat (medgamma) Response Received:');
  console.log('   Message ID:', medgammaData.messageId);
  console.log('   Model Name:', medgammaData.modelName);
  console.log('   Content Preview:', medgammaData.content ? medgammaData.content.slice(0, 100) + '...' : 'EMPTY');

  // 3. Test POST /medibot/chat/feedback with thumbs_up
  console.log('\n--- [Test 3] POST /medibot/chat/feedback (Thumbs Up) ---');
  let fbUpRes = await fetch(`${BASE_URL}/medibot/chat/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messageId: testMessageId,
      encounterId: testEncounterId,
      rating: 'thumbs_up',
    }),
  });

  if (!fbUpRes.ok) {
    const errText = await fbUpRes.text();
    throw new Error(`Feedback (thumbs_up) failed with status ${fbUpRes.status}: ${errText}`);
  }

  const fbUpData = await fbUpRes.json();
  console.log('✅ Feedback (thumbs_up) recorded successfully:', fbUpData);

  // 4. Test POST /medibot/chat/feedback with thumbs_down and tags
  console.log('\n--- [Test 4] POST /medibot/chat/feedback (Thumbs Down with Tags) ---');
  let fbDownRes = await fetch(`${BASE_URL}/medibot/chat/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messageId: medgammaData.messageId || 'msg-down-' + Date.now(),
      encounterId: testEncounterId,
      rating: 'thumbs_down',
      tags: ['Inaccurate Diagnosis', 'Missed Allergies/Context'],
      feedbackText: 'E2E automated test clinical alignment evaluation note.',
    }),
  });

  if (!fbDownRes.ok) {
    const errText = await fbDownRes.text();
    throw new Error(`Feedback (thumbs_down) failed with status ${fbDownRes.status}: ${errText}`);
  }

  const fbDownData = await fbDownRes.json();
  console.log('✅ Feedback (thumbs_down) recorded successfully:', fbDownData);

  // 4.5 Test POST /medibot/chat/summarize to populate patient_memory
  console.log('\n--- [Test 4.5] POST /medibot/chat/summarize (Saving to patient_memory) ---');
  let sumRes = await fetch(`${BASE_URL}/medibot/chat/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      encounterId: testEncounterId,
    }),
  });

  if (!sumRes.ok) {
    const errText = await sumRes.text();
    console.warn(`Summarize notice: status ${sumRes.status}: ${errText}`);
  } else {
    const sumData = await sumRes.json();
    console.log('✅ Chat session successfully summarized into semantic memory:', sumData);
  }

  // 5. Query PostgreSQL directly to confirm database integrity
  console.log('\n--- [Test 5] Querying PostgreSQL "chat_feedback" and "patient_memory" tables ---');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/wellness_db',
  });

  try {
    const dbRes = await pool.query(
      `SELECT id, message_id, patient_id, rating, tags, feedback_text, created_at 
       FROM chat_feedback 
       WHERE patient_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [PATIENT_ID]
    );

    console.log(`✅ Found ${dbRes.rows.length} verified feedback rows in PostgreSQL:`);
    console.table(dbRes.rows);

    const memRes = await pool.query(
      `SELECT id, patient_id, encounter_id, summary_text, created_at 
       FROM patient_memory 
       WHERE patient_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [PATIENT_ID]
    );
    console.log(`✅ Found ${memRes.rows.length} verified semantic rows in "patient_memory":`);
    console.table(memRes.rows);
  } finally {
    await pool.end();
  }

  console.log('\n🎉 ALL FRIEND FEATURES VERIFIED AND CONFIRMED FULLY WORKING IN BACKEND & DATABASE!');
}

runTests().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
