import type { Response } from 'express';

export type ErrorResponsePayload = {
  statusCode: number;
  code: string;
  message: string;
  params?: Record<string, unknown>;
  details?: unknown;
};

export const buildErrorResponse = (payload: ErrorResponsePayload) => {
  const error: Record<string, unknown> = {
    code: payload.code,
    message: payload.message
  };

  if (payload.details !== undefined) {
    error.details = payload.details;
  }

  if (payload.params !== undefined) {
    error.params = payload.params;
  }

  return {
    success: false,
    code: payload.code,
    message: payload.message,
    params: payload.params,
    error
  };
};

export const sendError = (res: Response, payload: ErrorResponsePayload): void => {
  res.status(payload.statusCode).json(buildErrorResponse(payload));
};
