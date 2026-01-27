/**
 * LLM Usage Routes
 */

import { Router } from 'express';
import { getLlmStatistics, getLlmLogs, getLlmSessions } from '../llm-usage.controller.js';

const router = Router();

/**
 * @route   GET /v1/ai/usage/statistics
 * @desc    Get LLM usage statistics
 * @access  Private (requires admin:full scope)
 */
router.get('/statistics', getLlmStatistics);

/**
 * @route   GET /v1/ai/usage/logs
 * @desc    Get LLM usage logs
 * @access  Private (requires admin:full scope)
 */
router.get('/logs', getLlmLogs);

/**
 * @route   GET /v1/ai/usage/sessions
 * @desc    Get LLM usage grouped by session
 * @access  Private (requires admin:full scope)
 */
router.get('/sessions', getLlmSessions);

export default router;
