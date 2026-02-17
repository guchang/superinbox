/**
 * LLM Usage Controller - Statistics and Logs
 */

import { Request, Response } from 'express';
import { getDatabase } from '../storage/database.js';
import { logger } from '../middleware/logger.js';
import { sendError } from '../utils/error-response.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const normalizeUserId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

const parsePagination = (
  pageRaw: unknown,
  pageSizeRaw: unknown,
  defaultPageSize = DEFAULT_PAGE_SIZE
): { page: number; pageSize: number; offset: number } => {
  const parsedPage = Number.parseInt(String(pageRaw ?? DEFAULT_PAGE), 10);
  const parsedPageSize = Number.parseInt(String(pageSizeRaw ?? defaultPageSize), 10);

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : DEFAULT_PAGE;
  const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0
    ? Math.min(parsedPageSize, MAX_PAGE_SIZE)
    : defaultPageSize;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
};

const resolveAuthorizedUserId = (
  req: Request,
  res: Response,
  requestedUserIdRaw: unknown
): string | undefined | null => {
  if (!req.user) {
    sendError(res, {
      statusCode: 401,
      code: 'AUTH.UNAUTHORIZED',
      message: 'Authentication required',
    });
    return null;
  }

  const requestedUserId = normalizeUserId(requestedUserIdRaw);
  const currentUserId = normalizeUserId(req.user.userId) || normalizeUserId(req.user.id);
  const isAdmin = req.user.scopes.includes('admin:full');

  if (!currentUserId) {
    sendError(res, {
      statusCode: 401,
      code: 'AUTH.UNAUTHORIZED',
      message: 'Invalid authenticated user',
    });
    return null;
  }

  if (requestedUserId && requestedUserId !== currentUserId && !isAdmin) {
    sendError(res, {
      statusCode: 403,
      code: 'AUTH.FORBIDDEN',
      message: 'Not allowed to access other user data',
      params: { requestedUserId },
    });
    return null;
  }

  if (requestedUserId) {
    return requestedUserId;
  }

  return currentUserId;
};

/**
 * Get LLM usage statistics
 */
export const getLlmStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const authorizedUserId = resolveAuthorizedUserId(req, res, req.query.userId);
    if (authorizedUserId === null) {
      return;
    }

    const stats = getDatabase().getLlmUsageStatistics({
      userId: authorizedUserId,
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
      model,
      provider,
      status,
      sessionId,
      sessionType,
      startDate,
      endDate,
      page,
      pageSize,
    } = req.query;

    const authorizedUserId = resolveAuthorizedUserId(req, res, req.query.userId);
    if (authorizedUserId === null) {
      return;
    }

    const pagination = parsePagination(page, pageSize, DEFAULT_PAGE_SIZE);

    const result = getDatabase().getLlmUsageLogs({
      userId: authorizedUserId,
      model: model as string,
      provider: provider as string,
      status: status as string,
      sessionId: sessionId as string,
      sessionType: sessionType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: pagination.pageSize,
      offset: pagination.offset,
    });

    res.json({
      success: true,
      data: {
        data: result.data,
        total: result.total,
        page: pagination.page,
        pageSize: pagination.pageSize,
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
      sessionType,
      startDate,
      endDate,
      page,
      pageSize,
    } = req.query;

    const authorizedUserId = resolveAuthorizedUserId(req, res, req.query.userId);
    if (authorizedUserId === null) {
      return;
    }

    const pagination = parsePagination(page, pageSize, 20);

    const result = getDatabase().getLlmUsageBySession({
      userId: authorizedUserId,
      sessionType: sessionType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: pagination.pageSize,
      offset: pagination.offset,
    });

    res.json({
      success: true,
      data: {
        data: result.data,
        total: result.total,
        page: pagination.page,
        pageSize: pagination.pageSize,
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

/**
 * Get AI feedback logs
 */
export const getAiFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const authorizedUserId = resolveAuthorizedUserId(req, res, req.query.userId);
    if (authorizedUserId === null) {
      return;
    }

    const pagination = parsePagination(req.query.page, req.query.pageSize, DEFAULT_PAGE_SIZE);

    const data = getDatabase().getAiFeedbackByUser(
      authorizedUserId,
      pagination.pageSize,
      pagination.offset
    );
    const total = getDatabase().countAiFeedbackByUser(authorizedUserId);

    res.json({
      success: true,
      data: {
        data,
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
      },
    });
  } catch (error) {
    logger.error('[LLM] Failed to get AI feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI feedback',
    });
  }
};
