import { DocumentService } from './document-service.js';

/**
 * Transparent Proxy wrapper providing full backwards compatibility for DocumentProcessorService.
 */
export const DocumentProcessorService = new Proxy(DocumentService, {
  construct(target, args) {
    return new target(...args);
  },
  get(target, prop) {
    return target[prop];
  },
});

export { DocumentService };
export default DocumentProcessorService;
