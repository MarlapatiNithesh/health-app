/**
 * Live Database & Server Integration Test
 * Connects directly to the real PostgreSQL database on port 5433 using .env configuration,
 * launches Express API, and verifies full member login and LangGraph MediBot triage.
 */

import http from 'node:http';
import assert from 'node:assert';
import { createApp } from './src/app.js';
import { loadConfig } from './src/config/env.js';
import { createDatabasePool } from './src/database/pool.js';
import { createRepositories } from './src/repositories/index.js';

console.log('========================================================================');
console.log('  LIVE POSTGRESQL & LANGGRAPH MEDIBOT INTEGRATION TEST');
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

  const testPort = 4041;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(testPort, '127.0.0.1', resolve));
  console.log(`[Express API] Running on http://127.0.0.1:${testPort} connected to live PostgreSQL`);

  const baseUrl = `http://127.0.0.1:${testPort}`;

  try {
    // ── 1. Status Check ───────────────────────────────────────────────────────
    console.log('\n[STEP 1] Testing /medibot/status');
    const statusRes = await fetch(`${baseUrl}/medibot/status`);
    assert.strictEqual(statusRes.status, 200);
    const status = await statusRes.json();
    console.log('MediBot Status:', status.status, '| Framework:', status.framework, '| RAG Engine:', status.rag_engine);
    assert.strictEqual(status.framework, 'langchain_langgraph');

    // ── 2. Real OTP Flow (Persists Member to Database) ────────────────────────
    console.log('\n[STEP 2] Testing OTP Login (Dev Bypass 123456 -> Real PostgreSQL member)');
    const phone = '+14155552671';
    const sendRes = await fetch(`${baseUrl}/phone/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    assert.strictEqual(sendRes.status, 200);
    const sendData = await sendRes.json();
    console.log('OTP Send Status:', sendData.status, '| Session ID:', sendData.sessionId);

    const verifyRes = await fetch(`${baseUrl}/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: '123456' }),
    });
    assert.strictEqual(verifyRes.status, 200);
    const auth = await verifyRes.json();
    const token = auth.token;
    const memberId = auth.memberId || auth.member?.id;
    console.log('Authenticated Member ID:', memberId);
    console.log('JWT Token successfully issued!');

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Grant clinical consent for AI processing
    console.log('\n[STEP 2.5] Granting clinical consent for AI processing (/medibot/consents)');
    const consentRes = await fetch(`${baseUrl}/medibot/consents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ scope: 'ai_processing', granted: true }),
    });
    assert.strictEqual(consentRes.status, 200);
    console.log('Clinical consent granted successfully!');

    // ── 3. Real LangGraph Chat Triage Turn (Persisted to Database) ────────────
    console.log('\n[STEP 3] Testing /medibot/chat with LangGraph StateGraph Execution');
    const chatRes = await fetch(`${baseUrl}/medibot/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: 'Hi MediBot, I have had a severe sore throat and fever for 2 days.',
      }),
    });
    assert.strictEqual(chatRes.status, 200);
    const chat = await chatRes.json();
    console.log('MediBot Assistant Output:');
    console.log(`- Role: ${chat.role}`);
    console.log(`- Encounter ID (DB UUID): ${chat.encounterId}`);
    console.log(`- Risk Level: ${chat.riskLevel}`);
    console.log(`- Primary Symptom:`, chat.symptomAssessment?.primarySymptom);
    console.log(`- Next Clinical Inquiry Field:`, chat.symptomAssessment?.nextField);
    console.log(`- Response: "${chat.content.slice(0, 180)}..."`);
    assert(chat.content.length > 0);
    assert(chat.encounterId);

    // Verify row in database
    const dbCheck = await pool.query('SELECT count(*) FROM chat_sessions WHERE id = $1', [chat.encounterId]);
    console.log(`Verified in PostgreSQL: ${dbCheck.rows[0].count} encounter session(s) active in database.`);
    assert.strictEqual(parseInt(dbCheck.rows[0].count, 10), 1);

    // ── 4. Emergency Short-Circuit ───────────────────────────────────────────
    console.log('\n[STEP 4] Testing Emergency Red-Flag Protocol');
    const emRes = await fetch(`${baseUrl}/medibot/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        encounterId: chat.encounterId,
        message: 'I am experiencing sudden shortness of breath and cannot breathe properly.',
      }),
    });
    assert.strictEqual(emRes.status, 200);
    const emChat = await emRes.json();
    console.log(`Emergency Flag: ${emChat.emergency?.flag} | Trigger: ${emChat.emergency?.trigger}`);
    console.log(`Risk Level: ${emChat.riskLevel}`);
    assert.strictEqual(emChat.riskLevel, 'high');
    assert.strictEqual(emChat.emergency?.flag, true);

    // ── 5. Real PostgreSQL RAG Query ─────────────────────────────────────────
    console.log('\n[STEP 5] Testing /medibot/rag over PostgreSQL Vector Store');
    const ragRes = await fetch(`${baseUrl}/medibot/rag`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: 'What medication guidelines apply for hypertension and diabetes?',
      }),
    });
    assert.strictEqual(ragRes.status, 200);
    const rag = await ragRes.json();
    console.log('RAG Query Response:');
    console.log(`- Results count: ${rag.results?.length}`);
    console.log(`- Structured Evidence:`, rag.structuredEvidence);

    console.log('\n========================================================================');
    console.log('  ALL LIVE DATABASE & LANGGRAPH MEDIBOT TESTS PASSED! 🎉');
    console.log('========================================================================\n');
  } finally {
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
