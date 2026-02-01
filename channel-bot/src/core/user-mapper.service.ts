/**
 * User Mapper Service
 *
 * SQLite-based implementation for managing user bindings between
 * SuperInbox users and platform channels.
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import type {
  IUserMapper,
  UserBinding,
  CreateBindingRequest,
} from './user-mapper.interface.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * User Mapper Service Implementation
 */
export class UserMapperService implements IUserMapper {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const dataDir = dirname(dbPath || join(process.cwd(), 'data', 'channel-bot.db'));

    // Ensure data directory exists
    mkdirSync(dataDir, { recursive: true });

    const databasePath = dbPath || join(dataDir, 'channel-bot.db');
    this.db = new Database(databasePath);

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');

    this.initSchema();
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_channel_bindings (
        id TEXT PRIMARY KEY,
        super_inbox_user_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        api_key TEXT,
        language TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(channel, channel_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_channel_bindings_user
        ON user_channel_bindings(super_inbox_user_id);

      CREATE INDEX IF NOT EXISTS idx_user_channel_bindings_channel
        ON user_channel_bindings(channel, channel_id);

      CREATE INDEX IF NOT EXISTS idx_user_channel_bindings_channel_id
        ON user_channel_bindings(channel_id);
    `);

    this.ensureApiKeyColumn();
    this.ensureLanguageColumn();
  }

  /**
   * Ensure api_key column exists (for upgrades)
   */
  private ensureApiKeyColumn(): void {
    const columns = this.db.prepare(`PRAGMA table_info(user_channel_bindings)`).all() as Array<{ name: string }>;
    const hasApiKey = columns.some((column) => column.name === 'api_key');
    if (!hasApiKey) {
      this.db.exec(`ALTER TABLE user_channel_bindings ADD COLUMN api_key TEXT`);
    }
  }

  /**
   * Ensure language column exists (for upgrades)
   */
  private ensureLanguageColumn(): void {
    const columns = this.db.prepare(`PRAGMA table_info(user_channel_bindings)`).all() as Array<{ name: string }>;
    const hasLanguage = columns.some((column) => column.name === 'language');
    if (!hasLanguage) {
      this.db.exec(`ALTER TABLE user_channel_bindings ADD COLUMN language TEXT`);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `binding_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get current timestamp
   */
  private now(): string {
    return new Date().toISOString();
  }

  async findSuperInboxUser(channelId: string, channel: string): Promise<string | null> {
    const stmt = this.db.prepare(`
      SELECT super_inbox_user_id
      FROM user_channel_bindings
      WHERE channel_id = ? AND channel = ?
      LIMIT 1
    `);

    const row = stmt.get(channelId, channel) as { super_inbox_user_id: string } | undefined;

    return row?.super_inbox_user_id ?? null;
  }

  async findChannelUser(userId: string, channel: string): Promise<string | null> {
    const stmt = this.db.prepare(`
      SELECT channel_id
      FROM user_channel_bindings
      WHERE super_inbox_user_id = ? AND channel = ?
      LIMIT 1
    `);

    const row = stmt.get(userId, channel) as { channel_id: string } | undefined;

    return row?.channel_id ?? null;
  }

  async bindUser(userId: string, channelId: string, channel: string, apiKey?: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO user_channel_bindings (id, super_inbox_user_id, channel, channel_id, api_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channel, channel_id) DO UPDATE SET
        super_inbox_user_id = excluded.super_inbox_user_id,
        api_key = CASE
          WHEN excluded.api_key IS NOT NULL THEN excluded.api_key
          ELSE api_key
        END,
        updated_at = excluded.updated_at
    `);

    const id = this.generateId();
    const now = this.now();

    stmt.run(id, userId, channel, channelId, apiKey ?? null, now, now);
  }

  async unbindUser(userId: string, channel: string): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM user_channel_bindings
      WHERE super_inbox_user_id = ? AND channel = ?
    `);

    stmt.run(userId, channel);
  }

  async getUserBindings(userId: string): Promise<UserBinding[]> {
    const stmt = this.db.prepare(`
      SELECT id, super_inbox_user_id, channel, channel_id, api_key, language, created_at, updated_at
      FROM user_channel_bindings
      WHERE super_inbox_user_id = ?
    `);

    const rows = stmt.all(userId) as Array<{
      id: string;
      super_inbox_user_id: string;
      channel: string;
      channel_id: string;
      api_key?: string;
      language?: string;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      superInboxUserId: row.super_inbox_user_id,
      channel: row.channel,
      channelId: row.channel_id,
      apiKey: row.api_key,
      language: row.language,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async findChannelApiKey(channelId: string, channel: string): Promise<string | null> {
    const stmt = this.db.prepare(`
      SELECT api_key
      FROM user_channel_bindings
      WHERE channel_id = ? AND channel = ?
      LIMIT 1
    `);

    const row = stmt.get(channelId, channel) as { api_key: string | null } | undefined;

    return row?.api_key ?? null;
  }

  async findChannelLanguage(channelId: string, channel: string): Promise<string | null> {
    const stmt = this.db.prepare(`
      SELECT language
      FROM user_channel_bindings
      WHERE channel_id = ? AND channel = ?
      LIMIT 1
    `);

    const row = stmt.get(channelId, channel) as { language: string | null } | undefined;

    return row?.language ?? null;
  }

  async setChannelLanguage(channelId: string, channel: string, language: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE user_channel_bindings
      SET language = ?, updated_at = ?
      WHERE channel_id = ? AND channel = ?
    `);

    stmt.run(language, this.now(), channelId, channel);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Singleton instance factory
 */
let userMapperInstance: UserMapperService | null = null;

export function getUserMapper(dbPath?: string): UserMapperService {
  if (!userMapperInstance) {
    userMapperInstance = new UserMapperService(dbPath);
  }

  return userMapperInstance;
}
