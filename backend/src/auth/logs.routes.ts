/**
 * Access Logs Routes
 */

import { Router } from 'express';
import {
  getGlobalLogs,
  createExportTask,
  getExportStatus,
  downloadExportFile,
} from './logs.controller.js';
import { getStatistics } from './statistics.controller.js';
import { authenticateJwt } from '../middleware/auth.js';

const router = Router();

/**
 * @route   GET /v1/auth/logs
 * @desc    Get access logs for current user
 * @access  Private
 */
router.get('/logs', authenticateJwt, getGlobalLogs);

/**
 * @route   POST /v1/auth/logs/export
 * @desc    Create export task for current user's logs
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

/**
 * @route   GET /v1/auth/logs/statistics
 * @desc    Get API usage statistics for current user
 * @access  Private
 */
router.get('/logs/statistics', authenticateJwt, getStatistics);

export default router;
