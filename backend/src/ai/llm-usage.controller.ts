/**
 * LLM Usage Controller - Statistics and Logs
 */

import { Request, Response } from 'express';
import { getDatabase } from '../storage/database.js';
import { logger } from '../middleware/logger.js';

/**
 * Get LLM usage statistics
 */
export const getLlmStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, startDate, endDate } = req.query;

    const stats = getDatabase().getLlmUsageStatistics({
      userId: userId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('[LLM] Failed to get statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get LLM statistics',
    });
  }
};

/**
 * Get LLM usage logs
 */
export const getLlmLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      model,
      provider,
      status,
      sessionId,
      sessionType,
      startDate,
      endDate,
      page = '1',
      pageSize = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const offset = (pageNum - 1) * pageSizeNum;

    const result = getDatabase().getLlmUsageLogs({
      userId: userId as string,
      model: model as string,
      provider: provider as string,
      status: status as string,
      sessionId: sessionId as string,
      sessionType: sessionType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: pageSizeNum,
      offset,
    });

    res.json({
      success: true,
      data: {
        data: result.data,
        total: result.total,
        page: pageNum,
        pageSize: pageSizeNum,
      },
    });
  } catch (error) {
    logger.error('[LLM] Failed to get logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get LLM logs',
    });
  }
};

/**
 * Get LLM usage grouped by session
 */
export const getLlmSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      sessionType,
      startDate,
      endDate,
      page = '1',
      pageSize = '20',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const offset = (pageNum - 1) * pageSizeNum;

    const result = getDatabase().getLlmUsageBySession({
      userId: userId as string,
      sessionType: sessionType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: pageSizeNum,
      offset,
    });

    res.json({
      success: true,
      data: {
        data: result.data,
        total: result.total,
        page: pageNum,
        pageSize: pageSizeNum,
      },
    });
  } catch (error) {
    logger.error('[LLM] Failed to get sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get LLM sessions',
    });
  }
};
