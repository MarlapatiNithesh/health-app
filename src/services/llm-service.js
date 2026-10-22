import { createHash } from 'node:crypto';
import { logger } from '../logger.js';
import { FIELD_QUESTION_TEMPLATES, FIELD_QUICK_OPTIONS, FIELD_LABELS } from './symptom-priority-service.js';

export const CLINICAL_TOOL_DEFINITIONS = [
  {
    name: 'get_patient_profile',
    description: 'Retrieve demographics, blood group, preferred language, and emergency contacts for the patient.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'UUID of the patient' },
      },
      required: ['patientId'],
    },
  },
  {
    name: 'get_medical_history',
    description: 'Retrieve active and chronic conditions and past medical diagnoses for the patient.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'UUID of the patient' },
      },
      required: ['patientId'],
    },
  },
  {
    name: 'get_current_medications',
    description: 'Retrieve all currently active prescribed medications, dosages, frequency, and administration routes.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'UUID of the patient' },
      },
      required: ['patientId'],
    },
  },
  {
    name: 'get_allergies',
    description: 'Retrieve all documented substance allergies, reactions, and severity levels.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'UUID of the patient' },
      },
      required: ['patientId'],
    },
  },
  {
    name: 'get_recent_labs',
    description: 'Retrieve the most recent laboratory test results with reference ranges and abnormal flags.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'UUID of the patient' },
      },
      required: ['patientId'],
    },
  },
  {
    name: 'check_drug_interactions',
    description: 'Verify if a proposed medication has interactions with the patient active medications or allergies.',
    parameters: {
      type: 'object',
      properties: {
        drug: { type: 'string', description: 'Name of the proposed medication' },
      },
      required: ['drug'],
    },
  },
  {
    name: 'search_medical_knowledge',
    description: 'Search authoritative clinical guidelines (like NICE, WHO) for evidence-based medical knowledge.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The medical question or search query' },
      },
      required: ['query'],
    },
  },
];

const SYMPTOM_EXTRACTION_SYSTEM_PROMPT = `You are a medical symptom extraction assistant.
Extract symptom information from the patient's message and return ONLY a valid JSON object.
Return only the fields that are NEW or CHANGED based on what the patient just said.
If nothing new was mentioned for a field, omit it from the JSON.

Fields to extract (all optional):
- primarySymptom (string): the main symptom e.g. "headache", "chest pain"
- onset (string): how it started e.g. "sudden", "gradual", "over 2 hours"
- duration (string): how long it has lasted e.g. "3 days", "since this morning"
- severity (number 0-10): numerical severity
- character (string): what it feels like e.g. "throbbing", "sharp", "dull pressure"
- location (string): where in the body e.g. "right temple", "central chest"
- radiation (string): where it spreads to e.g. "left arm", "jaw", "none"
- aggravatingFactors (string): what makes it worse e.g. "bright light", "movement", "eating"
- relievingFactors (string): what makes it better e.g. "rest", "paracetamol", "lying down"
- associatedSymptoms (array of strings): other symptoms e.g. ["nausea", "sweating"]

Return an empty object {} if no symptom information was found.
Return ONLY the JSON object, no other text.`;

export class LLMService {
  constructor({
    geminiApiKey = process.env.GEMINI_API_KEY || '',
    openaiApiKey = process.env.OPENAI_API_KEY || '',
    huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY || '',
    defaultModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    endpointUrl = process.env.GEMINI_ENDPOINT_URL || '',
    timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || '20000', 10),
  } = {}) {
    this.geminiApiKey = geminiApiKey;
    this.openaiApiKey = openaiApiKey;
    this.huggingFaceApiKey = huggingFaceApiKey;
    this.defaultModel = defaultModel;
    this.endpointUrl = endpointUrl || `https://generativelanguage.googleapis.com/v1beta/models/${defaultModel}:generateContent`;
    this.timeoutMs = timeoutMs;
  }

  async generateCompletion({ messages, systemPrompt = '', tools = CLINICAL_TOOL_DEFINITIONS }) {
    const startTime = Date.now();
    const promptString = JSON.stringify({ systemPrompt, messages });
    const promptHash = createHash('sha256').update(promptString).digest('hex');

    if (this.geminiApiKey) {
      try {
        const contents = this.#buildContents(messages);

        const requestBody = {
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1536,
            candidateCount: 1,
          },
        };

        if (systemPrompt) {
          requestBody.system_instruction = { parts: [{ text: systemPrompt }] };
        }

        const response = await this.#callGemini(this.endpointUrl, requestBody);

        if (response.ok) {
          const data = await response.json();
          const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (responseText) {
            return {
              content: responseText,
              toolCalls: [],
              modelName: this.defaultModel,
              modelVersion: 'v1beta',
              promptHash,
              tokens: {
                input: data.usageMetadata?.promptTokenCount ?? Math.round(promptString.length / 4),
                output: data.usageMetadata?.candidatesTokenCount ?? Math.round(responseText.length / 4),
              },
              latencyMs: Date.now() - startTime,
            };
          }
        } else {
          const errBody = await response.text().catch(() => '');
          logger.warn('Gemini endpoint returned error status', { status: response.status, body: errBody.slice(0, 200) });
        }
      } catch (err) {
        logger.warn('Gemini API call failed, falling back to clinical rule engine', { error: err.message });
      }
    }

    return this.#deterministicFallback(messages, promptHash, Date.now() - startTime);
  }

  async generateWithToolCalling({
    messages,
    systemPrompt = '',
    toolHandlers,
    requestedModel = 'gemini',
    symptomState = null,
    nextField = null,
    assessmentComplete = false,
  }) {
    let currentMessages = [...messages];
    const startTime = Date.now();
    const promptString = JSON.stringify({ systemPrompt, messages });
    const promptHash = createHash('sha256').update(promptString).digest('hex');

    if (requestedModel === 'medgamma' || requestedModel === 'medgemma') {
      const hfSystemPrompt = `${systemPrompt}\n\nNote: You have access to tools, but tool calling via HF is currently manual. For now, answer the user using only the provided context.`;
      const hfResponse = await this.#callHuggingFace(currentMessages, hfSystemPrompt);
      if (hfResponse) {
        return {
          content: hfResponse,
          modelName: 'MedGemma 2B',
          modelVersion: '1.0',
          promptHash,
          latencyMs: Date.now() - startTime,
        };
      }
      logger.warn('MedGemma HF call skipped or failed, falling back to Gemini / rule engine.');
    }

    if (requestedModel === 'gpt-4o' || requestedModel === 'openai') {
      const gptResponse = await this.#callOpenAI(currentMessages, systemPrompt);
      if (gptResponse) {
        return {
          content: gptResponse,
          modelName: 'GPT-4o Clinical',
          modelVersion: '2024-08-06',
          promptHash,
          latencyMs: Date.now() - startTime,
        };
      }
      logger.warn('GPT-4o OpenAI call skipped or failed, falling back to Gemini / rule engine.');
    }

    if (this.geminiApiKey) {
      let loopCount = 0;
      const MAX_TOOL_LOOPS = 5;

      while (loopCount++ < MAX_TOOL_LOOPS) {
        const contents = this.#buildContents(currentMessages);
        const requestBody = {
          contents,
          tools: [{ functionDeclarations: CLINICAL_TOOL_DEFINITIONS }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1536 },
        };

        if (systemPrompt) {
          requestBody.system_instruction = { parts: [{ text: systemPrompt }] };
        }

        const response = await this.#callGemini(this.endpointUrl, requestBody);
        if (!response.ok) {
          logger.warn('Gemini endpoint returned error status during tool calling', { status: response.status });
          break; 
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

        if (functionCalls.length > 0 && toolHandlers) {
          const toolPromises = functionCalls.map(async ({ name, args }) => {
            logger.info(`LLM invoked tool: ${name}`, { args });
            const toolResult = await toolHandlers[name]?.(args) ?? { error: 'Unknown tool' };
            return { name, args, toolResult };
          });

          const results = await Promise.all(toolPromises);

          results.forEach(({ name, args, toolResult }) => {
            currentMessages.push({ role: 'model', content: { functionCall: { name, args } } });
            currentMessages.push({
              role: 'tool',
              content: {
                functionResponse: {
                  name,
                  response: typeof toolResult === 'object' && toolResult !== null ? toolResult : { output: toolResult },
                },
              },
            });
          });

          continue; 
        }

        const textParts = parts.filter((p) => typeof p.text === 'string').map((p) => p.text);
        const text = textParts.join('\n').trim();
        if (text) {
          return {
            content: text,
            modelName: 'Gemini 2.5 Flash',
            modelVersion: 'v1beta',
            promptHash,
            tokens: {
              input: data.usageMetadata?.promptTokenCount ?? Math.round(promptString.length / 4),
              output: data.usageMetadata?.candidatesTokenCount ?? Math.round(text.length / 4),
            },
            latencyMs: Date.now() - startTime,
          };
        }
      }
    }

    return this.#deterministicFallback(
      currentMessages,
      promptHash,
      Date.now() - startTime,
      symptomState,
      nextField,
      assessmentComplete
    );
  }

  async generateJsonExtraction(userText, existingState = {}) {
    if (!this.geminiApiKey || !userText) return {};

    const startTime = Date.now();

    const contextHint = Object.keys(existingState).length > 0
      ? `\nAlready collected: ${JSON.stringify(existingState)}\nReturn only NEW or CHANGED fields.`
      : '';

    const fullText = userText + contextHint;

    try {
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: fullText }] }],
        generationConfig: {
          temperature: 0.0,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
        system_instruction: { parts: [{ text: SYMPTOM_EXTRACTION_SYSTEM_PROMPT }] },
      };

      const response = await this.#callGemini(this.endpointUrl, requestBody);

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = this.#tryParseJson(rawText);
        if (parsed !== null) {
          logger.debug('LLMService.generateJsonExtraction: JSON mode success', {
            latencyMs: Date.now() - startTime,
            fields: Object.keys(parsed),
          });
          return parsed;
        }
      }
    } catch (err) {
      logger.debug('LLMService.generateJsonExtraction: JSON mode failed, trying text mode', { error: err.message });
    }

    try {
      const fallbackPrompt = `${SYMPTOM_EXTRACTION_SYSTEM_PROMPT}\n\nPatient message: "${fullText}"\n\nRespond with ONLY a JSON object, nothing else:`;
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: fallbackPrompt }] }],
        generationConfig: { temperature: 0.0, maxOutputTokens: 512 },
      };

      const response = await this.#callGemini(this.endpointUrl, requestBody);

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = this.#tryParseJson(rawText);
        if (parsed !== null) {
          logger.debug('LLMService.generateJsonExtraction: text fallback success', { fields: Object.keys(parsed) });
          return parsed;
        }
      }
    } catch (err) {
      logger.warn('LLMService.generateJsonExtraction: both modes failed', { error: err.message });
    }

    return {};
  }

  #tryParseJson(text) {
    try { return JSON.parse(text); } catch {  }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch {  }
    }
    return null;
  }

  async generateSummary(conversationText) {
    if (!this.geminiApiKey || !conversationText) {
      return 'Consultation summary unavailable.';
    }

    try {
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: conversationText }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300,
        },
        system_instruction: {
          parts: [{
            text: `You are a clinical documentation assistant. Summarise the following doctor-patient conversation
in 1-3 concise sentences suitable for a clinical note. Include:
- Chief complaint and primary symptom
- Key symptom details (severity, duration, onset)
- Any risk flags identified
- Follow-up recommendation
Do not diagnose. Write in third person (e.g. "Patient reported...").`,
          }],
        },
      };

      const response = await this.#callGemini(this.endpointUrl, requestBody);

      if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Summary unavailable.';
      }
    } catch (err) {
      logger.warn('LLMService.generateSummary failed', { error: err.message });
    }

    return 'Summary unavailable.';
  }

  async detectEmotion(text) {
    if (!this.huggingFaceApiKey || !text) return null;

    const hfUrl = `https://api-inference.huggingface.co/models/SamLowe/roberta-base-go_emotions`;
    try {
      const response = await fetch(hfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.huggingFaceApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text.slice(0, 500) }),
      });

      if (response.ok) {
        const data = await response.json();
        const predictions = Array.isArray(data[0]) ? data[0] : data;

        const highAnxiety = predictions.slice(0, 3).find(
          p => (p.label === 'nervousness' || p.label === 'fear' || p.label === 'anxiety') && p.score > 0.4
        );

        if (highAnxiety) return 'HIGH_ANXIETY';
      }
    } catch (err) {
      logger.debug('Emotion detection bypassed', { error: err.message });
    }
    return null;
  }

  async clinicalReviewAgent(draftResponse, allergiesText) {
    const systemPrompt = `You are the Clinical Review Board (Attending Physician).
Your job is to read a draft response from a junior AI and verify it against the patient's allergies.
ALLERGIES: ${allergiesText}

If the draft recommends a medication that the patient is allergic to, output ONLY: {"approved": false, "reason": "Patient is allergic to X"}
If it is safe, output ONLY: {"approved": true}
Respond in valid JSON only.`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: draftResponse }] }],
      generationConfig: { temperature: 0.0, maxOutputTokens: 150, responseMimeType: 'application/json' },
      system_instruction: { parts: [{ text: systemPrompt }] },
    };

    try {

      const response = await this.#callGemini(this.endpointUrl, requestBody);
      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = this.#tryParseJson(rawText);
        if (parsed) return parsed;
      }
    } catch (err) {
      logger.debug('Clinical review agent failed, defaulting to safe', { error: err.message });
    }
    return { approved: true }; 
  }

  #buildContents(messages) {
    const filtered = (messages || []).filter(
      (m) => m && (typeof m.content === 'string' && m.content.trim() !== '' || typeof m.content === 'object')
    );

    const contents = [];
    for (const m of filtered) {
      let role = m.role === 'assistant' ? 'model' : m.role === 'tool' ? 'user' : 'user';
      if (m.content.functionCall || m.content.functionResponse) role = m.role === 'model' ? 'model' : 'user'; 

      let part;
      if (typeof m.content === 'string') {
        part = { text: m.content.trim() };
      } else {
        part = m.content;
      }

      if (contents.length > 0 && contents[contents.length - 1].role === role && typeof m.content === 'string' && contents[contents.length - 1].parts[0].text) {
        contents[contents.length - 1].parts[0].text += '\n' + m.content.trim();
      } else {
        contents.push({ role, parts: [part] });
      }
    }
    return contents;
  }

  async #callGemini(url, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const targetUrl = this.geminiApiKey && !url.includes('key=')
      ? (url.includes('?') ? `${url}&key=${this.geminiApiKey}` : `${url}?key=${this.geminiApiKey}`)
      : url;

    try {
      let response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.geminiApiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok && (response.status === 503 || response.status === 429)) {
        logger.warn('Gemini primary endpoint busy, attempting fallback model', { status: response.status });
        const fallbackModel = 'gemini-2.0-flash';
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${this.geminiApiKey}`;
        try {
          response = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': this.geminiApiKey,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(this.timeoutMs),
          });
        } catch (fbErr) {
          logger.warn('Fallback model attempt failed', { error: fbErr.message });
        }
      }

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async #callHuggingFace(messages, systemPrompt, modelId = 'google/gemma-2-2b-it') {
    if (!this.huggingFaceApiKey) {
      logger.warn('HUGGINGFACE_API_KEY is missing.');
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const hfUrl = `https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`;

    const hfMessages = [];
    if (systemPrompt) hfMessages.push({ role: 'system', content: systemPrompt });
    messages.forEach(m => hfMessages.push({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }));

    try {
      const response = await fetch(hfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.huggingFaceApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: hfMessages,
          max_tokens: 1024,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        logger.error('Hugging Face API Error', { status: response.status, body: errBody });
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (err) {
      logger.error('Hugging Face fetch failed', { error: err.message });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async #callOpenAI(messages, systemPrompt, modelId = 'gpt-4o') {
    if (!this.openaiApiKey) {
      logger.warn('OPENAI_API_KEY is missing, falling back to Gemini.');
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const openAiUrl = 'https://api.openai.com/v1/chat/completions';

    const openAiMessages = [];
    if (systemPrompt) openAiMessages.push({ role: 'system', content: systemPrompt });
    messages.forEach(m => openAiMessages.push({
      role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }));

    try {
      const response = await fetch(openAiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: openAiMessages,
          max_tokens: 1536,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        logger.error('OpenAI API Error', { status: response.status, body: errBody });
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (err) {
      logger.error('OpenAI fetch failed', { error: err.message });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async embedTextHuggingFace(text) {
    if (!this.huggingFaceApiKey || !text) return new Float32Array(384).fill(0.01);

    const hfUrl = `https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2`;
    try {
      const response = await fetch(hfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.huggingFaceApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: [text] }),
      });

      if (response.ok) {
        const data = await response.json();

        const vector = Array.isArray(data[0]) ? data[0] : data;
        return vector;
      }
      logger.warn('Hugging Face embedding returned error', { status: response.status });
    } catch (err) {
      logger.warn('Hugging Face embedding failed', { error: err.message });
    }
    return new Float32Array(384).fill(0.01);
  }

  #deterministicFallback(
    messages,
    promptHash,
    latencyMs,
    symptomState = null,
    nextField = null,
    assessmentComplete = false
  ) {
    const lastUserMessage = [...(messages || [])].reverse().find((m) => m.role === 'user')?.content || '';
    const content = this.#generateDeterministicResponse(lastUserMessage, symptomState, nextField, assessmentComplete);
    return {
      content,
      toolCalls: [],
      modelName: 'MediBot Clinical Rule Engine',
      modelVersion: '1.0.0',
      promptHash,
      tokens: { input: 50, output: 50 },
      latencyMs,
    };
  }

  #generateDeterministicResponse(userQuery, symptomState = null, nextField = null, assessmentComplete = false) {

    if (symptomState?.primarySymptom && nextField) {
      const symptomName = symptomState.primarySymptom;
      const fieldLabel = FIELD_LABELS[nextField] || nextField;
      const template = FIELD_QUESTION_TEMPLATES[nextField] || `Could you clarify your ${fieldLabel}?`;
      const quickOptions = FIELD_QUICK_OPTIONS[nextField] || [];

      return [
        `🎯 **Primary Focus:** Assessing ${symptomName} (${fieldLabel})`,
        '',
        `Thank you for that update. To ensure an accurate clinical triage, I need to check your **${fieldLabel}**:`,
        '',
        template,
        '',
        '💡 **Follow-up & Feedback Questions:**',
        ...quickOptions.map((opt, i) => `${i + 1}. ${opt}`),
      ].join('\n');
    }

    if (assessmentComplete && symptomState?.primarySymptom) {
      const s = symptomState;
      const lines = [
        `🎯 **Primary Focus:** Completed Clinical Assessment for ${s.primarySymptom}`,
        '',
        '📋 **Key Observations (Clinical Synthesis):**',
        `- **Primary Symptom**: ${s.primarySymptom}`,
        s.severity ? `- **Reported Severity**: ${s.severity} / 10` : null,
        s.character ? `- **Character**: ${s.character}` : null,
        s.onset ? `- **Onset**: ${s.onset}` : null,
        s.duration ? `- **Duration**: ${s.duration}` : null,
        s.location ? `- **Location**: ${s.location}` : null,
        s.radiation ? `- **Radiation**: ${s.radiation}` : null,
        '',
        '🩺 **Clinical Guidance & Triage Summary:**',
        'Your reported symptoms have been structured and saved to your health chart. Because clinical symptoms can evolve rapidly, monitor closely for any worsening pain, sudden breathlessness, or unusual weakness.',
        '',
        '*Please review these findings with your attending physician or healthcare provider for definitive diagnosis and medical care.*',
        '',
        '💡 **Follow-up & Feedback Questions:**',
        '1. Would you like to review related medication records?',
        '2. Would you like to check guidelines on when to seek immediate emergency care?',
        '3. Would you like to download your verified Health Summary PDF for your doctor?',
      ].filter(Boolean);

      return lines.join('\n');
    }

    const lower = userQuery.toLowerCase();
    if (lower.includes('chest pain') || lower.includes('shortness of breath') || lower.includes('heart attack')) {
      return '🚨 **EMERGENCY WARNING**: Chest pain and severe shortness of breath can indicate a critical medical emergency. Please call emergency services (e.g. 911 or 112) or go to the nearest emergency room immediately.';
    }
    if (lower.includes('medication') || lower.includes('dose') || lower.includes('prescription')) {
      return [
        '🎯 **Primary Focus:** Prescription & Medication Review',
        '',
        '📋 **Key Observations:** I have reviewed your active medication records.',
        '🩺 **Clinical Guidance:** Always verify any changes to dosage, timing, or frequency with your prescribing physician.',
        '',
        '💡 **Follow-up & Feedback Questions:**',
        '1. Which specific medication would you like to review?',
        '2. Have you experienced any unusual side effects?',
      ].join('\n');
    }
    if (lower.includes('headache') || lower.includes('fever') || lower.includes('pain') || lower.includes('cough') || lower.includes('dizzy')) {
      const detectedSymptom = lower.includes('headache') ? 'Headache' : lower.includes('fever') ? 'Fever' : lower.includes('cough') ? 'Cough' : 'discomfort';
      return [
        `🎯 **Primary Focus:** Initial Evaluation of ${detectedSymptom}`,
        '',
        `I understand you are experiencing ${detectedSymptom.toLowerCase()}. I will walk through a clinical evaluation with you.`,
        '',
        `On a scale from 0 to 10, where 0 is no pain and 10 is the worst imaginable, how severe is it right now?`,
        '',
        '💡 **Follow-up & Feedback Questions:**',
        '1. Mild (1 - 3 out of 10)',
        '2. Moderate (4 - 6 out of 10)',
        '3. Severe (7 - 9 out of 10)',
        '4. Critical (10 / 10)',
      ].join('\n');
    }

    return [
      '🎯 **Primary Focus:** MediBot Health Consultation',
      '',
      'Hello, I am MediBot, your clinical health assistant. I can help evaluate symptoms, review your medical records, check your health trends, and provide guidance.',
      '',
      '💡 **Follow-up & Feedback Questions:**',
      '1. I want to report a symptom (headache, fever, stomach pain)',
      '2. Can you review my active medications?',
      '3. How do my latest health trends look?',
    ].join('\n');
  }
}

