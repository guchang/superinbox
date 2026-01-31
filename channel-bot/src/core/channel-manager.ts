/**
 * Channel Manager
 *
 * Orchestrates all channel instances, handles message routing,
 * and manages user mapping.
 */

import type {
  IChannel,
  ChannelMessage,
  ChannelType,
  ChannelStatus,
  SendMessageRequest,
  SendMessageResponse,
} from './channel.interface.js';
import type { IUserMapper } from './user-mapper.interface.js';
import type { CoreApiClient } from './core-api.client.js';
import { SSESubscriptionService } from './sse-subscription.service.js';
import { buildNotificationMessage } from './notification-builder.js';

/**
 * Channel Manager Configuration
 */
export interface ChannelManagerConfig {
  /** User mapper service */
  userMapper: IUserMapper;
  /** Core API client */
  coreApiClient: CoreApiClient;
}

/**
 * Channel Manager
 *
 * Manages all channel instances and handles message processing.
 */
export class ChannelManager {
  private channels: Map<ChannelType, IChannel> = new Map();
  private userMapper: IUserMapper;
  private coreApiClient: CoreApiClient;
  private sseService: SSESubscriptionService;
  private itemChannelMapping: Map<string, string> = new Map(); // itemId -> channelId

  constructor(config: ChannelManagerConfig) {
    this.userMapper = config.userMapper;
    this.coreApiClient = config.coreApiClient;
    this.sseService = new SSESubscriptionService(config.coreApiClient);
    this.initializeEventHandlers();
  }

  /**
   * Initialize SSE event handlers
   */
  private initializeEventHandlers(): void {
    // AI completed
    this.sseService.on('ai.completed', async (event) => {
      await this.sendNotificationToUser(event.channelId, buildNotificationMessage(event));
    });

    // AI failed
    this.sseService.on('ai.failed', async (event) => {
      await this.sendNotificationToUser(event.channelId, buildNotificationMessage(event));
    });

    // Routing completed
    this.sseService.on('routing.completed', async (event) => {
      await this.sendNotificationToUser(event.channelId, buildNotificationMessage(event));
      // Unsubscribe after routing complete
      this.sseService.unsubscribe(event.itemId);
      this.itemChannelMapping.delete(event.itemId);
    });

    // Routing failed
    this.sseService.on('routing.failed', async (event) => {
      await this.sendNotificationToUser(event.channelId, buildNotificationMessage(event));
      // Unsubscribe after routing failed
      this.sseService.unsubscribe(event.itemId);
      this.itemChannelMapping.delete(event.itemId);
    });
  }

  /**
   * Register a channel
   * @param channel - Channel instance
   */
  registerChannel(channel: IChannel): void {
    if (this.channels.has(channel.name)) {
      throw new Error(`Channel ${channel.name} is already registered`);
    }

    this.channels.set(channel.name, channel);

    // Register message handler
    channel.onMessage((message) => this.handleMessage(message));
  }

  /**
   * Unregister a channel
   * @param channelName - Channel name
   */
  unregisterChannel(channelName: ChannelType): void {
    const channel = this.channels.get(channelName);

    if (channel) {
      channel.stop().catch((error) => {
        console.error(`Error stopping channel ${channelName}:`, error);
      });

      this.channels.delete(channelName);
    }
  }

  /**
   * Get a registered channel
   * @param channelName - Channel name
   * @returns Channel or undefined
   */
  getChannel(channelName: ChannelType): IChannel | undefined {
    return this.channels.get(channelName);
  }

  /**
   * Get all registered channels
   * @returns Array of channel names
   */
  getChannels(): ChannelType[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Start all registered channels
   */
  async startAll(): Promise<void> {
    const startPromises = Array.from(this.channels.values()).map((channel) =>
      channel.start().catch((error) => {
        console.error(`Failed to start channel ${channel.name}:`, error);
      })
    );

    await Promise.all(startPromises);
  }

  /**
   * Stop all registered channels
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.channels.values()).map((channel) =>
      channel.stop().catch((error) => {
        console.error(`Failed to stop channel ${channel.name}:`, error);
      })
    );

    await Promise.all(stopPromises);
  }

  /**
   * Get status of all channels
   * @returns Array of channel statuses
   */
  async getChannelStatuses(): Promise<ChannelStatus[]> {
    const statuses: ChannelStatus[] = [];

    for (const [name, channel] of this.channels.entries()) {
      try {
        const isHealthy = await channel.healthCheck();

        statuses.push({
          name,
          status: isHealthy ? 'running' : 'stopped',
        });
      } catch (error) {
        statuses.push({
          name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return statuses;
  }

  /**
   * Restart a specific channel
   * @param channelName - Channel name
   */
  async restartChannel(channelName: ChannelType): Promise<void> {
    const channel = this.channels.get(channelName);

    if (!channel) {
      throw new Error(`Channel ${channelName} not found`);
    }

    await channel.stop();
    await channel.start();
  }

  /**
   * Handle incoming message from any channel
   * @param message - Channel message
   */
  private async handleMessage(message: ChannelMessage): Promise<void> {
    try {
      // Find SuperInbox user ID by channel ID
      const superInboxUserId = await this.userMapper.findSuperInboxUser(
        message.channelId,
        message.channel
      );

      if (!superInboxUserId) {
        console.warn(
          `No SuperInbox user found for ${message.channel} channel ID: ${message.channelId}`
        );
        // Optionally send message back to user asking them to bind
        return;
      }

      // Create item in Core
      const item = await this.coreApiClient.createItem({
        originalContent: message.content,
        source: message.channel,
        userId: superInboxUserId,
        contentType: this.inferContentType(message),
        attachments: message.attachments,
      });

      console.log(`Item created: ${item.id} from ${message.channel}`);

      // Store mapping for notifications
      this.itemChannelMapping.set(item.id, message.channelId);

      // Subscribe to SSE events for this item
      this.sseService.subscribeToItem(item.id, message.channelId);

      // Optionally send confirmation back to user
      const channel = this.channels.get(message.channel);
      if (channel) {
        await channel.sendMessage(message.channelId, '✅ Added to inbox');
      }
    } catch (error) {
      console.error('Error handling message:', error);

      // Send error message back to user
      const channel = this.channels.get(message.channel);
      if (channel) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to process message';
        await channel.sendMessage(message.channelId, `❌ Error: ${errorMessage}`);
      }
    }
  }

  /**
   * Send message to a user through specific channel
   * @param request - Send message request
   * @returns Send message response
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      // Find channel ID by SuperInbox user ID
      const channelId = await this.userMapper.findChannelUser(
        request.userId,
        request.channel
      );

      if (!channelId) {
        return {
          success: false,
          error: `No ${request.channel} binding found for user ${request.userId}`,
        };
      }

      // Get channel and send message
      const channel = this.channels.get(request.channel);

      if (!channel) {
        return {
          success: false,
          error: `Channel ${request.channel} is not available`,
        };
      }

      await channel.sendMessage(channelId, request.message);

      return {
        success: true,
        messageId: `${request.channel}_${channelId}_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Infer content type from message
   * @param message - Channel message
   * @returns Content type
   */
  private inferContentType(message: ChannelMessage): string {
    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];

      if (attachment.type === 'photo') return 'image';
      if (attachment.type === 'audio') return 'audio';
      if (attachment.type === 'video') return 'video';
      if (attachment.type === 'document') return 'file';
    }

    if (message.content.startsWith('http')) return 'url';

    return 'text';
  }

  /**
   * Send notification message to user through channel
   * @param channelId - Platform channel ID
   * @param message - Notification message
   */
  private async sendNotificationToUser(channelId: string, message: string): Promise<void> {
    // Find which channel this user belongs to
    // For now, we only support Telegram, but we could extend this
    const channel = this.channels.get('telegram');
    if (!channel) {
      console.warn(`No channel available to send notification to ${channelId}`);
      return;
    }

    try {
      await channel.sendMessage(channelId, message);
      console.log(`Notification sent to ${channelId}: ${message.substring(0, 50)}...`);
    } catch (error) {
      console.error(`Failed to send notification to ${channelId}:`, error);
    }
  }
}
