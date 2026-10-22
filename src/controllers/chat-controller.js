import { asyncHandler } from '../middleware/async-handler.js';
import { ApplicationError } from '../errors/application-error.js';

export class ChatController {
  constructor({ clinicalOrchestratorService, chatService, clinicalRulesService, clinicalRepo }) {
    this.chatService = chatService || clinicalOrchestratorService;
    this.clinicalOrchestratorService = this.chatService;
    this.clinicalRulesService = clinicalRulesService;
    this.clinicalRepo = clinicalRepo;
  }

  chat = asyncHandler(async (req, res) => {
    const rawMsg = req.body.message || req.body.content || req.body.text;
    const { encounterId, intent, stream, model, requestedModel } = req.body;
    const activeModel = model || requestedModel || 'gemini';
    if (!rawMsg || typeof rawMsg !== 'string' || !rawMsg.trim()) {
      throw new ApplicationError('Message text is required', 400, 'validation_error');
    }

    const message = rawMsg.trim();

    if (stream) {

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const onProgress = (statusMsg) => {
        res.write(`data: ${JSON.stringify({ event: 'progress', message: statusMsg })}\n\n`);
      };

      try {
        const response = await this.chatService.handleChatMessage({
          patientId: req.memberId,
          encounterId,
          message,
          intent,
          model: activeModel,
          onProgress,
        });
        res.write(`data: ${JSON.stringify({ event: 'complete', data: response })}\n\n`);
        res.end();
      } catch (err) {
        res.write(`data: ${JSON.stringify({ event: 'error', message: err.message })}\n\n`);
        res.end();
      }
      return;
    }

    const response = await this.chatService.handleChatMessage({
      patientId: req.memberId,
      encounterId,
      message,
      intent,
      model: activeModel,
    });

    res.json(response);
  });

  ragQuery = asyncHandler(async (req, res) => {
    const { query } = req.body;
    if (!query) throw new ApplicationError('Query is required', 400, 'validation_error');

    const result = await this.chatService.queryRAG(req.memberId, query);
    res.json(result);
  });

  validateDrug = asyncHandler(async (req, res) => {
    const drug = req.body.drug || req.body.medication || req.body.drugName;
    if (!drug) throw new ApplicationError('Drug name is required', 400, 'validation_error');

    const hasInlineLists = Array.isArray(req.body.allergies) || Array.isArray(req.body.patientAllergies) ||
      Array.isArray(req.body.conditions) || Array.isArray(req.body.existingConditions);

    let patientContext;
    if (req.body.context) {
      patientContext = req.body.context;
    } else if (hasInlineLists) {
      const rawAllergies = req.body.allergies || req.body.patientAllergies || [];
      const rawConditions = req.body.conditions || req.body.existingConditions || [];
      patientContext = {
        allergies: rawAllergies.map((a) => (typeof a === 'string' ? { substance: a } : a)),
        activeConditions: rawConditions.map((c) => (typeof c === 'string' ? { name: c } : c)),
        conditions: rawConditions.map((c) => (typeof c === 'string' ? { name: c } : c)),
      };
    } else {
      patientContext = await this.clinicalRepo.getPatientContext(req.memberId);
    }

    const result = await this.clinicalRulesService.validateDrugAction({
      drug,
      context: patientContext,
    });

    res.json(result);
  });

  submitFeedback = asyncHandler(async (req, res) => {
    let { messageId, encounterId, rating, feedbackText, tags } = req.body;
    if (rating === 1 || rating === '1' || rating === 'up') rating = 'thumbs_up';
    if (rating === -1 || rating === '-1' || rating === 'down') rating = 'thumbs_down';

    if (!messageId || !rating || !['thumbs_up', 'thumbs_down'].includes(rating)) {
      throw new ApplicationError('messageId and valid rating (thumbs_up or thumbs_down) are required', 400, 'validation_error');
    }

    const result = await this.chatService.submitFeedback(req.memberId, {
      messageId,
      encounterId,
      rating,
      feedbackText,
      tags: Array.isArray(tags) ? tags : [],
    });

    res.status(201).json(result);
  });

  summarizeChat = asyncHandler(async (req, res) => {
    const encounterId = req.body.encounterId || req.params.encounterId || req.body.sessionId;
    if (!encounterId) {
      throw new ApplicationError('encounterId is required', 400, 'validation_error');
    }
    const result = await this.chatService.summarizeEncounter(req.memberId, encounterId);
    res.json(result);
  });
}

export const OrchestratorController = ChatController;
export default ChatController;

