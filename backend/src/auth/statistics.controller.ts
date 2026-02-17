/**
 * Statistics Controller
 * Handles API usage statistics and analytics
 */

import type { Request, Response } from 'express';
import { getDatabase } from '../storage/database.js';
import { logger } from '../middleware/logger.js';
import { sendError } from '../utils/error-response.js';
import { ensureAccessLogSchema } from '../middleware/access-logger.js';
import type {
  StatisticsResponse,
  StatisticsQuery,
  StatisticsTimeRange,
} from '../types/statistics.js';

const normalizeUserId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

/**
 * Get API usage statistics for current user
 */
export async function getStatistics(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    const userId = normalizeUserId(authReq.user?.userId) || normalizeUserId(authReq.user?.id);
    if (!userId) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // Parse query parameters
    const timeRange = (req.query.timeRange as StatisticsTimeRange) || 'week';
    const query: StatisticsQuery = {
      timeRange,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    // Calculate date range based on timeRange
    const { startDate, endDate } = calculateDateRange(query);

    // Fetch statistics from database
    const stats = fetchStatistics(startDate, endDate, timeRange, userId);

    res.json(stats);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch statistics');
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch statistics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Calculate date range based on time range option
 */
function calculateDateRange(query: StatisticsQuery): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString();
  let startDate: Date;

  switch (query.timeRange) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setDate(now.getDate() - 30));
      break;
    case 'all':
      // Start from a very early date
      startDate = new Date('2020-01-01T00:00:00.000Z');
      break;
    default:
      startDate = new Date(now.setDate(now.getDate() - 7));
  }

  // Override with custom dates if provided
  if (query.startDate) {
    startDate = new Date(query.startDate);
  }
  if (query.endDate) {
    now.setTime(new Date(query.endDate).getTime());
  }

  return {
    startDate: startDate.toISOString(),
    endDate,
  };
}

/**
 * Fetch statistics from database
 */
function fetchStatistics(
  startDate: string,
  endDate: string,
  timeRange: StatisticsTimeRange,
  userId: string
): StatisticsResponse {
  ensureAccessLogSchema();
  const db = getDatabase();

  const whereClause = 'WHERE timestamp >= ? AND timestamp <= ? AND user_id = ?';
  const whereParams = [startDate, endDate, userId];

  // 1. Get summary statistics
  const summaryStmt = (db as any).db.prepare(`
    SELECT
      COUNT(*) as totalRequests,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorCount
    FROM api_access_logs
    ${whereClause}
  `);
  const summaryRow = summaryStmt.get(...whereParams) as any;

  const successRate = summaryRow.totalRequests > 0
    ? (summaryRow.successCount / summaryRow.totalRequests) * 100
    : 0;

  // 2. Get per-key statistics
  const keyStatsStmt = (db as any).db.prepare(`
    SELECT
      api_key_id as id,
      api_key_name as name,
      COUNT(*) as requests,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount,
      MAX(timestamp) as lastUsed
    FROM api_access_logs
    ${whereClause}
    GROUP BY api_key_id, api_key_name
    ORDER BY requests DESC
  `);
  const keyRows = keyStatsStmt.all(...whereParams) as any[];

  const keyStats = keyRows.map((row: any) => {
    const keySuccessRate = row.requests > 0 ? (row.successCount / row.requests) * 100 : 0;
    return {
      id: row.id,
      name: row.name || 'Unknown Key',
      requests: row.requests,
      successRate: Math.round(keySuccessRate * 10) / 10,
      percentage: Math.round((row.requests / summaryRow.totalRequests) * 100 * 10) / 10,
      lastUsed: row.lastUsed,
    };
  });

  // 3. Get trend data (group by day)
  const trendStmt = (db as any).db.prepare(`
    SELECT
      DATE(timestamp) as date,
      COUNT(*) as requests
    FROM api_access_logs
    ${whereClause}
    GROUP BY DATE(timestamp)
    ORDER BY date ASC
  `);
  const trendRows = trendStmt.all(...whereParams) as any[];

  const trendData = trendRows.map((row: any) => {
    const date = new Date(row.date);
    const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      date: monthDay,
      requests: row.requests,
    };
  });

  // 4. Get status distribution
  const statusStmt = (db as any).db.prepare(`
    SELECT
      status,
      COUNT(*) as count
    FROM api_access_logs
    ${whereClause}
    GROUP BY status
  `);
  const statusRows = statusStmt.all(...whereParams) as any[];

  const statusDistribution = statusRows.map((row: any) => {
    const status = row.status === 'denied' ? 'error' : row.status;
    const count = row.count;
    return {
      status: status as 'success' | 'error',
      count,
      percentage: Math.round((count / summaryRow.totalRequests) * 100 * 10) / 10,
    };
  });

  // Combine success/error for status distribution
  const successCount = statusDistribution.find(s => s.status === 'success')?.count || 0;
  const errorCount = statusDistribution.find(s => s.status === 'error')?.count || 0;

  return {
    summary: {
      totalRequests: summaryRow.totalRequests || 0,
      successCount: summaryRow.successCount || 0,
      errorCount: summaryRow.errorCount || 0,
      successRate: Math.round(successRate * 10) / 10,
    },
    keyStats,
    trendData,
    statusDistribution: [
      { status: 'success' as const, count: successCount, percentage: Math.round((successCount / summaryRow.totalRequests) * 100 * 10) / 10 },
      { status: 'error' as const, count: errorCount, percentage: Math.round((errorCount / summaryRow.totalRequests) * 100 * 10) / 10 },
    ].filter(d => d.count > 0),
    timeRange,
    generatedAt: new Date().toISOString(),
  };
}
