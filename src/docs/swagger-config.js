import swaggerUi from 'swagger-ui-express';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SWAGGER BASE SPECIFICATION & DOMAIN SCHEMAS
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const baseSwaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Wellness & MediBot Clinical Health AI Platform API',
    version: '1.0.0',
    description: `
### Enterprise Healthcare & Clinical AI REST API
High-performance REST API powering member authentication, demographic & biometric profile management, multi-source wearable & health telemetry ingestion, and **MediBot Clinical AI Triage & Patient 360**.

#### Key Capabilities:
- **Authentication**: Phone-based OTP verification with rate limiting and JWT session management.
- **Biometrics & Wearables**: Apple Health, Health Connect, OpenWearables (Oura, Whoop, Fitbit, Garmin) multi-provider reconciliation.
- **Clinical AI Triage**: Sub-millisecond red-flag emergency screening, deterministic drug-allergy contraindication checks, and semantic clinical RAG retrieval.
- **Clinical Vault**: OCR entity extraction, deduplication, and ACID commit to patient medical records.
- **Patient 360 & Encounters**: Longitudinal clinical timelines, diagnostic conditions, active medications, lab records, and encounter transcripts.
    `,
    contact: {
      name: 'Engineering & Clinical AI Team',
      email: 'engineering@wellness-app.internal',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local API Server',
    },
  ],
  tags: [
    { name: 'System', description: 'System health check and database connectivity diagnostics' },
    { name: 'Phone Authentication', description: 'SMS OTP issuance, verification, and JWT session generation' },
    { name: 'Member Profile & Health', description: 'Member demographic, biometric progress, consents, and account lifecycle' },
    { name: 'Wearables & Devices', description: 'Wearable device management, provider connections, and synchronized health metrics' },
    { name: 'Webhooks', description: 'Inbound real-time telemetry webhooks with HMAC-SHA256 signature verification' },
    { name: 'MediBot AI Clinical Services', description: 'Real-time AI triage chat, semantic vector retrieval (RAG), and safety rules engine' },
    { name: 'Patient 360 & Records', description: 'Longitudinal medical records, active conditions, medications, allergies, and lab results' },
    { name: 'Clinical Documents & OCR', description: 'S3 clinical vault, OCR entity extraction, deduplication, and field confirmation' },
    { name: 'Clinical Encounters', description: 'Clinical encounter sessions, symptom state tracking, and communication transcripts' },
    { name: 'Clinical Consents', description: 'Patient medical data sharing and scoped clinical triage consent management' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT token issued via `/phone/verify-otp`. Format: `Bearer <token>`',
      },
      WebhookSecret: {
        type: 'apiKey',
        in: 'header',
        name: 'x-webhook-secret',
        description: 'Webhook verification secret shared with the webhook provider',
      },
      WebhookSignature: {
        type: 'apiKey',
        in: 'header',
        name: 'webhook-signature',
        description: 'HMAC-SHA256 signature for payload integrity verification',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error', 'requestId'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'validation_error' },
              message: { type: 'string', example: 'Invalid input parameters' },
              details: {
                type: 'array',
                items: { type: 'object' },
                example: [{ field: 'phone', issue: 'Must be E.164 format' }],
              },
            },
          },
          requestId: { type: 'string', format: 'uuid', example: '4fa1b2c3-d4e5-4f6a-b7c8-d9e0f1a2b3c4' },
        },
      },
      SendOtpRequest: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string', example: '+14155552671', description: 'Member mobile number in E.164 format' },
        },
      },
      SendOtpResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'pending' },
          message: { type: 'string', example: 'Verification code sent successfully' },
        },
      },
      VerifyOtpRequest: {
        type: 'object',
        required: ['phone', 'code'],
        properties: {
          phone: { type: 'string', example: '+14155552671' },
          code: { type: 'string', example: '123456', description: '6-digit SMS verification code' },
          profile: { $ref: '#/components/schemas/UpdateProfileRequest' },
        },
      },
      VerifyOtpResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          member: { $ref: '#/components/schemas/MemberProfile' },
        },
      },
      MemberProfile: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          phone: { type: 'string', example: '+14155552671' },
          firstName: { type: 'string', example: 'Jane' },
          lastName: { type: 'string', example: 'Doe' },
          dob: { type: 'string', format: 'date', example: '1990-05-15' },
          biologicalSex: { type: 'string', enum: ['male', 'female', 'intersex', 'other'], example: 'female' },
          heightCm: { type: 'number', example: 172.5 },
          weightKg: { type: 'number', example: 68.4 },
          status: { type: 'string', enum: ['active', 'suspended', 'deleted'], example: 'active' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UpdateProfileRequest: {
        type: 'object',
        properties: {
          firstName: { type: 'string', example: 'Jane' },
          lastName: { type: 'string', example: 'Doe' },
          dob: { type: 'string', format: 'date', example: '1990-05-15' },
          biologicalSex: { type: 'string', enum: ['male', 'female', 'intersex', 'other'] },
          heightCm: { type: 'number', example: 172.5 },
          weightKg: { type: 'number', example: 68.4 },
        },
      },
      PhoneHealthSample: {
        type: 'object',
        required: ['sourceType', 'metricType', 'value', 'unit', 'startDate', 'endDate'],
        properties: {
          sourceType: { type: 'string', enum: ['apple_health', 'health_connect'], example: 'apple_health' },
          metricType: { type: 'string', example: 'step_count', description: 'Standard metric: step_count, heart_rate, sleep_asleep, active_energy' },
          value: { type: 'number', example: 10450 },
          unit: { type: 'string', example: 'count' },
          startDate: { type: 'string', format: 'date-time', example: '2026-09-30T00:00:00Z' },
          endDate: { type: 'string', format: 'date-time', example: '2026-09-30T23:59:59Z' },
          deviceModel: { type: 'string', example: 'iPhone 15 Pro' },
        },
      },
      PhoneHealthConnection: {
        type: 'object',
        properties: {
          platform: { type: 'string', enum: ['apple_health', 'health_connect'], example: 'apple_health' },
          status: { type: 'string', enum: ['connected', 'disconnected', 'error'], example: 'connected' },
          lastSyncAt: { type: 'string', format: 'date-time' },
          metricsEnabled: { type: 'array', items: { type: 'string' }, example: ['step_count', 'heart_rate', 'sleep'] },
        },
      },
      HealthScore: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          memberId: { type: 'string', format: 'uuid' },
          scoreDate: { type: 'string', format: 'date', example: '2026-09-30' },
          overallScore: { type: 'number', minimum: 0, maximum: 100, example: 88.5 },
          categoryScores: {
            type: 'object',
            properties: {
              activity: { type: 'number', example: 92 },
              sleep: { type: 'number', example: 84 },
              nutrition: { type: 'number', example: 89 },
            },
          },
        },
      },
      WearableDevice: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          provider: { type: 'string', example: 'oura' },
          deviceModel: { type: 'string', example: 'Oura Ring Gen 3' },
          batteryLevel: { type: 'number', example: 85 },
          lastSyncAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['active', 'paused', 'disconnected'], example: 'active' },
        },
      },
      ConnectSessionResponse: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', format: 'uuid' },
          authUrl: { type: 'string', format: 'uri', example: 'https://connect.openwearables.com/oauth/authorize?session=...' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      ChatRequest: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            description: 'Patient medical question or triage query',
            example: 'What did my doctor prescribe in my report, and how are my lab values?',
          },
          encounterId: {
            type: 'string',
            format: 'uuid',
            description: 'OPTIONAL: Pass only if continuing a specific consultation. If omitted, MediBot manages encounters automatically.',
          },
        },
        example: {
          message: 'What did my doctor prescribe in my report, and how are my lab values?',
        },
      },
      ChatResponse: {
        type: 'object',
        properties: {
          response: { type: 'string', example: 'Your symptoms require immediate emergency medical care. Please call 911 or go to the nearest emergency department.' },
          triageLevel: { type: 'string', enum: ['emergency', 'urgent', 'routine', 'self_care'], example: 'emergency' },
          isEmergency: { type: 'boolean', example: true },
          screeningLatencyMs: { type: 'number', example: 0.8 },
          disclaimer: { type: 'string', example: 'This AI triage tool provides decision support and does not replace professional medical advice.' },
          suggestedActions: { type: 'array', items: { type: 'string' }, example: ['Call emergency services immediately', 'Do not drive yourself to hospital'] },
        },
      },
      RagQueryRequest: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', example: 'Fasting glucose and HbA1c history over the last 12 months' },
          limit: { type: 'integer', default: 5, example: 5 },
        },
      },
      RagQueryResponse: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content: { type: 'string', example: 'Lab report 2026-03-15: Fasting Glucose 98 mg/dL, HbA1c 5.4%' },
                source: { type: 'string', example: 'document:3fa85f64-5717-4562-b3fc-2c963f66afa6' },
                score: { type: 'number', example: 0.92 },
              },
            },
          },
        },
      },
      DrugValidationRequest: {
        type: 'object',
        required: ['medication'],
        properties: {
          medication: { type: 'string', example: 'Amoxicillin 500mg' },
          patientAllergies: { type: 'array', items: { type: 'string' }, example: ['Penicillin'] },
          existingConditions: { type: 'array', items: { type: 'string' }, example: ['Asthma'] },
        },
      },
      DrugValidationResponse: {
        type: 'object',
        properties: {
          isSafe: { type: 'boolean', example: false },
          contraindications: {
            type: 'array',
            items: { type: 'string' },
            example: ['Cross-reactivity between Penicillin allergy and Amoxicillin'],
          },
          warnings: { type: 'array', items: { type: 'string' }, example: ['Severe anaphylaxis risk'] },
        },
      },
      PatientRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          conditions: { type: 'array', items: { type: 'object' } },
          medications: { type: 'array', items: { type: 'object' } },
          allergies: { type: 'array', items: { type: 'object' } },
          labs: { type: 'array', items: { type: 'object' } },
        },
      },
      UpdatePatientProfileRequest: {
        type: 'object',
        properties: {
          bloodGroup: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], example: 'O+' },
          emergencyContact: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Jane Doe' },
              relationship: { type: 'string', example: 'Spouse' },
              phone: { type: 'string', example: '+919390498829' },
            },
          },
          preferences: {
            type: 'object',
            properties: {
              preferredLanguage: { type: 'string', example: 'en-IN' },
              unitsSystem: { type: 'string', enum: ['metric', 'imperial'], example: 'metric' },
            },
          },
          lifestyle: {
            type: 'object',
            properties: {
              smokingStatus: { type: 'string', example: 'non_smoker' },
              alcoholConsumption: { type: 'string', example: 'occasional' },
              exerciseFrequency: { type: 'string', example: '3_times_week' },
            },
          },
          goals: {
            type: 'array',
            items: { type: 'string' },
            example: ['maintain_normal_bp', 'daily_10k_steps'],
          },
        },
        example: {
          bloodGroup: 'O+',
          emergencyContact: {
            name: 'Jane Doe',
            relationship: 'Spouse',
            phone: '+919390498829',
          },
          preferences: {
            preferredLanguage: 'en-IN',
            unitsSystem: 'metric',
          },
          lifestyle: {
            smokingStatus: 'non_smoker',
            alcoholConsumption: 'occasional',
            exerciseFrequency: '3_times_week',
          },
          goals: ['maintain_normal_bp', 'daily_10k_steps'],
        },
      },
      RecordConditionRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Type 2 Diabetes Mellitus', description: 'Clinical condition or diagnosis name' },
          code: { type: 'string', example: 'E11.9', description: 'ICD-10 clinical diagnostic code' },
          status: { type: 'string', enum: ['active', 'resolved', 'recurrence', 'remission'], default: 'active', example: 'active' },
          severity: { type: 'string', enum: ['mild', 'moderate', 'severe'], example: 'moderate' },
          onsetDate: { type: 'string', format: 'date', example: '2024-01-15' },
        },
        example: {
          name: 'Type 2 Diabetes Mellitus',
          code: 'E11.9',
          status: 'active',
          severity: 'moderate',
          onsetDate: '2024-01-15',
        },
      },
      RecordMedicationRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Metformin 500mg', description: 'Prescribed medication name' },
          rxnormCode: { type: 'string', example: '860975', description: 'RxNorm clinical drug code' },
          dose: { type: 'string', example: '500mg', description: 'Dosage amount' },
          frequency: { type: 'string', example: 'twice daily', description: 'Dosing schedule' },
          route: { type: 'string', example: 'oral', description: 'Administration route' },
          startedAt: { type: 'string', format: 'date-time', example: '2026-01-01T00:00:00Z' },
        },
        example: {
          name: 'Metformin 500mg',
          rxnormCode: '860975',
          dose: '500mg',
          frequency: 'twice daily',
          route: 'oral',
          startedAt: '2026-01-01T00:00:00Z',
        },
      },
      RecordAllergyRequest: {
        type: 'object',
        required: ['substance'],
        properties: {
          substance: { type: 'string', example: 'Penicillin', description: 'Allergen substance or drug' },
          reaction: { type: 'string', example: 'Urticaria and facial swelling', description: 'Observed adverse reaction' },
          severity: { type: 'string', enum: ['mild', 'moderate', 'severe'], example: 'severe', description: 'Clinical reaction severity tier' },
          verificationStatus: { type: 'string', enum: ['patient_confirmed', 'suspected', 'refuted'], default: 'patient_confirmed', example: 'patient_confirmed' },
        },
        example: {
          substance: 'Penicillin',
          reaction: 'Urticaria and facial swelling',
          severity: 'severe',
          verificationStatus: 'patient_confirmed',
        },
      },
      RecordLabRequest: {
        type: 'object',
        required: ['testName', 'value'],
        properties: {
          testName: { type: 'string', example: 'Fasting Blood Glucose', description: 'Laboratory test name' },
          value: { type: 'number', example: 95.5, description: 'Observed quantitative value' },
          unit: { type: 'string', example: 'mg/dL', description: 'Unit of measurement' },
          refLow: { type: 'number', example: 70, description: 'Reference range low' },
          refHigh: { type: 'number', example: 99, description: 'Reference range high' },
          interpretation: { type: 'string', enum: ['normal', 'low', 'high', 'critical'], example: 'normal' },
          collectedAt: { type: 'string', format: 'date-time', example: '2026-09-30T08:00:00Z' },
        },
        example: {
          testName: 'Fasting Blood Glucose',
          value: 95.5,
          unit: 'mg/dL',
          refLow: 70,
          refHigh: 99,
          interpretation: 'normal',
          collectedAt: '2026-09-30T08:00:00Z',
        },
      },
      ClinicalDocument: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          docType: { type: 'string', example: 'prescription' },
          originalFilename: { type: 'string', example: 'rx_metformin.pdf' },
          extractionStatus: { type: 'string', example: 'done' },
          ocrEngine: { type: 'string', example: 'gemini_vision' },
          summary: { type: 'string', example: 'Prescription includes: Metformin 500mg, twice daily. Clinical diagnoses noted: Type 2 Diabetes Mellitus.' },
          extractions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                fieldName: { type: 'string', example: 'medication_name' },
                rawValue: { type: 'string', example: 'Metformin 500mg' },
                normalizedValue: { type: 'string', example: 'Metformin' },
                confidence: { type: 'number', example: 0.95 },
                status: { type: 'string', example: 'confirmed' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CommitDocumentFieldsRequest: {
        type: 'object',
        properties: {
          fieldIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            description: 'Optional array of extracted field UUIDs to confirm and commit to the patient chart. If omitted or empty, all pending extracted fields from this document will be committed.',
            example: [],
          },
        },
        example: {
          fieldIds: [],
        },
      },
      Encounter: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['in_progress', 'complete', 'high_risk', 'abandoned'], example: 'in_progress' },
          intent: { type: 'string', example: 'symptom' },
          riskLevel: { type: 'string', example: 'low' },
          summary: { type: 'string', example: 'Chest tightness consultation' },
          triageAssessment: { type: 'object' },
          symptomState: { type: 'object' },
          messages: { type: 'array', items: { type: 'object' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateEncounterRequest: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            enum: ['symptom', 'medication_query', 'record_query', 'general'],
            default: 'symptom',
            description: 'Primary clinical intent of encounter',
          },
          riskLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            default: 'low',
            description: 'Initial triage risk level',
          },
          chiefComplaint: {
            type: 'string',
            example: 'Chest tightness on exertion',
            description: 'Patient chief medical complaint',
          },
          symptoms: {
            type: 'array',
            items: { type: 'string' },
            example: ['chest_tightness', 'dyspnea', 'fatigue'],
            description: 'List of reported clinical symptoms',
          },
        },
        example: {
          intent: 'symptom',
          riskLevel: 'low',
          chiefComplaint: 'Chest tightness on exertion',
          symptoms: ['chest_tightness', 'dyspnea', 'fatigue'],
        },
      },
      UpdateEncounterStatusRequest: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['in_progress', 'complete', 'high_risk', 'abandoned'],
            default: 'complete',
            description: 'Encounter lifecycle status',
          },
          riskLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            example: 'medium',
            description: 'Updated clinical risk tier',
          },
          resolution: {
            type: 'string',
            example: 'referred_to_cardiologist',
            description: 'Clinical encounter summary or resolution notes',
          },
          summary: {
            type: 'string',
            example: 'Patient advised ECG and cardiology consultation',
            description: 'Clinical encounter summary',
          },
          flaggedForReview: {
            type: 'boolean',
            default: false,
            description: 'Flag for human physician retrospective review',
          },
        },
        example: {
          status: 'complete',
          riskLevel: 'medium',
          resolution: 'referred_to_cardiologist',
          summary: 'Patient advised ECG and cardiology consultation',
          flaggedForReview: false,
        },
      },
      PostEncounterMessageRequest: {
        type: 'object',
        required: ['content'],
        properties: {
          role: {
            type: 'string',
            enum: ['patient', 'user', 'assistant', 'system'],
            default: 'patient',
            description: 'Message author role',
          },
          content: {
            type: 'string',
            example: 'Tightness worsens on climbing stairs.',
            description: 'Message textual content',
          },
          meta: {
            type: 'object',
            example: {},
            description: 'Optional clinical telemetry or contextual metadata',
          },
        },
        example: {
          role: 'patient',
          content: 'Tightness worsens on climbing stairs.',
        },
      },
      UpdateSymptomStateRequest: {
        type: 'object',
        properties: {
          primarySymptom: {
            type: 'string',
            example: 'chest_tightness',
            description: 'Primary localized clinical symptom',
          },
          severity: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            example: 7,
            description: 'Numerical symptom intensity (1-10)',
          },
          overallSeverity: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            example: 7,
            description: 'Overall triage severity score (1-10)',
          },
          triageLevel: {
            type: 'string',
            enum: ['routine', 'urgent', 'emergency'],
            example: 'urgent',
            description: 'Computed urgency recommendation',
          },
          symptoms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'chest_tightness' },
                severity: { type: 'integer', example: 7 },
                onset: { type: 'string', example: '2026-09-30T08:00:00Z' },
                isRedFlag: { type: 'boolean', example: true },
              },
            },
            example: [
              { name: 'chest_tightness', severity: 7, onset: '2026-09-30T08:00:00Z', isRedFlag: true },
              { name: 'dyspnea', severity: 6, onset: '2026-09-30T08:00:00Z', isRedFlag: false },
            ],
          },
          associatedSymptoms: {
            type: 'array',
            items: { type: 'string' },
            example: ['dyspnea', 'fatigue'],
          },
          isComplete: {
            type: 'boolean',
            default: false,
            description: 'Whether structured symptom evaluation is fully collected',
          },
        },
        example: {
          primarySymptom: 'chest_tightness',
          severity: 7,
          overallSeverity: 7,
          triageLevel: 'urgent',
          symptoms: [
            { name: 'chest_tightness', severity: 7, onset: '2026-09-30T08:00:00Z', isRedFlag: true },
            { name: 'dyspnea', severity: 6, onset: '2026-09-30T08:00:00Z', isRedFlag: false },
          ],
          isComplete: true,
        },
      },
      SymptomState: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', format: 'uuid' },
          primarySymptom: { type: 'string', example: 'chest_tightness' },
          severity: { type: 'integer', example: 7 },
          overallSeverity: { type: 'integer', example: 7 },
          triageLevel: { type: 'string', example: 'urgent' },
          symptoms: { type: 'array', items: { type: 'object' } },
          isComplete: { type: 'boolean', example: true },
        },
      },
      EncounterMessage: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          sessionId: { type: 'string', format: 'uuid' },
          role: { type: 'string', example: 'user' },
          content: { type: 'string', example: 'Tightness worsens on climbing stairs.' },
          meta: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      GlobalConsentRequest: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['data_access', 'ai_processing', 'document_upload', 'wearable_sync', 'global'],
            default: 'global',
            description: 'Clinical consent permission scope or global for all scopes',
          },
          granted: {
            type: 'boolean',
            default: true,
            description: 'Whether consent is actively granted',
          },
          version: {
            type: 'string',
            default: '1.0',
            description: 'Consent agreement version',
          },
        },
        example: {
          scope: 'global',
          granted: true,
          version: '1.0',
        },
      },
      ScopedConsentRequest: {
        type: 'object',
        properties: {
          granted: {
            type: 'boolean',
            default: true,
            description: 'Whether consent is actively granted for this specific scope',
          },
        },
        example: {
          granted: true,
        },
      },
      MemberConsentRequest: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['health_data', 'telemetry', 'ai_triage', 'emergency_share'],
            default: 'health_data',
            description: 'Type of member consent',
          },
          version: {
            type: 'string',
            default: '1.0',
            description: 'Consent agreement terms version',
          },
          granted: {
            type: 'boolean',
            default: true,
            description: 'Whether consent is granted',
          },
        },
        example: {
          type: 'health_data',
          version: '1.0',
          granted: true,
        },
      },
      ConsentResponse: {
        type: 'object',
        properties: {
          consent: {
            type: 'object',
            properties: {
              memberId: { type: 'string', format: 'uuid' },
              scope: { type: 'string', example: 'data_access' },
              granted: { type: 'boolean', example: true },
              grantedAt: { type: 'string', format: 'date-time' },
              revokedAt: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        },
      },
    },
  },
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SWAGGER CONFIGURATION ENGINE (SpringDoc Style)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class SwaggerConfig {
  static #endpointRegistry = new Map();

  /**
   * Register a controller group declaratively (equivalent to @RestController + @RequestMapping)
   *
   * @param {string} controllerName - Identifier for the controller
   * @param {string} basePath - Base URI prefix (e.g. '/v1/me', '/medibot')
   * @param {Array<Object>} endpoints - Endpoint specifications
   */
  static registerController(controllerName, basePath, endpoints) {
    if (!this.#endpointRegistry.has(controllerName)) {
      this.#endpointRegistry.set(controllerName, { basePath, endpoints: [] });
    }
    const group = this.#endpointRegistry.get(controllerName);
    for (const ep of endpoints) {
      group.endpoints.push(ep);
    }
  }

  /**
   * Introspect direct routes mounted on the Express application
   *
   * @param {import('express').Application} app
   */
  static autoDiscoverExpressRoutes(app) {
    if (!app || !app.router || !Array.isArray(app.router.stack)) return;

    for (const layer of app.router.stack) {
      if (layer.route && layer.route.path && typeof layer.route.path === 'string') {
        const fullPath = layer.route.path;
        if (fullPath === '*' || fullPath === '/docs' || fullPath === '/api-docs') continue;
        const methods = Object.keys(layer.route.methods || {});
        for (const method of methods) {
          if (layer.route.methods[method]) {
            SwaggerConfig.#registerEndpointIfNotExists(fullPath, method.toLowerCase());
          }
        }
      }
    }
  }

  static #registerEndpointIfNotExists(path, method) {
    let normPath = path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    if (normPath.length > 1 && normPath.endsWith('/')) {
      normPath = normPath.slice(0, -1);
    }

    if (!this.#endpointRegistry.has('AppDirectRoutes')) {
      this.#endpointRegistry.set('AppDirectRoutes', { basePath: '', endpoints: [] });
    }
    const group = this.#endpointRegistry.get('AppDirectRoutes');
    const existing = group.endpoints.find((e) => e.path === normPath && e.method === method);
    if (!existing) {
      group.endpoints.push({
        path: normPath,
        method,
        summary: `${method.toUpperCase()} ${normPath}`,
        tags: [SwaggerConfig.#inferTagFromPath(normPath)],
        auth: false,
      });
    }
  }

  static #inferTagFromPath(path) {
    if (path.startsWith('/phone')) return 'Phone Authentication';
    if (path.startsWith('/wearables') || path.includes('/wearables')) return 'Wearables & Devices';
    if (path.startsWith('/v1/me/phone-health') || path.startsWith('/v1/me')) return 'Member Profile & Health';
    if (path.includes('/webhooks')) return 'Webhooks';
    if (path.startsWith('/medibot/chat') || path.startsWith('/medibot/rag') || path.startsWith('/medibot/rules')) return 'MediBot AI Clinical Services';
    if (path.startsWith('/medibot/patients')) return 'Patient 360 & Records';
    if (path.startsWith('/medibot/documents')) return 'Clinical Documents & OCR';
    if (path.startsWith('/medibot/encounters')) return 'Clinical Encounters';
    if (path.startsWith('/medibot/consents')) return 'Clinical Consents';
    if (path.startsWith('/health')) return 'System';
    return 'System';
  }

  /**
   * Build complete OpenAPI paths object
   */
  static buildPaths() {
    const paths = {};

    for (const [, { basePath, endpoints }] of this.#endpointRegistry.entries()) {
      for (const ep of endpoints) {
        let fullPath = (basePath ? `${basePath}${ep.path.startsWith('/') ? '' : '/'}${ep.path}` : ep.path) || '/';
        // Normalize Express route params (:param) to OpenAPI ({param})
        fullPath = fullPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
        if (fullPath.length > 1 && fullPath.endsWith('/')) {
          fullPath = fullPath.slice(0, -1);
        }

        if (!paths[fullPath]) {
          paths[fullPath] = {};
        }

        const method = ep.method.toLowerCase();
        const operation = {
          summary: ep.summary || `${method.toUpperCase()} ${fullPath}`,
          description: ep.description || ep.summary || `Automated endpoint configuration for ${method.toUpperCase()} ${fullPath}`,
          tags: ep.tags || [this.#inferTagFromPath(fullPath)],
        };

        // Auto-configure security
        if (ep.auth === 'BearerAuth' || ep.auth === true) {
          operation.security = [{ BearerAuth: [] }];
        } else if (ep.auth === 'WebhookSecret') {
          operation.security = [{ WebhookSecret: [] }, { WebhookSignature: [] }];
        }

        // Auto-discover path parameters
        const pathParams = [];
        const matches = fullPath.match(/\{([a-zA-Z0-9_]+)\}/g);
        if (matches) {
          for (const m of matches) {
            const paramName = m.replace(/[{}]/g, '');
            const customParam = Array.isArray(ep.parameters)
              ? ep.parameters.find((p) => p.name === paramName && (p.in === 'path' || !p.in))
              : null;
            if (customParam) {
              pathParams.push({
                in: 'path',
                required: true,
                description: `Unique identifier for ${paramName}`,
                ...customParam,
                name: paramName,
              });
            } else {
              pathParams.push({
                name: paramName,
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: `Unique identifier for ${paramName}`,
              });
            }
          }
        }

        if (Array.isArray(ep.parameters)) {
          for (const p of ep.parameters) {
            if (!pathParams.some((pp) => pp.name === p.name)) {
              pathParams.push(p);
            }
          }
        }

        if (pathParams.length > 0) {
          operation.parameters = pathParams;
        }

        // Auto-configure requestBody
        if (ep.requestBody) {
          if (ep.requestBody === 'multipart') {
            operation.requestBody = {
              required: true,
              description: 'Medical document file upload (PDF, PNG, JPEG, TIFF up to 20MB)',
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      file: { type: 'string', format: 'binary', description: 'Document binary' },
                      docType: { type: 'string', enum: ['prescription', 'lab_report', 'discharge_summary'], example: 'prescription' },
                    },
                    required: ['file'],
                  },
                },
              },
            };
          } else if (typeof ep.requestBody === 'string') {
            operation.requestBody = {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${ep.requestBody}` },
                },
              },
            };
          } else {
            operation.requestBody = ep.requestBody;
          }
        }

        // Auto-configure responses
        operation.responses = {};
        const successCode = ep.statusCode || (method === 'post' ? 201 : 200);

        if (ep.responseSchema) {
          if (typeof ep.responseSchema === 'string') {
            operation.responses[successCode] = {
              description: ep.responseDescription || 'Successful operation',
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${ep.responseSchema}` },
                },
              },
            };
          } else {
            operation.responses[successCode] = ep.responseSchema;
          }
        } else if (ep.responses) {
          operation.responses = ep.responses;
        } else {
          operation.responses[successCode] = {
            description: 'Operation completed successfully',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          };
        }

        // Standard error responses
        if (!operation.responses[400]) {
          operation.responses[400] = {
            description: 'Validation Error / Bad Request',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          };
        }
        if (ep.auth && !operation.responses[401]) {
          operation.responses[401] = {
            description: 'Unauthorized access - Invalid or missing authentication credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          };
        }
        if (pathParams.length > 0 && !operation.responses[404]) {
          operation.responses[404] = {
            description: 'Resource not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          };
        }

        paths[fullPath][method] = operation;
      }
    }

    return paths;
  }

  /**
   * Build complete Swagger/OpenAPI document
   */
  static buildSpec(baseSpec = baseSwaggerSpec) {
    const paths = this.buildPaths();
    return {
      ...baseSpec,
      paths: {
        ...(baseSpec.paths || {}),
        ...paths,
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SPRINGDOC-STYLE DECLARATIVE CONTROLLER REGISTRATIONS (All 43 API Endpoints)
// ─────────────────────────────────────────────────────────────────────────────

// 1. System Controller
SwaggerConfig.registerController('SystemController', '', [
  {
    method: 'get',
    path: '/health',
    summary: 'API & Database Health Check',
    description: 'Verifies server liveness and PostgreSQL database connectivity status.',
    tags: ['System'],
    auth: false,
    statusCode: 200,
  },
]);

// 2. Phone Authentication Controller (@RequestMapping("/phone"))
SwaggerConfig.registerController('PhoneController', '/phone', [
  {
    method: 'post',
    path: '/send-otp',
    summary: 'Send Phone Verification OTP',
    description: 'Issues a 6-digit SMS verification code with rate-limiting and cooldown enforcement.',
    tags: ['Phone Authentication'],
    auth: false,
    requestBody: 'SendOtpRequest',
    statusCode: 200,
    responseSchema: 'SendOtpResponse',
  },
  {
    method: 'post',
    path: '/verify-otp',
    summary: 'Verify OTP & Issue Access Token',
    description: 'Validates SMS OTP, creates or updates member profile, and issues a JWT session token.',
    tags: ['Phone Authentication'],
    auth: false,
    requestBody: 'VerifyOtpRequest',
    statusCode: 200,
    responseSchema: 'VerifyOtpResponse',
  },
]);

// 3. Member Profile Controller (@RequestMapping("/v1/me"))
SwaggerConfig.registerController('MemberController', '/v1/me', [
  {
    method: 'get',
    path: '/profile',
    summary: 'Get Current Member Profile',
    description: 'Retrieves authenticated member demographic details, status, and biometrics.',
    tags: ['Member Profile & Health'],
    auth: 'BearerAuth',
    statusCode: 200,
    responseSchema: 'MemberProfile',
  },
  {
    method: 'patch',
    path: '/profile',
    summary: 'Update Member Profile & Biometrics',
    description: 'Updates height, weight, name, and demographic fields with audit history logging.',
    tags: ['Member Profile & Health'],
    auth: 'BearerAuth',
    requestBody: 'UpdateProfileRequest',
    statusCode: 200,
    responseSchema: 'MemberProfile',
  },
  {
    method: 'get',
    path: '/profile/history',
    summary: 'Get Biometric Change Audit Log',
    description: 'Returns chronological history of weight and biometric revisions.',
    tags: ['Member Profile & Health'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/profile/weight-progress',
    summary: 'Get Weight Progress Analytics',
    description: 'Calculates BMI trajectory, baseline comparisons, and progress towards weight targets.',
    tags: ['Member Profile & Health'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/consents',
    summary: 'Record Member Privacy & Health Consents',
    description: 'Stores member acceptance for clinical data processing and privacy terms.',
    tags: ['Member Profile & Health'],
    auth: 'BearerAuth',
    requestBody: 'MemberConsentRequest',
    statusCode: 200,
  },
  {
    method: 'delete',
    path: '/',
    summary: 'Delete Member Account (GDPR/CCPA)',
    description: 'Executes member right-to-be-forgotten deletion and terminates access tokens.',
    tags: ['Member Profile & Health'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
]);

// 4. Phone Health Controller (@RequestMapping("/v1/me"))
SwaggerConfig.registerController('PhoneHealthController', '/v1/me', [
  {
    method: 'put',
    path: '/phone-health/connection',
    summary: 'Update Phone Health Connection State',
    description: 'Registers or updates Apple Health or Android Health Connect sync configuration.',
    tags: ['Member Profile & Health'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/phone-health/connection',
    summary: 'Get Phone Health Connection State',
    description: 'Returns current synchronization status, enabled metrics, and last sync timestamp.',
    tags: ['Member Profile & Health'],
    auth: 'BearerAuth',
    statusCode: 200,
    responseSchema: 'PhoneHealthConnection',
  },
  {
    method: 'post',
    path: '/phone-health/sync',
    summary: 'Batch Ingest Apple Health / Health Connect Samples',
    description: 'Ingests batch timeseries biometric telemetry (steps, heart rate, sleep) with ACID persistence.',
    tags: ['Member Profile & Health'],
    auth: 'BearerAuth',
    statusCode: 202,
  },
  {
    method: 'get',
    path: '/daily-summary',
    summary: 'Get Daily Activity & Vital Summary',
    description: 'Aggregates daily steps, active energy, average heart rate, and sleep duration.',
    tags: ['Member Profile & Health'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
]);

// 5. Wearables & Devices Controller (@RequestMapping("/wearables"))
SwaggerConfig.registerController('WearableController', '/wearables', [
  {
    method: 'get',
    path: '/providers',
    summary: 'List Supported Wearable Providers',
    description: 'Returns supported hardware brands (Oura, Whoop, Fitbit, Garmin, Apple).',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/connections',
    summary: 'List Active Provider Connections',
    description: 'Lists connected third-party wearable provider accounts for the member.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'delete',
    path: '/connections/{provider}',
    summary: 'Disconnect Wearable Provider',
    description: 'Revokes provider OAuth token and unlinks wearable data ingestion.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/connections/{provider}/sync',
    summary: 'Trigger On-Demand Provider Sync',
    description: 'Initiates immediate background synchronization with third-party wearable cloud.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 202,
  },
  {
    method: 'get',
    path: '/sync/runs',
    summary: 'List Wearable Sync Runs',
    description: 'Returns historical telemetry sync runs, status codes, and records processed.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/sync/recent',
    summary: 'Get Most Recent Sync Status',
    description: 'Returns telemetry freshness timestamp and status of latest sync job.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/connect-session',
    summary: 'Create OpenWearables Connect Session',
    description: 'Generates OAuth authorization URL to connect a wearable hardware device.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
    responseSchema: 'ConnectSessionResponse',
  },
  {
    method: 'get',
    path: '/devices',
    summary: 'List Connected Hardware Devices',
    description: 'Returns member paired hardware rings, bands, smartwatches, and sensors.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/devices',
    summary: 'Register Wearable Device',
    description: 'Adds a newly paired hardware wearable device to member profile.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 201,
    responseSchema: 'WearableDevice',
  },
  {
    method: 'patch',
    path: '/devices/{deviceId}',
    summary: 'Update Device Settings',
    description: 'Modifies device friendly name, sync preferences, or battery alert thresholds.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'delete',
    path: '/devices/{deviceId}',
    summary: 'Unpair Wearable Device',
    description: 'Disconnects and removes hardware device from member account.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/devices/{deviceId}/sync',
    summary: 'Trigger Device Telemetry Sync',
    description: 'Forces sync of pending biometric records from specific device.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 202,
  },
  {
    method: 'get',
    path: '/timeseries',
    summary: 'Query Biometric Timeseries Data',
    description: 'Retrieves granular heart rate, HRV, SpO2, and skin temperature timeseries.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/workouts',
    summary: 'List Recorded Workouts',
    description: 'Returns exercise activities, heart rate zones, GPS routes, and calories burned.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/sleep',
    summary: 'List Sleep Sessions',
    description: 'Retrieves sleep stages (deep, REM, light), efficiency score, and wake episodes.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/health-scores',
    summary: 'Get Composite Health Scores',
    description: 'Retrieves multi-domain wellness, recovery, activity, and sleep readiness scores.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
    responseSchema: 'HealthScore',
  },
  {
    method: 'get',
    path: '/sync-logs',
    summary: 'Get Synchronization Audit Logs',
    description: 'Returns detailed sync diagnostic logs and vendor API response codes.',
    tags: ['Wearables & Devices'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
]);

// 6. Webhooks Controller (@RequestMapping("/api/webhooks"))
SwaggerConfig.registerController('WebhookController', '/api/webhooks', [
  {
    method: 'post',
    path: '/health',
    summary: 'Ingest Real-Time Health Telemetry Webhook',
    description: 'Receives webhook event packets with cryptographic signature verification.',
    tags: ['Webhooks'],
    auth: 'WebhookSecret',
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/open-wearables',
    summary: 'Ingest OpenWearables Platform Webhook',
    description: 'Processes vendor event payloads (Oura ring, Whoop band) with deduplication.',
    tags: ['Webhooks'],
    auth: 'WebhookSecret',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/providers/{provider}/webhooks',
    summary: 'Webhook Provider Challenge Handshake',
    description: 'Responds to provider verification challenges (`hub.challenge`, `verification_token`).',
    tags: ['Webhooks'],
    auth: false,
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/providers/{provider}/webhooks',
    summary: 'Ingest Provider-Specific Webhook Event',
    description: 'Processes event delivery from named provider (e.g. Fitbit, Garmin).',
    tags: ['Webhooks'],
    auth: 'WebhookSecret',
    statusCode: 200,
  },
]);

// 7. MediBot AI Clinical Services Controller (@RequestMapping("/medibot"))
SwaggerConfig.registerController('ChatController', '/medibot', [
  {
    method: 'get',
    path: '/status',
    summary: 'MediBot Clinical Microservices Status',
    description: 'Reports operational health of AI triage engine, vector store, and caching layers.',
    tags: ['MediBot AI Clinical Services'],
    auth: false,
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/chat',
    summary: 'Clinical AI Triage Chat (<1ms Safety Screen)',
    description: 'Executes sub-millisecond red-flag emergency screening followed by clinical conversational guidance.',
    tags: ['MediBot AI Clinical Services'],
    auth: 'BearerAuth',
    requestBody: 'ChatRequest',
    statusCode: 200,
    responseSchema: 'ChatResponse',
  },
  {
    method: 'post',
    path: '/rag',
    summary: 'Clinical Semantic Vector Retrieval (RAG)',
    description: 'Searches patient longitudinal chart for relevant lab results, conditions, and previous encounters.',
    tags: ['MediBot AI Clinical Services'],
    auth: 'BearerAuth',
    requestBody: 'RagQueryRequest',
    statusCode: 200,
    responseSchema: 'RagQueryResponse',
  },
  {
    method: 'post',
    path: '/rules/validate',
    summary: 'Deterministic Drug Safety & Contraindication Check',
    description: 'Validates medication prescriptions against patient allergies, chronic diseases, and contraindications.',
    tags: ['MediBot AI Clinical Services'],
    auth: 'BearerAuth',
    requestBody: 'DrugValidationRequest',
    statusCode: 200,
    responseSchema: 'DrugValidationResponse',
  },
]);

// 8. Patient 360 & Clinical Records Controller (@RequestMapping("/medibot/patients"))
SwaggerConfig.registerController('ClinicalController', '/medibot/patients', [
  {
    method: 'get',
    path: '/{patientId}',
    summary: 'Get Patient 360 Comprehensive Medical Chart',
    description: 'Aggregates patient demographic, clinical conditions, medications, allergies, and lab results.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    statusCode: 200,
    responseSchema: 'PatientRecord',
  },
  {
    method: 'put',
    path: '/{patientId}',
    summary: 'Update Patient Clinical Profile',
    description: 'Updates primary clinical notes, attending physician, and patient summary.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    requestBody: 'UpdatePatientProfileRequest',
    statusCode: 200,
    responseSchema: 'PatientRecord',
  },
  {
    method: 'get',
    path: '/{patientId}/context',
    summary: 'Get Complete Patient Clinical Context',
    description: 'Provides condensed clinical context payload optimized for LLM reasoning prompts.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/{patientId}/timeline',
    summary: 'Get Unified Longitudinal Clinical Timeline',
    description: 'Generates unified chronological timeline of all medical encounters, lab draws, and diagnoses.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/{patientId}/conditions',
    summary: 'Get Diagnosed Active Conditions',
    description: 'Returns ICD-10 coded clinical conditions and chronic diagnoses.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/{patientId}/conditions',
    summary: 'Record Clinical Condition',
    description: 'Appends a confirmed medical diagnosis to patient chart.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    requestBody: 'RecordConditionRequest',
    statusCode: 201,
  },
  {
    method: 'get',
    path: '/{patientId}/medications',
    summary: 'Get Active Prescribed Medications',
    description: 'Returns active drug prescriptions, dosages, and administration frequencies.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/{patientId}/medications',
    summary: 'Record Prescribed Medication',
    description: 'Records a new medication with safety verification checks.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    requestBody: 'RecordMedicationRequest',
    statusCode: 201,
  },
  {
    method: 'get',
    path: '/{patientId}/allergies',
    summary: 'Get Documented Allergies',
    description: 'Lists confirmed allergen sensitivities, reaction severity, and clinical notes.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/{patientId}/allergies',
    summary: 'Record Known Allergy',
    description: 'Adds an allergy record to prevent drug-allergy interactions.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    requestBody: 'RecordAllergyRequest',
    statusCode: 201,
  },
  {
    method: 'get',
    path: '/{patientId}/labs',
    summary: 'Get Laboratory Test Results',
    description: 'Retrieves chronological lab panels (metabolic, lipid, blood count) with reference ranges.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'post',
    path: '/{patientId}/labs',
    summary: 'Record Laboratory Test Result',
    description: 'Appends a clinical laboratory panel or test observation to patient chart.',
    tags: ['Patient 360 & Records'],
    auth: 'BearerAuth',
    requestBody: 'RecordLabRequest',
    statusCode: 201,
  },
]);

// 9. Clinical Consents Controller (@RequestMapping("/medibot/consents"))
SwaggerConfig.registerController('ConsentsController', '/medibot/consents', [
  {
    method: 'post',
    path: '/',
    summary: 'Set Global Patient Clinical Consent',
    description: 'Authorizes MediBot clinical AI assistance and emergency triage protocols.',
    tags: ['Clinical Consents'],
    auth: 'BearerAuth',
    requestBody: 'GlobalConsentRequest',
    statusCode: 200,
    responseSchema: 'ConsentResponse',
  },
  {
    method: 'post',
    path: '/{scope}',
    summary: 'Set Scoped Clinical Consent',
    description: 'Configures granular permissions (`data_access`, `ai_processing`, `document_upload`, `wearable_sync`).',
    tags: ['Clinical Consents'],
    auth: 'BearerAuth',
    parameters: [
      {
        name: 'scope',
        in: 'path',
        required: true,
        description: 'Clinical consent permission scope',
        schema: {
          type: 'string',
          enum: ['data_access', 'ai_processing', 'document_upload', 'wearable_sync'],
          default: 'data_access',
        },
      },
    ],
    requestBody: 'ScopedConsentRequest',
    statusCode: 200,
    responseSchema: 'ConsentResponse',
  },
  {
    method: 'get',
    path: '/{scope}',
    summary: 'Get Scoped Clinical Consent Status',
    description: 'Verifies whether a specific consent scope is actively granted.',
    tags: ['Clinical Consents'],
    auth: 'BearerAuth',
    parameters: [
      {
        name: 'scope',
        in: 'path',
        required: true,
        description: 'Clinical consent permission scope',
        schema: {
          type: 'string',
          enum: ['data_access', 'ai_processing', 'document_upload', 'wearable_sync'],
          default: 'data_access',
        },
      },
    ],
    statusCode: 200,
    responseSchema: 'ConsentResponse',
  },
]);

// 10. Clinical Documents & OCR Controller (@RequestMapping("/medibot/documents"))
SwaggerConfig.registerController('DocumentController', '/medibot/documents', [
  {
    method: 'post',
    path: '/',
    summary: 'Upload Medical Document / Lab Report / Prescription',
    description: 'Uploads clinical document to S3 vault with Gzip compression, perceptual deduplication, and OCR extraction.',
    tags: ['Clinical Documents & OCR'],
    auth: 'BearerAuth',
    requestBody: 'multipart',
    statusCode: 202,
    responseSchema: 'ClinicalDocument',
  },
  {
    method: 'post',
    path: '/upload',
    summary: 'Upload Medical Document (Alias)',
    description: 'Multipart file upload endpoint alias for medical document ingestion.',
    tags: ['Clinical Documents & OCR'],
    auth: 'BearerAuth',
    requestBody: 'multipart',
    statusCode: 202,
    responseSchema: 'ClinicalDocument',
  },
  {
    method: 'get',
    path: '/',
    summary: 'List Uploaded Medical Documents',
    description: 'Returns metadata list of patient clinical documents in vault.',
    tags: ['Clinical Documents & OCR'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/{id}',
    summary: 'Get Document Details & Extracted OCR Entities',
    description: 'Returns document storage metadata and OCR recognized medical entities.',
    tags: ['Clinical Documents & OCR'],
    auth: 'BearerAuth',
    statusCode: 200,
    responseSchema: 'ClinicalDocument',
  },
  {
    method: 'post',
    path: '/{id}/commit',
    summary: 'Confirm & Commit Extracted Medical Fields to Patient Chart',
    description: 'Atomically commits confirmed OCR extracted entities (medications, labs) into clinical records. If fieldIds is omitted or empty, all pending extractions are confirmed.',
    tags: ['Clinical Documents & OCR'],
    auth: 'BearerAuth',
    requestBody: 'CommitDocumentFieldsRequest',
    statusCode: 200,
  },
]);

// 11. Clinical Encounters Controller (@RequestMapping("/medibot/encounters"))
SwaggerConfig.registerController('EncounterController', '/medibot/encounters', [
  {
    method: 'post',
    path: '/',
    summary: 'Create New Clinical Encounter Session',
    description: 'Initializes a new clinical consultation encounter session.',
    tags: ['Clinical Encounters'],
    auth: 'BearerAuth',
    requestBody: 'CreateEncounterRequest',
    statusCode: 201,
    responseSchema: 'Encounter',
  },
  {
    method: 'get',
    path: '/',
    summary: 'List Patient Clinical Encounters',
    description: 'Retrieves historical consultation sessions and triage assessments.',
    tags: ['Clinical Encounters'],
    auth: 'BearerAuth',
    statusCode: 200,
  },
  {
    method: 'get',
    path: '/{id}',
    summary: 'Get Encounter Session Details',
    description: 'Retrieves complete encounter session data including transcript and symptom state.',
    tags: ['Clinical Encounters'],
    auth: 'BearerAuth',
    statusCode: 200,
    responseSchema: 'Encounter',
  },
  {
    method: 'put',
    path: '/{id}/status',
    summary: 'Update Encounter Status',
    description: 'Transitions encounter lifecycle status (`in_progress`, `complete`, `high_risk`, `abandoned`).',
    tags: ['Clinical Encounters'],
    auth: 'BearerAuth',
    requestBody: 'UpdateEncounterStatusRequest',
    statusCode: 200,
    responseSchema: 'Encounter',
  },
  {
    method: 'post',
    path: '/{id}/messages',
    summary: 'Post Message to Encounter Transcript',
    description: 'Appends patient or clinician message to ongoing encounter session.',
    tags: ['Clinical Encounters'],
    auth: 'BearerAuth',
    requestBody: 'PostEncounterMessageRequest',
    statusCode: 201,
    responseSchema: 'EncounterMessage',
  },
  {
    method: 'get',
    path: '/{id}/symptom-state',
    summary: 'Get Evaluated Symptom State',
    description: 'Returns evaluated symptom tracker, onset, severity score, and red-flag indicators.',
    tags: ['Clinical Encounters'],
    auth: 'BearerAuth',
    statusCode: 200,
    responseSchema: 'SymptomState',
  },
  {
    method: 'put',
    path: '/{id}/symptom-state',
    summary: 'Update Evaluated Symptom State',
    description: 'Updates active symptom severity and triage progression.',
    tags: ['Clinical Encounters'],
    auth: 'BearerAuth',
    requestBody: 'UpdateSymptomStateRequest',
    statusCode: 200,
    responseSchema: 'SymptomState',
  },
]);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPILED SWAGGER SPECIFICATION & EXPRESS MOUNT HELPER
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const swaggerSpec = SwaggerConfig.buildSpec(baseSwaggerSpec);

/**
 * Mounts interactive Swagger UI and raw JSON documentation endpoints
 *
 * @param {import('express').Application} app
 * @returns {Object} Compiled OpenAPI 3.0.3 specification
 */
export function setupSwaggerDocs(app) {
  SwaggerConfig.autoDiscoverExpressRoutes(app);
  const spec = SwaggerConfig.buildSpec(baseSwaggerSpec);

  const customUiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none !important; }
      .swagger-ui .info { margin: 25px 0; }
      .swagger-ui .info .title { font-family: Inter, sans-serif; font-size: 28px; color: #1e293b; }
      .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
      .swagger-ui .opblock.opblock-post { border-color: #10b981; background: rgba(16, 185, 129, 0.05); }
      .swagger-ui .opblock.opblock-get { border-color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
      .swagger-ui .opblock.opblock-put { border-color: #f59e0b; background: rgba(245, 158, 11, 0.05); }
      .swagger-ui .opblock.opblock-delete { border-color: #ef4444; background: rgba(239, 68, 68, 0.05); }
      .swagger-ui .opblock.opblock-patch { border-color: #8b5cf6; background: rgba(139, 92, 246, 0.05); }
    `,
    customSiteTitle: 'Wellness & MediBot Clinical API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
  };

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, customUiOptions));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, customUiOptions));

  const jsonHandler = (_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.json(spec);
  };

  app.get('/docs.json', jsonHandler);
  app.get('/api-docs/swagger.json', jsonHandler);

  return spec;
}

export default swaggerSpec;
