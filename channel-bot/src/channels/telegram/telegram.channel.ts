/**
 * Telegram Channel Implementation
 *
 * Grammy-based Telegram Bot channel implementation.
 */

import { Bot, type Context } from 'grammy';
import type {
  IChannel,
  ChannelMessage,
  MessageAttachment,
  ChannelType,
} from '../../core/channel.interface.js';

/**
 * Telegram Channel Configuration
 */
export interface TelegramChannelConfig {
  /** Bot token from @BotFather */
  botToken: string;
}

/**
 * Telegram Channel Implementation
 */
export class TelegramChannel implements IChannel {
  readonly name: ChannelType = 'telegram';
  private bot: Bot;
  private messageHandler?: (message: ChannelMessage) => Promise<void>;
  private isStarted: boolean = false;

  constructor(config: TelegramChannelConfig) {
    this.bot = new Bot(config.botToken);
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      console.log('Telegram channel is already started');
      return;
    }

    // Register message handler
    this.bot.on('message:text', async (ctx) => {
      await this.handleTextMessage(ctx);
    });

    this.bot.on('message:photo', async (ctx) => {
      await this.handlePhotoMessage(ctx);
    });

    this.bot.on('message:document', async (ctx) => {
      await this.handleDocumentMessage(ctx);
    });

    // Register /start command
    this.bot.command('start', async (ctx) => {
      const chatId = ctx.chat?.id.toString();

      if (!chatId) return;

      // Send binding instructions
      const token = this.generateBindingToken(chatId);

      await ctx.reply(
        `Welcome to SuperInbox Bot! 🚀\n\n` +
          `To bind your account, please visit:\n` +
          `https://superinbox.com/bot/bind?channel=telegram&channel_id=${chatId}&token=${token}\n\n` +
          `After binding, you can send messages here and they will be automatically forwarded to SuperInbox.`
      );
    });

    // Register /help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        `SuperInbox Bot Help 📚\n\n` +
          `/start - Bind your account\n` +
          `/help - Show this help message\n\n` +
          `Just send any message and it will be forwarded to SuperInbox!`
      );
    });

    // Start polling
    await this.bot.start();

    this.isStarted = true;
    console.log('Telegram channel started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await this.bot.stop();

    this.isStarted = false;
    console.log('Telegram channel stopped');
  }

  onMessage(handler: (message: ChannelMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  async sendMessage(userId: string, message: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(userId, message);
    } catch (error) {
      console.error(`Failed to send message to Telegram user ${userId}:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.bot.api.getMe();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle text message
   */
  private async handleTextMessage(ctx: Context): Promise<void> {
    const message = ctx.message;

    if (!message) return;

    const channelId = ctx.chat?.id.toString();

    if (!channelId) return;

    const channelMessage: ChannelMessage = {
      channel: this.name,
      channelId,
      content: message.text || '',
      raw: message,
    };

    await this.dispatchMessage(channelMessage);
  }

  /**
   * Handle photo message
   */
  private async handlePhotoMessage(ctx: Context): Promise<void> {
    const message = ctx.message;

    if (!message || !message.photo) return;

    const channelId = ctx.chat?.id.toString();

    if (!channelId) return;

    // Get largest photo
    const largestPhoto = message.photo[message.photo.length - 1];

    const attachment: MessageAttachment = {
      type: 'photo',
      fileId: largestPhoto.file_id,
    };

    const caption = message.caption || 'Photo';

    const channelMessage: ChannelMessage = {
      channel: this.name,
      channelId,
      content: caption,
      attachments: [attachment],
      raw: message,
    };

    await this.dispatchMessage(channelMessage);
  }

  /**
   * Handle document message
   */
  private async handleDocumentMessage(ctx: Context): Promise<void> {
    const message = ctx.message;

    if (!message || !message.document) return;

    const channelId = ctx.chat?.id.toString();

    if (!channelId) return;

    const attachment: MessageAttachment = {
      type: 'document',
      fileId: message.document.file_id,
      fileName: message.document.file_name,
      fileSize: message.document.file_size,
      mimeType: message.document.mime_type,
    };

    const caption = message.caption || 'Document';

    const channelMessage: ChannelMessage = {
      channel: this.name,
      channelId,
      content: caption,
      attachments: [attachment],
      raw: message,
    };

    await this.dispatchMessage(channelMessage);
  }

  /**
   * Dispatch message to registered handler
   */
  private async dispatchMessage(message: ChannelMessage): Promise<void> {
    if (this.messageHandler) {
      try {
        await this.messageHandler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    }
  }

  /**
   * Generate binding token
   * Note: In production, this should be a secure JWT token
   */
  private generateBindingToken(channelId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return Buffer.from(`${channelId}:${timestamp}:${random}`).toString('base64');
  }
}

/**
 * Create Telegram channel
 */
export function createTelegramChannel(config: TelegramChannelConfig): TelegramChannel {
  return new TelegramChannel(config);
}
