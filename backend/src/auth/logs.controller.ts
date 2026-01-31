/**
 * Access Logs Controller
 * Handles API access log queries and exports
 */

import type { Request, Response } from 'express';
import { queryAccessLogs, type AccessLogQuery } from '../middleware/access-logger.js';
import { getDatabase } from '../storage/database.js';
import { logger } from '../middleware/logger.js';
import { sendError } from '../utils/error-response.js';
import crypto from 'crypto';
import path from 'path';

/**
 * Query global access logs (admin only)
 */
export async function getGlobalLogs(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permission using scopes
    const authReq = req as any;
    if (!authReq.user?.scopes?.includes('admin:full')) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'Admin permission required'
      });
      return;
    }

    // Parse query parameters
    // Handle multiple method parameters (e.g., ?method=GET&method=POST)
    const methodParam = req.query.method;
    const methods = Array.isArray(methodParam)
      ? methodParam as string[]
      : methodParam
        ? [methodParam as string]
        : undefined;

    const query: AccessLogQuery = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      methods,
      endpoint: req.query.endpoint as string,
      status: req.query.status as 'success' | 'error' | 'denied' | undefined,
      apiKeyId: req.query.apiKeyId as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    // Validate limit
    if ((query.limit || 50) > 200) {
      sendError(res, {
        statusCode: 400,
        code: 'LOGS.INVALID_QUERY',
        message: 'Limit cannot exceed 200'
      });
      return;
    }

    const result = queryAccessLogs(query);

    res.json({
      total: result.total,
      page: result.page,
      limit: result.limit || 50,
      logs: result.logs,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to query global access logs');
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to query access logs',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Query logs for a specific API key
 */
export async function getApiKeyLogs(req: Request, res: Response): Promise<void> {
  try {
    const { keyId } = req.params;

    // Check permission: admin or key owner
    const authReq = req as any;
    const isAdmin = authReq.user?.scopes?.includes('admin:full');
    const isOwner = authReq.apiKey?.id === keyId;

    if (!isAdmin && !isOwner) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'You do not have permission to view logs for this API key'
      });
      return;
    }

    // Parse query parameters
    // Handle multiple method parameters (e.g., ?method=GET&method=POST)
    const methodParam = req.query.method;
    const methods = Array.isArray(methodParam)
      ? methodParam as string[]
      : methodParam
        ? [methodParam as string]
        : undefined;

    const query: AccessLogQuery = {
      apiKeyId: keyId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      methods,
      endpoint: req.query.endpoint as string,
      status: req.query.status as 'success' | 'error' | 'denied' | undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    // Validate limit
    if ((query.limit || 50) > 200) {
      sendError(res, {
        statusCode: 400,
        code: 'LOGS.INVALID_QUERY',
        message: 'Limit cannot exceed 200'
      });
      return;
    }

    const result = queryAccessLogs(query);

    res.json({
      total: result.total,
      page: result.page,
      limit: result.limit || 50,
      logs: result.logs,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to query API key access logs');
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to query access logs',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Create export task (async export for large datasets)
 */
export async function createExportTask(req: Request, res: Response): Promise<void> {
  try {
    const { format, startDate, endDate, includeFields } = req.body;

    // Validate format
    if (!['csv', 'json', 'xlsx'].includes(format)) {
      sendError(res, {
        statusCode: 400,
        code: 'LOGS.INVALID_FORMAT',
        message: 'Format must be csv, json, or xlsx'
      });
      return;
    }

    // Validate fields
    if (!Array.isArray(includeFields) || includeFields.length === 0) {
      sendError(res, {
        statusCode: 400,
        code: 'LOGS.INVALID_FIELDS',
        message: 'At least one field must be specified'
      });
      return;
    }

    // Create export task
    const exportId = crypto.randomUUID();
    const userId = (req as any).user?.id || 'system';

    const db = getDatabase();
    const stmt = (db as any).db.prepare(`
      INSERT INTO export_tasks (
        id, user_id, format, status, filters,
        created_at, expires_at
      ) VALUES (?, ?, ?, 'processing', ?, ?, ?)
    `);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

    stmt.run(
      exportId,
      userId,
      format,
      JSON.stringify({ startDate, endDate, includeFields }),
      new Date().toISOString(),
      expiresAt.toISOString()
    );

    // Process export asynchronously
    setImmediate(() => processExport(exportId, req.body));

    res.json({
      success: true,
      exportId,
      status: 'processing',
      message: 'Export task created. It will be completed shortly.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create export task');
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to create export task',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get export task status
 */
export async function getExportStatus(req: Request, res: Response): Promise<void> {
  try {
    const { exportId } = req.params;

    const db = getDatabase();
    const stmt = (db as any).db.prepare('SELECT * FROM export_tasks WHERE id = ?');
    const task = stmt.get(exportId);

    if (!task) {
      sendError(res, {
        statusCode: 404,
        code: 'LOGS.EXPORT_NOT_FOUND',
        message: 'Export task not found',
        params: { exportId }
      });
      return;
    }

    // Check permission
    const authReq = req as any;
    const isAdmin = authReq.user?.scopes?.includes('admin:full');
    const isOwner = authReq.user?.id === task.user_id;

    if (!isAdmin && !isOwner) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'You do not have permission to view this export'
      });
      return;
    }

    const downloadUrl = task.status === 'completed'
      ? `/v1/auth/logs/exports/${exportId}/download`
      : null;

    res.json({
      exportId: task.id,
      status: task.status,
      downloadUrl,
      fileSize: task.file_size,
      recordCount: task.record_count,
      expiresAt: task.expires_at,
      createdAt: task.created_at,
      completedAt: task.completed_at,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get export status');
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get export status',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Download exported file
 */
export async function downloadExportFile(req: Request, res: Response): Promise<void> {
  try {
    const { exportId } = req.params;

    const db = getDatabase();
    const stmt = (db as any).db.prepare('SELECT * FROM export_tasks WHERE id = ?');
    const task = stmt.get(exportId);

    if (!task) {
      sendError(res, {
        statusCode: 404,
        code: 'LOGS.EXPORT_NOT_FOUND',
        message: 'Export task not found',
        params: { exportId }
      });
      return;
    }

    // Check permission
    const authReq = req as any;
    const isAdmin = authReq.user?.scopes?.includes('admin:full');
    const isOwner = authReq.user?.id === task.user_id;

    if (!isAdmin && !isOwner) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'You do not have permission to download this export'
      });
      return;
    }

    // Check if export is completed
    if (task.status !== 'completed') {
      sendError(res, {
        statusCode: 400,
        code: 'LOGS.EXPORT_NOT_READY',
        message: 'Export is not ready yet'
      });
      return;
    }

    // Check if export has expired
    if (new Date() > new Date(task.expires_at)) {
      sendError(res, {
        statusCode: 410,
        code: 'LOGS.EXPORT_EXPIRED',
        message: 'Export file has expired'
      });
      return;
    }

    // Send file
    const filePath = task.file_path;
    const fileName = `access-logs-${exportId}.${task.format}`;

    res.download(filePath, fileName, (err) => {
      if (err) {
        logger.error({ error: err, exportId }, 'Failed to send export file');
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to download export file');
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to download export file',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Process export task asynchronously
 */
async function processExport(exportId: string, options: {
  format: string;
  startDate: string;
  endDate: string;
  includeFields: string[];
}): Promise<void> {
  try {
    const db = getDatabase();
    const query: AccessLogQuery = {
      startDate: options.startDate,
      endDate: options.endDate,
    };

    const result = queryAccessLogs(query);
    const logs = result.logs;

    // Create export file
    const exportDir = path.join(process.cwd(), 'data', 'exports');
    const fileName = `access-logs-${exportId}.${options.format}`;
    const filePath = path.join(exportDir, fileName);

    // Ensure directory exists
    const fs = await import('fs');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    if (options.format === 'json') {
      // JSON export
      const filteredLogs = logs.map(log => {
        const filtered: any = {};
        options.includeFields.forEach(field => {
          if (field in log) {
            filtered[field] = (log as any)[field];
          }
        });
        return filtered;
      });

      await fs.promises.writeFile(filePath, JSON.stringify(filteredLogs, null, 2));
    } else if (options.format === 'csv') {
      // CSV export
      const headers = options.includeFields.join(',');
      const rows = logs.map(log => {
        return options.includeFields.map(field => {
          const value = (log as any)[field];
          if (typeof value === 'object') {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',');
      });

      const csv = [headers, ...rows].join('\n');
      await fs.promises.writeFile(filePath, csv);
    } else {
      // For xlsx, we would need a library like exceljs
      // For now, fall back to CSV
      const headers = options.includeFields.join(',');
      const rows = logs.map(log => {
        return options.includeFields.map(field => {
          const value = (log as any)[field];
          if (typeof value === 'object') {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',');
      });

      const csv = [headers, ...rows].join('\n');
      await fs.promises.writeFile(filePath, csv);
    }

    // Get file stats
    const stats = await fs.promises.stat(filePath);

    // Update export task
    const updateStmt = (db as any).db.prepare(`
      UPDATE export_tasks
      SET status = 'completed',
          file_path = ?,
          file_size = ?,
          record_count = ?,
          completed_at = ?
      WHERE id = ?
    `);

    updateStmt.run(
      filePath,
      stats.size,
      logs.length,
      new Date().toISOString(),
      exportId
    );

    logger.info({ exportId, recordCount: logs.length, fileSize: stats.size }, 'Export completed');
  } catch (error) {
    logger.error({ error, exportId }, 'Failed to process export');

    // Update export task with error
    const db = getDatabase();
    const updateStmt = (db as any).db.prepare(`
      UPDATE export_tasks
      SET status = 'failed',
          error_message = ?
      WHERE id = ?
    `);

    updateStmt.run(error instanceof Error ? error.message : String(error), exportId);
  }
}
