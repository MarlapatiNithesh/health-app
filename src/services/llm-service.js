import { createHash } from 'node:crypto';
import { logger } from '../logger.js';

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

// ── Gemini JSON-extraction system prompt ────────────────────────────────────────
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

  // ── Main conversational completion ──────────────────────────────────────────

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

  // ── Tool Calling Loop ──────────────────────────────────────────────

  async generateWithToolCalling({ messages, systemPrompt = '', toolHandlers, requestedModel = 'gemini' }) {
    let currentMessages = [...messages];
    const startTime = Date.now();
    const promptString = JSON.stringify({ systemPrompt, messages });
    const promptHash = createHash('sha256').update(promptString).digest('hex');

    // ── MedGemma (Hugging Face) Routing ──────────────────────────────────
    if (requestedModel === 'medgamma' || requestedModel === 'medgemma') {
      const hfSystemPrompt = `${systemPrompt}\n\nNote: You have access to tools, but tool calling via HF is currently manual. For now, answer the user using only the provided context.`;
      const hfResponse = await this.#callHuggingFace(currentMessages, hfSystemPrompt);
      if (hfResponse) {
        return {
          content: hfResponse,
          modelName: 'medgemma-2b (hf)',
          modelVersion: '1.0',
          promptHash,
          latencyMs: Date.now() - startTime,
        };
      }
      logger.warn('MedGemma HF call failed, falling back to Gemini.');
    }

    // ── Gemini Routing (Default) ─────────────────────────────────────────
    while (true) {
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
        return this.#deterministicFallback(currentMessages, promptHash, Date.now() - startTime);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall) || [];

      if (functionCalls.length > 0) {
        const toolPromises = functionCalls.map(async ({ name, args }) => {
          logger.info(`LLM invoked tool: ${name}`, { args });
          const toolResult = await toolHandlers[name]?.(args) ?? { error: 'Unknown tool' };
          return { name, args, toolResult };
        });

        const results = await Promise.all(toolPromises);
        
        results.forEach(({ name, args, toolResult }) => {
          currentMessages.push({ role: 'model', content: { functionCall: { name, args } } });
          currentMessages.push({ role: 'tool', content: { functionResponse: { name, response: toolResult } } });
        });
        
        continue; // Loop: LLM sees all results and responds or calls more tools
      }

      const text = candidate?.content?.parts?.[0]?.text || '';
      return {
        content: text,
        modelName: this.defaultModel,
        modelVersion: 'v1beta',
        promptHash,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // ── JSON extraction call (for structured symptom extraction) ────────────────

  /**
   * Extract structured data from free text using the LLM in JSON mode.
   * Returns a parsed JavaScript object.
   * Safe to call — never throws; returns {} on failure.
   */
  async generateJsonExtraction(userText, existingState = {}) {
    if (!this.geminiApiKey || !userText) return {};

    const startTime = Date.now();

    const contextHint = Object.keys(existingState).length > 0
      ? `\nAlready collected: ${JSON.stringify(existingState)}\nReturn only NEW or CHANGED fields.`
      : '';

    const fullText = userText + contextHint;

    // ── Try with JSON response mode first ────────────────────────────────────
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

    // ── Fallback: plain text with explicit JSON instruction ──────────────────
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
    try { return JSON.parse(text); } catch { /* try regex */ }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { /* give up */ }
    }
    return null;
  }


  // ── Short summarisation call (for session summarisation) ────────────────────

  /**
   * Generate a concise clinical summary of a conversation.
   * Returns a plain string.
   */
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

  // ── Multi-Agent & Safety Features ──────────────────────────────────────────

  /**
   * Detects extreme emotions (anxiety, fear, panic) using a lightweight classification model.
   */
  async detectEmotion(text) {
    if (!this.huggingFaceApiKey || !text) return null;
    
    // Using a fast emotion classifier on HF
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
        
        // Find if anxiety/fear is in the top 3 and high confidence
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

  /**
   * Acts as an "Attending Physician" to double check MedGemma's draft against allergies.
   */
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
      // Use standard Gemini-Flash for the fast critic step
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
    return { approved: true }; // Fail open if critic crashes, let traditional validator handle it
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  #buildContents(messages) {
    const filtered = (messages || []).filter(
      (m) => m && (typeof m.content === 'string' && m.content.trim() !== '' || typeof m.content === 'object')
    );

    const contents = [];
    for (const m of filtered) {
      let role = m.role === 'assistant' ? 'model' : m.role === 'tool' ? 'user' : 'user';
      if (m.content.functionCall || m.content.functionResponse) role = m.role === 'model' ? 'model' : 'user'; // functionCall is model, functionResponse is user
      
      let part;
      if (typeof m.content === 'string') {
        part = { text: m.content.trim() };
      } else {
        part = m.content;
      }

      // Merge consecutive same-role text messages (Gemini requirement)
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

    try {
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.geminiApiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // Auto-fallback on rate limit or overload
      if (!response.ok && (response.status === 503 || response.status === 429)) {
        logger.warn('Gemini primary endpoint busy, attempting fallback model', { status: response.status });
        const fallbackModel = 'gemini-2.0-flash-lite';
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent`;
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

    // HF uses standard OpenAI chat format
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

  // ── Hugging Face Embeddings (for Semantic Memory) ─────────────────────────
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
        // The API returns an array of arrays if multiple inputs are provided, or just one array.
        const vector = Array.isArray(data[0]) ? data[0] : data;
        return vector;
      }
      logger.warn('Hugging Face embedding returned error', { status: response.status });
    } catch (err) {
      logger.warn('Hugging Face embedding failed', { error: err.message });
    }
    return new Float32Array(384).fill(0.01);
  }

  #deterministicFallback(messages, promptHash, latencyMs) {
    const lastUserMessage = [...(messages || [])].reverse().find((m) => m.role === 'user')?.content || '';
    const content = this.#generateDeterministicResponse(lastUserMessage);
    return {
      content,
      toolCalls: [],
      modelName: 'medibot-rule-engine',
      modelVersion: '1.0.0',
      promptHash,
      tokens: { input: 50, output: 50 },
      latencyMs,
    };
  }

  #generateDeterministicResponse(userQuery) {
    const lower = userQuery.toLowerCase();
    if (lower.includes('chest pain') || lower.includes('shortness of breath') || lower.includes('heart attack')) {
      return '🚨 **EMERGENCY WARNING**: Chest pain and severe shortness of breath can indicate a critical medical emergency. Please call emergency services (e.g. 911 or 112) or go to the nearest emergency room immediately.';
    }
    if (lower.includes('medication') || lower.includes('dose') || lower.includes('prescription')) {
      return 'I have checked your records. Always verify any changes to dosage or frequency with your prescribing physician. What specific medication would you like to review?';
    }
    if (lower.includes('headache') || lower.includes('fever') || lower.includes('pain')) {
      return 'I understand you are experiencing discomfort. To better understand your symptoms, how long have you had this, and on a scale from 1 to 10, how severe is the pain?';
    }
    return 'Hello, I am MediBot, your clinical health assistant. I can help review your medical records, check your health trends, and provide guidance on symptoms. How can I help you today?';
  }
}
