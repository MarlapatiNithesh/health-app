import { logger } from '../logger.js';
import { ClinicalTriageMapper } from '../mappers/clinical-triage-mapper.js';
import { globalGeminiClient } from '../integrations/gemini-client.js';
import { SymptomPriorityService } from './symptom-priority-service.js';
import { ResponseSafetyValidator } from './response-safety-validator.js';

const RED_FLAG_ITEMS = [
  { trigger: 'chest pain', message: 'Severe chest pain or pressure requires immediate emergency attention.', regex: /\b(?:severe\s+)?chest\s+pain\b/i },
  { trigger: 'shortness of breath', message: 'Difficulty breathing or sudden shortness of breath is a critical symptom.', regex: /\b(?:shortness\s+of\s+breath|difficulty\s+breathing|can't\s+breathe|cannot\s+breathe)\b/i },
  { trigger: 'loss of consciousness', message: 'Fainting or loss of consciousness requires urgent clinical evaluation.', regex: /\b(?:loss\s+of\s+consciousness|fainting|passed\s+out|fainted)\b/i },
  { trigger: 'sudden weakness', message: 'Sudden weakness or numbness on one side of the face/body may indicate stroke.', regex: /\b(?:sudden\s+weakness|facial\s+droop|arm\s+weakness|face\s+drooping)\b/i },
  { trigger: 'slurred speech', message: 'Sudden slurred speech or confusion may indicate stroke. Call emergency services.', regex: /\b(?:slurred\s+speech|cannot\s+speak\s+clearly|can't\s+speak)\b/i },
  { trigger: 'anaphylaxis', message: 'Signs of anaphylaxis (throat swelling, hives, difficulty breathing) are life-threatening.', regex: /\b(?:anaphylaxis|throat\s+swelling|closing\s+up|severe\s+allergic\s+reaction)\b/i },
  { trigger: 'suicidal ideation', message: 'If you are having thoughts of harming yourself, please reach out immediately to emergency services or a crisis helpline.', regex: /\b(?:want\s+to\s+die|kill\s+myself|end\s+my\s+life|suicid|self.harm|harm\s+myself)\b/i },
  { trigger: 'severe bleeding', message: 'Severe or uncontrolled bleeding requires immediate emergency care.', regex: /\b(?:severe\s+bleeding|uncontrolled\s+bleeding|bleeding\s+heavily|haemorrhage|hemorrhage)\b/i },
];

const INTENT_MAP = [
  { intent: 'symptom_report', regex: /\b(?:pain|fever|cough|symptom|ache|sore|dizzy|nausea|hurt|feel\s+(?:sick|bad|ill|unwell)|breathless|swelling|rash|bleed|vomit|diarrhoea|diarrhea|fatigue|tired|weak)\b/i },
  { intent: 'medication_question', regex: /\b(?:medicine|drug|pill|prescription|dose|dosage|medication|tablet|capsule|take|refill|pharmacy|side effect|interaction)\b/i },
  { intent: 'factual_record_query', regex: /\b(?:record|history|diagnosis|condition|allergy|allergies|blood\s+group|profile)\b/i },
  { intent: 'health_trend_question', regex: /\b(?:trend|heart\s+rate|hrv|sleep|spo2|oxygen|activity|steps|calories|wearable|tracker)\b/i },
  { intent: 'document_question', regex: /\b(?:document|file|report|test|lab|result|scan|x-ray|mri|upload|pdf)\b/i },
  { intent: 'general_health_question', regex: /\b(?:diet|exercise|healthy|nutrition|workout|wellness)\b/i },
];

const PLACEHOLDER_VECTOR = new Float32Array(768).fill(0.01);

const MAX_PRIOR_ENCOUNTERS = 4;

const MAX_CONTEXT_MESSAGES = 30;

export class ChatService {
  constructor({
    encounterRepo,
    clinicalRepo,
    documentRepo,
    clinicalRulesService,
    healthService = null,
    llmService,
    geminiClient = globalGeminiClient,
    symptomPriorityService = null,
    responseSafetyValidator = null,
  }) {
    this.encounterRepo = encounterRepo;
    this.clinicalRepo = clinicalRepo;
    this.documentRepo = documentRepo;
    this.clinicalRulesService = clinicalRulesService;
    this.healthService = healthService;
    this.llmService = llmService;
    this.geminiClient = geminiClient;

    this.symptomPriorityService = symptomPriorityService || new SymptomPriorityService();
    this.responseSafetyValidator = responseSafetyValidator || new ResponseSafetyValidator();
  }

  async handleChatMessage({
    patientId,
    encounterId = null,
    message,
    intent = null,
    model = 'gemini',
    onProgress = null,
  }) {
    const startTime = Date.now();

    const isUuid = encounterId && typeof encounterId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(encounterId);

    let encounter = isUuid
      ? await this.encounterRepo.findEncounterById(encounterId).catch(() => null)
      : null;

    if (!encounter) {
      encounter = await this.encounterRepo.createEncounter(patientId, {
        intent: intent || this.#classifyIntent(message),
      });
      encounterId = encounter.id;
    } else {
      encounterId = encounter.id;
    }

    await this.encounterRepo.appendMessage(encounterId, patientId, {
      role: 'user',
      content: message,
    });

    const redFlagMatch = this.#screenRedFlags(message);
    if (redFlagMatch) {
      const alertResponse = `🚨 **EMERGENCY WARNING**: ${redFlagMatch.message} Please seek immediate emergency medical care (call 112 / 911 / 999) or go to the nearest emergency department right now.`;

      const [, assistantMsg] = await Promise.all([
        this.encounterRepo.updateEncounterStatus(encounterId, {
          status: 'high_risk',
          riskLevel: 'high',
          flaggedForReview: true,
          summary: `EMERGENCY ALERT: ${redFlagMatch.trigger}`,
        }),
        this.encounterRepo.appendMessage(encounterId, patientId, {
          role: 'assistant',
          content: alertResponse,
          meta: { emergency: true, trigger: redFlagMatch.trigger },
          latencyMs: Date.now() - startTime,
        }),
      ]);

      return ClinicalTriageMapper.toChatResponseDto({
        encounterId,
        role: 'assistant',
        content: alertResponse,
        riskLevel: 'high',
        status: 'high_risk',
        messageId: assistantMsg.id,
        latencyMs: Date.now() - startTime,
        emergencyFlag: true,
        trigger: redFlagMatch.trigger,
      });
    }

    onProgress?.('Fetching Patient 360 profile, lab results, and medical history...');
    const healthReadingsPromise = this.healthService && typeof this.clinicalRepo?.getConsent === 'function'
      ? this.clinicalRepo.getConsent(patientId, 'health_data')
        .then((consent) => consent?.granted
          ? this.healthService.getRecentHealthContext(patientId, 30, 100)
          : [])
        .catch((err) => {
          logger.warn('Could not load consented health readings for MediBot', { error: err.message });
          return [];
        })
      : Promise.resolve([]);

    const [patientContext, refreshedEncounter, ragEvidence, priorEncounters, healthReadings, semanticMemory, emotionState] = await Promise.all([
      this.clinicalRepo.getPatientContext(patientId),
      this.encounterRepo.findEncounterById(encounterId),
      this.#retrieveDualSearchEvidence(patientId, message),
      this.encounterRepo.listEncountersByPatient(patientId, MAX_PRIOR_ENCOUNTERS + 1)
        .catch(() => []),
      healthReadingsPromise,
      this.#retrieveSemanticMemory(patientId, message),
      this.llmService.detectEmotion ? this.llmService.detectEmotion(message) : null,
    ]);

    onProgress?.('Running clinical triage and symptom classification...');
    const currentSymptomState = refreshedEncounter?.symptomState || {};
    const lastAssistantMsg = (refreshedEncounter?.messages || [])
      .slice().reverse().find((m) => m.role === 'assistant');
    const pendingNextField = lastAssistantMsg?.meta?.nextField || currentSymptomState?.pendingNextField || null;

    const detectedIntent = intent || this.#classifyIntent(message);
    const isNonSymptomQuery = ['medication_question', 'factual_record_query', 'health_trend_question', 'document_question', 'general_health_question'].includes(detectedIntent);
    const isExplicitSymptomReport = detectedIntent === 'symptom_report' || this.symptomPriorityService.isSymptomReport(message);

    const isSymptomIntent = isExplicitSymptomReport || (!isNonSymptomQuery && !!pendingNextField);

    let updatedSymptomState = currentSymptomState;

    if (isSymptomIntent) {
      updatedSymptomState = await this.#extractAndMergeSymptoms(
        encounterId, patientId, message, currentSymptomState, pendingNextField
      );
    }

    const nextField = isSymptomIntent
      ? this.symptomPriorityService.getNextField(updatedSymptomState)
      : null;

    const assessmentComplete = isSymptomIntent &&
      this.symptomPriorityService.isMinimumComplete(updatedSymptomState);

    let riskAssessment = null;
    if (isSymptomIntent && assessmentComplete && !currentSymptomState?.riskAssessed) {
      riskAssessment = this.symptomPriorityService.assessRisk(updatedSymptomState, patientContext);
      logger.info('ChatService: symptom assessment complete, risk assessed', {
        riskLevel: riskAssessment.riskLevel,
        rules: riskAssessment.triggeredRules,
      });

      if (riskAssessment.riskLevel === 'high') {
        await this.encounterRepo.updateEncounterStatus(encounterId, {
          riskLevel: 'high',
          flaggedForReview: true,
        }).catch(() => {});
      } else if (riskAssessment.riskLevel === 'medium') {
        await this.encounterRepo.updateEncounterStatus(encounterId, { riskLevel: 'medium' }).catch(() => {});
      }

      await this.encounterRepo.upsertSymptomState(encounterId, patientId, {
        ...updatedSymptomState,
        riskAssessed: true,
        riskLevel: riskAssessment.riskLevel,
        triggeredRules: riskAssessment.triggeredRules,
      }).catch(() => {});
    }

    if (riskAssessment?.riskLevel === 'high') {
      const escalationResponse = `⚠️ **Based on your symptom assessment**, your reported symptoms — particularly ${updatedSymptomState.primarySymptom || 'the symptoms described'} — warrant **urgent medical attention**.

${riskAssessment.summary}

**Please take one of the following actions immediately:**
- Call your local emergency number (112 / 911 / 999)
- Go to the nearest Emergency Department
- Call your doctor or an emergency after-hours service right now

Do not wait. This is not a diagnosis, but your symptoms require professional clinical evaluation without delay.`;

      const [, assistantMsg] = await Promise.all([
        this.encounterRepo.updateEncounterStatus(encounterId, {
          status: 'high_risk',
          riskLevel: 'high',
          flaggedForReview: true,
          summary: riskAssessment.summary,
        }),
        this.encounterRepo.appendMessage(encounterId, patientId, {
          role: 'assistant',
          content: escalationResponse,
          meta: { escalation: true, riskLevel: 'high', triggeredRules: riskAssessment.triggeredRules },
          latencyMs: Date.now() - startTime,
        }),
      ]);

      return ClinicalTriageMapper.toChatResponseDto({
        encounterId,
        role: 'assistant',
        content: escalationResponse,
        riskLevel: 'high',
        status: 'high_risk',
        messageId: assistantMsg.id,
        latencyMs: Date.now() - startTime,
        symptomState: updatedSymptomState,
        riskAssessment,
      });
    }

    const priorEncounterList = (priorEncounters || [])
      .filter((e) => e.id !== encounterId); 

    const systemPrompt = this.#buildSystemPrompt(
      patientContext,
      updatedSymptomState,
      ragEvidence,
      priorEncounterList,
      nextField,
      isSymptomIntent,
      assessmentComplete,
      healthReadings,
      semanticMemory,
      emotionState,
    );

    const allMessages = (refreshedEncounter?.messages || [])
      .map((m) => ({ role: m.role, content: m.content }));

    const windowedMessages = allMessages.length > MAX_CONTEXT_MESSAGES
      ? allMessages.slice(-MAX_CONTEXT_MESSAGES)
      : allMessages;

    let modelSystemPrompt = systemPrompt;
    if (model === 'medgamma' || model === 'medgemma') {
      onProgress?.('Consulting MedGemma 2B specialized clinical model for differential diagnosis...');
      modelSystemPrompt = `${systemPrompt}\n\n[SPECIALIZED CLINICAL MODE: MedGemma 2B Foundation Model]\nAdopt the clinical reasoning of the specialized MedGemma 2B medical model. Emphasize differential diagnoses, clinical etiology, and evidence-based medicine guidelines.`;
    } else if (model === 'gpt-4o' || model === 'openai') {
      onProgress?.('Engaging GPT-4o deep diagnostic reasoning engine...');
      modelSystemPrompt = `${systemPrompt}\n\n[DEEP REASONING MODE: GPT-4o Clinical Engine]\nAdopt comprehensive step-by-step diagnostic reasoning, multi-system pathophysiological analysis, and detailed clinical evaluation.`;
    } else {
      onProgress?.('Generating clinical response with Gemini 2.5 Flash multi-agent engine...');
    }

    const toolHandlers = this.#buildToolHandlers(patientId, encounterId);
    let llmResult;

    if (this.llmService.generateWithToolCalling) {
      llmResult = await this.llmService.generateWithToolCalling({
        messages: windowedMessages,
        systemPrompt: modelSystemPrompt,
        toolHandlers,
        requestedModel: model,
        symptomState: updatedSymptomState,
        nextField,
        assessmentComplete,
      });
    } else {
      llmResult = await this.llmService.generateCompletion({
        messages: windowedMessages,
        systemPrompt: modelSystemPrompt,
        requestedModel: model,
      });
    }

    let finalContent = llmResult.content;

    if (this.llmService.clinicalReviewAgent) {
      onProgress?.('Attending Physician Agent is reviewing the draft against your allergy list...');
      const allergiesText = (patientContext.allergies || []).map((a) => a.substance || a.name).join(', ') || 'None';
      const criticResult = await this.llmService.clinicalReviewAgent(finalContent, allergiesText);
      if (criticResult && criticResult.approved === false) {
        logger.warn('ChatService: Clinical Critic REJECTED draft', { reason: criticResult.reason });
        windowedMessages.push({ role: 'assistant', content: finalContent });
        windowedMessages.push({ role: 'user', content: `[CRITICAL REVIEW BOARD]: Your previous draft was rejected by the Attending Physician because: ${criticResult.reason}. Please rewrite your response to be safe.` });
        const rewriteResult = await this.llmService.generateCompletion({
          messages: windowedMessages,
          systemPrompt: systemPrompt + '\nIMPORTANT: Do not recommend any medication the patient is allergic to.',
        });
        finalContent = rewriteResult.content;
      }
    }

    const validationResult = this.responseSafetyValidator.validate(finalContent, {
      patientContext,
      symptomState: updatedSymptomState,
      isSymptomAssessment: isSymptomIntent && !assessmentComplete,
      nextRequiredField: nextField,
    });

    if (validationResult.status === 'REVISE' && validationResult.revisedContent) {
      finalContent = validationResult.revisedContent;
      logger.info('ChatService: response revised by safety validator', { reason: validationResult.reason });
    } else if (validationResult.status === 'BLOCK') {
      logger.warn('ChatService: response BLOCKED by safety validator', { reason: validationResult.reason });
      finalContent = 'I\'m sorry, I wasn\'t able to generate an appropriate response for that. Please consult your healthcare provider for specific medical guidance.';
    }

    const resolvedModelName = llmResult.modelName || (
      (model === 'medgamma' || model === 'medgemma')
        ? 'MedGemma 2B'
        : (model === 'gpt-4o' || model === 'openai')
        ? 'GPT-4o Clinical'
        : 'Gemini 2.5 Flash'
    );

    const [, assistantMsg] = await Promise.all([
      this.encounterRepo.logModelRun(encounterId, patientId, {
        modelName: resolvedModelName,
        modelVersion: llmResult.modelVersion || 'v1beta',
        promptHash: llmResult.promptHash || null,
        inputTokens: llmResult.tokens?.input ?? 0,
        outputTokens: llmResult.tokens?.output ?? 0,
        latencyMs: llmResult.latencyMs ?? 0,
      }),
      this.encounterRepo.appendMessage(encounterId, patientId, {
        role: 'assistant',
        content: finalContent,
        latencyMs: llmResult.latencyMs ?? 0,
        meta: {
          model: resolvedModelName,
          safetyStatus: validationResult.status,
          nextField: nextField || null,
          assessmentComplete,
        },
      }),
    ]);

    if (assessmentComplete && !currentSymptomState?.riskAssessed) {
      this.#summariseAndPersistEncounter(encounterId, patientId, refreshedEncounter?.messages || [])
        .catch((err) => logger.warn('ChatService: background summarisation failed', { error: err.message }));
    }

    return ClinicalTriageMapper.toChatResponseDto({
      encounterId,
      role: 'assistant',
      content: finalContent,
      riskLevel: refreshedEncounter?.riskLevel || 'low',
      status: refreshedEncounter?.status || 'in_progress',
      messageId: assistantMsg.id,
      latencyMs: Date.now() - startTime,
      symptomState: updatedSymptomState,
      nextField,
      assessmentComplete,
      modelName: resolvedModelName,
    });
  }

  async queryRAG(patientId, queryText) {
    try {
      let queryVector = PLACEHOLDER_VECTOR;
      if (typeof this.geminiClient?.embedContent === 'function' && queryText) {
        queryVector = await this.geminiClient.embedContent(queryText).catch(() => PLACEHOLDER_VECTOR);
      }

      const [results, patientContext] = await Promise.all([
        this.documentRepo.searchEmbeddings(patientId, queryVector, 5),
        this.clinicalRepo?.getPatientContext ? this.clinicalRepo.getPatientContext(patientId) : null,
      ]);

      const matchingMeds = (patientContext?.activeMedications || []).filter((m) => {
        const name = m?.name || m?.medicationName;
        return name && queryText.toLowerCase().includes(name.toLowerCase());
      });
      const matchingLabs = (patientContext?.recentLabs || []).filter((l) => {
        const name = l?.name || l?.testName;
        return name && queryText.toLowerCase().includes(name.toLowerCase());
      });

      return ClinicalTriageMapper.toRagResponseDto({
        query: queryText,
        results,
        structuredEvidence: {
          medications: matchingMeds,
          labs: matchingLabs,
        },
      });
    } catch {
      return ClinicalTriageMapper.toRagResponseDto({ query: queryText, results: [], structuredEvidence: { medications: [], labs: [] } });
    }
  }

  async submitFeedback(patientId, feedbackData) {
    if (typeof this.encounterRepo?.saveChatFeedback === 'function') {
      return await this.encounterRepo.saveChatFeedback(patientId, feedbackData);
    }
    return { status: 'recorded', ...feedbackData };
  }

  #buildToolHandlers(patientId, encounterId) {
    return {
      get_patient_profile:      async () => this.clinicalRepo?.findPatientById?.(patientId) ?? { error: 'Not available' },
      get_medical_history:      async () => this.clinicalRepo?.findClinicalRecords?.(patientId, 'condition') ?? [],
      get_current_medications:  async () => this.clinicalRepo?.findClinicalRecords?.(patientId, 'medication') ?? [],
      get_allergies:            async () => this.clinicalRepo?.findClinicalRecords?.(patientId, 'allergy') ?? [],
      get_recent_labs:          async () => this.clinicalRepo?.findClinicalRecords?.(patientId, 'lab_result') ?? [],
      check_drug_interactions:  async (args) => this.clinicalRulesService?.checkMedication?.(patientId, args.drug) ?? { error: 'Not implemented' },
      search_medical_knowledge: async (args) => this.#searchGuidelinesRAG(args.query),
    };
  }

  async #searchGuidelinesRAG(queryText) {
    if (typeof this.documentRepo?.searchGuidelineEmbeddings !== 'function') return [];
    try {
      let queryVector = PLACEHOLDER_VECTOR;
      if (typeof this.geminiClient?.embedContent === 'function' && queryText) {
        queryVector = await this.geminiClient.embedContent(queryText).catch(() => PLACEHOLDER_VECTOR);
      }
      return await this.documentRepo.searchGuidelineEmbeddings(queryVector, 3);
    } catch (err) {
      logger.debug('Guideline embedding search bypassed', { error: err.message });
      return [];
    }
  }

  async #extractAndMergeSymptoms(encounterId, patientId, text, existingState, pendingNextField = null) {
    try {

      const ruleExtracted = this.symptomPriorityService?.extractSymptomFromText
        ? this.symptomPriorityService.extractSymptomFromText(text, pendingNextField, existingState)
        : {};

      let llmExtracted = {};
      if (this.llmService?.generateJsonExtraction) {
        try {
          llmExtracted = await this.llmService.generateJsonExtraction(text, existingState);
        } catch {
          llmExtracted = {};
        }
      }

      const combined = { ...ruleExtracted, ...llmExtracted };

      if (pendingNextField && !combined[pendingNextField] && text.length > 1 && text.length < 90) {
        combined[pendingNextField] = text.trim();
      }

      const merged = { ...existingState };
      for (const [key, val] of Object.entries(combined)) {
        if (val !== null && val !== undefined && val !== '') {
          merged[key] = val;
        }
      }

      if (Object.keys(combined).length > 0) {
        await this.encounterRepo.upsertSymptomState(encounterId, patientId, merged)
          .catch((err) => logger.debug('ChatService: symptom state upsert failed', { error: err.message }));
        logger.debug('ChatService: symptom state updated', {
          extracted: Object.keys(combined),
          merged: Object.keys(merged),
        });
      }

      return merged;
    } catch (err) {
      logger.warn('ChatService.#extractAndMergeSymptoms failed', { error: err.message });
      return existingState;
    }
  }

  async #retrieveDualSearchEvidence(patientId, queryText) {
    let vectorChunks = [];
    if (typeof this.documentRepo?.searchEmbeddings === 'function') {
      try {
        let queryVector = PLACEHOLDER_VECTOR;
        if (typeof this.geminiClient?.embedContent === 'function' && queryText) {
          queryVector = await this.geminiClient.embedContent(queryText).catch(() => PLACEHOLDER_VECTOR);
        }
        vectorChunks = await this.documentRepo.searchEmbeddings(patientId, queryVector, 8);
      } catch (err) {
        logger.debug('Vector embedding search bypassed', { error: err.message });
      }
    }

    let documents = [];
    if (typeof this.documentRepo?.listDocuments === 'function') {
      try {
        documents = await this.documentRepo.listDocuments(patientId, 5);
      } catch (err) {
        logger.debug('Document list retrieval bypassed', { error: err.message });
      }
    }

    return { vectorChunks: vectorChunks || [], documents: documents || [] };
  }

  #classifyIntent(text = '') {
    for (const item of INTENT_MAP) {
      if (item.regex.test(text)) return item.intent;
    }
    return 'out_of_scope';
  }

  #screenRedFlags(text = '') {
    for (const item of RED_FLAG_ITEMS) {
      if (item.regex.test(text)) return item;
    }
    return null;
  }

  async summarizeEncounter(patientId, encounterId) {
    const encounter = await this.encounterRepo.findEncounterById(encounterId);
    if (!encounter) {
      throw new ApplicationError('Encounter not found', 404, 'not_found');
    }
    const messages = encounter.messages || [];
    if (messages.length === 0) {
      return { status: 'skipped', reason: 'no_messages', encounterId };
    }
    await this.#summariseAndPersistEncounter(encounterId, patientId, messages);
    return { status: 'summarized', encounterId };
  }

  async #summariseAndPersistEncounter(encounterId, patientId, messages) {
    try {
      const conversationText = messages
        .filter((m) => m.role !== 'system')
        .map((m) => `${m.role === 'user' ? 'Patient' : 'MediBot'}: ${m.content}`)
        .join('\n');

      if (!conversationText) return;

      const summary = await this.llmService.generateSummary(conversationText);

      await Promise.all([
        this.encounterRepo.updateEncounterStatus(encounterId, {
          status: 'complete',
          summary: summary.slice(0, 500),
        }),
        this.clinicalRepo.createHealthEvent(patientId, {
          eventType: 'chat_summary',
          summary: summary.slice(0, 500),
          structuredData: { encounterId, source: 'medibot_assessment' },
          sessionId: encounterId,
        }).catch(() => {}),
        this.#embedAndSaveMemory(patientId, encounterId, summary),
      ]);

      logger.info('ChatService: encounter summarised and persisted', { encounterId });
    } catch (err) {
      logger.warn('ChatService.#summariseAndPersistEncounter failed', { error: err.message });
    }
  }

  async #retrieveSemanticMemory(patientId, queryText) {
    if (!this.llmService?.embedTextHuggingFace || !queryText) return [];
    try {
      const queryVector = await this.llmService.embedTextHuggingFace(queryText);
      const vector = queryVector.length === 384 ? queryVector : new Float32Array(384).fill(0.01);
      if (typeof this.encounterRepo?.searchPatientMemory === 'function') {
        return await this.encounterRepo.searchPatientMemory(patientId, vector, 2);
      }
    } catch (err) {
      logger.debug('Semantic Memory retrieval bypassed', { error: err.message });
    }
    return [];
  }

  async #embedAndSaveMemory(patientId, encounterId, summary) {
    if (!this.llmService?.embedTextHuggingFace || !summary) return;
    try {
      const vector = await this.llmService.embedTextHuggingFace(summary);
      if (vector.length === 384 && typeof this.encounterRepo?.savePatientMemory === 'function') {
        await this.encounterRepo.savePatientMemory(patientId, encounterId, summary, vector);
      }
    } catch (err) {
      logger.debug('Semantic Memory save bypassed', { error: err.message });
    }
  }

  #buildSystemPrompt(
    context = {},
    symptomState = null,
    ragEvidence = null,
    priorEncounters = [],
    nextField = null,
    isSymptomIntent = false,
    assessmentComplete = false,
    healthReadings = [],
    semanticMemory = [],
    emotionState = null,
  ) {

    const conditions = (context.activeConditions || [])
      .map((c) => `${c.name}${c.code ? ` (${c.code})` : ''}`)
      .join(', ') || 'None recorded';

    const meds = (context.activeMedications || [])
      .map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? `, ${m.frequency}` : ''}${m.route ? ` via ${m.route}` : ''}`)
      .join('\n  - ') || 'None recorded';

    const allergies = (context.allergies || [])
      .map((a) => `${a.substance || a.name} (Reaction: ${a.details?.reaction || 'Allergy'}, Severity: ${a.severity || 'Unknown'})`)
      .join(', ') || 'None recorded';

    const labs = (context.recentLabs || [])
      .map((l) => `${l.name || l.testName}: ${l.valueNum ?? l.valueText ?? l.value ?? ''} ${l.unit || ''} [${l.interpretation || 'recorded'}]`)
      .join(', ') || 'None recorded';

    const connectedHealthReadings = (healthReadings || [])
      .map((sample) => `  - ${sample.metric}: ${sample.value} ${sample.unit || ''}; ${sample.recordedAt || sample.localDate || 'date unavailable'}; source ${sample.provider || 'phone health app'}`)
      .join('\n') || '  No recent connected health readings are available or health sharing is off.';

    const lifestyle = context.patient?.lifestyle && typeof context.patient.lifestyle === 'object' &&
      Object.keys(context.patient.lifestyle).length > 0
      ? Object.entries(context.patient.lifestyle)
          .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${v}`)
          .join(', ')
      : 'None recorded';

    const goals = Array.isArray(context.patient?.goals) && context.patient.goals.length > 0
      ? context.patient.goals.join(', ')
      : 'None recorded';

    const priorSessionSummaries = (priorEncounters || [])
      .filter((e) => e.summary || e.symptomState?.primarySymptom)
      .slice(0, MAX_PRIOR_ENCOUNTERS)
      .map((e) => {
        const date = e.startedAt ? new Date(e.startedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown date';
        const summary = e.summary || `Consultation for ${e.symptomState?.primarySymptom || e.intent || 'general concern'}`;
        const risk = e.riskLevel ? ` [Risk: ${e.riskLevel}]` : '';
        return `  • ${date}: ${summary}${risk}`;
      })
      .join('\n') || '  • No prior consultations recorded';

    const longTermMemoryText = (semanticMemory || [])
      .map((m) => `  • [Past Memory Match]: ${m.summary_text}`)
      .join('\n') || '  • No relevant long-term memories triggered.';

    const docSummaries = (ragEvidence?.documents || [])
      .map((d) => `  - [Doc ID: ${d.id}, File: ${d.originalFilename}, Type: ${d.docType}]: ${d.summary || 'Uploaded document'}`)
      .join('\n') || '  None uploaded';

    const chunkTexts = (ragEvidence?.vectorChunks || [])
      .map((c) => `  - [Relevance: ${Number(c.similarity || 0).toFixed(2)}]: ${c.contentText}`)
      .join('\n') || '  None';

    const symptomBlock = (isSymptomIntent && symptomState)
      ? this.symptomPriorityService.buildSymptomAssessmentBlock(symptomState)
      : '';

    return `You are MediBot, a personalised, evidence-based clinical AI assistant for ${context.patient?.fullName || 'the patient'}.
You are a health information assistant, not a clinician. Be warm, clear, and focused on the patient's wellbeing without claiming to diagnose or replace professional care.
${emotionState === 'HIGH_ANXIETY' ? "🚨 [SYSTEM ALERT]: The patient's message indicates HIGH ANXIETY, FEAR, or PANIC. You MUST adjust your tone to be highly empathetic, calming, and reassuring before asking any clinical questions.\n" : ''}
Blood Group: ${context.patient?.bloodGroup || 'Not recorded'}

════════════════════════════════════════════════════════════════════════════════
PATIENT PROFILE & CLINICAL HISTORY:
- Blood Group: ${context.patient?.bloodGroup || 'Not recorded'}
- Lifestyle: ${lifestyle}
- Health Goals: ${goals}

ACTIVE MEDICAL CONDITIONS:
  ${conditions}

CURRENT MEDICATIONS (Active Prescriptions):
  - ${meds}

KNOWN ALLERGIES:
  ${allergies}

RECENT LAB RESULTS:
  ${labs}

RECENT CONNECTED HEALTH APP READINGS (last 30 days; only when health sharing is enabled):
${connectedHealthReadings}

════════════════════════════════════════════════════════════════════════════════
CONSULTATION HISTORY (Session Memory — prior encounters):
${priorSessionSummaries}

════════════════════════════════════════════════════════════════════════════════
LONG-TERM MEMORY (Relevant Past Context):
${longTermMemoryText}

════════════════════════════════════════════════════════════════════════════════
UPLOADED MEDICAL DOCUMENTS:
${docSummaries}

RELEVANT EVIDENCE FROM DOCUMENTS (semantic search):
${chunkTexts}
${symptomBlock ? '\n' + symptomBlock : ''}
════════════════════════════════════════════════════════════════════════════════
CORE BEHAVIOURAL & FORMATTING RULES (follow always):

0. FORMATTING & READABILITY (CRITICAL):
${isSymptomIntent && !assessmentComplete
  ? `   - ACTIVE ASSESSMENT TURN: You are currently inquiring about: "${nextField}".
   - Keep answers CONCISE (under 120 words). Do NOT jump ahead or provide premature clinical diagnoses yet.
   - Always start with: 🎯 **Primary Focus:** Assessing ${symptomState?.primarySymptom || 'Reported Symptom'} (${nextField})
   - Acknowledge what the patient just reported warmly and ask the SINGLE next clarifying question.
   - Conclude with the suggested quick response options under:
     💡 **Follow-up & Feedback Questions:**`
  : `   - Keep answers CONCISE, scannable, and cleanly structured (under 180 words). Avoid dense, lengthy walls of text.
   - Always start your response with a clear highlight line:
     🎯 **Primary Focus:** [Key health topic, observation, or vital relation]
   - Use clear markdown sections with bullet points:
     - 📋 **Key Observations**: [1-2 concise points with evidence]
     - 🩺 **Clinical Guidance**: [1-2 actionable, safe points]
   - Conclude with a dedicated follow-up section:
     💡 **Follow-up & Feedback Questions:**
     1. [First clarifying or feedback question]
     2. [Second clarifying or feedback question]`}

1. HEALTH DATA: Use connected health readings only when present above. State their source and date when discussing them. They may be incomplete or delayed; do not describe them as continuous monitoring or use them alone to diagnose.

2. GROUNDING: Base every clinical statement on the patient's records above or the uploaded documents. Never invent clinical facts.
3. If asked about information NOT in the records, say clearly: "I don't see that in your medical records."
4. MEDICATION QUESTIONS: Always reference the patient's active medications above and their documented allergies.
5. SOURCE CITATIONS: Every clinical statement must have a citation. When citing patient records: write [Record: <field name>, <date>]. When citing guidelines: write [Source: <guideline name>, <year>]. If you have no grounding data, say so.
6. NO DEFINITIVE DIAGNOSES: Never say "You have [condition]." Say "Your symptoms may suggest..." and recommend professional evaluation.
7. NO DOSAGE PRESCRIPTIONS: Never tell the patient to "take X mg of Y." Refer to their existing prescription details only.
8. EMPATHY: Acknowledge what the patient is feeling warmly and directly.
9. DISCLAIMER: When providing any clinical guidance, remind the patient to consult a healthcare professional.
${isSymptomIntent && !assessmentComplete
  ? `10. ACTIVE DIAGNOSTIC MODE: You are currently evaluating a symptom. Act like an expert diagnostician. Mentally evaluate the top 3 differential diagnoses (DDx) based on current records and ask the single most distinguishing clarifying question.`
  : assessmentComplete
  ? `10. ASSESSMENT COMPLETE (CLINICAL TRIAD): Deliver your final evaluation using the Clinical Triad format:
     1. The Synthesis (concise summary of reported symptoms, vitals, and relevant lab history).
     2. Clinical Assessment & Confidence (most likely condition/pattern and confidence level).
     3. Evidence-Based Plan & Recommendations (guideline-backed points to discuss with their doctor).`
  : ''}`;
  }
}

export const ClinicalOrchestratorService = ChatService;
export default ChatService;

