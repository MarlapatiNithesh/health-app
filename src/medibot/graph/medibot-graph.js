/**
 * MediBot LangGraph StateGraph Builder
 * Compiles nodes, routing edges, and conditional branches into an executable LangGraph workflow.
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { MediBotStateAnnotation } from '../state/medibot-state.js';
import { createScreenEmergencyNode } from './nodes/screen-emergency.node.js';
import { createEmergencyEscalateNode } from './nodes/emergency-escalate.node.js';
import { createRetrieveContextNode } from './nodes/retrieve-context.node.js';
import { createExtractSymptomsNode } from './nodes/extract-symptoms.node.js';
import { createAssessTriageNode } from './nodes/assess-triage.node.js';
import { createHighRiskEscalateNode } from './nodes/high-risk-escalate.node.js';
import { createComposePromptNode } from './nodes/compose-prompt.node.js';
import { createAgentReasoningNode } from './nodes/agent-reasoning.node.js';
import { createClinicalCriticNode } from './nodes/clinical-critic.node.js';
import { createPromptRewriteNode } from './nodes/prompt-rewrite.node.js';
import { createSafetyGuardrailNode } from './nodes/safety-guardrail.node.js';
import { createPersistAndLearnNode } from './nodes/persist-and-learn.node.js';

export function buildMediBotGraph(dependencies = {}) {
  const {
    encounterRepo,
    clinicalRepo,
    documentRepo,
    clinicalRulesService,
    symptomPriorityService,
    responseSafetyValidator,
    llmService,
    chatModel,
    tools,
    dualRetriever,
    guidelineRetriever,
    semanticMemoryRetriever,
  } = dependencies;

  const graph = new StateGraph(MediBotStateAnnotation);

  // ── Register Nodes ──────────────────────────────────────────────────────────
  graph.addNode('screen_emergency', createScreenEmergencyNode());
  graph.addNode('emergency_escalate', createEmergencyEscalateNode({ encounterRepo }));
  graph.addNode(
    'retrieve_context',
    createRetrieveContextNode({
      clinicalRepo,
      encounterRepo,
      dualRetriever,
      semanticMemoryRetriever,
      llmService,
    })
  );
  graph.addNode(
    'extract_symptoms',
    createExtractSymptomsNode({
      encounterRepo,
      llmService,
      symptomPriorityService,
    })
  );
  graph.addNode(
    'assess_triage',
    createAssessTriageNode({
      symptomPriorityService,
      encounterRepo,
    })
  );
  graph.addNode('high_risk_escalate', createHighRiskEscalateNode({ encounterRepo }));
  graph.addNode('compose_prompt', createComposePromptNode());
  graph.addNode(
    'agent_reasoning',
    createAgentReasoningNode({
      chatModel,
      tools,
      llmService,
    })
  );
  graph.addNode(
    'clinical_critic',
    createClinicalCriticNode({
      chatModel,
      llmService,
    })
  );
  graph.addNode('prompt_rewrite', createPromptRewriteNode());
  graph.addNode('safety_guardrail', createSafetyGuardrailNode({ responseSafetyValidator }));
  graph.addNode(
    'persist_and_learn',
    createPersistAndLearnNode({
      encounterRepo,
      clinicalRepo,
      semanticMemoryRetriever,
      llmService,
      chatModel,
    })
  );

  // ── Define Edges and Conditional Branches ───────────────────────────────────
  graph.addEdge(START, 'screen_emergency');

  // Branch 1: Emergency screening
  graph.addConditionalEdges('screen_emergency', (state) => {
    return state.isEmergency ? 'emergency_escalate' : 'retrieve_context';
  });
  graph.addEdge('emergency_escalate', END);

  // Sequential retrieval and assessment
  graph.addEdge('retrieve_context', 'extract_symptoms');
  graph.addEdge('extract_symptoms', 'assess_triage');

  // Branch 2: High-risk triage escalation
  graph.addConditionalEdges('assess_triage', (state) => {
    return state.riskAssessment?.riskLevel === 'high' ? 'high_risk_escalate' : 'compose_prompt';
  });
  graph.addEdge('high_risk_escalate', END);

  // Prompt ingestion to reasoning
  graph.addEdge('compose_prompt', 'agent_reasoning');
  graph.addEdge('agent_reasoning', 'clinical_critic');

  // Branch 3: Multi-agent Clinical Critic Review & Rewrite Loop
  graph.addConditionalEdges('clinical_critic', (state) => {
    if (!state.criticApproved && (state.criticAttempts || 0) < 2) {
      return 'prompt_rewrite';
    }
    return 'safety_guardrail';
  });
  graph.addEdge('prompt_rewrite', 'agent_reasoning');

  // Safety guardrail to persistence
  graph.addEdge('safety_guardrail', 'persist_and_learn');
  graph.addEdge('persist_and_learn', END);

  return graph.compile();
}

