import { logger } from '../logger.js';

const DEFAULT_TIMEOUT_MS = 25_000;
const FALLBACK_MODEL = 'gemini-flash-lite-latest';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiClient {

  constructor({
    apiKey = process.env.GEMINI_API_KEY || '',
    model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10),
  } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  #url(model, action = 'generateContent') {
    return `${BASE_URL}/${model}:${action}?key=${this.apiKey}`;
  }

  async generateContent(contents, systemInstruction = '', generationConfig = null) {
    if (!this.apiKey) return '';

    const body = { contents };
    if (systemInstruction) {
      body.system_instruction = { parts: [{ text: systemInstruction }] };
    }
    if (generationConfig) {
      body.generationConfig = generationConfig;
    }

    let response = await this.#fetchWithTimeout(this.#url(this.model), body);

    if (!response.ok && (response.status === 503 || response.status === 429)) {
      logger.warn('Gemini primary model busy, falling back', {
        status: response.status,
        fallback: FALLBACK_MODEL,
      });
      response = await this.#fetchWithTimeout(this.#url(FALLBACK_MODEL), body);
    }

    if (!response.ok) {
      logger.warn('Gemini API error', { status: response.status, model: this.model });
      return '';
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async transcribeImage(buffer, mimeType) {
    if (!this.apiKey || !buffer?.length) return '';

    const b64 = buffer.toString('base64');
    const contents = [{
      parts: [
        { inline_data: { mime_type: mimeType, data: b64 } },
        {
          text: 'You are an expert clinical pharmacist and medical OCR specialist. '
              + 'Carefully transcribe ALL text in this medical document, especially doctor handwriting, cursive prescription notes, clinic headers, and lab reports. '
              + 'Decipher doctors\' cursive handwriting and standard medical abbreviations (e.g., Rx, Tab, Cap, Syr, Inj, OD, BD, TDS, QID, HS, SOS, stat, AC, PC, mg, mcg, ml, x days). '
              + 'Identify and clearly transcribe every medicine name, its strength/dose, frequency/dosage schedule, and duration. '
              + 'Preserve all clinical sections, patient vitals, diagnosis, doctor name, clinic/hospital details, and dates accurately.',
        },
      ],
    }];

    try {
      return await this.generateContent(contents, '', {
        temperature: 0.1,
        maxOutputTokens: 2048,
      });
    } catch (err) {
      logger.warn('GeminiClient.transcribeImage failed', { error: err.message });
      return '';
    }
  }

  async embedContent(text) {
    if (!this.apiKey || !text) return new Array(768).fill(0.01);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`;
      const body = {
        model: 'models/text-embedding-004',
        content: { parts: [{ text: String(text).slice(0, 2048) }] },
      };
      const res = await this.#fetchWithTimeout(url, body);
      if (res.ok) {
        const data = await res.json();
        const values = data?.embedding?.values;
        if (Array.isArray(values) && values.length === 768) {
          return values;
        }
      }
    } catch (err) {
      logger.warn('GeminiClient.embedContent fallback', { error: err.message });
    }
    return new Array(768).fill(0.01);
  }

  async #fetchWithTimeout(url, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

export const globalGeminiClient = new GeminiClient();

