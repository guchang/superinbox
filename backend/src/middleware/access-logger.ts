/**
 * Access Log Middleware
 * Records all API requests to database for auditing and analytics
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../storage/database.js';
import { logger } from './logger.js';

interface AuthenticatedRequest extends Request {
  apiKey?: {
    id: string;
    name: string;
    userId: string;
  };
}

/**
 * Extract client IP address from request
 */
function extractClientIp(req: Request): string {
  return (req.ip ||
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.socket.remoteAddress ||
    'unknown')
    .split(',')[0]
    .trim();
}

/**
 * Determine request status based on status code
 */
function getStatusFromCode(statusCode: number): 'success' | 'error' | 'denied' {
  if (statusCode === 401 || statusCode === 403) return 'denied';
  if (statusCode >= 400) return 'error';
  return 'success';
}

/**
 * Calculate request size from headers or body
 */
function calculateRequestSize(req: Request): number {
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    return parseInt(contentLength, 10);
  }

  // Estimate based on body
  if (req.body) {
    return JSON.stringify(req.body).length;
  }

  return 0;
}

/**
 * Access log middleware
 * Records all API requests to database after response is sent
 */
export const accessLogMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Store request start time for later use
  (req as any)._startTime = startTime;
  (req as any)._requestId = requestId;

  // Capture original json and end methods
  const originalJson = res.json.bind(res);
  const originalEnd = res.end.bind(res);

  // Intercept response to capture data
  let responseBody: unknown;
  let responseSize = 0;

  res.json = function(body: unknown) {
    responseBody = body;
    responseSize = JSON.stringify(body).length;
    return originalJson(body);
  };

  res.end = function(chunk?: unknown, encoding?: any) {
    if (chunk && !responseBody) {
      const chunkStr = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      responseSize = chunkStr.length;
    }
    return originalEnd(chunk as any, encoding as any);
  };

  // Log to database when response finishes
  res.on('finish', async () => {
    try {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const status = getStatusFromCode(statusCode);

      // Skip logging for health check and internal endpoints
      if (req.path === '/health' || req.path.startsWith('/internal')) {
        return;
      }

      // Only log authenticated API requests
      const authReq = req as AuthenticatedRequest;
      if (!authReq.apiKey?.id) {
        return;
      }

      const db = getDatabase();

      // Prepare log entry
      const logEntry = {
        id: requestId,
        api_key_id: authReq.apiKey.id,
        api_key_name: authReq.apiKey.name || null,
        user_id: authReq.apiKey.userId,
        endpoint: req.path,
        full_url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        method: req.method,
        status_code: statusCode,
        status,
        ip_address: extractClientIp(req),
        user_agent: req.headers['user-agent'] || null,
        request_size: calculateRequestSize(req),
        response_size: responseSize,
        duration,
        request_headers: req.headers ? JSON.stringify(req.headers) : null,
        request_body: req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : null,
        query_params: req.query && Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : null,
        response_body: responseBody && statusCode >= 400 ? JSON.stringify(responseBody) : null,
        error_code: statusCode >= 400 ? (responseBody as any)?.error?.code : null,
        error_message: statusCode >= 400 ? (responseBody as any)?.error?.message : null,
        error_details: statusCode >= 400 ? (responseBody as any)?.error?.details ? JSON.stringify((responseBody as any).error.details) : null : null,
        timestamp: new Date(startTime).toISOString(),
      };

      // Insert log into database (async, don't block response)
      setImmediate(() => {
        try {
          const stmt = (db as any).db.prepare(`
            INSERT INTO api_access_logs (
              id, api_key_id, api_key_name, user_id, endpoint, full_url,
              method, status_code, status, ip_address, user_agent,
              request_size, response_size, duration, request_headers,
              request_body, query_params, response_body, error_code,
              error_message, error_details, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          stmt.run(
            logEntry.id,
            logEntry.api_key_id,
            logEntry.api_key_name,
            logEntry.user_id,
            logEntry.endpoint,
            logEntry.full_url,
            logEntry.method,
            logEntry.status_code,
            logEntry.status,
            logEntry.ip_address,
            logEntry.user_agent,
            logEntry.request_size,
            logEntry.response_size,
            logEntry.duration,
            logEntry.request_headers,
            logEntry.request_body,
            logEntry.query_params,
            logEntry.response_body,
            logEntry.error_code,
            logEntry.error_message,
            logEntry.error_details,
            logEntry.timestamp
          );
        } catch (error) {
          logger.error({ error, requestId }, 'Failed to save access log to database');
        }
      });

    } catch (error) {
      logger.error({ error, requestId }, 'Failed to record access log');
    }
  });

  next();
};

/**
 * Query access logs from database
 */
export interface AccessLogQuery {
  apiKeyId?: string;
  startDate?: string;
  endDate?: string;
  method?: string;
  endpoint?: string;
  status?: 'success' | 'error' | 'denied';
  page?: number;
  limit?: number;
}

export interface AccessLogEntry {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  fullUrl: string;
  statusCode: number;
  status: 'success' | 'error' | 'denied';
  duration: number;
  ip: string;
  userAgent: string;
  apiKeyId?: string;
  apiKeyName?: string;
  requestSize?: number;
  responseSize?: number;
  requestBody?: unknown;
  requestHeaders?: Record<string, string>;
  queryParams?: Record<string, string>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Query access logs with filters
 */
export function queryAccessLogs(query: AccessLogQuery): {
  logs: AccessLogEntry[];
  total: number;
  page: number;
  limit: number;
} {
  const db = getDatabase();
  const page = query.page || 1;
  const limit = Math.min(query.limit || 50, 200);
  const offset = (page - 1) * limit;

  // Build WHERE clause
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.apiKeyId) {
    conditions.push('api_key_id = ?');
    params.push(query.apiKeyId);
  }

  if (query.startDate) {
    conditions.push('timestamp >= ?');
    params.push(query.startDate);
  }

  if (query.endDate) {
    conditions.push('timestamp <= ?');
    params.push(query.endDate);
  }

  if (query.method) {
    conditions.push('method = ?');
    params.push(query.method);
  }

  if (query.endpoint) {
    conditions.push('endpoint LIKE ?');
    params.push(`%${query.endpoint}%`);
  }

  if (query.status) {
    conditions.push('status = ?');
    params.push(query.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countStmt = (db as any).db.prepare(
    `SELECT COUNT(*) as count FROM api_access_logs ${whereClause}`
  );
  const countResult = countStmt.get(...params) as { count: number };
  const total = countResult.count;

  // Query logs
  const logsStmt = (db as any).db.prepare(`
    SELECT
      id,
      api_key_id as apiKeyId,
      api_key_name as apiKeyName,
      endpoint,
      full_url as fullUrl,
      method,
      status_code as statusCode,
      status,
      duration,
      ip_address as ip,
      user_agent as userAgent,
      request_size as requestSize,
      response_size as responseSize,
      request_body as requestBody,
      request_headers as requestHeaders,
      query_params as queryParams,
      error_code as errorCode,
      error_message as errorMessage,
      error_details as errorDetails,
      timestamp
    FROM api_access_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);

  const rows = logsStmt.run(...params, limit, offset);
  const logs: AccessLogEntry[] = (rows as any).map((row: any) => ({
    id: row.id,
    apiKeyId: row.apiKeyId,
    apiKeyName: row.apiKeyName,
    endpoint: row.endpoint,
    fullUrl: row.fullUrl,
    method: row.method,
    statusCode: row.statusCode,
    status: row.status,
    duration: row.duration,
    ip: row.ip,
    userAgent: row.userAgent,
    requestSize: row.requestSize,
    responseSize: row.responseSize,
    requestBody: row.requestBody ? JSON.parse(row.requestBody) : undefined,
    requestHeaders: row.requestHeaders ? JSON.parse(row.requestHeaders) : undefined,
    queryParams: row.queryParams ? JSON.parse(row.queryParams) : undefined,
    error: row.errorCode ? {
      code: row.errorCode,
      message: row.errorMessage,
      details: row.errorDetails ? JSON.parse(row.errorDetails) : undefined,
    } : undefined,
    timestamp: row.timestamp,
  }));

  return { logs, total, page, limit };
}
