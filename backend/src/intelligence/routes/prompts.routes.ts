/**
 * Intelligence Layer - Prompt Template Routes
 *
 * Includes routes for:
 * - Prompt template management
 * - AI parse result retrieval and correction
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getParseResult, updateParseResult } from '../controllers/parse.controller.js';

const router = Router();

// Placeholder routes for prompt templates
router.get('/prompts', authenticate, (_req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        name: 'Default Category Classifier',
        description: 'Classify user category from content',
        category: 'unknown',
        template: 'Analyze the following content and classify the category',
        variables: ['content'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ]
  });
});

router.get('/prompts/:id', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      name: 'Default Category Classifier',
      description: 'Classify user category from content',
      category: 'unknown',
      template: 'Analyze the following content and classify the category',
      variables: ['content'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  });
});

router.post('/prompts', authenticate, (req, res) => {
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

router.put('/prompts/:id', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    }
  });
});

router.delete('/prompts/:id', authenticate, (_req, res) => {
  res.json({ success: true });
});

// Parse result routes
// GET /v1/intelligence/parse/:id - Retrieve AI parse result
router.get('/parse/:id', authenticate, getParseResult);

// PATCH /v1/intelligence/parse/:id - Update AI parse result with user correction
router.patch('/parse/:id', authenticate, updateParseResult);

export default router;
