/**
 * Comprehensive End-to-End Local API & MediBot Test Runner
 * Boots the Express app locally, performs real HTTP requests to all MediBot routes,
 * tests LangGraph StateGraph triage, SSE streaming, RAG queries, and emergency handling.
 */

import http from 'node:http';
import assert from 'node:assert';
import { createApp } from './src/app.js';
import { loadConfig } from './src/config/env.js';
import { PhoneVerificationRepository } from './src/repositories/phone-verification-repository.js';

process.env.ALLOW_DEV_OTP = 'true';
process.env.DEV_OTP_CODE = '123456';

console.log('========================================================================');
console.log('  STARTING LOCAL INTEGRATION TEST: MEDIBOT & EXPRESS SERVER');
console.log('========================================================================\n');

// Mock in-memory repository store for full server integration test
function createInMemoryRepositories() {
  const members = new Map();
  const phoneSessions = new Map();
  const encounters = new Map();
  const messages = new Map();
  const symptoms = new Map();
  const consents = new Map();

  const demoMemberId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const demoPhone = '+14155552671';
  members.set(demoMemberId, {
    id: demoMemberId,
    phone: demoPhone,
    role: 'member',
    name: 'Alex Mercer',
    status: 'active',
  });

  return {
    memberRepo: {
      findMemberById: async (id) => members.get(id) || null,
      findMemberByPhone: async (phone) => {
        for (const m of members.values()) {
          if (m.phone === phone) return m;
        }
        return null;
      },
      createMember: async (data) => {
        const id = data.id || 'b1ffcd88-8b0b-4ef8-bb6d-6bb9bd380b22';
        const record = { id, ...data };
        members.set(id, record);
        return record;
      },
      updateMember: async (id, data) => {
        const m = members.get(id) || { id };
        Object.assign(m, data);
        members.set(id, m);
        return m;
      },
    },
    phoneVerificationRepo: new PhoneVerificationRepository(null),
    clinicalRepo: {
      findPatientById: async () => ({ id: demoMemberId, name: 'Alex Mercer', bloodGroup: 'A+' }),
      getPatientContext: async () => ({
        name: 'Alex Mercer',
        gender: 'male',
        bloodGroup: 'A+',
        activeConditions: [{ name: 'Type 2 Diabetes', code: 'E11' }],
        activeMedications: [{ name: 'Metformin', dose: '500mg', frequency: 'twice daily' }],
        allergies: [{ substance: 'Sulfa drugs', severity: 'moderate' }],
        recentLabs: [{ name: 'HbA1c', valueNum: 7.2, unit: '%', refLow: 4.0, refHigh: 5.7 }],
      }),
      findClinicalRecords: async (_id, type) => {
        if (type === 'condition') return [{ name: 'Type 2 Diabetes' }];
        if (type === 'medication') return [{ name: 'Metformin' }];
        if (type === 'allergy') return [{ substance: 'Sulfa drugs' }];
        return [];
      },
      getConsent: async () => ({ granted: true }),
      ensurePatient: async () => {},
      createHealthEvent: async () => ({ id: 'evt-100' }),
    },
    encounterRepo: {
      createEncounter: async (patientId, data) => {
        const id = '22222222-2222-4222-8222-222222222222';
        const record = { id, patientId, ...data, messages: [] };
        encounters.set(id, record);
        return record;
      },
      findEncounterById: async (id) => {
        const enc = encounters.get(id) || {
          id,
          patientId: demoMemberId,
          messages: messages.get(id) || [],
          symptomState: symptoms.get(id) || {},
        };
        enc.messages = messages.get(id) || [];
        enc.symptomState = symptoms.get(id) || {};
        return enc;
      },
      appendMessage: async (encounterId, patientId, msg) => {
        const list = messages.get(encounterId) || [];
        const record = { id: `msg-${list.length + 1}`, ...msg };
        list.push(record);
        messages.set(encounterId, list);
        return record;
      },
      upsertSymptomState: async (encounterId, patientId, state) => {
        symptoms.set(encounterId, state);
        return state;
      },
      updateEncounterStatus: async (encounterId, updates) => {
        const enc = encounters.get(encounterId) || { id: encounterId };
        Object.assign(enc, updates);
        encounters.set(encounterId, enc);
        return enc;
      },
      logModelRun: async () => ({ id: 'run-1' }),
      listEncountersByPatient: async () => [],
      searchPatientMemory: async () => ['Patient reported elevated fasting glucose last month'],
      savePatientMemory: async () => {},
    },
    documentRepo: {
      listDocuments: async () => [
        { originalFilename: 'metabolic_panel.pdf', docType: 'lab_result', summary: 'Elevated fasting blood sugar' },
      ],
      searchEmbeddings: async () => [
        { id: 'emb-1', section: 'Endocrinology', contentText: 'Fasting glucose: 142 mg/dL. Metformin prescribed.', similarity: 0.88 },
      ],
      searchGuidelineEmbeddings: async () => [
        { id: 'guide-1', title: 'ADA Diabetes Guidelines', contentText: 'First-line therapy for T2D is Metformin and lifestyle changes.', similarity: 0.92 },
      ],
    },
    phoneHealthRepo: {},
    wearableRepo: {},
    healthSampleRepo: {},
  };
}

async function testLocalServer() {
  const config = loadConfig();
  const testPort = 4040;
  const repos = createInMemoryRepositories();

  // Create Express App with MediBot
  const { app } = createApp({
    ...config,
    jwtSecret: 'c2VjdXJlLXdlbGxuZXNzLWFwcC1qd3Qtc2VjcmV0LWtleS0yMDI2',
    repositories: repos,
    startNotificationScheduler: false,
  });

  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(testPort, '127.0.0.1', resolve));
  console.log(`[HTTP Server] Listening on http://127.0.0.1:${testPort}`);

  const baseUrl = `http://127.0.0.1:${testPort}`;

  try {
    // ── 1. Test GET /medibot/status ──────────────────────────────────────────
    console.log('\n[TEST 1] GET /medibot/status');
    const statusRes = await fetch(`${baseUrl}/medibot/status`);
    assert.strictEqual(statusRes.status, 200, 'Status endpoint must return 200');
    const statusData = await statusRes.json();
    console.log('Status Response:', statusData);
    assert.strictEqual(statusData.status, 'ok');
    assert.strictEqual(statusData.framework, 'langchain_langgraph');
    console.log('✅ PASS: /medibot/status returns ok with langchain_langgraph framework');

    // ── 2. Authenticate via Phone OTP ────────────────────────────────────────
    console.log('\n[TEST 2] POST /phone/send-otp & /phone/verify-otp (Dev Bypass 123456)');
    const sendOtpRes = await fetch(`${baseUrl}/phone/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+14155552671' }),
    });
    if (!sendOtpRes.ok) {
      const err = await sendOtpRes.text();
      console.error('Send OTP failed:', sendOtpRes.status, err);
    }
    assert.strictEqual(sendOtpRes.status, 200);

    const verifyOtpRes = await fetch(`${baseUrl}/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+14155552671', code: '123456' }),
    });
    if (!verifyOtpRes.ok) {
      const err = await verifyOtpRes.text();
      console.error('Verify OTP failed:', verifyOtpRes.status, err);
    }
    assert.strictEqual(verifyOtpRes.status, 200);
    const authData = await verifyOtpRes.json();
    const token = authData.token;
    assert(token, 'Must receive JWT token from verify-otp');
    console.log('✅ PASS: Authenticated successfully! JWT token obtained.');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // ── 3. Test POST /medibot/chat (Standard JSON Triage) ────────────────────
    console.log('\n[TEST 3] POST /medibot/chat (Adaptive Triage: Cough turn)');
    const chatRes = await fetch(`${baseUrl}/medibot/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        message: 'I have a dry cough for 3 days, severity 5/10',
      }),
    });
    assert.strictEqual(chatRes.status, 200);
    const chatData = await chatRes.json();
    console.log('Chat Triage Output:');
    console.log(`- Role: ${chatData.role}`);
    console.log(`- Content: "${chatData.content}"`);
    console.log(`- Risk Level: ${chatData.riskLevel}`);
    console.log(`- Symptom Assessment:`, chatData.symptomAssessment);
    assert(chatData.content.length > 0, 'Content must not be empty');
    assert.strictEqual(chatData.role, 'assistant');
    console.log('✅ PASS: /medibot/chat executed LangGraph triage and returned structured response');

    // ── 4. Test POST /medibot/chat with SSE Streaming (stream: true) ─────────
    console.log('\n[TEST 4] POST /medibot/chat with SSE Streaming (stream: true)');
    const streamRes = await fetch(`${baseUrl}/medibot/chat`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        message: 'What should I do if my blood sugar feels a bit high today?',
        stream: true,
      }),
    });
    assert.strictEqual(streamRes.status, 200);
    const sseBody = await streamRes.text();
    console.log('Received SSE stream bytes:', sseBody.length);
    assert(sseBody.includes('event'), 'Must contain SSE events');
    assert(sseBody.includes('progress') || sseBody.includes('complete'), 'Must contain progress or complete event');
    console.log('✅ PASS: Real-time SSE streaming events received properly from LangGraph!');

    // ── 5. Test Emergency Red-Flag Interception ──────────────────────────────
    console.log('\n[TEST 5] POST /medibot/chat (Emergency Red-Flag Short-Circuit: Chest Pain)');
    const emergencyRes = await fetch(`${baseUrl}/medibot/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        message: 'I am having crushing chest pain and feel breathless!',
      }),
    });
    assert.strictEqual(emergencyRes.status, 200);
    const emergencyData = await emergencyRes.json();
    console.log('Emergency Alert Response:');
    console.log(`- Risk Level: ${emergencyData.riskLevel}`);
    console.log(`- Emergency Flag:`, emergencyData.emergency);
    console.log(`- Content: "${emergencyData.content}"`);
    assert.strictEqual(emergencyData.riskLevel, 'high');
    assert.strictEqual(emergencyData.emergency?.flag, true);
    assert.strictEqual(emergencyData.emergency?.trigger, 'chest pain');
    console.log('✅ PASS: Emergency 0s short-circuit triggered in LangGraph!');

    // ── 6. Test POST /medibot/rag (Semantic RAG Query) ───────────────────────
    console.log('\n[TEST 6] POST /medibot/rag (Grounded Clinical RAG Search)');
    const ragRes = await fetch(`${baseUrl}/medibot/rag`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: 'What was my latest HbA1c result and Metformin medication?',
      }),
    });
    assert.strictEqual(ragRes.status, 200);
    const ragData = await ragRes.json();
    console.log('RAG Response:');
    console.log(`- Results count: ${ragData.results?.length}`);
    console.log(`- Correlated Medications:`, ragData.structuredEvidence?.medications);
    console.log(`- Correlated Labs:`, ragData.structuredEvidence?.labs);
    assert(Array.isArray(ragData.results));
    assert(ragData.structuredEvidence?.medications?.length > 0);
    console.log('✅ PASS: Vector RAG query successfully retrieved grounded documents and records!');

    // ── 7. Test POST /medibot/rules/validate (Clinical Rules Check) ──────────
    console.log('\n[TEST 7] POST /medibot/rules/validate (Drug Contraindication Validation)');
    const ruleRes = await fetch(`${baseUrl}/medibot/rules/validate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ drug: 'Metformin' }),
    });
    assert.strictEqual(ruleRes.status, 200);
    const ruleData = await ruleRes.json();
    console.log('Rule Validation Output:', ruleData);
    console.log('✅ PASS: Clinical rules engine successfully evaluated drug action!');

    console.log('\n========================================================================');
    console.log('  ALL 7 LOCAL LIVE SERVER & MEDIBOT INTEGRATION TESTS PASSED! 🎉');
    console.log('========================================================================\n');
  } finally {
    server.close();
  }
}

testLocalServer().catch((err) => {
  console.error('Local server test failed:', err);
  process.exit(1);
});

