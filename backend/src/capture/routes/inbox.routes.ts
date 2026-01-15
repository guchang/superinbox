/**
 * Capture Layer - Routes
 */

import { Router } from 'express';
import { inboxController } from '../controllers/inbox.controller.js';
import { authenticateApiKey } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';

const router = Router();

/**
 * @route   POST /v1/inbox
 * @desc    Create a new item from inbox input
 * @access  Private (API Key)
 */
router.post(
  '/inbox',
  authenticateApiKey,
  inboxController.createItem
);

/**
 * @route   GET /v1/items
 * @desc    Get all items with filtering
 * @access  Private (API Key)
 */
router.get(
  '/items',
  authenticateApiKey,
  inboxController.getItems
);

/**
 * @route   GET /v1/items/:id
 * @desc    Get a single item by ID
 * @access  Private (API Key)
 */
router.get(
  '/items/:id',
  authenticateApiKey,
  inboxController.getItem
);

/**
 * @route   PUT /v1/items/:id
 * @desc    Update an item
 * @access  Private (API Key)
 */
router.put(
  '/items/:id',
  authenticateApiKey,
  inboxController.updateItem
);

/**
 * @route   DELETE /v1/items/:id
 * @desc    Delete an item
 * @access  Private (API Key)
 */
router.delete(
  '/items/:id',
  authenticateApiKey,
  inboxController.deleteItem
);

/**
 * @route   POST /v1/items/:id/distribute
 * @desc    Manually trigger distribution for an item
 * @access  Private (API Key)
 */
router.post(
  '/items/:id/distribute',
  authenticateApiKey,
  inboxController.triggerDistribution
);

export default router;
