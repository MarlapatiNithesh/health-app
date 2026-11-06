/**
 * MediBot Embeddings Implementation
 * Extends LangChain Embeddings base class.
 * Supports Google Generative AI (text-embedding-004), OpenAI (text-embedding-3-small),
 * and deterministic mathematical fallback for offline/development usage.
 */

import { Embeddings } from '@langchain/core/embeddings';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { createHash } from 'node:crypto';
import { medibotConfig } from '../config/medibot-config.js';
import { logger } from '../../logger.js';

export class MediBotEmbeddings extends Embeddings {
  constructor(options = {}) {
    super(options);
    this.dimension = options.dimension || medibotConfig.embeddings.dimension; // 768
    this.geminiApiKey = options.geminiApiKey || medibotConfig.gemini.apiKey;
    this.openaiApiKey = options.openaiApiKey || medibotConfig.openai.apiKey;

    this.delegate = null;

    if (this.geminiApiKey) {
      try {
        this.delegate = new GoogleGenerativeAIEmbeddings({
          apiKey: this.geminiApiKey,
          modelName: medibotConfig.embeddings.geminiModel,
        });
      } catch (e) {
        logger.warn('GoogleGenerativeAIEmbeddings init failed', { error: e.message });
      }
    } else if (this.openaiApiKey) {
      try {
        this.delegate = new OpenAIEmbeddings({
          apiKey: this.openaiApiKey,
          modelName: medibotConfig.embeddings.openaiModel,
        });
      } catch (e) {
        logger.warn('OpenAIEmbeddings init failed', { error: e.message });
      }
    }
  }

  async embedDocuments(documents) {
    if (this.delegate) {
      try {
        return await this.delegate.embedDocuments(documents);
      } catch (err) {
        logger.warn('Delegate embedDocuments failed, using deterministic fallback', { error: err.message });
      }
    }
    return documents.map((doc) => this.#generateDeterministicVector(doc, this.dimension));
  }

  async embedQuery(text) {
    if (this.delegate) {
      try {
        return await this.delegate.embedQuery(text);
      } catch (err) {
        logger.warn('Delegate embedQuery failed, using deterministic fallback', { error: err.message });
      }
    }
    return this.#generateDeterministicVector(text, this.dimension);
  }

  /**
   * Deterministic semantic embedding generation based on ngram hashing and normalization.
   * Produces reproducible unit-normalized vectors suitable for cosine similarity.
   */
  #generateDeterministicVector(text = '', dim = 768) {
    const vector = new Float32Array(dim).fill(0.001);
    if (!text || typeof text !== 'string') return Array.from(vector);

    const clean = text.toLowerCase().trim();
    const tokens = clean.split(/\s+/);

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const h1 = parseInt(createHash('md5').update(tok).digest('hex').slice(0, 8), 16) % dim;
      const h2 = parseInt(createHash('sha256').update(tok + i).digest('hex').slice(0, 8), 16) % dim;
      vector[h1] += 0.5;
      vector[h2] += 0.3;

      // Bigram
      if (i > 0) {
        const bi = tokens[i - 1] + '_' + tok;
        const h3 = parseInt(createHash('md5').update(bi).digest('hex').slice(0, 8), 16) % dim;
        vector[h3] += 0.8;
      }
    }

    // Unit normalize vector
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) {
      vector[i] = vector[i] / norm;
    }

    return Array.from(vector);
  }
}

