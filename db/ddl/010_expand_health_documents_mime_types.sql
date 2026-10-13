-- Migration 010: Expand health_documents mime_type check constraint to support all document formats
-- (.pdf, .doc, .docx, .txt, .csv, .rtf, images: .png, .jpg, .jpeg, .tiff, .webp)

ALTER TABLE health_documents DROP CONSTRAINT IF EXISTS health_documents_mime_type_check;

ALTER TABLE health_documents ADD CONSTRAINT health_documents_mime_type_check
  CHECK (mime_type IN (
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/tiff',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/rtf'
  ));
