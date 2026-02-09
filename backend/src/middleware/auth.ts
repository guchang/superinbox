/**
 * Authentication Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../storage/database.js';
import { verifyToken } from '../utils/jwt.js';
import { sendError } from '../utils/error-response.js';

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
      apiKey?: {
        id: string;
        name: string;
        userId: string;
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
    // Get token from Authorization header, cookie, or URL parameter (for SSE)
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.superinbox_auth_token;
    const urlToken = req.query.token as string; // For SSE connections
    
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cookieToken || urlToken;

    if (!token) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Missing Authorization token'
      });
      return;
    }

    // Verify JWT token
    const payload = verifyToken(token);

    if (!payload) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Invalid or expired token'
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
      scopes: payload.scopes || ['read'], // Use scopes from token
    };

    next();
  } catch (error) {
    console.error('JWT Authentication error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Authentication failed'
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
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Missing Authorization header'
      });
      return;
    }

    // Check Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Authorization header must use Bearer token format'
      });
      return;
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate API key
    const db = getDatabase();
    const validation = db.validateApiKey(apiKey);

    if (!validation.valid) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Invalid or inactive API key'
      });
      return;
    }

    // Attach user info to request
    req.user = {
      id: validation.userId ?? 'default-user',
      userId: validation.userId ?? 'default-user',
      scopes: validation.scopes ?? ['read', 'write']
    };

    // Attach API key info to request (for access logging)
    req.apiKey = {
      id: validation.apiKeyId ?? '',
      name: validation.apiKeyName ?? 'Unknown',
      userId: validation.userId ?? 'default-user'
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Authentication failed'
    });
  }
};

/**
 * Check if user has required scope
 */
export const requireScope = (scope: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    if (!hasScope(req.user.scopes, scope)) {
      console.warn(`Access denied: user lacks required scope '${scope}'`, {
        userId: req.user.userId,
        userScopes: req.user.scopes,
        requiredScope: scope,
      });

      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: `Required scope: ${scope}`,
        params: { scope }
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
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Authentication required'
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

      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: `Required scopes: ${scopes.join(', ')}`,
        params: { scopes: scopes.join(', ') }
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
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Authentication required'
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

      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: `Required one of scopes: ${scopes.join(', ')}`,
        params: { scopes: scopes.join(', ') }
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
    // Get token from Authorization header, cookie, or URL parameter (for SSE)
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.superinbox_auth_token;
    const urlToken = req.query.token as string; // For SSE connections
    
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cookieToken || urlToken;

    if (!token) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Missing Authorization token or API key'
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
        scopes: payload.scopes || ['read'],
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
      // Attach API key info to request (for access logging)
      req.apiKey = {
        id: validation.apiKeyId ?? '',
        name: validation.apiKeyName ?? 'Unknown',
        userId: validation.userId ?? 'default-user'
      };
      next();
      return;
    }

    // Neither JWT nor API key is valid
    sendError(res, {
      statusCode: 401,
      code: 'AUTH.UNAUTHORIZED',
      message: 'Invalid token or API key'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication - attaches user if valid, but doesn't require it
 */
export const optionalAuth = (
  req: Request,
  _res: Response,
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
        scopes: payload.scopes || ['read'],
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
      // Attach API key info to request (for access logging)
      req.apiKey = {
        id: validation.apiKeyId ?? '',
        name: validation.apiKeyName ?? 'Unknown',
        userId: validation.userId ?? 'default-user'
      };
    }

    next();
  } catch (error) {
    // Continue without authentication on error
    next();
  }
};
