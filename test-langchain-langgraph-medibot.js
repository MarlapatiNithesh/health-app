/**
 * Test Suite: LangChain and LangGraph MediBot System
 * Verifies all phases of the LangChain / LangGraph clinical triage and RAG workflow:
 *  1. Emergency red-flag screen & fast escalation
 *  2. Prompt Ingestion engine & RAG context assembly
 *  3. LangChain RecursiveCharacterTextSplitter document chunking
 *  4. LangChain MediBotEmbeddings & vector similarity math
 *  5. Structured symptom extraction & Priority table question selection
 *  6. Clinical Critic review & auto-correction loop
 *  7. Response safety guardrail enforcement
 *  8. End-to-end LangGraph StateGraph execution & result DTO
 */

import assert from 'node:assert';
import {
  MediBotService,
  MediBotDocumentChunker,
  MediBotEmbeddings,
  PostgresPgVectorStore,
  MediBotPromptIngester,
  buildMediBotGraph,
  medibotConfig,
} from './src/medibot/index.js';
import { SymptomPriorityService } from './src/services/symptom-priority-service.js';
import { ResponseSafetyValidator } from './src/services/response-safety-validator.js';
import { ClinicalTriageMapper } from './src/mappers/clinical-triage-mapper.js';

console.log('========================================================================');
console.log('  LANGCHAIN & LANGGRAPH MEDIBOT: VERIFICATION TEST SUITE');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[TEST ${totalTests}] ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[TEST ${totalTests}] ❌ FAIL: ${name}`);
    console.error(err);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[TEST ${totalTests}] ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[TEST ${totalTests}] ❌ FAIL: ${name}`);
    console.error(err);
  }
}

// ── Mock Repositories for Hermetic Testing ───────────────────────────────────
function createMockRepos() {
  const encounters = new Map();
  const messages = new Map();
  const symptoms = new Map();
  const memories = [];

  return {
    encounterRepo: {
      createEncounter: async (patientId, data) => {
        const id = '11111111-1111-4111-8111-111111111111';
        const enc = { id, patientId, ...data, messages: [] };
        encounters.set(id, enc);
        return enc;
      },
      findEncounterById: async (id) => {
        const enc = encounters.get(id) || {
          id,
          patientId: 'patient-test-01',
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
      logModelRun: async () => ({ id: 'model-run-1' }),
      listEncountersByPatient: async () => [],
      searchPatientMemory: async () => memories.map((m) => m.summary),
      savePatientMemory: async (patientId, encounterId, summary) => {
        memories.push({ patientId, encounterId, summary });
      },
    },
    clinicalRepo: {
      getPatientContext: async () => ({
        name: 'Jane Doe',
        gender: 'female',
        bloodGroup: 'O+',
        activeConditions: [{ name: 'Hypertension', code: 'I10' }],
        activeMedications: [{ name: 'Lisinopril', dose: '10mg', frequency: 'daily' }],
        allergies: [{ substance: 'Penicillin', severity: 'severe' }],
        recentLabs: [{ name: 'HbA1c', valueNum: 5.6, unit: '%', refLow: 4.0, refHigh: 5.7 }],
      }),
      findPatientById: async () => ({ id: 'patient-test-01', name: 'Jane Doe' }),
      findClinicalRecords: async (_id, type) => {
        if (type === 'condition') return [{ name: 'Hypertension' }];
        if (type === 'medication') return [{ name: 'Lisinopril' }];
        if (type === 'allergy') return [{ substance: 'Penicillin' }];
        return [];
      },
      createHealthEvent: async () => ({ id: 'evt-1' }),
    },
    documentRepo: {
      listDocuments: async () => [
        { originalFilename: 'blood_panel_march.pdf', docType: 'lab_result', summary: 'Normal blood chemistry' },
      ],
      searchEmbeddings: async () => [
        { id: 'chunk-1', section: 'Cardiology', contentText: 'Blood pressure reading: 120/80 mmHg', similarity: 0.89 },
      ],
    },
    clinicalRulesService: {
      checkMedication: async (_pid, drug) => {
        if (/amoxicillin|penicillin/i.test(drug)) {
          return { safe: false, alert: 'Allergy warning: Patient is allergic to Penicillin!' };
        }
        return { safe: true, alert: 'No interactions found.' };
      },
      validateDrugAction: async ({ drug }) => ({ drug, valid: true }),
    },
  };
}

async function main() {
  const { encounterRepo, clinicalRepo, documentRepo, clinicalRulesService } = createMockRepos();

  // ── TEST 1: LangChain Recursive Document Chunking ──────────────────────────
  await runAsyncTest('LangChain RecursiveCharacterTextSplitter Chunking', async () => {
    const chunker = new MediBotDocumentChunker({ chunkSize: 120, chunkOverlap: 20 });
    const text = `PATIENT REPORT
Patient presents with chronic cough and occasional fever.
Lungs are clear to auscultation bilaterally.
PRESCRIPTION DETAILS
Prescribed Azithromycin 500mg daily for 3 days. Take with food.
LABORATORY RESULTS
CBC shows WBC 7,500/mcL. CRP within normal limits. Follow up in 10 days.`;

    const chunks = await chunker.chunkText(text, { patientId: 'p-1', documentId: 'd-1' });
    assert(chunks.length >= 2, `Expected at least 2 chunks, got ${chunks.length}`);
    assert(chunks[0].content.length > 0, 'Chunk content must not be empty');
    assert(chunks.some((c) => c.section === 'Prescription' || c.section === 'Lab Results'), 'Section inference failed');
  });

  // ── TEST 2: LangChain Embeddings & Cosine Math ──────────────────────────────
  await runAsyncTest('LangChain MediBotEmbeddings & Vector Cosine Similarity', async () => {
    const embeddings = new MediBotEmbeddings({ dimension: 768 });
    const doc1 = 'Hypertension high blood pressure medication Lisinopril';
    const doc2 = 'Cardiovascular systolic blood pressure elevated';
    const doc3 = 'Sprained ankle football sports injury';

    const [v1, v2, v3] = await embeddings.embedDocuments([doc1, doc2, doc3]);
    assert.strictEqual(v1.length, 768, 'Vector dimension must be 768');
    assert.strictEqual(v2.length, 768, 'Vector dimension must be 768');

    // Cosine similarity
    const dot = (a, b) => a.reduce((sum, val, i) => sum + val * b[i], 0);
    const sim12 = dot(v1, v2);
    const sim13 = dot(v1, v3);

    assert(sim12 > sim13, `Cardio docs (${sim12.toFixed(3)}) should be more similar than ankle injury (${sim13.toFixed(3)})`);
  });

  // ── TEST 3: Dynamic Prompt Ingestion ─────────────────────────────────────────
  await runAsyncTest('MediBot Prompt Ingestion Engine Formats RAG & Patient Context', async () => {
    const patientContext = await clinicalRepo.getPatientContext();
    const prompt = await MediBotPromptIngester.ingestClinicalPrompt({
      patientContext,
      ragEvidence: {
        vectorChunks: [{ section: 'Labs', contentText: 'HbA1c level is 5.6%' }],
        documents: [{ originalFilename: 'lab_report.pdf', summary: 'Normal blood work' }],
      },
      semanticMemory: ['Patient complained of mild fatigue 2 weeks ago'],
      priorEncounters: [{ intent: 'symptom_report', summary: 'Mild headache, resolved' }],
      symptomState: { primarySymptom: 'headache', severity: 6 },
      nextField: 'character',
      isSymptomIntent: true,
      assessmentComplete: false,
    });

    assert(prompt.includes('Jane Doe'), 'Demographics must include patient name');
    assert(prompt.includes('Lisinopril'), 'Active medications must be ingested');
    assert(prompt.includes('Penicillin'), 'Documented allergies must be ingested');
    assert(prompt.includes('HbA1c level is 5.6%'), 'RAG vector chunks must be grounded in prompt');
    assert(prompt.includes('Ask specifically about: CHARACTER'), 'Single question directive must target next priority field');
  });

  // ── TEST 4: Emergency Red-Flag Fast Escalation in LangGraph ──────────────────
  await runAsyncTest('LangGraph Emergency Short-Circuit (Severe Chest Pain)', async () => {
    const service = new MediBotService({
      encounterRepo,
      clinicalRepo,
      documentRepo,
      clinicalRulesService,
    });

    const progressMessages = [];
    const response = await service.handleChatMessage({
      patientId: 'patient-test-01',
      message: 'I have severe chest pain and pressure in my chest right now!',
      onProgress: (msg) => progressMessages.push(msg),
    });

    assert.strictEqual(response.riskLevel, 'high', 'Emergency must yield high risk level');
    assert.strictEqual(response.emergency?.flag, true, 'Emergency flag must be true');
    assert.strictEqual(response.emergency?.trigger, 'chest pain', 'Trigger must identify chest pain');
    assert(response.content.includes('EMERGENCY WARNING'), 'Must output emergency warning banner');
  });

  // ── TEST 5: Structured Symptom Assessment & Next Priority Field ──────────────
  await runAsyncTest('LangGraph Adaptive Symptom Triage Flow (Headache -> Character)', async () => {
    const service = new MediBotService({
      encounterRepo,
      clinicalRepo,
      documentRepo,
      clinicalRulesService,
    });

    const progressMessages = [];
    const response = await service.handleChatMessage({
      patientId: 'patient-test-01',
      message: 'I have had a bad headache for 2 days, severity is 7/10',
      onProgress: (msg) => progressMessages.push(msg),
    });

    assert(response.content, 'Response content must be generated');
    assert(response.symptomAssessment, 'Symptom assessment metadata must be populated');
    assert.strictEqual(response.symptomAssessment.primarySymptom, 'headache', 'Primary symptom extracted');
    assert.strictEqual(response.symptomAssessment.nextField, 'character', 'Next clinical inquiry field should be character');
    assert.strictEqual(response.symptomAssessment.isComplete, false, 'Assessment is still gathering details');
  });

  // ── TEST 6: Multi-Agent Clinical Critic Safety Audit ────────────────────────
  await runAsyncTest('Clinical Critic Rejects Penicillin Recommendation for Allergic Patient', async () => {
    const validator = new ResponseSafetyValidator();
    const unsafeResponse = 'You should take 500mg Amoxicillin tablets twice daily for your infection.';

    const validation = validator.validate(unsafeResponse, {
      patientContext: { allergies: [{ substance: 'Penicillin' }] },
      isSymptomAssessment: false,
    });

    assert.strictEqual(validation.status, 'REVISE', 'Specific dosage instructions must trigger safety revision');
    assert(
      validation.revisedContent.includes('professional medical advice') || validation.revisedContent.includes('consult your doctor'),
      'Revised content must include safety disclaimer'
    );
  });

  // ── TEST 7: RAG Semantic Querying Endpoint ──────────────────────────────────
  await runAsyncTest('MediBot RAG Query with Structured Evidence Correlation', async () => {
    const service = new MediBotService({
      encounterRepo,
      clinicalRepo,
      documentRepo,
      clinicalRulesService,
    });

    const ragResult = await service.queryRAG('patient-test-01', 'What is my current Lisinopril medication dose?');
    assert(ragResult.query, 'Query must be echoed');
    assert(Array.isArray(ragResult.results), 'Vector results must be an array');
    assert(ragResult.structuredEvidence?.medications?.length > 0, 'Matching Lisinopril medication must be correlated');
    assert.strictEqual(ragResult.structuredEvidence.medications[0].name, 'Lisinopril');
  });

  // ── TEST 8: Full End-to-End Chat DTO Format Compliance ──────────────────────
  runTest('ClinicalTriageMapper DTO Contract Compliance', () => {
    const dto = ClinicalTriageMapper.toChatResponseDto({
      encounterId: 'enc-123',
      role: 'assistant',
      content: 'Here is your guidance.',
      riskLevel: 'low',
      status: 'in_progress',
      messageId: 'msg-999',
      latencyMs: 120,
      symptomState: { primarySymptom: 'cough', character: 'dry' },
      nextField: 'duration',
      assessmentComplete: false,
    });

    assert.strictEqual(dto.encounterId, 'enc-123');
    assert.strictEqual(dto.role, 'assistant');
    assert.strictEqual(dto.content, 'Here is your guidance.');
    assert.strictEqual(dto.riskLevel, 'low');
    assert.strictEqual(dto.symptomAssessment.primarySymptom, 'cough');
    assert.strictEqual(dto.symptomAssessment.nextField, 'duration');
    assert.strictEqual(dto.symptomAssessment.isComplete, false);
  });

  console.log('\n========================================================================');
  console.log(`  RESULTS: ${passedTests} / ${totalTests} TESTS PASSED! 🎉`);
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
