import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null
});

const documentQueue = new Queue('document-extraction', { connection });

async function addTestDocumentJob() {
  console.log('📤 Adding new PDF Document to the BullMQ Extraction Queue...');
  
  await documentQueue.add('process_pdf', {
    documentId: 'doc-999',
    patientId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    fileUrl: 's3://medibot-demo/lab_report_oct_2026.pdf',
    docType: 'lab_report'
  });

  console.log('✅ Job added! Make sure your worker is running to process it.');
  process.exit(0);
}

addTestDocumentJob().catch(console.error);
