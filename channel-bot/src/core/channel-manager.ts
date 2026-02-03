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
import { getMessage, normalizeLanguage, type LanguageCode } from './messages.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_UPLOAD_FILES = 5;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/zip',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/opus',
  'video/mp4',
  'video/webm',
]);

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
  private itemChannelMapping: Map<string, { channelId: string; channel: ChannelType }> = new Map();

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
      const language = await this.resolveLanguage(event.channel, event.channelId);
      await this.sendNotificationToUser(
        event.channel,
        event.channelId,
        buildNotificationMessage(event, language)
      );
    });

    // AI failed
    this.sseService.on('ai.failed', async (event) => {
      const language = await this.resolveLanguage(event.channel, event.channelId);
      await this.sendNotificationToUser(
        event.channel,
        event.channelId,
        buildNotificationMessage(event, language)
      );
    });

    // Routing completed
    this.sseService.on('routing.completed', async (event) => {
      const language = await this.resolveLanguage(event.channel, event.channelId);
      await this.sendNotificationToUser(
        event.channel,
        event.channelId,
        buildNotificationMessage(event, language)
      );
      // Unsubscribe after routing complete
      this.sseService.unsubscribe(event.itemId);
      this.itemChannelMapping.delete(event.itemId);
    });

    // Routing failed
    this.sseService.on('routing.failed', async (event) => {
      const language = await this.resolveLanguage(event.channel, event.channelId);
      await this.sendNotificationToUser(
        event.channel,
        event.channelId,
        buildNotificationMessage(event, language)
      );
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
      const trimmedContent = message.content.trim();

      if (trimmedContent.startsWith('/lang')) {
        await this.handleLangCommand(message);
        return;
      }

      if (trimmedContent === '/help') {
        await this.handleHelpCommand(message);
        return;
      }

      if (trimmedContent === '/start') {
        await this.handleStartCommand(message);
        return;
      }

      if (trimmedContent.startsWith('/bind')) {
        await this.handleBindCommand(message);
        return;
      }

      if (trimmedContent.startsWith('/list')) {
        await this.handleListCommand(message);
        return;
      }

      const language = await this.resolveLanguage(message.channel, message.channelId);

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
        await this.sendNotificationToUser(
          message.channel,
          message.channelId,
          getMessage(language, 'pleaseBind')
        );
        return;
      }

      const apiKey = await this.userMapper.findChannelApiKey(
        message.channelId,
        message.channel
      );

      if (!apiKey) {
        await this.sendNotificationToUser(
          message.channel,
          message.channelId,
          getMessage(language, 'noApiKeyBound')
        );
        return;
      }

      const attachments = message.attachments;
      if (attachments && attachments.length > 0) {
        if (attachments.length > MAX_UPLOAD_FILES) {
          await this.sendNotificationToUser(
            message.channel,
            message.channelId,
            getMessage(language, 'tooManyFiles', { max: MAX_UPLOAD_FILES })
          );
          return;
        }

        if (attachments.length > 1) {
          for (const attachment of attachments) {
            if (!attachment.data) {
              await this.sendNotificationToUser(
                message.channel,
                message.channelId,
                getMessage(language, 'failedReadFile')
              );
              return;
            }

            if (attachment.data.byteLength > MAX_UPLOAD_BYTES) {
              await this.sendNotificationToUser(
                message.channel,
                message.channelId,
                getMessage(language, 'fileTooLarge', {
                  max: Math.round(MAX_UPLOAD_BYTES / (1024 * 1024)),
                })
              );
              return;
            }

            if (!attachment.mimeType || !ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
              const mime = attachment.mimeType || getMessage(language, 'unknownMime');
              await this.sendNotificationToUser(
                message.channel,
                message.channelId,
                getMessage(language, 'unsupportedFileType', { mime })
              );
              return;
            }
          }

          try {
            const item = await this.coreApiClient.createItemWithFilesBuffer({
              files: attachments.map((attachment) => ({
                buffer: attachment.data as Buffer,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
              })),
              content: message.content,
              source: message.channel,
              maxBytes: MAX_UPLOAD_BYTES,
            }, apiKey);

            console.log(`Item created: ${item.id} from ${message.channel}`);

            // Store mapping for notifications
            this.itemChannelMapping.set(item.id, { channelId: message.channelId, channel: message.channel });

            // Subscribe to SSE events for this item
            this.sseService.subscribeToItem(item.id, message.channelId, message.channel, apiKey);

            await this.sendNotificationToUser(
              message.channel,
              message.channelId,
              `${getMessage(language, 'addedToInbox')}${this.formatItemIdSuffix(item.id)}`
            );
            return;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to upload files';
            await this.sendNotificationToUser(
              message.channel,
              message.channelId,
              getMessage(language, 'uploadFailed', { message: errorMessage })
            );
            return;
          }
        }

        const attachment = attachments[0];
        if (!attachment.url && !attachment.data) {
          await this.sendNotificationToUser(
            message.channel,
            message.channelId,
            getMessage(language, 'failedReadFile')
          );
          return;
        }

        const size = attachment.data ? attachment.data.byteLength : attachment.fileSize;
        if (size && size > MAX_UPLOAD_BYTES) {
          await this.sendNotificationToUser(
            message.channel,
            message.channelId,
            getMessage(language, 'fileTooLarge', {
              max: Math.round(MAX_UPLOAD_BYTES / (1024 * 1024)),
            })
          );
          return;
        }

        if (!attachment.mimeType || !ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
          const mime = attachment.mimeType || getMessage(language, 'unknownMime');
          await this.sendNotificationToUser(
            message.channel,
            message.channelId,
            getMessage(language, 'unsupportedFileType', { mime })
          );
          return;
        }

        try {
          const item = attachment.data
            ? await this.coreApiClient.createItemWithFileBuffer({
              buffer: attachment.data,
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              content: message.content,
              source: message.channel,
              maxBytes: MAX_UPLOAD_BYTES,
            }, apiKey)
            : await this.coreApiClient.createItemWithFileFromUrl({
              url: attachment.url as string,
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              content: message.content,
              source: message.channel,
              maxBytes: MAX_UPLOAD_BYTES,
            }, apiKey);

          console.log(`Item created: ${item.id} from ${message.channel}`);

          // Store mapping for notifications
          this.itemChannelMapping.set(item.id, { channelId: message.channelId, channel: message.channel });

          // Subscribe to SSE events for this item
          this.sseService.subscribeToItem(item.id, message.channelId, message.channel, apiKey);

          await this.sendNotificationToUser(
            message.channel,
            message.channelId,
            `${getMessage(language, 'addedToInbox')}${this.formatItemIdSuffix(item.id)}`
          );
          return;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to upload file';
          await this.sendNotificationToUser(
            message.channel,
            message.channelId,
            getMessage(language, 'uploadFailed', { message: errorMessage })
          );
          return;
        }
      }

      // Create item in Core
      const item = await this.coreApiClient.createItem({
        originalContent: message.content,
        source: message.channel,
        userId: superInboxUserId,
        contentType: this.inferContentType(message),
        attachments: message.attachments,
      }, apiKey);

      console.log(`Item created: ${item.id} from ${message.channel}`);

      // Store mapping for notifications
      this.itemChannelMapping.set(item.id, { channelId: message.channelId, channel: message.channel });

      // Subscribe to SSE events for this item
      this.sseService.subscribeToItem(item.id, message.channelId, message.channel, apiKey);

      // Optionally send confirmation back to user
      const channel = this.channels.get(message.channel);
      if (channel) {
        await channel.sendMessage(
          message.channelId,
          `${getMessage(language, 'addedToInbox')}${this.formatItemIdSuffix(item.id)}`
        );
      }
    } catch (error) {
      console.error('Error handling message:', error);

      // Send error message back to user
      const channel = this.channels.get(message.channel);
      if (channel) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to process message';
        const language = await this.resolveLanguage(message.channel, message.channelId);
        await channel.sendMessage(
          message.channelId,
          getMessage(language, 'errorProcessing', { message: errorMessage })
        );
      }
    }
  }

  /**
   * Handle /start command
   */
  private async handleStartCommand(message: ChannelMessage): Promise<void> {
    const userId = await this.userMapper.findSuperInboxUser(message.channelId, message.channel);
    const apiKey = await this.userMapper.findChannelApiKey(message.channelId, message.channel);
    const language = await this.resolveLanguage(message.channel, message.channelId);

    if (userId && apiKey) {
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage(language, 'bindingAlready')
      );
      return;
    }

    await this.sendNotificationToUser(
      message.channel,
      message.channelId,
      getMessage(language, 'bindingPrompt')
    );
  }

  /**
   * Handle /bind command
   */
  private async handleBindCommand(message: ChannelMessage): Promise<void> {
    const parts = message.content.trim().split(/\s+/);
    const apiKey = parts.slice(1).join(' ').trim();
    const language = await this.resolveLanguage(message.channel, message.channelId);

    if (!apiKey) {
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage(language, 'usageBind')
      );
      return;
    }

    const me = await this.coreApiClient.getMeByApiKey(apiKey);
    if (!me) {
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage(language, 'invalidApiKey')
      );
      return;
    }

    await this.userMapper.bindUser(me.id, message.channelId, message.channel, apiKey);
    await this.sendNotificationToUser(
      message.channel,
      message.channelId,
      getMessage(language, 'bindingSuccess')
    );
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
   * Handle /lang command (Lark only)
   */
  private async handleLangCommand(message: ChannelMessage): Promise<void> {
    const parts = message.content.trim().split(/\s+/);
    const requestedRaw = parts[1];
    const currentLanguage = await this.resolveLanguage(message.channel, message.channelId);

    if (message.channel === 'telegram') {
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage('en', 'telegramFixedLang')
      );
      return;
    }

    if (!requestedRaw) {
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage(currentLanguage, 'langUsage')
      );
      return;
    }

    const requested = normalizeLanguage(requestedRaw);
    if (!requested) {
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage(currentLanguage, 'langInvalid')
      );
      return;
    }

    const userId = await this.userMapper.findSuperInboxUser(message.channelId, message.channel);
    if (!userId) {
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage(requested, 'pleaseBind')
      );
      return;
    }

    await this.userMapper.setChannelLanguage(message.channelId, message.channel, requested);
    await this.sendNotificationToUser(
      message.channel,
      message.channelId,
      getMessage(requested, 'langSet', { language: this.languageLabel(requested) })
    );
  }

  /**
   * Handle /help command
   */
  private async handleHelpCommand(message: ChannelMessage): Promise<void> {
    const language = await this.resolveLanguage(message.channel, message.channelId);
    await this.sendNotificationToUser(
      message.channel,
      message.channelId,
      getMessage(language, 'helpText')
    );
  }

  /**
   * Send notification message to user through channel
   * @param channelId - Platform channel ID
   * @param message - Notification message
   */
  private async sendNotificationToUser(channelName: ChannelType, channelId: string, message: string): Promise<void> {
    const channel = this.channels.get(channelName);
    if (!channel) {
      console.warn(`No channel available to send notification to ${channelId} (${channelName})`);
      return;
    }

    try {
      await channel.sendMessage(channelId, message);
      console.log(`Notification sent to ${channelId}: ${message.substring(0, 50)}...`);
    } catch (error) {
      console.error(`Failed to send notification to ${channelId}:`, error);
    }
  }

  private formatItemIdSuffix(itemId: string): string {
    if (!itemId || itemId.length < 4) return '';
    return ` (ID:${itemId.slice(-4)})`;
  }

  private async resolveLanguage(channel: ChannelType, channelId: string): Promise<LanguageCode> {
    if (channel === 'telegram') return 'en';
    const stored = await this.userMapper.findChannelLanguage(channelId, channel);
    const normalized = normalizeLanguage(stored);
    if (normalized) return normalized;
    if (channel === 'lark') return 'zh';
    return 'en';
  }

  private languageLabel(language: LanguageCode): string {
    return language === 'zh' ? '中文' : 'English';
  }

  /**
   * Handle /list command
   */
  private async handleListCommand(message: ChannelMessage): Promise<void> {
    const language = await this.resolveLanguage(message.channel, message.channelId);
    const apiKey = await this.userMapper.findChannelApiKey(message.channelId, message.channel);

    if (!apiKey) {
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage(language, 'noApiKeyBound')
      );
      return;
    }

    // Parse command arguments: /list [page] [limit]
    const parts = message.content.trim().split(/\s+/);
    const page = parts[1] ? parseInt(parts[1], 10) : 1;
    const limit = parts[2] ? parseInt(parts[2], 10) : 10;

    // Validate arguments
    if (isNaN(page) || page < 1) {
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage(language, 'listUsage')
      );
      return;
    }

    if (parts[2] !== undefined && (isNaN(limit) || limit < 1 || limit > 50)) {
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage(language, 'listUsage')
      );
      return;
    }

    try {
      const response = await this.coreApiClient.getItems(apiKey, { page, limit });

      if (response.entries.length === 0) {
        await this.sendNotificationToUser(
          message.channel,
          message.channelId,
          getMessage(language, 'listEmpty')
        );
        return;
      }

      // Build list message
      const totalPages = Math.ceil(response.total / response.limit);
      let listMessage = getMessage(language, 'listTitle', { total: response.total }) + '\n\n';

      for (let i = 0; i < response.entries.length; i++) {
        const entry = response.entries[i];
        const content = entry.content.length > 50
          ? entry.content.substring(0, 50) + '...'
          : entry.content;

        // Format date
        const date = new Date(entry.createdAt);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

        // Format status emoji
        const statusEmoji = entry.status === 'completed' ? '✅' :
                           entry.status === 'processing' ? '⏳' :
                           entry.status === 'failed' ? '❌' : '📝';

        listMessage += getMessage(language, 'listItem', {
          index: (page - 1) * response.limit + i + 1,
          content: `${statusEmoji} ${content}`,
          category: entry.category || 'unknown',
          status: entry.status,
          date: dateStr
        }) + '\n';
      }

      // Add page info
      listMessage += '\n' + getMessage(language, 'listPageInfo', {
        page: response.page,
        totalPages: totalPages
      });

      // Add "more items" hint if applicable
      if (response.total > response.page * response.limit) {
        listMessage += '\n' + getMessage(language, 'listMoreItems', {
          more: response.total - response.page * response.limit,
          page: response.page + 1
        });
      }

      await this.sendNotificationToUser(message.channel, message.channelId, listMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.sendNotificationToUser(
        message.channel,
        message.channelId,
        getMessage(language, 'listError', { message: errorMessage })
      );
    }
  }
}
