/**
 * Capture Layer - Routes
 */

import { Router } from 'express';
import { inboxController } from '../controllers/inbox.controller.js';
import { batchRedistributeController } from '../controllers/bredistribute.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { uploadSingle, uploadMultiple } from '../../middleware/upload';

const router = Router();

/**
 * @route   POST /v1/inbox
 * @desc    Create a new item from inbox input
 * @access  Private (JWT or API Key)
 */
router.post(
  '/inbox',
  authenticate,
  inboxController.createItem
);

/**
 * @route   GET /v1/inbox
 * @desc    Get all items with filtering (documented API)
 * @access  Private (API Key)
 */
router.get(
  '/inbox',
  authenticate,
  inboxController.getItems
);

/**
 * @route   GET /v1/inbox/search
 * @desc    Search items by keyword (documented API)
 * @access  Private (API Key)
 * NOTE: Must come before /inbox/:id to avoid being matched as :id
 */
router.get(
  '/inbox/search',
  authenticate,
  inboxController.searchItems
);

/**
 * @route   GET /v1/inbox/sources
 * @desc    Get available sources for filtering
 * @access  Private (API Key)
 * NOTE: Must come before /inbox/:id to avoid being matched as :id
 */
router.get(
  '/inbox/sources',
  authenticate,
  inboxController.getSources
);

/**
 * @route   POST /v1/inbox/batch
 * @desc    Create multiple items in one request (documented API)
 * @access  Private (API Key)
 * NOTE: Must come before /inbox/:id to avoid being matched as :id
 */
router.post(
  '/inbox/batch',
  authenticate,
  inboxController.createItemsBatch
);

/**
 * @route   POST /v1/inbox/files
 * @desc    Create a new item with multiple file uploads
 * @access  Private (API Key)
 * NOTE: Must come before /inbox/:id to avoid being matched as :id
 */
router.post(
  '/inbox/files',
  authenticate,
  uploadMultiple,
  inboxController.createItemWithMultipleFiles
);

/**
 * @route   POST /v1/inbox/file
 * @desc    Create a new item with file upload (image, audio, or file)
 * @access  Private (API Key)
 * NOTE: Must come before /inbox/:id to avoid being matched as :id
 */
router.post(
  '/inbox/file',
  authenticate,
  uploadSingle,
  inboxController.createItemWithFile
);

/**
 * @route   GET /v1/inbox/:id
 * @desc    Get a single item by ID (documented API)
 * @access  Private (API Key)
 */
router.get(
  '/inbox/:id',
  authenticate,
  inboxController.getItem
);

/**
 * @route   PUT /v1/inbox/:id
 * @desc    Update an item by ID (documented API)
 * @access  Private (API Key)
 */
router.put(
  '/inbox/:id',
  authenticate,
  inboxController.updateItem
);

/**
 * @route   DELETE /v1/inbox/:id
 * @desc    Delete an item by ID (documented API)
 * @access  Private (API Key)
 */
router.delete(
  '/inbox/:id',
  authenticate,
  inboxController.deleteItemFromInbox
);

/**
 * @route   GET /v1/inbox/:id/routing-progress
 * @desc    Get real-time routing progress via SSE
 * @access  Private (JWT or API Key)
 */
router.get(
  '/inbox/:id/routing-progress',
  authenticate,
  inboxController.getRoutingProgress
);

/**
 * @route   GET /v1/inbox/:id/file
 * @desc    Serve uploaded file for inline viewing
 * @access  Private (API Key)
 */
router.get(
  '/inbox/:id/file',
  authenticate,
  inboxController.serveFile
);

/**
 * @route   GET /v1/inbox/:id/file/:index
 * @desc    Serve specific file by index for multi-file items
 * @access  Private (API Key)
 */
router.get(
  '/inbox/:id/file/:index',
  authenticate,
  inboxController.serveFile
);

/**
 * @route   GET /v1/inbox/:id/file/download
 * @desc    Download file as attachment
 * @access  Private (API Key)
 */
router.get(
  '/inbox/:id/file/download',
  authenticate,
  inboxController.downloadFile
);

/**
 * @route   GET /v1/inbox/:id/file/:index/download
 * @desc    Download specific file by index for multi-file items
 * @access  Private (API Key)
 */
router.get(
  '/inbox/:id/file/:index/download',
  authenticate,
  inboxController.downloadFile
);

/**
 * @route   POST /v1/inbox/:id/retry
 * @desc    Retry AI processing for failed items
 * @access  Private (API Key)
 */
router.post(
  '/inbox/:id/retry',
  authenticate,
  inboxController.retryAIProcessing
);

/**
 * @route   POST /v1/inbox/:id/reclassify
 * @desc    Reclassify an item regardless of status
 * @access  Private (API Key)
 */
router.post(
  '/inbox/:id/reclassify',
  authenticate,
  inboxController.reclassifyItem
);

/**
 * @route   POST /v1/inbox/:id/distribute
 * @desc    Redistribute an item to configured targets
 * @access  Private (API Key)
 */
router.post(
  '/inbox/:id/distribute',
  authenticate,
  inboxController.distributeItem
);

/**
 * @route   POST /v1/inbox/:id/cancel-routing
 * @desc    Cancel ongoing routing and reset status
 * @access  Private (API Key)
 */
router.post(
  '/inbox/:id/cancel-routing',
  authenticate,
  inboxController.cancelRouting
);

/**
 * @route   POST /v1/inbox/batch-redistribute
 * @desc    Batch redistribute items with safety controls
 * @access  Private (API Key)
 */
router.post(
  '/inbox/batch-redistribute',
  authenticate,
  batchRedistributeController.batchRedistribute
);

/**
 * @route   GET /v1/inbox/batch-redistribute/status
 * @desc    Get batch redistribution status
 * @access  Private (API Key)
 */
router.get(
  '/inbox/batch-redistribute/status',
  authenticate,
  batchRedistributeController.getBatchStatus
);

export default router;
