/**
 * Access Logs Routes
 */

import { Router } from 'express';
import {
  getGlobalLogs,
  getApiKeyLogs,
  createExportTask,
  getExportStatus,
  downloadExportFile,
} from './logs.controller.js';
import { authenticateJwt } from '../middleware/auth.js';

const router = Router();

/**
 * @route   GET /v1/auth/logs
 * @desc    Get global access logs (admin only)
 * @access  Private (requires admin:full scope)
 */
router.get('/logs', authenticateJwt, getGlobalLogs);

/**
 * @route   GET /v1/auth/api-keys/:keyId/logs
 * @desc    Get logs for a specific API key
 * @access  Private (admin or key owner)
 */
router.get('/api-keys/:keyId/logs', authenticateJwt, getApiKeyLogs);

/**
 * @route   POST /v1/auth/logs/export
 * @desc    Create export task (async export for large datasets)
 * @access  Private
 */
router.post('/logs/export', authenticateJwt, createExportTask);

/**
 * @route   GET /v1/auth/logs/exports/:exportId
 * @desc    Get export task status
 * @access  Private
 */
router.get('/logs/exports/:exportId', authenticateJwt, getExportStatus);

/**
 * @route   GET /v1/auth/logs/exports/:exportId/download
 * @desc    Download exported file
 * @access  Private
 */
router.get('/logs/exports/:exportId/download', authenticateJwt, downloadExportFile);

export default router;
