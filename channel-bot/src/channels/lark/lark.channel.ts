/**
 * Lark Channel Implementation
 *
 * Feishu/Lark bot using Socket (long connection) mode.
 */

import * as Lark from '@larksuiteoapi/node-sdk';
import type { Readable } from 'node:stream';
import type {
  IChannel,
  ChannelMessage,
  MessageAttachment,
  ChannelType,
} from '../../core/channel.interface.js';

/**
 * Lark Channel Configuration
 */
export interface LarkChannelConfig {
  appId: string;
  appSecret: string;
  verificationToken?: string;
}

interface LarkMessageEvent {
  sender?: {
    sender_id?: {
      open_id?: string;
      user_id?: string;
    };
    sender_type?: string;
  };
  message?: {
    message_id?: string;
    message_type?: string;
    content?: string;
  };
}

/**
 * Lark Channel Implementation
 */
export class LarkChannel implements IChannel {
  readonly name: ChannelType = 'lark';
  private client: Lark.Client;
  private wsClient: Lark.WSClient;
  private messageHandler?: (message: ChannelMessage) => Promise<void>;
  private isStarted = false;
  private config: LarkChannelConfig;
  private recentMessageIds: Map<string, number> = new Map();

  constructor(config: LarkChannelConfig) {
    this.config = config;
    this.client = new Lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
    });
    this.wsClient = new Lark.WSClient({
      appId: config.appId,
      appSecret: config.appSecret,
      loggerLevel: Lark.LoggerLevel.info,
      autoReconnect: true,
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      console.log('Lark channel is already started');
      return;
    }

    const eventDispatcher = new Lark.EventDispatcher({
      verificationToken: this.config.verificationToken,
      loggerLevel: Lark.LoggerLevel.info,
    }).register({
      'im.message.receive_v1': async (data: LarkMessageEvent) => {
        await this.handleIncomingMessage(data);
      },
    });

    await this.wsClient.start({ eventDispatcher });

    this.isStarted = true;
    console.log('Lark channel started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.wsClient.close({ force: true });
    this.isStarted = false;
    console.log('Lark channel stopped');
  }

  onMessage(handler: (message: ChannelMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  async sendMessage(userId: string, message: string): Promise<void> {
    try {
      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'open_id',
        },
        data: {
          receive_id: userId,
          msg_type: 'text',
          content: JSON.stringify({ text: message }),
        },
      });
    } catch (error) {
      console.error(`Failed to send message to Lark user ${userId}:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.auth.v3.tenantAccessToken.internal({
        data: {
          app_id: this.config.appId,
          app_secret: this.config.appSecret,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  private async handleIncomingMessage(data: LarkMessageEvent): Promise<void> {
    const message = data.message;
    if (!message) return;

    const senderType = data.sender?.sender_type;
    if (senderType && senderType !== 'user') {
      return;
    }

    const channelId =
      data.sender?.sender_id?.open_id ||
      data.sender?.sender_id?.user_id;

    if (!channelId) return;

    const messageId = message.message_id;
    if (this.shouldSkipMessage(messageId)) {
      return;
    }

    const messageType = message.message_type || 'text';
    const content = this.safeParseContent(message.content);

    if (messageType === 'text') {
      const text = typeof content?.text === 'string' ? content.text : '';
      if (!text) return;

      const channelMessage: ChannelMessage = {
        channel: this.name,
        channelId,
        content: text,
        raw: data,
      };

      await this.dispatchMessage(channelMessage);
      return;
    }

    if (messageType === 'post') {
      const { text, attachments: postAttachments } = this.extractPostContent(content);
      if (!text && postAttachments.length === 0) {
        const messageId = message.message_id || 'unknown';
        const preview = this.safeStringify(content, 500);
        console.warn(`[Lark] Unsupported post content: messageId=${messageId} preview=${preview}`);
        return;
      }

      if (postAttachments.length === 0) {
        const channelMessage: ChannelMessage = {
          channel: this.name,
          channelId,
          content: text,
          raw: data,
        };

        await this.dispatchMessage(channelMessage);
        return;
      }

      try {
        const messageId = message.message_id;
        if (!messageId) return;

        const attachments: MessageAttachment[] = [];
        for (const entry of postAttachments) {
          const attachment = await this.buildAttachmentFromFileKey({
            messageId,
            fileKey: entry.fileKey,
            messageType: entry.messageType,
            mimeType: entry.mimeType,
            fileName: entry.fileName,
            fileSize: entry.fileSize,
          });
          attachments.push(attachment);
        }

        const channelMessage: ChannelMessage = {
          channel: this.name,
          channelId,
          content: text || 'Post',
          attachments,
          raw: data,
        };

        await this.dispatchMessage(channelMessage);
        return;
      } catch (error) {
        console.error('Failed to handle Lark message:', error);
        await this.sendMessage(channelId, '❌ Failed to read file. Please try again.');
        return;
      }
    }

    try {
      const attachment = await this.buildAttachment(message, content);
      if (!attachment) {
        console.warn(`Unsupported Lark message type: ${messageType}`);
        return;
      }

      const fallbackText =
        (typeof content?.text === 'string' && content.text) ||
        (typeof content?.file_name === 'string' && content.file_name) ||
        messageType ||
        'Attachment';

      const channelMessage: ChannelMessage = {
        channel: this.name,
        channelId,
        content: fallbackText,
        attachments: [attachment],
        raw: data,
      };

      await this.dispatchMessage(channelMessage);
    } catch (error) {
      console.error('Failed to handle Lark message:', error);
      await this.sendMessage(channelId, '❌ Failed to read file. Please try again.');
    }
  }

  private async buildAttachment(
    message: NonNullable<LarkMessageEvent['message']>,
    content: Record<string, unknown> | null
  ): Promise<MessageAttachment | null> {
    const messageType = message.message_type || '';
    const messageId = message.message_id;
    if (!messageId) return null;

    const fileKey =
      this.pickString(content, ['file_key']) ||
      this.pickString(content, ['image_key']) ||
      this.pickFirstStringArray(content, 'image_key_list');

    if (!fileKey) {
      return null;
    }

    let mimeType =
      this.pickString(content, ['mime_type', 'file_type']) ||
      undefined;

    const fileName =
      this.pickString(content, ['file_name', 'name']) ||
      this.buildFallbackFileName(messageType, fileKey, mimeType);

    const fileSize =
      this.pickNumber(content, ['file_size']) ||
      undefined;

    return this.buildAttachmentFromFileKey({
      messageId,
      fileKey,
      messageType,
      mimeType,
      fileName,
      fileSize,
    });
  }

  private async buildAttachmentFromFileKey(params: {
    messageId: string;
    fileKey: string;
    messageType: string;
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
  }): Promise<MessageAttachment> {
    const { messageId, fileKey, messageType } = params;
    const resourceType = this.mapResourceType(messageType);
    const download = await this.downloadMessageResource(messageId, fileKey, resourceType);

    let mimeType = params.mimeType || download.mimeType || undefined;
    const fileName =
      params.fileName ||
      this.buildFallbackFileName(messageType, fileKey, mimeType);

    if (
      messageType === 'audio' &&
      (!mimeType || mimeType === 'audio/octet-stream' || mimeType === 'application/octet-stream')
    ) {
      mimeType = 'audio/ogg';
    }

    if (!mimeType || mimeType === 'application/octet-stream') {
      mimeType = this.guessMimeTypeFromName(fileName) || mimeType;
    }

    const fileSize =
      params.fileSize ||
      download.fileSize ||
      undefined;

    return {
      type: this.mapAttachmentType(messageType),
      fileId: fileKey,
      fileName,
      fileSize,
      mimeType,
      data: download.buffer,
    };
  }

  private mapAttachmentType(messageType: string): MessageAttachment['type'] {
    if (messageType === 'image') return 'photo';
    if (messageType === 'audio') return 'audio';
    if (messageType === 'media' || messageType === 'video') return 'video';
    return 'document';
  }

  private mapResourceType(messageType: string): string {
    if (messageType === 'image') return 'image';
    if (messageType === 'audio') return 'audio';
    if (messageType === 'media' || messageType === 'video') return 'video';
    return 'file';
  }

  private buildFallbackFileName(messageType: string, fileKey: string, mimeType?: string): string {
    const base = `${messageType || 'file'}_${fileKey}`;
    const ext = this.guessExtension(mimeType);
    return ext ? `${base}.${ext}` : base;
  }

  private guessExtension(mimeType?: string): string | undefined {
    if (!mimeType) return undefined;
    if (mimeType.includes('jpeg')) return 'jpg';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('gif')) return 'gif';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('mpeg')) return 'mp3';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('webm')) return 'webm';
    return undefined;
  }

  private guessMimeTypeFromName(fileName?: string): string | undefined {
    if (!fileName || !fileName.includes('.')) return undefined;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return undefined;
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      case 'md':
        return 'text/markdown';
      case 'txt':
        return 'text/plain';
      case 'zip':
        return 'application/zip';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'ogg':
        return 'audio/ogg';
      case 'opus':
        return 'audio/opus';
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      default:
        return undefined;
    }
  }

  private async downloadMessageResource(
    messageId: string,
    fileKey: string,
    resourceType: string
  ): Promise<{
    buffer: Buffer;
    mimeType?: string;
    fileSize?: number;
  }> {
    const resp = await this.tryDownloadMessageResource(messageId, fileKey, resourceType);

    const headers = resp.headers || {};
    const mimeType = typeof headers['content-type'] === 'string' ? headers['content-type'] : undefined;
    const contentLength = typeof headers['content-length'] === 'string'
      ? Number(headers['content-length'])
      : undefined;

    const stream = resp.getReadableStream();
    const buffer = await this.streamToBuffer(stream);

    return {
      buffer,
      mimeType,
      fileSize: Number.isFinite(contentLength) ? contentLength : undefined,
    };
  }

  private async tryDownloadMessageResource(
    messageId: string,
    fileKey: string,
    resourceType: string
  ) {
    try {
      return await this.client.im.v1.messageResource.get({
        params: {
          type: resourceType,
        },
        path: {
          message_id: messageId,
          file_key: fileKey,
        },
      });
    } catch (error) {
      if (resourceType === 'audio' || resourceType === 'video') {
        return await this.client.im.v1.messageResource.get({
          params: {
            type: 'file',
          },
          path: {
            message_id: messageId,
            file_key: fileKey,
          },
        });
      }
      throw error;
    }
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }

    return Buffer.concat(chunks);
  }

  private safeParseContent(content?: string): Record<string, unknown> | null {
    if (!content) return null;
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private extractPostContent(content: Record<string, unknown> | null): {
    text: string;
    attachments: Array<{
      fileKey: string;
      messageType: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    }>;
  } {
    if (!content) return { text: '', attachments: [] };

    const post = content.post;
    let postObj: Record<string, unknown> | null = null;
    if (post && typeof post === 'object' && !Array.isArray(post)) {
      postObj = post as Record<string, unknown>;
    } else if (content.content && Array.isArray(content.content)) {
      postObj = content;
    }

    if (!postObj) {
      return { text: '', attachments: [] };
    }

    const localeBlocks: Record<string, unknown>[] = [];
    const textLines: string[] = [];
    const attachments: Array<{
      fileKey: string;
      messageType: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    }> = [];
    const attachmentKeys = new Set<string>();

    if (postObj.content && typeof postObj.content === 'object') {
      localeBlocks.push(postObj);
    } else {
      for (const value of Object.values(postObj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          localeBlocks.push(value as Record<string, unknown>);
        }
      }
    }

    const pushText = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (textLines.length === 0 || textLines[textLines.length - 1] !== trimmed) {
        textLines.push(trimmed);
      }
    };

    const normalizeType = (value?: string): string | undefined => {
      if (!value) return undefined;
      const lower = value.toLowerCase();
      if (lower.startsWith('image/')) return 'image';
      if (lower.startsWith('video/')) return 'video';
      if (lower.startsWith('audio/')) return 'audio';
      if (lower === 'image' || lower === 'video' || lower === 'audio') return lower;
      return undefined;
    };

    const addAttachment = (entry: {
      fileKey?: string;
      messageType?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    }) => {
      if (!entry.fileKey || !entry.messageType) return;
      const key = `${entry.messageType}:${entry.fileKey}`;
      if (attachmentKeys.has(key)) return;
      attachmentKeys.add(key);
      attachments.push({
        fileKey: entry.fileKey,
        messageType: entry.messageType,
        fileName: entry.fileName,
        mimeType: entry.mimeType,
        fileSize: entry.fileSize,
      });
    };

    const collectFromNode = (node: unknown) => {
      if (!node) return;
      if (typeof node === 'string') {
        pushText(node);
        return;
      }
      if (Array.isArray(node)) {
        for (const entry of node) collectFromNode(entry);
        return;
      }
      if (typeof node !== 'object') return;

      const obj = node as Record<string, unknown>;
      const tag = this.pickString(obj, ['tag', 'type']);
      const imageKey = this.pickString(obj, ['image_key', 'imageKey']);
      const fileKey = this.pickString(obj, ['file_key', 'fileKey']);
      const videoKey = this.pickString(obj, ['video_key', 'videoKey', 'media_key', 'mediaKey']);
      const audioKey = this.pickString(obj, ['audio_key', 'audioKey']);
      const mimeType = this.pickString(obj, ['mime_type', 'file_type', 'mimeType', 'fileType']);
      const fileName = this.pickString(obj, ['file_name', 'fileName', 'name']);
      const fileSize = this.pickNumber(obj, ['file_size', 'fileSize', 'size']);

      const imageKeyList = obj.image_key_list;
      if (Array.isArray(imageKeyList)) {
        for (const entry of imageKeyList) {
          if (typeof entry === 'string' && entry) {
            addAttachment({ fileKey: entry, messageType: 'image', fileName, mimeType, fileSize });
          }
        }
      }

      const inferredType = normalizeType(mimeType);
      if (tag === 'img' || tag === 'image') {
        addAttachment({
          fileKey: imageKey || fileKey,
          messageType: 'image',
          fileName,
          mimeType,
          fileSize,
        });
      } else if (tag === 'media' || tag === 'video') {
        if (videoKey || fileKey) {
          addAttachment({
            fileKey: videoKey || fileKey,
            messageType: 'video',
            fileName,
            mimeType,
            fileSize,
          });
        } else if (imageKey) {
          addAttachment({
            fileKey: imageKey,
            messageType: 'image',
            fileName,
            mimeType,
            fileSize,
          });
        }
      } else if (tag === 'audio') {
        addAttachment({
          fileKey: audioKey || fileKey,
          messageType: 'audio',
          fileName,
          mimeType,
          fileSize,
        });
      } else if (tag === 'file') {
        addAttachment({
          fileKey: fileKey,
          messageType: 'file',
          fileName,
          mimeType,
          fileSize,
        });
      } else if (inferredType) {
        addAttachment({
          fileKey: (inferredType === 'image' ? imageKey : undefined) || fileKey || videoKey || audioKey,
          messageType: inferredType,
          fileName,
          mimeType,
          fileSize,
        });
      } else if (imageKey) {
        addAttachment({
          fileKey: imageKey,
          messageType: 'image',
          fileName,
          mimeType,
          fileSize,
        });
      } else if (videoKey) {
        addAttachment({
          fileKey: videoKey,
          messageType: 'video',
          fileName,
          mimeType,
          fileSize,
        });
      } else if (audioKey) {
        addAttachment({
          fileKey: audioKey,
          messageType: 'audio',
          fileName,
          mimeType,
          fileSize,
        });
      } else if (fileKey) {
        addAttachment({
          fileKey: fileKey,
          messageType: 'file',
          fileName,
          mimeType,
          fileSize,
        });
      }

      const text = this.pickString(obj, ['text', 'content', 'title']);
      if (text) pushText(text);

      const href = this.pickString(obj, ['href']);
      if (href) pushText(href);

      for (const value of Object.values(obj)) {
        if (value !== obj) collectFromNode(value);
      }
    };

    for (const localeBlock of localeBlocks) {
      const title = this.pickString(localeBlock, ['title']);
      if (title) pushText(title);

      const contentLines = localeBlock.content;
      if (Array.isArray(contentLines)) {
        for (const line of contentLines) {
          if (Array.isArray(line)) {
            const lineParts: string[] = [];
            for (const node of line) {
              if (!node || typeof node !== 'object') {
                if (typeof node === 'string') lineParts.push(node);
                continue;
              }
              const nodeObj = node as Record<string, unknown>;
              const tag = this.pickString(nodeObj, ['tag']);
              if (tag === 'img' || tag === 'image') {
                const key = this.pickString(nodeObj, ['image_key', 'imageKey']);
                if (key) {
                  addAttachment({
                    fileKey: key,
                    messageType: 'image',
                    fileName: this.pickString(nodeObj, ['file_name', 'fileName', 'name']),
                    mimeType: this.pickString(nodeObj, ['mime_type', 'file_type', 'mimeType', 'fileType']),
                    fileSize: this.pickNumber(nodeObj, ['file_size', 'fileSize', 'size']),
                  });
                }
                continue;
              }

              const text = this.pickString(nodeObj, ['text', 'content']);
              if (text) lineParts.push(text);

              if (tag === 'a') {
                const href = this.pickString(nodeObj, ['href']);
                if (href && (!text || !text.includes(href))) {
                  lineParts.push(` ${href}`);
                }
              }

              collectFromNode(nodeObj);
            }

            if (lineParts.length > 0) {
              pushText(lineParts.join(''));
            }
          } else {
            collectFromNode(line);
          }
        }
      } else {
        collectFromNode(localeBlock);
      }
    }

    return {
      text: textLines.join('\n').trim(),
      attachments,
    };
  }

  private safeStringify(value: unknown, maxLength: number): string {
    try {
      const raw = typeof value === 'string' ? value : JSON.stringify(value);
      if (!raw) return '';
      return raw.length > maxLength ? `${raw.slice(0, maxLength)}...` : raw;
    } catch {
      return '';
    }
  }

  private shouldSkipMessage(messageId?: string): boolean {
    if (!messageId) return false;
    const now = Date.now();
    const ttl = 6 * 60 * 60 * 1000;
    const last = this.recentMessageIds.get(messageId);
    if (last && now - last < ttl) return true;
    this.recentMessageIds.set(messageId, now);
    if (this.recentMessageIds.size > 1000) {
      for (const [id, timestamp] of this.recentMessageIds) {
        if (now - timestamp > ttl) {
          this.recentMessageIds.delete(id);
        }
        if (this.recentMessageIds.size <= 800) break;
      }
    }
    return false;
  }

  private pickString(obj: Record<string, unknown> | null, keys: string[]): string | undefined {
    if (!obj) return undefined;
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'string' && value) return value;
    }
    return undefined;
  }

  private pickNumber(obj: Record<string, unknown> | null, keys: string[]): number | undefined {
    if (!obj) return undefined;
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value && Number.isFinite(Number(value))) {
        return Number(value);
      }
    }
    return undefined;
  }

  private pickFirstStringArray(obj: Record<string, unknown> | null, key: string): string | undefined {
    if (!obj) return undefined;
    const value = obj[key];
    if (Array.isArray(value)) {
      const first = value[0];
      if (typeof first === 'string' && first) return first;
    }
    return undefined;
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
}

/**
 * Create Lark channel
 */
export function createLarkChannel(config: LarkChannelConfig): LarkChannel {
  return new LarkChannel(config);
}
