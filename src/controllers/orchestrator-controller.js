import { ChatController } from './chat-controller.js';

/**
 * Proxy wrapper providing seamless backwards compatibility for OrchestratorController.
 */
export const OrchestratorController = new Proxy(ChatController, {
  construct(target, args) {
    return new target(...args);
  },
  get(target, prop) {
    return target[prop];
  },
});

export { ChatController };
export default OrchestratorController;
