/**
 * Settings Layer - Settings Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// Statistics endpoint
router.get('/statistics', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      totalItems: 11,
      itemsByIntent: {
        todo: 2,
        idea: 3,
        expense: 1,
        schedule: 2,
        note: 0,
        bookmark: 0,
        unknown: 3,
      },
      itemsByStatus: {
        pending: 0,
        processing: 0,
        completed: 11,
        failed: 0,
      },
      itemsBySource: {
        cli: 11,
      },
      avgProcessingTime: 10.5,
      todayItems: 0,
      weekItems: 11,
      monthItems: 11,
    }
  });
});

// API Keys endpoints
router.get('/api-keys', authenticate, (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        keyValue: 'dev-key-change-this-in-production',
        name: 'Development Key',
        scopes: ['full'],
        userId: 'default-user',
        isActive: true,
        createdAt: new Date().toISOString(),
      }
    ]
  });
});

router.post('/api-keys', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      id: Date.now().toString(),
      keyValue: `sinbox_${Math.random().toString(36).substring(2)}`,
      ...req.body,
      isActive: true,
      createdAt: new Date().toISOString(),
    }
  });
});

router.delete('/api-keys/:id', authenticate, (req, res) => {
  res.json({ success: true });
});

// Logs endpoint
router.get('/logs', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      logs: [],
      total: 0,
    }
  });
});

export default router;
