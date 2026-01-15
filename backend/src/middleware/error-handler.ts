/**
 * Error Handling Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info'
});

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

/**
 * Global error handler
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error({
    error: err.message,
    code: err.code,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    details: err.details
  });

  // Determine status code
  const statusCode = err.statusCode ?? 500;

  // Build error response
  const errorResponse = {
    success: false,
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message: err.message ?? 'An unexpected error occurred',
      details: err.details
    }
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    (errorResponse.error as any).stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      details: {
        method: req.method,
        path: req.path
      }
    }
  });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create a custom error
 */
export class ApiError extends Error implements AppError {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Common error factories
 */
export const badRequest = (message: string, details?: unknown): ApiError => {
  return new ApiError(400, 'BAD_REQUEST', message, details);
};

export const unauthorized = (message: string = 'Unauthorized'): ApiError => {
  return new ApiError(401, 'UNAUTHORIZED', message);
};

export const forbidden = (message: string = 'Forbidden'): ApiError => {
  return new ApiError(403, 'FORBIDDEN', message);
};

export const notFound = (resource: string = 'Resource'): ApiError => {
  return new ApiError(404, 'NOT_FOUND', `${resource} not found`);
};

export const conflict = (message: string, details?: unknown): ApiError => {
  return new ApiError(409, 'CONFLICT', message, details);
};

export const internalError = (message: string = 'Internal server error'): ApiError => {
  return new ApiError(500, 'INTERNAL_ERROR', message);
};
