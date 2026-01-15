/**
 * Routing Layer - Rules Routes
 */

import { Router } from 'express';
import { authenticateApiKey } from '../../middleware/auth.js';

const router = Router();

// Placeholder routes for routing rules
router.get('/rules', authenticateApiKey, (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
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
    ]
  });
});

router.get('/rules/:id', authenticateApiKey, (req, res) => {
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

router.post('/rules', authenticateApiKey, (req, res) => {
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

router.put('/rules/:id', authenticateApiKey, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    }
  });
});

router.delete('/rules/:id', authenticateApiKey, (req, res) => {
  res.json({ success: true });
});

router.post('/rules/:id/test', authenticateApiKey, (req, res) => {
  res.json({
    success: true,
    data: {
      matched: true,
      rule: req.params.id,
    }
  });
});

export default router;
