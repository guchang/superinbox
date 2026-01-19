/**
 * File Upload Middleware
 * Handles multipart/form-data uploads for images and files
 */

import multer from 'multer';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { config } from '../config/index.js';

// Ensure upload directory exists
const uploadDir = config.storage.uploadDir || './data/uploads';
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename: timestamp-randomstring.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  }
});

// File filter to accept only specific types
const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/zip',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'video/mp4',
    'video/webm'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (config.storage.maxUploadSize || 10485760), // Default 10MB per file
    fieldSize: 20971520, // 20MB for non-file fields
    files: 5 // Maximum 5 files
  }
});

// Export middleware for single file upload
export const uploadSingle = upload.single('file');

// Export middleware for multiple files upload
export const uploadMultiple = upload.array('files', 5);

// Export upload instance for custom use
export { upload };
