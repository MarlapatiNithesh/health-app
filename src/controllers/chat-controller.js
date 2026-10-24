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
    const { encounterId, message, intent, stream } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new ApplicationError('Message text is required', 400, 'validation_error');
    }

    if (stream) {
      // SSE Setup for real-time agentic progress updates
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const onProgress = (statusMsg) => {
        res.write(`data: ${JSON.stringify({ event: 'progress', message: statusMsg })}\n\n`);
      };

      try {
        const response = await this.chatService.handleChatMessage({
          patientId: req.memberId,
          encounterId,
          message: message.trim(),
          intent,
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
      message: message.trim(),
      intent,
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
    const { drug, context } = req.body;
    if (!drug) throw new ApplicationError('Drug name is required', 400, 'validation_error');
    const patientContext = context || (await this.clinicalRepo.getPatientContext(req.memberId));

    const result = await this.clinicalRulesService.validateDrugAction({
      drug,
      context: patientContext,
    });

    res.json(result);
  });
}

export const OrchestratorController = ChatController;
export default ChatController;
