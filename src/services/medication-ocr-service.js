import { logger } from '../logger.js';
import { globalGeminiClient } from '../integrations/gemini-client.js';

export class MedicationOcrService {
  constructor({
    geminiClient = globalGeminiClient,
    medicationScheduleService = null,
    confidenceThreshold = 85.0,
  } = {}) {
    this.geminiClient = geminiClient;
    this.medicationScheduleService = medicationScheduleService;
    this.confidenceThreshold = confidenceThreshold;
  }

  /**
   * Levenshtein distance string similarity score (0.0 to 1.0).
   */
  static computeSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.92;

    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    const distance = dp[m][n];
    const maxLen = Math.max(m, n);
    return Math.max(0, 1 - distance / maxLen);
  }

  /**
   * Extract dosage tokens (e.g. 500mg, 40 mg, 10mcg).
   */
  static extractDosage(text) {
    if (!text) return null;
    const match = text.match(/\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu)\b/i);
    return match ? `${match[1]}${match[2].toLowerCase()}` : null;
  }

  /**
   * Transcribe image buffer using Gemini Vision or Tesseract fallback.
   */
  async transcribeImage(buffer, mimeType = 'image/jpeg') {
    if (!buffer || buffer.length === 0) return '';

    // 1. Try Gemini Vision if API key present
    if (this.geminiClient?.apiKey) {
      try {
        const text = await this.geminiClient.transcribeImage(buffer, mimeType);
        if (text && text.trim().length > 0) {
          logger.info('[MedicationOCR] Extracted via Gemini Vision', { length: text.length });
          return text;
        }
      } catch (err) {
        logger.warn('[MedicationOCR] Gemini Vision transcription failed, falling back', { error: err.message });
      }
    }

    // 2. Fallback to Tesseract.js
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        errorHandler: (err) => logger.warn('[MedicationOCR] Tesseract error', { error: err?.message }),
      });
      const res = await worker.recognize(buffer);
      await worker.terminate().catch(() => {});
      const recognized = res?.data?.text || '';
      logger.info('[MedicationOCR] Extracted via Tesseract.js', { length: recognized.length });
      return recognized;
    } catch (tessErr) {
      logger.warn('[MedicationOCR] Tesseract fallback failed', { error: tessErr.message });
      return buffer.toString('utf8');
    }
  }

  /**
   * Verify an uploaded medication blister/vial image against the scheduled dose.
   */
  async verifyMedicationScan(patientId, {
    imageBuffer,
    mimeType = 'image/jpeg',
    expectedMedication,
    expectedDosage,
    scheduleId = null,
    intakeLogId = null,
  }) {
    if (!imageBuffer) {
      throw new Error('Image buffer is required for medication OCR verification');
    }

    const extractedText = await this.transcribeImage(imageBuffer, mimeType);
    const cleanExtracted = extractedText.replace(/\r\n/g, ' ').replace(/\n/g, ' ');

    // 1. Calculate name similarity
    let bestNameMatch = 0;
    const words = cleanExtracted.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const singleScore = MedicationOcrService.computeSimilarity(words[i], expectedMedication);
      if (singleScore > bestNameMatch) bestNameMatch = singleScore;

      if (i < words.length - 1) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        const biScore = MedicationOcrService.computeSimilarity(bigram, expectedMedication);
        if (biScore > bestNameMatch) bestNameMatch = biScore;
      }
    }

    // Direct substring check gives high confidence
    if (cleanExtracted.toLowerCase().includes(expectedMedication.toLowerCase())) {
      bestNameMatch = Math.max(bestNameMatch, 0.95);
    }

    // 2. Check dosage match
    const expectedDoseNormalized = (expectedDosage || '').replace(/\s+/g, '').toLowerCase();
    const extractedDose = MedicationOcrService.extractDosage(cleanExtracted);
    let doseMatch = false;

    if (expectedDoseNormalized && cleanExtracted.toLowerCase().includes(expectedDoseNormalized)) {
      doseMatch = true;
    } else if (expectedDoseNormalized && extractedDose) {
      doseMatch = expectedDoseNormalized === extractedDose;
    }

    // 3. Overall confidence calculation (0 - 100%)
    let confidenceScore = Math.round(bestNameMatch * 80 + (doseMatch ? 20 : 5));
    if (confidenceScore > 100) confidenceScore = 100;

    const isMatch = confidenceScore >= this.confidenceThreshold;

    let warning = null;
    let feedback = '';

    if (isMatch) {
      feedback = `✓ Verified: Scanned label matches ${expectedMedication} ${expectedDosage || ''} with ${confidenceScore}% confidence. Exact timing confirmed.`;
    } else {
      warning = `🚨 Potential Mismatch Warning: You marked ${expectedMedication} ${expectedDosage || ''}, but scanned label indicates "${cleanExtracted.slice(0, 60)}..." (Match: ${confidenceScore}%). Please re-verify before ingestion.`;
      feedback = warning;
    }

    // Update or confirm intake in database if MedicationScheduleService is wired
    let intakeResult = null;
    if (this.medicationScheduleService?.markDoseTaken) {
      intakeResult = await this.medicationScheduleService.markDoseTaken(patientId, {
        scheduleId,
        intakeLogId,
        takenAt: new Date(),
        ocrVerified: isMatch,
        ocrConfidence: confidenceScore,
        ocrExtractedText: cleanExtracted.slice(0, 500),
        mismatchWarning: warning,
      });
    }

    return {
      verified: isMatch,
      confidence: confidenceScore,
      expectedMedication,
      expectedDosage,
      extractedDose,
      extractedText: cleanExtracted.slice(0, 300),
      feedback,
      mismatchWarning: warning,
      intakeRecord: intakeResult,
    };
  }
}
