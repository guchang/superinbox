/**
 * File Upload Middleware
 * Handles multipart/form-data uploads for images and files
 */

import type { RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { config } from '../config/index.js';

interface UploadAppError extends Error {
  statusCode?: number;
  code?: string;
  params?: Record<string, unknown>;
}

// Ensure upload directory exists
const uploadDir = config.storage.uploadDir || './data/uploads';
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const maxUploadFiles = Math.max(1, config.storage.maxUploadFiles || 20);
const maxUploadSize = config.storage.maxUploadSize || 104857600;
const maxUploadSizeLabel = `${Math.round(maxUploadSize / (1024 * 1024))}MB`;

const createUploadError = (
  code: string,
  message: string,
  params?: Record<string, unknown>,
  statusCode = 400
): UploadAppError => {
  const error = new Error(message) as UploadAppError;
  error.code = code;
  error.statusCode = statusCode;
  error.params = params;
  return error;
};

const mapMulterError = (error: unknown): UploadAppError => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return createUploadError('INBOX.FILE_TOO_LARGE', 'File too large', { max: maxUploadSizeLabel });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return createUploadError('INBOX.TOO_MANY_FILES', 'Too many files', { max: maxUploadFiles });
    }

    return createUploadError('INBOX.INVALID_INPUT', error.message);
  }

  const uploadError = error as UploadAppError;
  if (uploadError?.code) {
    return uploadError;
  }

  return createUploadError(
    'INBOX.INVALID_INPUT',
    (error as Error)?.message || 'Invalid upload request'
  );
};

const wrapUploadMiddleware = (middleware: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    middleware(req, res, (error?: unknown) => {
      if (!error) {
        next();
        return;
      }

      next(mapMulterError(error));
    });
  };
};

// Configure storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename: timestamp-randomstring.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  }
});

const allowedTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/zip',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/opus',
  'video/mp4',
  'video/webm'
];

// File filter to accept only specific types
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(createUploadError('INBOX.INVALID_FILE_TYPE', 'Unsupported file type', {
    mimeType: file.mimetype
  }));
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxUploadSize,
    fieldSize: 20971520, // 20MB for non-file fields
    files: maxUploadFiles // Maximum files per request
  }
});

// Export middleware for single file upload
export const uploadSingle = wrapUploadMiddleware(upload.single('file') as RequestHandler);

// Export middleware for multiple files upload
export const uploadMultiple = wrapUploadMiddleware(upload.array('files', maxUploadFiles) as RequestHandler);

// Export upload instance for custom use
export { upload };
