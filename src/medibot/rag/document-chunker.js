/**
 * Document Chunker
 * Uses LangChain's RecursiveCharacterTextSplitter to split documents and OCR text
 * into semantic, overlapping chunks for embedding storage and RAG retrieval.
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { medibotConfig } from '../config/medibot-config.js';

export class MediBotDocumentChunker {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || medibotConfig.chunking.chunkSize;
    this.chunkOverlap = options.chunkOverlap || medibotConfig.chunking.chunkOverlap;
    this.separators = options.separators || medibotConfig.chunking.separators;

    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      separators: this.separators,
    });
  }

  /**
   * Chunk raw text into structured chunk objects.
   * @param {string} text - Raw or OCR-extracted text
   * @param {object} metadata - Document metadata (patientId, documentId, docType)
   * @returns {Promise<Array<{ content: string, pageNumber: number, section: string, metadata: object }>>}
   */
  async chunkText(text, metadata = {}) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return [];
    }

    const docs = await this.splitter.createDocuments(
      [text],
      [{ ...metadata }]
    );

    return docs.map((doc, index) => {
      // Infer section from chunk content if available
      let section = 'General';
      const upper = doc.pageContent.toUpperCase();
      if (upper.includes('PRESCRIPTION') || upper.includes('RX')) section = 'Prescription';
      else if (upper.includes('LAB') || upper.includes('TEST') || upper.includes('RESULT')) section = 'Lab Results';
      else if (upper.includes('DIAGNOSIS') || upper.includes('IMPRESSION')) section = 'Diagnosis';
      else if (upper.includes('HISTORY') || upper.includes('PAST MEDICAL')) section = 'Medical History';

      return {
        content: doc.pageContent,
        pageNumber: metadata.pageNumber || Math.floor(index / 3) + 1,
        section,
        metadata: {
          ...doc.metadata,
          chunkIndex: index,
          section,
        },
      };
    });
  }
}

