/**
 * HTTP API Routes
 *
 * REST API endpoints for SuperInbox Core to communicate with Channel Bot.
 */

import type { Router } from 'express';
import express from 'express';
import type { ChannelManager } from '../core/channel-manager.js';
import type { SendMessageRequest } from '../core/channel.interface.js';

/**
 * Create API routes
 * @param channelManager - Channel manager instance
 * @returns Express router
 */
export function createApiRoutes(channelManager: ChannelManager): Router {
  const router = express.Router();

  /**
   * POST /send
   * Send message to user through specific channel
   *
   * Request body:
   * {
   *   "channel": "telegram" | "lark" | "wework",
   *   "userId": "superinbox-user-id",
   *   "message": "Hello, world!"
   * }
   */
  router.post('/send', async (req, res) => {
    try {
      const { channel, userId, message } = req.body as SendMessageRequest;

      // Validate request
      if (!channel || !userId || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: channel, userId, message',
        });
      }

      // Send message
      const result = await channelManager.sendMessage({
        channel,
        userId,
        message,
      });

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error in POST /send:', error);

      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  /**
   * GET /status
   * Get status of all channels
   *
   * Response:
   * {
   *   "channels": [
   *     { "name": "telegram", "status": "running" },
   *     { "name": "lark", "status": "running" }
   *   ]
   * }
   */
  router.get('/status', async (_req, res) => {
    try {
      const statuses = await channelManager.getChannelStatuses();

      return res.status(200).json({
        channels: statuses,
      });
    } catch (error) {
      console.error('Error in GET /status:', error);

      return res.status(500).json({
        channels: [],
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  /**
   * POST /channels/:channel/restart
   * Restart a specific channel
   *
   * Parameters:
   * - channel: Channel name (telegram, lark, wework)
   */
  router.post('/channels/:channel/restart', async (req, res) => {
    try {
      const { channel } = req.params;

      await channelManager.restartChannel(channel as any);

      return res.status(200).json({
        success: true,
        message: `Channel ${channel} restarted successfully`,
      });
    } catch (error) {
      console.error(`Error in POST /channels/${req.params.channel}/restart:`, error);

      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  /**
   * GET /health
   * Health check endpoint
   */
  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
