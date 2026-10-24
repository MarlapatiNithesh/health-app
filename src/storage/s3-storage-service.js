/**
 * S3StorageService — handles gzip compression and AWS S3 uploads/downloads.
 *
 * Design decisions:
 *  - sha256 is accepted as a parameter (already computed by caller) — no recomputation.
 *  - Object key is always: documents/{patientId}/{sha256}.gz
 *    (documentId-based keying removed to avoid two different key formats for the same object).
 *  - Local fallback path mirrors the same key structure as S3 for consistency.
 *  - Compression is always gzip — the constant 'compression' column was removed from schema.
 */
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../logger.js';

const GZIP_MIME = 'application/gzip';

export class S3StorageService {
  /**
   * @param {object} opts
   * @param {string} [opts.bucket]          - S3 bucket name
   * @param {string} [opts.region]          - AWS region
   * @param {string} [opts.localFallbackDir] - Local directory used when S3 is unreachable
   * @param {object} [opts.s3Client]         - Pre-built S3Client (for testing / DI)
   */
  constructor({
    bucket = process.env.AWS_S3_BUCKET || 'medibot-clinical-docs',
    region = process.env.AWS_REGION || 'us-east-1',
    localFallbackDir = './uploads/s3-bucket',
    s3Client = null,
  } = {}) {
    this.bucket = bucket;
    this.region = region;
    this.localFallbackDir = localFallbackDir;
    this.s3Client = s3Client;
  }

  /** Lazily initialize the AWS S3Client (credentials read from env). */
  async #getS3Client() {
    if (this.s3Client) return this.s3Client;
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        const { S3Client } = await import('@aws-sdk/client-s3');
        this.s3Client = new S3Client({
          region: this.region,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
          ...(process.env.AWS_ENDPOINT_URL ? { endpoint: process.env.AWS_ENDPOINT_URL } : {}),
        });
        return this.s3Client;
      } catch (err) {
        logger.warn('Failed to initialize AWS S3 client', { error: err.message });
      }
    }
    return null;
  }

  /**
   * Compress and upload a document buffer to S3.
   * Object key: documents/{patientId}/{sha256}.gz
   *
   * @param {object} opts
   * @param {string} opts.patientId  - Patient UUID (used as namespace prefix)
   * @param {string} opts.sha256     - Pre-computed SHA-256 hex of the original buffer
   * @param {string} opts.filename   - Original filename (stored in S3 metadata only)
   * @param {Buffer} opts.buffer     - Raw uncompressed file bytes
   * @param {string} [opts.mimeType] - MIME type of the original file
   * @returns {Promise<{storageKey, objectKey, originalSizeBytes, compressedSizeBytes, compressionRatio, mimeType, localFilePath}>}
   */
  async uploadDocument({ patientId, sha256, filename, buffer, mimeType = 'application/pdf' }) {
    const compressed = gzipSync(buffer);
    const objectKey = `documents/${patientId}/${sha256}.gz`;
    const storageKey = `s3://${this.bucket}/${objectKey}`;

    const client = await this.#getS3Client();
    if (client) {
      try {
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        await client.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: compressed,
          ContentEncoding: 'gzip',
          ContentType: mimeType,
          Metadata: {
            sha256,
            patientId,
            originalFilename: filename,
            uncompressedSize: String(buffer.length),
          },
        }));
        logger.debug('S3 upload successful', { storageKey, compressedBytes: compressed.length });
      } catch (err) {
        logger.warn('AWS S3 upload error — saving to local fallback', { error: err.message, storageKey });
      }
    }

    // Always write local fallback — mirrors S3 key path under localFallbackDir
    const localFilePath = path.join(this.localFallbackDir, 'documents', patientId, `${sha256}.gz`);
    setImmediate(async () => {
      try {
        await mkdir(path.dirname(localFilePath), { recursive: true });
        await writeFile(localFilePath, compressed);
      } catch (err) {
        logger.warn('Local S3 fallback write error', { error: err.message });
      }
    });

    return {
      storageKey,
      objectKey,
      originalSizeBytes: buffer.length,
      compressedSizeBytes: compressed.length,
      compressionRatio: Number((compressed.length / Math.max(1, buffer.length)).toFixed(3)),
      mimeType,
      localFilePath,
    };
  }

  /**
   * Download and decompress a document from S3 (or local fallback).
   *
   * @param {string} storageKey  - Full s3:// URI from health_documents.storage_key
   * @returns {Promise<Buffer>}  - Decompressed file bytes
   */
  async getDocumentBuffer(storageKey) {
    const objectKey = storageKey.replace(`s3://${this.bucket}/`, '');

    // Try S3 first
    const client = await this.#getS3Client();
    if (client) {
      try {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const res = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
        const chunks = [];
        for await (const chunk of res.Body) chunks.push(chunk);
        return gunzipSync(Buffer.concat(chunks));
      } catch (err) {
        logger.warn('S3 read failed, attempting local fallback', { error: err.message, objectKey });
      }
    }

    // Local fallback (same path structure as S3 key)
    const localFilePath = path.join(this.localFallbackDir, objectKey);
    const compressed = await readFile(localFilePath);
    return gunzipSync(compressed);
  }
}

/** Singleton — used by DocumentProcessorService and other services. */
export const globalS3Storage = new S3StorageService();
