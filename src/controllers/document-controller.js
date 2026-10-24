import path from 'node:path';
import { asyncHandler } from '../middleware/async-handler.js';
import { ApplicationError } from '../errors/application-error.js';

export class DocumentController {
  constructor(documentService, documentRepo) {
    this.documentService = documentService;
    this.documentProcessorService = documentService;
    this.documentRepo = documentRepo;
  }

  upload = asyncHandler(async (req, res) => {
    let file = req.file;

    // Support frontend uploading via document/image URL
    if (!file && req.body?.url) {
      const docUrl = req.body.url;
      try {
        const fetchRes = await fetch(docUrl);
        if (!fetchRes.ok) {
          throw new ApplicationError(`Failed to fetch document from URL (${fetchRes.status})`, 400, 'validation_error');
        }
        const arrayBuf = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const contentType = (fetchRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
        let originalname = req.body.filename;
        if (!originalname) {
          try {
            const parsed = new URL(docUrl);
            const base = path.basename(parsed.pathname);
            originalname = base && base !== '/' ? base : 'document.jpg';
          } catch {
            originalname = 'document.jpg';
          }
        }
        file = {
          originalname,
          mimetype: contentType,
          size: buffer.length,
          buffer,
        };
      } catch (err) {
        if (err instanceof ApplicationError) throw err;
        throw new ApplicationError(`Error downloading document from URL: ${err.message}`, 400, 'validation_error');
      }
    }

    if (!file) {
      throw new ApplicationError('No document file or URL provided', 400, 'validation_error');
    }

    let mimeType = file.mimetype || 'application/pdf';
    if (mimeType === 'image/jpg' || mimeType === 'image/pjpeg') {
      mimeType = 'image/jpeg';
    }
    const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];
    if (!allowedMimes.includes(mimeType)) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (ext === '.pdf') mimeType = 'application/pdf';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.tif' || ext === '.tiff') mimeType = 'image/tiff';
      else mimeType = 'application/pdf';
    }

    const validDocTypes = ['prescription', 'lab_report', 'discharge_summary', 'imaging', 'other'];
    const docType = req.body?.docType && validDocTypes.includes(req.body.docType)
      ? req.body.docType
      : undefined;

    const document = await this.documentService.uploadAndProcess(req.memberId, {
      originalname: file.originalname,
      mimetype: mimeType,
      size: file.size,
      buffer: file.buffer,
      docType,
    });

    res.status(201).json({
      message: 'Document uploaded and processed successfully',
      document,
    });
  });

  getDocument = asyncHandler(async (req, res) => {
    const documentId = req.params.documentId || req.params.id;
    const document = await this.documentRepo.findDocumentById(req.memberId, documentId);
    if (!document) throw new ApplicationError('Document not found', 404, 'not_found');
    res.json({ document });
  });

  listDocuments = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit || '20', 10);
    const documents = await this.documentRepo.listDocuments(req.memberId, limit);
    res.json({ documents });
  });

  commitFields = asyncHandler(async (req, res) => {
    const documentId = req.params.documentId || req.params.id;
    const body = req.body || {};
    const fieldIds = Array.isArray(body.fieldIds) ? body.fieldIds : null;

    const result = await this.documentService.commitDocumentFields(req.memberId, documentId, fieldIds);
    res.json(result);
  });
}
