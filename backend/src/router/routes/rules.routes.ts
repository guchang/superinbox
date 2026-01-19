/**
 * Routing Layer - Rules Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { dispatchItem } from '../controllers/dispatch.controller.js';

const router = Router();

// Placeholder routes for routing rules
router.get('/rules', authenticate, (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        name: 'Todo to Notion',
        description: 'Route todo items to Notion',
        priority: 1,
        conditions: [
          { field: 'category', operator: 'equals', value: 'todo' }
        ],
        actions: [
          { type: 'notion', config: { databaseId: 'xxx' } }
        ],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ]
  });
});

router.get('/rules/:id', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      name: 'Todo to Notion',
      description: 'Route todo items to Notion',
      priority: 1,
      conditions: [
        { field: 'intent', operator: 'equals', value: 'todo' }
      ],
      actions: [
        { type: 'notion', config: { databaseId: 'xxx' } }
      ],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  });
});

router.post('/rules', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  });
});

router.put('/rules/:id', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    }
  });
});

router.delete('/rules/:id', authenticate, (req, res) => {
  res.json({ success: true });
});

router.post('/rules/:id/test', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      matched: true,
      rule: req.params.id,
    }
  });
});

/**
 * @route   POST /v1/routing/dispatch/:id
 * @desc    Manually dispatch an item to configured adapters
 * @access  Private (requires authentication)
 */
router.post('/dispatch/:id', authenticate, dispatchItem);

export default router;
