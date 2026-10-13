import { asyncHandler } from '../middleware/async-handler.js';
import { EncounterService } from '../services/encounter-service.js';

export class EncounterController {
  constructor(encounterServiceOrRepo) {
    if (encounterServiceOrRepo instanceof EncounterService) {
      this.encounterService = encounterServiceOrRepo;
    } else {
      this.encounterService = new EncounterService(encounterServiceOrRepo);
    }
  }

  createEncounter = asyncHandler(async (req, res) => {
    const patientId = req.body?.patientId || req.memberId;
    const encounter = await this.encounterService.createEncounter(patientId, req.body || {});
    res.status(201).json(encounter);
  });

  getEncounter = asyncHandler(async (req, res) => {
    const encounterId = req.params.encounterId || req.params.id;
    const encounter = await this.encounterService.getEncounter(req.memberId, encounterId);
    res.json(encounter);
  });

  listEncounters = asyncHandler(async (req, res) => {
    const patientId = req.query.patientId || req.memberId;
    const limit = parseInt(req.query.limit || '20', 10);
    const encounters = await this.encounterService.listEncounters(patientId, limit);
    res.json({ encounters });
  });

  updateStatus = asyncHandler(async (req, res) => {
    const encounterId = req.params.encounterId || req.params.id;
    const updated = await this.encounterService.updateStatus(req.memberId, encounterId, req.body || {});
    res.json(updated);
  });

  postMessage = asyncHandler(async (req, res) => {
    const encounterId = req.params.encounterId || req.params.id;
    const message = await this.encounterService.postMessage(req.memberId, encounterId, req.body || {});
    res.status(201).json(message);
  });

  getSymptomState = asyncHandler(async (req, res) => {
    const encounterId = req.params.encounterId || req.params.id;
    const state = await this.encounterService.getSymptomState(req.memberId, encounterId);
    res.json(state);
  });

  updateSymptomState = asyncHandler(async (req, res) => {
    const encounterId = req.params.encounterId || req.params.id;
    const updated = await this.encounterService.updateSymptomState(req.memberId, encounterId, req.body || {});
    res.json(updated);
  });
}
