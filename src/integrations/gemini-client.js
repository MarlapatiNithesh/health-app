/**
 * GeminiClient — integration layer for Google Gemini API.
 *
 * Responsibilities:
 *  - generateContent: text-only completion requests.
 *  - transcribeImage: multimodal OCR for image buffers.
 *
 * All network I/O for Gemini lives here. Services call this client;
 * they do NOT construct fetch() calls themselves.
 */
import { logger } from '../logger.js';

const DEFAULT_TIMEOUT_MS = 25_000;
const FALLBACK_MODEL = 'gemini-flash-lite-latest';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiClient {
  /**
   * @param {object} opts
   * @param {string} [opts.apiKey]      - Gemini API key (defaults to GEMINI_API_KEY env var)
   * @param {string} [opts.model]       - Model name (defaults to GEMINI_MODEL env var)
   * @param {number} [opts.timeoutMs]   - Request timeout in ms
   */
  constructor({
    apiKey = process.env.GEMINI_API_KEY || '',
    model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10),
  } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  /** Build the endpoint URL for a given model and action. */
  #url(model, action = 'generateContent') {
    return `${BASE_URL}/${model}:${action}?key=${this.apiKey}`;
  }

  /**
   * Send a generateContent request to Gemini.
   * Retries automatically on 503/429 using the fallback model.
   *
   * @param {object[]} contents  - Gemini `contents` array
   * @param {string}   [systemInstruction] - Optional system prompt text
   * @returns {Promise<string>}  - Extracted text from first candidate
   */
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

    // Auto-fallback on overload / quota
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

  /**
   * Transcribe all visible text in an image buffer using Gemini Vision.
   *
   * @param {Buffer} buffer   - Raw image bytes
   * @param {string} mimeType - MIME type (e.g. 'image/jpeg')
   * @returns {Promise<string>} - Extracted OCR text, or '' on failure
   */
  async transcribeImage(buffer, mimeType) {
    if (!this.apiKey || !buffer?.length) return '';

    const b64 = buffer.toString('base64');
    const contents = [{
      parts: [
        { inline_data: { mime_type: mimeType, data: b64 } },
        {
          text: 'Transcribe all visible text in this document accurately, '
              + 'preserving clinical sections, findings, medications, and diagnoses.',
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

  /**
   * Generate vector embedding for text using Google Gemini text-embedding-004.
   * Returns array of 768 floats.
   */
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

  /** Internal: fetch with AbortController timeout. */
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

/** Singleton for convenience — used by DocumentProcessorService */
export const globalGeminiClient = new GeminiClient();
