import { asyncHandler } from '../middleware/async-handler.js';
import { ApplicationError } from '../errors/application-error.js';
import { ClinicalService } from '../services/clinical-service.js';

export class ClinicalController {
  constructor(clinicalServiceOrRepo) {
    if (clinicalServiceOrRepo instanceof ClinicalService) {
      this.clinicalService = clinicalServiceOrRepo;
    } else {
      this.clinicalService = new ClinicalService(clinicalServiceOrRepo);
    }
  }

  getProfile = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    if (patientId !== req.memberId) {
      throw new ApplicationError('Forbidden: Cannot access another patient record', 403, 'forbidden');
    }
    const patient = await this.clinicalService.getProfile(patientId);
    res.json({ patient });
  });

  updateProfile = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    if (patientId !== req.memberId) {
      throw new ApplicationError('Forbidden', 403, 'forbidden');
    }
    const patient = await this.clinicalService.updateProfile(patientId, req.body || {});
    res.json({ patient });
  });

  getConditions = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    const conditions = await this.clinicalService.getConditions(patientId);
    res.json({ conditions });
  });

  addCondition = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    const record = await this.clinicalService.addCondition(patientId, req.body || {});
    res.status(201).json({ condition: record });
  });

  getMedications = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    const medications = await this.clinicalService.getMedications(patientId);
    res.json({ medications });
  });

  addMedication = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    const record = await this.clinicalService.addMedication(patientId, req.body || {});
    res.status(201).json({ medication: record });
  });

  getAllergies = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    const allergies = await this.clinicalService.getAllergies(patientId);
    res.json({ allergies });
  });

  addAllergy = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    const record = await this.clinicalService.addAllergy(patientId, req.body || {});
    res.status(201).json({ allergy: record });
  });

  getLabs = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    const labs = await this.clinicalService.getLabs(patientId);
    res.json({ labs });
  });

  addLab = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    const record = await this.clinicalService.addLab(patientId, req.body || {});
    res.status(201).json({ lab: record });
  });

  getContext = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    if (patientId !== req.memberId) {
      throw new ApplicationError('Forbidden', 403, 'forbidden');
    }
    const context = await this.clinicalService.getPatientContext(patientId);
    res.json({ context });
  });

  getTimeline = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    const limit = parseInt(req.query.limit || '50', 10);
    const timeline = await this.clinicalService.getTimeline(patientId, limit);
    res.json({ timeline });
  });

  getProactiveInsights = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.memberId;
    const patientId = rawPid === 'me' ? req.memberId : rawPid;
    const insight = await this.clinicalService.getProactiveInsights(patientId);
    res.json({ insight });
  });

  getConsent = asyncHandler(async (req, res) => {
    let { scope } = req.params;
    const aliases = {
      data_sharing: 'data_access',
      telemetry_analytics: 'wearable_sync',
      wearables: 'wearable_sync',
      clinical_ai: 'ai_processing',
      ai_triage: 'ai_processing',
      documents: 'document_upload',
    };
    if (scope && aliases[scope]) {
      scope = aliases[scope];
    }
    const consent = await this.clinicalService.getConsent(req.memberId, scope);
    if (!consent) {
      return res.json({
        consent: {
          memberId: req.memberId,
          scope,
          granted: false,
          grantedAt: null,
          revokedAt: null,
        },
      });
    }
    res.json({ consent });
  });

  setConsent = asyncHandler(async (req, res) => {
    let scope = req.params.scope || req.body?.scope;
    const aliases = {
      data_sharing: 'data_access',
      telemetry_analytics: 'wearable_sync',
      wearables: 'wearable_sync',
      clinical_ai: 'ai_processing',
      ai_triage: 'ai_processing',
      documents: 'document_upload',
    };
    if (!scope || scope === 'global' || scope === 'all') {
      scope = 'global';
    } else if (aliases[scope]) {
      scope = aliases[scope];
    }

    const granted = req.body?.granted !== undefined ? Boolean(req.body.granted) : true;
    const consent = await this.clinicalService.setConsent(req.memberId, scope, granted);
    res.json({ consent });
  });

  getSummaryPdf = asyncHandler(async (req, res) => {
    const rawPid = req.params.patientId || req.query.patientId || req.memberId;
    const patientId = (!rawPid || rawPid === 'me' || rawPid === 'undefined' || rawPid === 'null')
      ? req.memberId
      : rawPid;
    if (patientId !== req.memberId) {
      throw new ApplicationError('Forbidden: Cannot access another patient record', 403, 'forbidden');
    }
    const { buffer, filename } = await this.clinicalService.getSummaryPdf(patientId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  });
}

