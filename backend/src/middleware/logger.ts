/**
 * Logger Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import { isDevelopment } from '../config/index.js';

// Create logger
const prettyStream = pinoPretty({
  colorize: true,
  translateTime: 'HH:MM:ss Z',
  ignore: 'pid,hostname'
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? 'info',
    base: isDevelopment() ? undefined : { pid: undefined, hostname: undefined }
  },
  isDevelopment() ? prettyStream as any : undefined
);

/**
 * Request logger middleware
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();

  // Log request
  logger.info({
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip
  }, 'Incoming request');

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`
    }, 'Request completed');
  });

  next();
};

/**
 * Error logging utility
 */
export const logError = (error: Error, context?: Record<string, unknown>): void => {
  logger.error({
    error: error.message,
    stack: error.stack,
    ...context
  }, 'Error occurred');
};

export default logger;
