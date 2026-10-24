try { process.loadEnvFile(); } catch {}

import { ProactiveMonitoringService } from './src/services/proactive-monitoring-service.js';
import { LLMService } from './src/services/llm-service.js';

// Mock Repositories to simulate the Database state for John Doe (Diabetic Patient)
const mockClinicalRepo = {
  getPatientContext: async (patientId) => ({
    patient: { fullName: 'John Doe' },
    activeConditions: [{ name: 'Type 2 Diabetes Mellitus' }],
    recentLabs: [{ name: 'HbA1c', value: '8.4', unit: '%' }],
    activeMedications: [{ name: 'Metformin 500mg' }]
  }),
  createHealthEvent: async (patientId, eventData) => {
    console.log('\n✅ [DATABASE LOG] Saved Proactive Ping to Health Events:');
    console.log(JSON.stringify(eventData, null, 2));
  }
};

async function testProactivePing() {
  console.log('🚀 Initializing Proactive Monitoring Service...');
  const llmService = new LLMService();
  
  const service = new ProactiveMonitoringService({
    clinicalRepo: mockClinicalRepo,
    encounterRepo: {},
    llmService
  });

  console.log('🔍 Scanning Patient: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 (John Doe)');
  await service.evaluatePatient('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
}

testProactivePing().catch(console.error);
