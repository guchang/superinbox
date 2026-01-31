/**
 * Channel Interface
 *
 * Defines the unified interface that all channel implementations must follow.
 * Each channel (Telegram, Lark, Wework, etc.) implements this interface.
 */

export type ChannelType = 'telegram' | 'lark' | 'wework';

/**
 * Main channel interface that all platform channels must implement
 */
export interface IChannel {
  /** Channel name */
  readonly name: ChannelType;

  /** Start the channel (Polling or Webhook) */
  start(): Promise<void>;

  /** Stop the channel */
  stop(): Promise<void>;

  /** Register message handler */
  onMessage(handler: (message: ChannelMessage) => Promise<void>): void;

  /** Send message to user */
  sendMessage(userId: string, message: string): Promise<void>;

  /** Health check */
  healthCheck(): Promise<boolean>;
}

/**
 * Unified message format from all channels
 */
export interface ChannelMessage {
  /** Channel name */
  channel: ChannelType;
  /** Platform user ID (e.g., Telegram User ID) */
  channelId: string;
  /** Message content */
  content: string;
  /** Attachments */
  attachments?: MessageAttachment[];
  /** Raw message object from platform */
  raw?: unknown;
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  type: 'photo' | 'document' | 'audio' | 'video';
  fileId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  url?: string;
}

/**
 * Channel status
 */
export interface ChannelStatus {
  name: ChannelType;
  status: 'running' | 'stopped' | 'error';
  connectedUsers?: number;
  error?: string;
}

/**
 * Send message request (from Core to Channel Bot)
 */
export interface SendMessageRequest {
  channel: ChannelType;
  userId: string;
  message: string;
}

/**
 * Send message response
 */
export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}
