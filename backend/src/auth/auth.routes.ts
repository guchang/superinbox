/**
 * Authentication Routes
 */

import { Router } from 'express';
import {
  registerController,
  loginController,
  refreshTokenController,
  logoutController,
  getMeController,
} from './auth.controller.js';
import { authenticateJwt } from '../middleware/auth.js';

const router = Router();

/**
 * @route   POST /v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerController);

/**
 * @route   POST /v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginController);

/**
 * @route   POST /v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', refreshTokenController);

/**
 * @route   POST /v1/auth/logout
 * @desc    Logout user
 * @access  Public (but requires refresh token)
 */
router.post('/logout', logoutController);

/**
 * @route   GET /v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticateJwt, getMeController);

export default router;
