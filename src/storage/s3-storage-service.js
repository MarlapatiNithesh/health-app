import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../logger.js';

const GZIP_MIME = 'application/gzip';

export class S3StorageService {

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

  async getDocumentBuffer(storageKey) {
    const objectKey = storageKey.replace(`s3://${this.bucket}/`, '');

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

    const localFilePath = path.join(this.localFallbackDir, objectKey);
    const compressed = await readFile(localFilePath);
    return gunzipSync(compressed);
  }
}

export const globalS3Storage = new S3StorageService();

