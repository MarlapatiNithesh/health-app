/**
 * MediBot LangGraph State Annotation
 * Defines the state channels and reducers for the clinical triage graph execution.
 */

import { Annotation } from '@langchain/langgraph';

export const MediBotStateAnnotation = Annotation.Root({
  // ── Session & User Request ──────────────────────────────────────────────────
  patientId: Annotation({
    reducer: (_, update) => update,
  }),
  encounterId: Annotation({
    reducer: (_, update) => update,
  }),
  userMessage: Annotation({
    reducer: (_, update) => update,
  }),
  messages: Annotation({
    reducer: (current, update) => {
      if (!update) return current || [];
      const incoming = Array.isArray(update) ? update : [update];
      return [...(current || []), ...incoming];
    },
    default: () => [],
  }),
  intent: Annotation({
    reducer: (_, update) => update,
  }),
  startTime: Annotation({
    reducer: (_, update) => update,
  }),
  onProgress: Annotation({
    reducer: (_, update) => update,
  }),

  // ── Emergency Red Flag Screening ────────────────────────────────────────────
  isEmergency: Annotation({
    reducer: (_, update) => update,
    default: () => false,
  }),
  emergencyDetails: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // ── Grounded Clinical Context & RAG Evidence ────────────────────────────────
  patientContext: Annotation({
    reducer: (_, update) => update,
    default: () => ({}),
  }),
  ragEvidence: Annotation({
    reducer: (_, update) => update,
    default: () => ({ vectorChunks: [], documents: [] }),
  }),
  semanticMemory: Annotation({
    reducer: (_, update) => update,
    default: () => [],
  }),
  priorEncounters: Annotation({
    reducer: (_, update) => update,
    default: () => [],
  }),
  emotionState: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // ── Symptom Extraction & Triage Evaluation ──────────────────────────────────
  symptomState: Annotation({
    reducer: (current, update) => ({ ...(current || {}), ...(update || {}) }),
    default: () => ({}),
  }),
  isSymptomIntent: Annotation({
    reducer: (_, update) => update,
    default: () => false,
  }),
  nextField: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),
  assessmentComplete: Annotation({
    reducer: (_, update) => update,
    default: () => false,
  }),
  riskAssessment: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // ── Prompt Ingestion & Agent Reasoning ──────────────────────────────────────
  systemPrompt: Annotation({
    reducer: (_, update) => update,
  }),
  draftResponse: Annotation({
    reducer: (_, update) => update,
  }),

  // ── Multi-Agent Clinical Critic Review ───────────────────────────────────────
  criticApproved: Annotation({
    reducer: (_, update) => update,
    default: () => true,
  }),
  criticReason: Annotation({
    reducer: (_, update) => update,
  }),
  criticAttempts: Annotation({
    reducer: (current, update) => (update !== undefined ? update : (current || 0) + 1),
    default: () => 0,
  }),

  // ── Safety Guardrail & Persistence ──────────────────────────────────────────
  validationResult: Annotation({
    reducer: (_, update) => update,
  }),
  finalResponse: Annotation({
    reducer: (_, update) => update,
  }),
  modelRunMetrics: Annotation({
    reducer: (_, update) => update,
  }),
  resultDto: Annotation({
    reducer: (_, update) => update,
  }),
});

