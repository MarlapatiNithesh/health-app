import { ChatService } from './chat-service.js';

/**
 * Transparent Proxy wrapper providing full backwards compatibility for ClinicalOrchestratorService.
 */
export const ClinicalOrchestratorService = new Proxy(ChatService, {
  construct(target, args) {
    return new target(...args);
  },
  get(target, prop) {
    return target[prop];
  },
});

export { ChatService };
export default ClinicalOrchestratorService;
