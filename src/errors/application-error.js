export class ApplicationError extends Error {
  constructor(message, status = 400, code = 'invalid_request', details) {
    super(message);
    this.name = 'ApplicationError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
