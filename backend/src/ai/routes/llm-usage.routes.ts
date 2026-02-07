/**
 * LLM Usage Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getLlmStatistics, getLlmLogs, getLlmSessions, getAiFeedback } from '../llm-usage.controller.js';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /v1/ai/usage/statistics
 * @desc    Get LLM usage statistics
 * @access  Private
 */
router.get('/statistics', getLlmStatistics);

/**
 * @route   GET /v1/ai/usage/logs
 * @desc    Get LLM usage logs
 * @access  Private
 */
router.get('/logs', getLlmLogs);

/**
 * @route   GET /v1/ai/usage/sessions
 * @desc    Get LLM usage grouped by session
 * @access  Private
 */
router.get('/sessions', getLlmSessions);

/**
 * @route   GET /v1/ai/usage/feedback
 * @desc    Get AI correction feedback logs
 * @access  Private
 */
router.get('/feedback', getAiFeedback);

export default router;
