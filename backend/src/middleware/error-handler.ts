/**
 * Error Handling Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { buildErrorResponse } from '../utils/error-response.js';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info'
});

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
  params?: Record<string, unknown>;
}

/**
 * Global error handler
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
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

  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  const params =
    err.params ??
    (err.details &&
    typeof err.details === 'object' &&
    'params' in err.details
      ? (err.details as { params?: Record<string, unknown> }).params
      : undefined);

  const errorResponse = buildErrorResponse({
    statusCode,
    code,
    message,
    params,
    details: err.details
  });

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
  _next: NextFunction
): void => {
  res.status(404).json(
    buildErrorResponse({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      details: {
        method: req.method,
        path: req.path
      }
    })
  );
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
    public details?: unknown,
    public params?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Common error factories
 */
export const badRequest = (
  message: string,
  details?: unknown,
  params?: Record<string, unknown>
): ApiError => {
  return new ApiError(400, 'BAD_REQUEST', message, details, params);
};

export const unauthorized = (
  message: string = 'Unauthorized',
  params?: Record<string, unknown>
): ApiError => {
  return new ApiError(401, 'UNAUTHORIZED', message, undefined, params);
};

export const forbidden = (
  message: string = 'Forbidden',
  params?: Record<string, unknown>
): ApiError => {
  return new ApiError(403, 'FORBIDDEN', message, undefined, params);
};

export const notFound = (
  resource: string = 'Resource',
  params?: Record<string, unknown>
): ApiError => {
  return new ApiError(404, 'NOT_FOUND', `${resource} not found`, undefined, params);
};

export const conflict = (
  message: string,
  details?: unknown,
  params?: Record<string, unknown>
): ApiError => {
  return new ApiError(409, 'CONFLICT', message, details, params);
};

export const internalError = (
  message: string = 'Internal server error',
  params?: Record<string, unknown>
): ApiError => {
  return new ApiError(500, 'INTERNAL_ERROR', message, undefined, params);
};
