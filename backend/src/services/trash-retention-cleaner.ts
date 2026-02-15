import { getDatabase } from '../storage/database.js';
import { logger } from '../middleware/logger.js';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

const runTrashRetentionCleanup = (): void => {
  try {
    const deletedCount = getDatabase().cleanupExpiredTrashItems();
    if (deletedCount > 0) {
      logger.info({ deletedCount }, 'Trash retention cleanup completed');
    }
  } catch (error) {
    logger.error({ error }, 'Trash retention cleanup failed');
  }
};

export const startTrashRetentionCleaner = (intervalMs: number = DEFAULT_INTERVAL_MS): (() => void) => {
  runTrashRetentionCleanup();
  const timer = setInterval(runTrashRetentionCleanup, intervalMs);

  return () => {
    clearInterval(timer);
  };
};
