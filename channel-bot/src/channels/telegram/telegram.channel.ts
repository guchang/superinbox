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
  private botToken: string;
  private messageHandler?: (message: ChannelMessage) => Promise<void>;
  private isStarted: boolean = false;

  constructor(config: TelegramChannelConfig) {
    this.botToken = config.botToken;
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

    this.bot.on('message:audio', async (ctx) => {
      await this.handleAudioMessage(ctx);
    });

    this.bot.on('message:voice', async (ctx) => {
      await this.handleVoiceMessage(ctx);
    });

    this.bot.on('message:video', async (ctx) => {
      await this.handleVideoMessage(ctx);
    });

    // Register /start command
    this.bot.command('start', async (ctx) => {
      const chatId = ctx.chat?.id.toString();

      if (!chatId) return;

      const channelMessage: ChannelMessage = {
        channel: this.name,
        channelId: chatId,
        content: '/start',
        raw: ctx.message,
      };

      await this.dispatchMessage(channelMessage);
    });

    // Register /help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        `SuperInbox Bot Help 📚\n\n` +
          `/start - Bind your account\n` +
          `/bind <API_KEY> - Bind your account\n` +
          `/list [page] [limit] - View your inbox\n` +
          `/help - Show this help message\n\n` +
          `Just send any message and it will be forwarded to SuperInbox!`
      );
    });

    // Set up menu button and command list before starting polling
    this.setupMenuButton().catch(error => {
      console.error('Failed to set up Telegram menu button:', error);
    });

    this.setupCommands().catch(error => {
      console.error('Failed to set up Telegram commands:', error);
    });

    // Start polling (non-blocking)
    this.bot.start().catch(error => {
      console.error('Failed to start Telegram bot:', error);
    });

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
      fileName: `photo_${largestPhoto.file_id}.jpg`,
      fileSize: largestPhoto.file_size,
      mimeType: 'image/jpeg',
      url: await this.buildFileUrl(largestPhoto.file_id),
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
      url: await this.buildFileUrl(message.document.file_id),
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
   * Handle audio message
   */
  private async handleAudioMessage(ctx: Context): Promise<void> {
    const message = ctx.message;

    if (!message || !message.audio) return;

    const channelId = ctx.chat?.id.toString();

    if (!channelId) return;

    const attachment: MessageAttachment = {
      type: 'audio',
      fileId: message.audio.file_id,
      fileName: message.audio.file_name || `audio_${message.audio.file_id}`,
      fileSize: message.audio.file_size,
      mimeType: message.audio.mime_type,
      url: await this.buildFileUrl(message.audio.file_id),
    };

    const caption = message.caption || 'Audio';

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
   * Handle voice message
   */
  private async handleVoiceMessage(ctx: Context): Promise<void> {
    const message = ctx.message;

    if (!message || !message.voice) return;

    const channelId = ctx.chat?.id.toString();

    if (!channelId) return;

    const attachment: MessageAttachment = {
      type: 'audio',
      fileId: message.voice.file_id,
      fileName: `voice_${message.voice.file_id}.ogg`,
      fileSize: message.voice.file_size,
      mimeType: message.voice.mime_type || 'audio/ogg',
      url: await this.buildFileUrl(message.voice.file_id),
    };

    const caption = message.caption || 'Voice message';

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
   * Handle video message
   */
  private async handleVideoMessage(ctx: Context): Promise<void> {
    const message = ctx.message;

    if (!message || !message.video) return;

    const channelId = ctx.chat?.id.toString();

    if (!channelId) return;

    const attachment: MessageAttachment = {
      type: 'video',
      fileId: message.video.file_id,
      fileName: message.video.file_name || `video_${message.video.file_id}`,
      fileSize: message.video.file_size,
      mimeType: message.video.mime_type,
      url: await this.buildFileUrl(message.video.file_id),
    };

    const caption = message.caption || 'Video';

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
   * Build file download URL from Telegram
   */
  private async buildFileUrl(fileId: string): Promise<string | undefined> {
    try {
      const file = await this.bot.api.getFile(fileId);
      if (!file.file_path) return undefined;
      return `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;
    } catch (error) {
      console.error('Failed to get Telegram file path:', error);
      return undefined;
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

  /**
   * Set up Telegram menu button
   * This configures the menu button that appears in Telegram client
   */
  private async setupMenuButton(): Promise<void> {
    try {
      await this.bot.api.setChatMenuButton({
        menu_button: {
          type: 'commands',
        },
      });
      console.log('Telegram menu button configured successfully');
    } catch (error) {
      console.error('Failed to configure Telegram menu button:', error);
    }
  }

  /**
   * Set up Telegram command list (EN + ZH)
   */
  private async setupCommands(): Promise<void> {
    const englishCommands = [
      { command: 'start', description: 'Bind your account' },
      { command: 'bind', description: 'Bind your account with API key' },
      { command: 'list', description: 'View your inbox' },
      { command: 'help', description: 'Show help message' },
    ];

    const chineseCommands = [
      { command: 'start', description: '绑定账号' },
      { command: 'bind', description: '使用 API key 绑定账号' },
      { command: 'list', description: '查看收件箱' },
      { command: 'help', description: '显示帮助' },
    ];

    await this.bot.api.setMyCommands(englishCommands, { language_code: 'en' });
    console.log('Telegram commands set for language: en');
    await this.bot.api.setMyCommands(chineseCommands, { language_code: 'zh' });
    console.log('Telegram commands set for language: zh');
  }
}

/**
 * Create Telegram channel
 */
export function createTelegramChannel(config: TelegramChannelConfig): TelegramChannel {
  return new TelegramChannel(config);
}
