/**
 * Authentication Controller
 */

import type { Request, Response } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
} from './auth.service.js';

/**
 * Register controller
 */
export const registerController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      res.status(400).json({
        success: false,
        error: '用户名、邮箱和密码不能为空',
      });
      return;
    }

    if (username.length < 3 || username.length > 20) {
      res.status(400).json({
        success: false,
        error: '用户名长度必须在3-20位之间',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: '密码至少6位',
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
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '注册失败',
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
      res.status(400).json({
        success: false,
        error: '用户名和密码不能为空',
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
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : '登录失败',
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
      res.status(400).json({
        success: false,
        error: '刷新令牌不能为空',
      });
      return;
    }

    const result = await refreshToken(refreshToken);

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
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : '刷新令牌失败',
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
      res.status(401).json({
        success: false,
        error: '未授权',
      });
      return;
    }

    const userData = await getMe(user.userId);

    if (!userData) {
      res.status(404).json({
        success: false,
        error: '用户不存在',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: '获取用户信息失败',
    });
  }
};
