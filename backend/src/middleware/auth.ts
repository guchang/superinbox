/**
 * Authentication Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../storage/database.js';
import { config } from '../config/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        scopes: string[];
      };
    }
  }
}

/**
 * Authenticate API Key middleware
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

    if (!req.user.scopes.includes(scope)) {
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
 * Optional authentication - attaches user if valid, but doesn't require it
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const apiKey = authHeader.substring(7);
    const db = getDatabase();
    const validation = db.validateApiKey(apiKey);

    if (validation.valid) {
      req.user = {
        id: validation.userId ?? 'default-user',
        scopes: validation.scopes ?? ['read', 'write']
      };
    }

    next();
  } catch (error) {
    // Continue without authentication on error
    next();
  }
};
