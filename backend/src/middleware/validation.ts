/**
 * Validation Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendError } from '../utils/error-response.js';

/**
 * Generic validation middleware factory
 */
export const validateRequest =
  (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendError(res, {
          statusCode: 400,
          code: 'REQUEST.INVALID',
          message: 'Request validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      } else {
        next(error);
      }
    }
  };

/**
 * Validate body only
 */
export const validateBody = <T extends z.ZodSchema>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendError(res, {
          statusCode: 400,
          code: 'REQUEST.INVALID',
          message: 'Request body validation failed',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate query parameters only
 */
export const validateQuery = <T extends z.ZodSchema>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendError(res, {
          statusCode: 400,
          code: 'REQUEST.INVALID',
          message: 'Query parameters validation failed',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate URL parameters only
 */
export const validateParams = <T extends z.ZodSchema>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendError(res, {
          statusCode: 400,
          code: 'REQUEST.INVALID',
          message: 'URL parameters validation failed',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  };
};
