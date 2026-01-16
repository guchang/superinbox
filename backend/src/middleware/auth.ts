/**
 * Authentication Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../storage/database.js';
import { verifyToken } from '../utils/jwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: string;
        username?: string;
        email?: string;
        role?: string;
        scopes: string[];
      };
    }
  }
}

/**
 * Authenticate JWT Token middleware
 */
export const authenticateJwt = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.superinbox_auth_token;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cookieToken;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Missing Authorization token'
      });
      return;
    }

    // Verify JWT token
    const payload = verifyToken(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }

    // Attach user info to request
    req.user = {
      id: payload.userId,
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      scopes: ['read', 'write'], // Default scopes for JWT users
    };

    next();
  } catch (error) {
    console.error('JWT Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Authenticate API Key middleware (for backward compatibility)
 */
export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing Authorization header'
        }
      });
      return;
    }

    // Check Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Authorization header must use Bearer token format'
        }
      });
      return;
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate API key
    const db = getDatabase();
    const validation = db.validateApiKey(apiKey);

    if (!validation.valid) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid or inactive API key'
        }
      });
      return;
    }

    // Attach user info to request
    req.user = {
      id: validation.userId ?? 'default-user',
      userId: validation.userId ?? 'default-user',
      scopes: validation.scopes ?? ['read', 'write']
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * Check if user has required scope
 */
export const requireScope = (scope: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    if (!hasScope(req.user.scopes, scope)) {
      console.warn(`Access denied: user lacks required scope '${scope}'`, {
        userId: req.user.userId,
        userScopes: req.user.scopes,
        requiredScope: scope,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `Required scope: ${scope}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has multiple required scopes (all must be present)
 */
export const requireScopes = (...scopes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const missingScopes = scopes.filter(scope => !hasScope(req.user!.scopes, scope));

    if (missingScopes.length > 0) {
      console.warn(`Access denied: user lacks required scopes`, {
        userId: req.user.userId,
        userScopes: req.user.scopes,
        requiredScopes: scopes,
        missingScopes,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `Required scopes: ${scopes.join(', ')}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has any of the required scopes (at least one must be present)
 */
export const requireAnyScope = (...scopes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const hasAnyScope = scopes.some(scope => hasScope(req.user!.scopes, scope));

    if (!hasAnyScope) {
      console.warn(`Access denied: user lacks any required scope`, {
        userId: req.user.userId,
        userScopes: req.user.scopes,
        requiredScopes: scopes,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `Required one of scopes: ${scopes.join(', ')}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Helper function to check if user has a specific scope
 * Supports admin:full (grants all permissions) and content:* wildcards
 */
function hasScope(userScopes: string[], requiredScope: string): boolean {
  // Check for admin full access
  if (userScopes.includes('admin:full')) {
    return true;
  }

  // Check for exact match
  if (userScopes.includes(requiredScope)) {
    return true;
  }

  // Check for content:* wildcard
  if (requiredScope.startsWith('content:')) {
    if (userScopes.includes('content:all')) {
      return true;
    }
  }

  return false;
}

/**
 * Combined authentication - accepts JWT Token or API Key
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.superinbox_auth_token;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cookieToken;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Missing Authorization token or API key'
      });
      return;
    }

    // Try JWT verification first
    const payload = verifyToken(token);
    if (payload) {
      req.user = {
        id: payload.userId,
        userId: payload.userId,
        username: payload.username,
        email: payload.email,
        role: payload.role,
        scopes: ['read', 'write'],
      };
      next();
      return;
    }

    // Fall back to API key validation
    const db = getDatabase();
    const validation = db.validateApiKey(token);

    if (validation.valid) {
      req.user = {
        id: validation.userId ?? 'default-user',
        userId: validation.userId ?? 'default-user',
        scopes: validation.scopes ?? ['read', 'write']
      };
      next();
      return;
    }

    // Neither JWT nor API key is valid
    res.status(401).json({
      success: false,
      error: 'Invalid token or API key'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication - attaches user if valid, but doesn't require it
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.superinbox_auth_token;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cookieToken;

    if (!token) {
      next();
      return;
    }

    // Try JWT verification first
    const payload = verifyToken(token);
    if (payload) {
      req.user = {
        id: payload.userId,
        userId: payload.userId,
        username: payload.username,
        email: payload.email,
        role: payload.role,
        scopes: ['read', 'write'],
      };
      next();
      return;
    }

    // Fall back to API key validation
    const db = getDatabase();
    const validation = db.validateApiKey(token);

    if (validation.valid) {
      req.user = {
        id: validation.userId ?? 'default-user',
        userId: validation.userId ?? 'default-user',
        scopes: validation.scopes ?? ['read', 'write']
      };
    }

    next();
  } catch (error) {
    // Continue without authentication on error
    next();
  }
};
