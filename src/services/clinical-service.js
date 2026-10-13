import { ApplicationError } from '../errors/application-error.js';
import { ClinicalRecordMapper, PatientMapper, HealthEventMapper } from '../mappers/index.js';

/**
 * ClinicalService — pure business-logic layer for clinical records.
 *
 * Rules:
 *  - NO direct database queries here (delegate to clinicalRepo).
 *  - NO cache manipulation here (ClinicalRecordRepository handles cache invalidation).
 *  - All returned objects pass through the appropriate Mapper.
 */
export class ClinicalService {
  constructor(clinicalRepo, proactiveMonitoringService = null) {
    this.clinicalRepo = clinicalRepo;
    this.proactiveMonitoringService = proactiveMonitoringService;
  }

  async getProfile(patientId) {
    let patient = await this.clinicalRepo.findPatientById(patientId);
    if (!patient) {
      await this.clinicalRepo.ensurePatient(patientId);
      patient = await this.clinicalRepo.findPatientById(patientId);
    }
    if (!patient) {
      throw new ApplicationError('Patient record not found', 404, 'not_found');
    }
    return PatientMapper.toDto(patient);
  }

  async updateProfile(patientId, updateData = {}) {
    await this.clinicalRepo.ensurePatient(patientId);
    const updated = await this.clinicalRepo.updatePatient(patientId, updateData || {});
    return PatientMapper.toDto(updated);
  }

  async getConditions(patientId) {
    const records = await this.clinicalRepo.findClinicalRecords(patientId, 'condition');
    return ClinicalRecordMapper.toDtoList(records);
  }

  async addCondition(patientId, input = {}) {
    const { code, status, severity, onsetDate, diagnosedDate } = input;
    const name = input.name || input.condition || input.conditionName || input.diagnosis;
    if (!name) {
      throw new ApplicationError('Condition name is required', 400, 'validation_error');
    }

    const provenance = await this.clinicalRepo.createProvenance({
      sourceType: 'user_input',
      confidence: 1.0,
    });

    const record = await this.clinicalRepo.createClinicalRecord(patientId, {
      recordType: 'condition',
      name,
      code,
      codeSystem: 'icd10',
      status: status || 'active',
      severity,
      startAt: onsetDate ? new Date(onsetDate) : new Date(),
      provenanceId: provenance.id,
      source: 'manual',
    });

    await this.clinicalRepo.createHealthEvent(patientId, {
      eventType: 'diagnosis',
      summary: `Condition documented: ${name}`,
      structuredData: { name, code, status },
      provenanceId: provenance.id,
    });

    return ClinicalRecordMapper.toDto(record);
  }

  async getMedications(patientId) {
    const records = await this.clinicalRepo.findClinicalRecords(patientId, 'medication');
    return ClinicalRecordMapper.toDtoList(records);
  }

  async addMedication(patientId, input = {}) {
    const { rxnormCode, frequency, route, startedAt } = input;
    const name = input.name || input.drugName || input.medication || input.medicationName || input.drug;
    const dose = input.dose || input.dosage;
    if (!name) {
      throw new ApplicationError('Medication name is required', 400, 'validation_error');
    }

    const provenance = await this.clinicalRepo.createProvenance({
      sourceType: 'user_input',
      confidence: 1.0,
    });

    const record = await this.clinicalRepo.createClinicalRecord(patientId, {
      recordType: 'medication',
      name,
      code: rxnormCode,
      codeSystem: 'rxnorm',
      dose,
      frequency,
      route,
      status: 'active',
      startAt: startedAt ? new Date(startedAt) : new Date(),
      provenanceId: provenance.id,
      source: 'manual',
    });

    await this.clinicalRepo.createHealthEvent(patientId, {
      eventType: 'medication_start',
      summary: `Medication started: ${name} ${dose || ''}`.trim(),
      structuredData: { drug: name, dose, frequency },
      provenanceId: provenance.id,
    });

    return ClinicalRecordMapper.toDto(record);
  }

  async getAllergies(patientId) {
    const records = await this.clinicalRepo.findClinicalRecords(patientId, 'allergy');
    return ClinicalRecordMapper.toDtoList(records);
  }

  async addAllergy(patientId, { substance, name, allergen: allergenProp, reaction, severity, verificationStatus = 'patient_confirmed' } = {}) {
    const allergen = substance || name || allergenProp;
    if (!allergen) {
      throw new ApplicationError('Allergy substance is required', 400, 'validation_error');
    }

    const provenance = await this.clinicalRepo.createProvenance({
      sourceType: 'user_input',
      confidence: 1.0,
    });

    const record = await this.clinicalRepo.createClinicalRecord(patientId, {
      recordType: 'allergy',
      name: allergen,
      severity,
      details: { reaction, verificationStatus },
      verificationStatus,
      startAt: new Date(),
      provenanceId: provenance.id,
      source: 'manual',
    });

    await this.clinicalRepo.createHealthEvent(patientId, {
      eventType: 'allergy',
      summary: `Allergy reported: ${allergen} (${reaction || 'reaction unstated'})`,
      structuredData: { substance: allergen, reaction, severity },
      provenanceId: provenance.id,
    });

    return ClinicalRecordMapper.toDto(record);
  }

  async getLabs(patientId) {
    const records = await this.clinicalRepo.findClinicalRecords(patientId, 'lab_result');
    return ClinicalRecordMapper.toDtoList(records);
  }

  async addLab(patientId, { testName, name, loincCode, value, unit, interpretation, collectedAt } = {}) {
    const test = testName || name;
    if (!test) {
      throw new ApplicationError('Lab test name is required', 400, 'validation_error');
    }

    const provenance = await this.clinicalRepo.createProvenance({
      sourceType: 'user_input',
      confidence: 1.0,
    });

    const record = await this.clinicalRepo.createClinicalRecord(patientId, {
      recordType: 'lab_result',
      name: test,
      code: loincCode,
      codeSystem: 'loinc',
      valueNum: typeof value === 'number' ? value : parseFloat(value) || null,
      valueText: typeof value === 'string' ? value : String(value ?? ''),
      unit,
      interpretation,
      startAt: collectedAt ? new Date(collectedAt) : new Date(),
      provenanceId: provenance.id,
      source: 'manual',
    });

    await this.clinicalRepo.createHealthEvent(patientId, {
      eventType: 'lab_result',
      summary: `Lab result: ${test} = ${value} ${unit || ''}`.trim(),
      structuredData: { testName: test, value, unit, interpretation },
      provenanceId: provenance.id,
    });

    return ClinicalRecordMapper.toDto(record);
  }

  async getPatientContext(patientId) {
    return this.clinicalRepo.getPatientContext(patientId);
  }

  async getTimeline(patientId, limit = 50) {
    const timeline = await this.clinicalRepo.getTimeline(patientId, limit);
    return timeline.map(HealthEventMapper.toTimelineDto);
  }

  async getProactiveInsights(patientId) {
    if (this.proactiveMonitoringService) {
      return this.proactiveMonitoringService.getLatestPingOrEvaluate(patientId);
    }
    if (typeof this.clinicalRepo?.getRecentHealthEvents === 'function') {
      const recent = await this.clinicalRepo.getRecentHealthEvents(patientId, 'proactive_ping', 1);
      if (recent && recent.length > 0) {
        return {
          id: recent[0].id,
          pingMessage: recent[0].summary,
          rulesTriggered: recent[0].structuredData?.rulesTriggered || [],
          eventTime: recent[0].eventTime,
          isNew: false
        };
      }
    }
    return null;
  }

  async getConsent(memberId, scope) {
    return this.clinicalRepo.getConsent(memberId, scope);
  }

  async setConsent(memberId, scope, granted) {
    return this.clinicalRepo.setConsent(memberId, scope, granted);
  }

  async getSummaryPdf(patientId) {
    if (!this.pdfService) {
      const { PdfSummaryService } = await import('./pdf-summary-service.js');
      const pool = this.clinicalRepo?.pool;
      let encounterRepo = null;
      let memberRepo = null;
      let documentRepo = null;
      let healthSampleRepo = null;
      if (pool) {
        const { EncounterRepository, MemberRepository, DocumentRepository, HealthSampleRepository } = await import('../repositories/index.js');
        encounterRepo = new EncounterRepository(pool);
        memberRepo = new MemberRepository(pool);
        documentRepo = new DocumentRepository(pool);
        healthSampleRepo = new HealthSampleRepository(pool);
      }
      this.pdfService = new PdfSummaryService({
        clinicalRepo: this.clinicalRepo,
        encounterRepo,
        memberRepo,
        documentRepo,
        healthSampleRepo,
      });
    }
    return this.pdfService.generateSummaryPdf(patientId);
  }
}

