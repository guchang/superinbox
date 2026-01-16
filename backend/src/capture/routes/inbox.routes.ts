/**
 * Capture Layer - Routes
 */

import { Router } from 'express';
import { inboxController } from '../controllers/inbox.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';

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
 */
router.post(
  '/items/:id/distribute',
  authenticate,
  inboxController.triggerDistribution
);

export default router;
