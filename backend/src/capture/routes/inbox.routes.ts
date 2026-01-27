/**
 * Capture Layer - Routes
 */

import { Router } from 'express';
import { inboxController } from '../controllers/inbox.controller.js';
import { batchRedistributeController } from '../controllers/bredistribute.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';
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
 * @route   GET /v1/items
 * @desc    Get all items with filtering
 * @access  Private (JWT or API Key)
 */
router.get(
  '/items',
  authenticate,
  inboxController.getItems
);

/**
 * @route   GET /v1/items/:id
 * @desc    Get a single item by ID
 * @access  Private (JWT or API Key)
 */
router.get(
  '/items/:id',
  authenticate,
  inboxController.getItem
);

/**
 * @route   PUT /v1/items/:id
 * @desc    Update an item
 * @access  Private (JWT or API Key)
 */
router.put(
  '/items/:id',
  authenticate,
  inboxController.updateItem
);

/**
 * @route   DELETE /v1/items/:id
 * @desc    Delete an item
 * @access  Private (JWT or API Key)
 */
router.delete(
  '/items/:id',
  authenticate,
  inboxController.deleteItem
);

/**
 * @route   POST /v1/items/:id/distribute
 * @desc    Manually trigger distribution for an item
 * @access  Private (JWT or API Key)
 * @legacy  This route is maintained for backward compatibility.
 *           New code should use POST /v1/routing/dispatch/:id instead.
 */
router.post(
  '/items/:id/distribute',
  authenticate,
  inboxController.triggerDistribution
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
