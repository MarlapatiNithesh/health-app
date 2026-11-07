/**
 * MediBot LangChain Clinical Tools
 * Exposes clinical tools with Zod schema validation using LangChain DynamicStructuredTool.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '../../logger.js';

export function createClinicalTools({
  patientId,
  clinicalRepo,
  clinicalRulesService,
  guidelineRetriever,
}) {
  const tools = [
    new DynamicStructuredTool({
      name: 'get_patient_profile',
      description: 'Retrieve demographics, blood group, preferred language, and emergency contacts for the patient.',
      schema: z.object({
        patientId: z.string().optional().describe('UUID of the patient (defaults to current patient)'),
      }),
      func: async (args) => {
        try {
          const targetId = args.patientId || patientId;
          const patient = await clinicalRepo?.findPatientById?.(targetId);
          return JSON.stringify(patient || { error: 'Patient not found' });
        } catch (err) {
          return JSON.stringify({ error: err.message });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'get_medical_history',
      description: 'Retrieve active and chronic conditions and past medical diagnoses for the patient.',
      schema: z.object({
        patientId: z.string().optional().describe('UUID of the patient'),
      }),
      func: async (args) => {
        try {
          const targetId = args.patientId || patientId;
          const records = await clinicalRepo?.findClinicalRecords?.(targetId, 'condition');
          return JSON.stringify(records || []);
        } catch (err) {
          return JSON.stringify({ error: err.message });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'get_current_medications',
      description: 'Retrieve all currently active prescribed medications, dosages, frequency, and administration routes.',
      schema: z.object({
        patientId: z.string().optional().describe('UUID of the patient'),
      }),
      func: async (args) => {
        try {
          const targetId = args.patientId || patientId;
          const records = await clinicalRepo?.findClinicalRecords?.(targetId, 'medication');
          return JSON.stringify(records || []);
        } catch (err) {
          return JSON.stringify({ error: err.message });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'get_allergies',
      description: 'Retrieve all documented substance allergies, reactions, and severity levels.',
      schema: z.object({
        patientId: z.string().optional().describe('UUID of the patient'),
      }),
      func: async (args) => {
        try {
          const targetId = args.patientId || patientId;
          const records = await clinicalRepo?.findClinicalRecords?.(targetId, 'allergy');
          return JSON.stringify(records || []);
        } catch (err) {
          return JSON.stringify({ error: err.message });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'get_recent_labs',
      description: 'Retrieve the most recent laboratory test results with reference ranges and abnormal flags.',
      schema: z.object({
        patientId: z.string().optional().describe('UUID of the patient'),
      }),
      func: async (args) => {
        try {
          const targetId = args.patientId || patientId;
          const records = await clinicalRepo?.findClinicalRecords?.(targetId, 'lab_result');
          return JSON.stringify(records || []);
        } catch (err) {
          return JSON.stringify({ error: err.message });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'check_drug_interactions',
      description: 'Verify if a proposed medication has interactions with the patient active medications or allergies.',
      schema: z.object({
        drug: z.string().describe('Name of the proposed medication to check'),
      }),
      func: async (args) => {
        try {
          if (!clinicalRulesService?.checkMedication) {
            return JSON.stringify({ safe: true, message: 'Rules service not available' });
          }
          const result = await clinicalRulesService.checkMedication(patientId, args.drug);
          return JSON.stringify(result || { safe: true });
        } catch (err) {
          return JSON.stringify({ error: err.message });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'search_medical_knowledge',
      description: 'Search authoritative clinical guidelines (like NICE, WHO) for evidence-based medical knowledge.',
      schema: z.object({
        query: z.string().describe('The clinical question or topic to search in guidelines'),
      }),
      func: async (args) => {
        try {
          if (!guidelineRetriever?.searchGuidelines) {
            return JSON.stringify([]);
          }
          const results = await guidelineRetriever.searchGuidelines(args.query, 3);
          return JSON.stringify(results);
        } catch (err) {
          return JSON.stringify({ error: err.message });
        }
      },
    }),
  ];

  return tools;
}

