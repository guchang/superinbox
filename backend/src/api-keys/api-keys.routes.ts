/**
 * API Keys Routes
 */

import { Router } from 'express';
import {
  createApiKeyController,
  listApiKeysController,
  getApiKeyController,
  updateApiKeyController,
  toggleApiKeyController,
  disableApiKeyController,
  enableApiKeyController,
  regenerateApiKeyController,
  deleteApiKeyController,
  getApiKeyLogsController,
} from './api-keys.controller.js';
import { authenticateJwt } from '../middleware/auth.js';

const router = Router();

/**
 * @route   POST /v1/api-keys
 * @desc    Create a new API key
 * @access  Private (requires JWT authentication)
 */
router.post('/', authenticateJwt, createApiKeyController);

/**
 * @route   GET /v1/api-keys
 * @desc    List all API keys for the current user
 * @access  Private (requires JWT authentication)
 */
router.get('/', authenticateJwt, listApiKeysController);

/**
 * @route   GET /v1/api-keys/:id
 * @desc    Get a single API key by ID
 * @access  Private (requires JWT authentication)
 */
router.get('/:id', authenticateJwt, getApiKeyController);

/**
 * @route   PATCH /v1/api-keys/:id
 * @desc    Update an API key (name and scopes)
 * @access  Private (requires JWT authentication)
 */
router.patch('/:id', authenticateJwt, updateApiKeyController);

/**
 * @route   POST /v1/api-keys/:id/disable
 * @desc    Disable an API key
 * @access  Private (requires JWT authentication)
 */
router.post('/:id/disable', authenticateJwt, disableApiKeyController);

/**
 * @route   POST /v1/api-keys/:id/enable
 * @desc    Enable an API key
 * @access  Private (requires JWT authentication)
 */
router.post('/:id/enable', authenticateJwt, enableApiKeyController);

/**
 * @route   POST /v1/api-keys/:id/toggle
 * @desc    Enable or disable an API key
 * @access  Private (requires JWT authentication)
 * @legacy  This endpoint is maintained for backward compatibility.
 *          New code should use POST /v1/api-keys/:id/enable or /disable instead.
 */
router.post('/:id/toggle', authenticateJwt, toggleApiKeyController);

/**
 * @route   POST /v1/api-keys/:id/regenerate
 * @desc    Regenerate an API key (creates new key value)
 * @access  Private (requires JWT authentication)
 */
router.post('/:id/regenerate', authenticateJwt, regenerateApiKeyController);

/**
 * @route   DELETE /v1/api-keys/:id
 * @desc    Delete an API key
 * @access  Private (requires JWT authentication)
 */
router.delete('/:id', authenticateJwt, deleteApiKeyController);

/**
 * @route   GET /v1/api-keys/:id/logs
 * @desc    Get access logs for an API key
 * @access  Private (requires JWT authentication)
 */
router.get('/:id/logs', authenticateJwt, getApiKeyLogsController);

export default router;
