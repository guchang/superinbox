/**
 * Enhanced API Error Handler Middleware
 * Provides standardized error responses with detailed error codes
 */

import type { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info'
});

/**
 * Standard API Error class
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error (422)
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', 422, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super('NOT_FOUND', 404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', 403, message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends ApiError {
  constructor(message: string, details?: any) {
    super('CONFLICT', 409, message, details);
    this.name = 'ConflictError';
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super(
      'RATE_LIMIT_EXCEEDED',
      429,
      'Too many requests. Please try again later.',
      { retryAfter }
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Enhanced error handler middleware
 */
export function apiErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error with context
  logger.error({
    error: err.message,
    code: err instanceof ApiError ? err.code : 'INTERNAL_ERROR',
    statusCode: err instanceof ApiError ? err.statusCode : 500,
    path: req.path,
    method: req.method,
    query: req.query,
    params: req.params,
    details: err instanceof ApiError ? err.details : undefined,
    stack: err.stack
  });

  // Handle ApiError instances
  if (err instanceof ApiError) {
    const response: any = {
      success: false,
      error: {
        code: err.code,
        message: err.message
      }
    };

    // Add details if present
    if (err.details !== undefined) {
      response.error.details = err.details;
    }

    // Add request ID for tracing
    const requestId = req.headers['x-request-id'] as string;
    if (requestId) {
      response.error.requestId = requestId;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.error.stack = err.stack;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  const response: any = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  };

  const requestId = req.headers['x-request-id'] as string;
  if (requestId) {
    response.error.requestId = requestId;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
    response.error.message = err.message; // Reveal actual error in dev
  }

  res.status(500).json(response);
}

/**
 * Handle 404 Not Found
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      details: {
        method: req.method,
        path: req.path,
        availableRoutes: [
          'POST /v1/inbox',
          'POST /v1/inbox/batch',
          'GET /v1/inbox/search',
          'GET /v1/items',
          'GET /v1/items/:id',
          'PUT /v1/items/:id',
          'DELETE /v1/items/:id',
          'GET /v1/intelligence/parse/:id',
          'PATCH /v1/intelligence/parse/:id',
          'GET /v1/intelligence/prompts',
          'GET /v1/routing/rules',
          'POST /v1/routing/rules',
          'PUT /v1/routing/rules/:id',
          'DELETE /v1/routing/rules/:id',
          'POST /v1/routing/dispatch/:id',
          'GET /v1/auth/api-keys',
          'POST /v1/auth/api-keys',
          'DELETE /v1/auth/api-keys/:id',
          'POST /v1/auth/api-keys/:id/disable',
          'POST /v1/auth/api-keys/:id/enable'
        ]
      }
    }
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Error factory functions
 */
export const errorFactory = {
  badRequest: (message: string, details?: any) =>
    new ApiError('BAD_REQUEST', 400, message, details),

  unauthorized: (message: string = 'Unauthorized') =>
    new UnauthorizedError(message),

  forbidden: (message: string = 'Forbidden') =>
    new ForbiddenError(message),

  notFound: (resource: string = 'Resource') =>
    new NotFoundError(resource),

  conflict: (message: string, details?: any) =>
    new ConflictError(message, details),

  validation: (message: string, details?: any) =>
    new ValidationError(message, details),

  rateLimit: (retryAfter?: number) =>
    new RateLimitError(retryAfter),

  internal: (message: string = 'Internal server error') =>
    new ApiError('INTERNAL_ERROR', 500, message)
};

/**
 * Error code constants
 */
export const ErrorCodes = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;
