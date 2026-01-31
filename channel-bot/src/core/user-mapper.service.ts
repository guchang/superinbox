/**
 * User Mapper Service
 *
 * SQLite-based implementation for managing user bindings between
 * SuperInbox users and platform channels.
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import type {
  IUserMapper,
  UserBinding,
} from './user-mapper.interface.js';

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

  async bindUser(userId: string, channelId: string, channel: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO user_channel_bindings (id, super_inbox_user_id, channel, channel_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(channel, channel_id) DO UPDATE SET
        super_inbox_user_id = excluded.super_inbox_user_id,
        updated_at = excluded.updated_at
    `);

    const id = this.generateId();
    const now = this.now();

    stmt.run(id, userId, channel, channelId, now, now);
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
      SELECT id, super_inbox_user_id, channel, channel_id, created_at, updated_at
      FROM user_channel_bindings
      WHERE super_inbox_user_id = ?
    `);

    const rows = stmt.all(userId) as Array<{
      id: string;
      super_inbox_user_id: string;
      channel: string;
      channel_id: string;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      superInboxUserId: row.super_inbox_user_id,
      channel: row.channel,
      channelId: row.channel_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
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
