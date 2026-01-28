/**
 * Authentication Controller
 */

import type { Request, Response } from 'express';
import {
  register,
  login,
  refreshToken as refreshTokenService,
  logout,
  getMe,
} from './auth.service.js';
import { ApiError } from '../middleware/error-handler.js';
import { sendError } from '../utils/error-response.js';

/**
 * Register controller
 */
export const registerController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      sendError(res, {
        statusCode: 400,
        code: 'AUTH.INVALID_INPUT',
        message: 'Username, email, and password are required',
        params: { fields: 'username,email,password' }
      });
      return;
    }

    if (username.length < 3 || username.length > 20) {
      sendError(res, {
        statusCode: 400,
        code: 'AUTH.INVALID_INPUT',
        message: 'Username length must be between 3 and 20 characters',
        params: { field: 'username' }
      });
      return;
    }

    if (password.length < 6) {
      sendError(res, {
        statusCode: 400,
        code: 'AUTH.INVALID_INPUT',
        message: 'Password must be at least 6 characters',
        params: { field: 'password' }
      });
      return;
    }

    // Register user
    const result = await register({ username, email, password });

    // Set cookies
    res.cookie('superinbox_auth_token', result.token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    if (result.refreshToken) {
      res.cookie('superinbox_refresh_token', result.refreshToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    res.cookie('superinbox_user', JSON.stringify(result.user), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error instanceof ApiError) {
      sendError(res, {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        params: error.params,
        details: error.details
      });
      return;
    }
    sendError(res, {
      statusCode: 400,
      code: 'AUTH.REGISTER_FAILED',
      message: error instanceof Error ? error.message : 'Register failed'
    });
  }
};

/**
 * Login controller
 */
export const loginController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      sendError(res, {
        statusCode: 400,
        code: 'AUTH.INVALID_INPUT',
        message: 'Username and password are required',
        params: { fields: 'username,password' }
      });
      return;
    }

    // Login user
    const result = await login({ username, password });

    // Set cookies
    res.cookie('superinbox_auth_token', result.token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    if (result.refreshToken) {
      res.cookie('superinbox_refresh_token', result.refreshToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    res.cookie('superinbox_user', JSON.stringify(result.user), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof ApiError) {
      sendError(res, {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        params: error.params,
        details: error.details
      });
      return;
    }
    sendError(res, {
      statusCode: 401,
      code: 'AUTH.LOGIN_FAILED',
      message: error instanceof Error ? error.message : 'Login failed'
    });
  }
};

/**
 * Refresh token controller
 */
export const refreshTokenController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      sendError(res, {
        statusCode: 400,
        code: 'AUTH.MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required'
      });
      return;
    }

    const result = await refreshTokenService(refreshToken);

    // Set cookies
    res.cookie('superinbox_auth_token', result.token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('superinbox_refresh_token', result.refreshToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.cookie('superinbox_user', JSON.stringify(result.user), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    if (error instanceof ApiError) {
      sendError(res, {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        params: error.params,
        details: error.details
      });
      return;
    }
    sendError(res, {
      statusCode: 401,
      code: 'AUTH.REFRESH_FAILED',
      message: error instanceof Error ? error.message : 'Refresh token failed'
    });
  }
};

/**
 * Logout controller
 */
export const logoutController = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies.superinbox_refresh_token;

    if (refreshToken) {
      await logout(refreshToken);
    }

    // Clear cookies
    res.clearCookie('superinbox_auth_token', { path: '/' });
    res.clearCookie('superinbox_refresh_token', { path: '/' });
    res.clearCookie('superinbox_user', { path: '/' });

    res.status(200).json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies even if there's an error
    res.clearCookie('superinbox_auth_token', { path: '/' });
    res.clearCookie('superinbox_refresh_token', { path: '/' });
    res.clearCookie('superinbox_user', { path: '/' });

    res.status(200).json({
      success: true,
      data: null,
    });
  }
};

/**
 * Get current user controller
 */
export const getMeController = async (req: Request, res: Response): Promise<void> => {
  try {
    // User info is attached by authenticateJwt middleware
    const user = (req as any).user;

    if (!user || !user.userId) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Unauthorized'
      });
      return;
    }

    const userData = await getMe(user.userId);

    if (!userData) {
      sendError(res, {
        statusCode: 404,
        code: 'AUTH.USER_NOT_FOUND',
        message: 'User not found',
        params: { userId: user.userId }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error('Get me error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch user information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
