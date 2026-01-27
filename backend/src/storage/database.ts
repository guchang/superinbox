/**
 * Storage Layer - Database Manager
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import crypto from 'crypto';
import type { Item, QueryFilter } from '../types/index.js';
import { config, isDevelopment } from '../config/index.js';

export class DatabaseManager {
  private db: Database.Database;
  private initialized = false;

  constructor() {
    const dbPath = config.database.path;

    // Ensure directory exists
    if (!existsSync(dirname(dbPath))) {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    if (isDevelopment()) {
      this.db.pragma('query_log = 1');
    }
  }

  /**
   * Get the underlying database instance
   */
  get database(): Database.Database {
    return this.db;
  }

  /**
   * Initialize database schema
   */
  initialize(): void {
    if (this.initialized) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL,
        last_login_at TEXT
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        timezone TEXT,
        llm_provider TEXT,
        llm_model TEXT,
        llm_base_url TEXT,
        llm_api_key TEXT,
        llm_timeout INTEGER,
        llm_max_tokens INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        original_content TEXT NOT NULL,
        content_type TEXT NOT NULL,
        source TEXT NOT NULL,
        category TEXT NOT NULL,
        entities TEXT,
        summary TEXT,
        suggested_title TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        distributed_targets TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        processed_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS distribution_results (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        status TEXT NOT NULL,
        external_id TEXT,
        external_url TEXT,
        error TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        key_value TEXT NOT NULL UNIQUE,
        key_preview TEXT,
        user_id TEXT NOT NULL,
        name TEXT,
        scopes TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS api_access_logs (
        id TEXT PRIMARY KEY,
        api_key_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS distribution_configs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 0,
        conditions TEXT,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
      CREATE INDEX IF NOT EXISTS idx_distribution_results_item_id ON distribution_results(item_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON api_keys(key_value);
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_api_key_id ON api_access_logs(api_key_id);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_user_id ON api_access_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_timestamp ON api_access_logs(timestamp);

      CREATE TABLE IF NOT EXISTS ai_categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        examples TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        prompt TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        confirmed_coverage TEXT,
        ai_coverage TEXT,
        confirmed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ai_categories_user_id ON ai_categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_categories_key ON ai_categories(key);
      CREATE INDEX IF NOT EXISTS idx_ai_categories_is_active ON ai_categories(is_active);
      CREATE INDEX IF NOT EXISTS idx_ai_templates_user_id ON ai_templates(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_templates_is_active ON ai_templates(is_active);
    `);

    this.initialized = true;
  }

  /**
   * Create a new item
   */
  createItem(item: Item): Item {
    const stmt = this.db.prepare(`
      INSERT INTO items (
        id, user_id, original_content, content_type, source,
        category, entities, summary, suggested_title,
        status, priority, distributed_targets,
        created_at, updated_at, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      item.id,
      item.userId,
      item.originalContent,
      item.contentType,
      item.source,
      item.category,
      JSON.stringify(item.entities),
      item.summary ?? null,
      item.suggestedTitle ?? null,
      item.status,
      item.priority,
      JSON.stringify(item.distributedTargets),
      item.createdAt.toISOString(),
      item.updatedAt.toISOString(),
      item.processedAt?.toISOString() ?? null
    );

    return item;
  }

  /**
   * Get item by ID
   */
  getItemById(id: string): Item | null {
    const stmt = this.db.prepare('SELECT * FROM items WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapRowToItem(row);
  }

  /**
   * Count items by user ID with filters
   */
  countItemsByUserId(userId: string, filter: QueryFilter = {}): number {
    let query = 'SELECT COUNT(*) as count FROM items WHERE user_id = ?';
    const params: any[] = [userId];

    if (filter.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter.category) {
      query += ' AND category = ?';
      params.push(filter.category);
    }

    if (filter.source) {
      query += ' AND source = ?';
      params.push(filter.source);
    }

    // Add since parameter filtering for incremental sync
    if (filter.since) {
      query += ' AND updated_at > ?';
      params.push(filter.since.toISOString());
    }

    // Add date range filtering
    if (filter.startDate) {
      query += ' AND created_at >= ?';
      params.push(filter.startDate.toISOString());
    }

    if (filter.endDate) {
      query += ' AND created_at <= ?';
      params.push(filter.endDate.toISOString());
    }

    if (filter.query) {
      // Use LIKE for full-text search
      query += ' AND (original_content LIKE ? OR summary LIKE ? OR suggested_title LIKE ?)';
      const searchTerm = `%${filter.query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as any;
    return result.count;
  }

  /**
   * Get items by user ID with filters
   */
  getItemsByUserId(userId: string, filter: QueryFilter = {}): Item[] {
    let query = 'SELECT * FROM items WHERE user_id = ?';
    const params: any[] = [userId];

    if (filter.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter.category) {
      query += ' AND category = ?';
      params.push(filter.category);
    }

    if (filter.source) {
      query += ' AND source = ?';
      params.push(filter.source);
    }

    // Add since parameter filtering for incremental sync
    if (filter.since) {
      query += ' AND updated_at > ?';
      params.push(filter.since.toISOString());
    }

    // Add date range filtering
    if (filter.startDate) {
      query += ' AND created_at >= ?';
      params.push(filter.startDate.toISOString());
    }

    if (filter.endDate) {
      query += ' AND created_at <= ?';
      params.push(filter.endDate.toISOString());
    }

    if (filter.query) {
      // 使用 LIKE 进行全文搜索
      query += ' AND (original_content LIKE ? OR summary LIKE ? OR suggested_title LIKE ?)';
      const searchTerm = `%${filter.query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Sorting
    const sortBy = filter.sortBy ?? 'createdAt';
    const sortOrder = filter.sortOrder ?? 'desc';
    query += ` ORDER BY ${this.camelToSnake(sortBy)} ${sortOrder.toUpperCase()}`;

    // Pagination
    if (filter.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);

      if (filter.offset) {
        query += ' OFFSET ?';
        params.push(filter.offset);
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapRowToItem(row));
  }

  /**
   * Update item
   */
  updateItem(id: string, updates: Partial<Item>): Item | null {
    const existing = this.getItemById(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updatedAt: new Date() };

    const stmt = this.db.prepare(`
      UPDATE items SET
        original_content = ?,
        content_type = ?,
        category = ?,
        entities = ?,
        summary = ?,
        suggested_title = ?,
        status = ?,
        priority = ?,
        distributed_targets = ?,
        updated_at = ?,
        processed_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.originalContent,
      updated.contentType,
      updated.category,
      JSON.stringify(updated.entities),
      updated.summary ?? null,
      updated.suggestedTitle ?? null,
      updated.status,
      updated.priority,
      JSON.stringify(updated.distributedTargets),
      updated.updatedAt.toISOString(),
      updated.processedAt?.toISOString() ?? null,
      id
    );

    return updated;
  }

  /**
   * Delete item
   */
  deleteItem(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Add distribution result
   */
  addDistributionResult(result: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO distribution_results (
        id, item_id, target_id, adapter_type, status,
        external_id, external_url, error, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      result.id,
      result.itemId,
      result.targetId,
      result.adapterType,
      result.status,
      result.externalId ?? null,
      result.externalUrl ?? null,
      result.error ?? null,
      result.timestamp.toISOString()
    );
  }

  /**
   * Validate API key
   */
  validateApiKey(keyValue: string): { valid: boolean; userId?: string; scopes?: string[]; apiKeyId?: string; apiKeyName?: string } {
    // Hash the API key for comparison
    const hashedKey = crypto.createHash('sha256').update(keyValue).digest('hex');

    const stmt = this.db.prepare(`
      SELECT id, user_id, scopes, name FROM api_keys
      WHERE key_value = ? AND is_active = 1
    `);

    const row = stmt.get(hashedKey) as any;

    if (!row) {
      return { valid: false };
    }

    // Update last used timestamp
    const updateStmt = this.db.prepare(`
      UPDATE api_keys SET last_used_at = ? WHERE id = ?
    `);
    updateStmt.run(new Date().toISOString(), row.id);

    return {
      valid: true,
      userId: row.user_id,
      scopes: JSON.parse(row.scopes),
      apiKeyId: row.id,
      apiKeyName: row.name
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Map database row to Item object
   */
  private mapRowToItem(row: any): Item {
    return {
      id: row.id,
      userId: row.user_id,
      originalContent: row.original_content,
      contentType: row.content_type,
      source: row.source,
      category: row.category,
      entities: JSON.parse(row.entities || '{}'),
      summary: row.summary,
      suggestedTitle: row.suggested_title,
      status: row.status,
      priority: row.priority,
      distributedTargets: JSON.parse(row.distributed_targets || '[]'),
      distributionResults: [], // Loaded separately if needed
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      processedAt: row.processed_at ? new Date(row.processed_at) : undefined
    };
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  // ========== User Methods ==========

  /**
   * Create a new user
   */
  createUser(user: {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    role?: string;
  }): { id: string; username: string; email: string; role: string; createdAt: Date } {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.id,
      user.username,
      user.email,
      user.passwordHash,
      user.role || 'user',
      now
    );

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      createdAt: new Date(now),
    };
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): any | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
    };
  }

  /**
   * Get user by username
   */
  getUserByUsername(username: string): any | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username) as any;
    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
    };
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): any | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;
    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
    };
  }

  /**
   * Update user's last login time
   */
  updateUserLastLogin(userId: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?');
    stmt.run(now, userId);
  }

  /**
   * Get user timezone setting
   */
  getUserTimezone(userId: string): string | null {
    const stmt = this.db.prepare('SELECT timezone FROM user_settings WHERE user_id = ?');
    const row = stmt.get(userId) as any;
    return row?.timezone ?? null;
  }

  /**
   * Update or create user timezone setting
   */
  setUserTimezone(userId: string, timezone: string | null): { timezone: string | null; updatedAt: string } {
    const now = new Date().toISOString();
    const existing = this.db.prepare('SELECT user_id FROM user_settings WHERE user_id = ?').get(userId);

    if (existing) {
      const updateStmt = this.db.prepare(`
        UPDATE user_settings
        SET timezone = ?, updated_at = ?
        WHERE user_id = ?
      `);
      updateStmt.run(timezone, now, userId);
    } else {
      const insertStmt = this.db.prepare(`
        INSERT INTO user_settings (user_id, timezone, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      insertStmt.run(userId, timezone, now, now);
    }

    return { timezone, updatedAt: now };
  }

  /**
   * Get user LLM configuration overrides
   */
  getUserLlmConfig(userId: string): {
    provider: string | null;
    model: string | null;
    baseUrl: string | null;
    apiKey: string | null;
    timeout: number | null;
    maxTokens: number | null;
  } {
    const stmt = this.db.prepare(`
      SELECT
        llm_provider,
        llm_model,
        llm_base_url,
        llm_api_key,
        llm_timeout,
        llm_max_tokens
      FROM user_settings
      WHERE user_id = ?
    `);
    const row = stmt.get(userId) as any;

    return {
      provider: row?.llm_provider ?? null,
      model: row?.llm_model ?? null,
      baseUrl: row?.llm_base_url ?? null,
      apiKey: row?.llm_api_key ?? null,
      timeout: row?.llm_timeout ?? null,
      maxTokens: row?.llm_max_tokens ?? null,
    };
  }

  /**
   * Update or create user LLM configuration overrides
   */
  setUserLlmConfig(userId: string, updates: {
    provider?: string | null;
    model?: string | null;
    baseUrl?: string | null;
    apiKey?: string | null;
    timeout?: number | null;
    maxTokens?: number | null;
  }): { updatedAt: string } {
    const now = new Date().toISOString();
    const existing = this.db.prepare('SELECT user_id FROM user_settings WHERE user_id = ?').get(userId);
    const fields: string[] = [];
    const params: unknown[] = [];

    const pushUpdate = (column: string, value: unknown) => {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        params.push(value);
      }
    };

    pushUpdate('llm_provider', updates.provider);
    pushUpdate('llm_model', updates.model);
    pushUpdate('llm_base_url', updates.baseUrl);
    pushUpdate('llm_api_key', updates.apiKey);
    pushUpdate('llm_timeout', updates.timeout);
    pushUpdate('llm_max_tokens', updates.maxTokens);

    if (existing) {
      if (fields.length > 0) {
        fields.push('updated_at = ?');
        params.push(now);
        const stmt = this.db.prepare(`
          UPDATE user_settings
          SET ${fields.join(', ')}
          WHERE user_id = ?
        `);
        stmt.run(...params, userId);
      }
    } else {
      const insertStmt = this.db.prepare(`
        INSERT INTO user_settings (
          user_id,
          timezone,
          llm_provider,
          llm_model,
          llm_base_url,
          llm_api_key,
          llm_timeout,
          llm_max_tokens,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(
        userId,
        null,
        updates.provider ?? null,
        updates.model ?? null,
        updates.baseUrl ?? null,
        updates.apiKey ?? null,
        updates.timeout ?? null,
        updates.maxTokens ?? null,
        now,
        now
      );
    }

    return { updatedAt: now };
  }

  // ========== Refresh Token Methods ==========

  /**
   * Create a refresh token
   */
  createRefreshToken(data: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  }): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.userId,
      data.token,
      data.expiresAt.toISOString(),
      now
    );
  }

  /**
   * Get refresh token by token string
   */
  getRefreshToken(token: string): any | null {
    const stmt = this.db.prepare('SELECT * FROM refresh_tokens WHERE token = ?');
    const row = stmt.get(token) as any;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Delete refresh token
   */
  deleteRefreshToken(token: string): void {
    const stmt = this.db.prepare('DELETE FROM refresh_tokens WHERE token = ?');
    stmt.run(token);
  }

  /**
   * Delete all refresh tokens for a user
   */
  deleteUserRefreshTokens(userId: string): void {
    const stmt = this.db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?');
    stmt.run(userId);
  }

  /**
   * Clean up expired refresh tokens
   */
  cleanupExpiredRefreshTokens(): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?');
    stmt.run(now);
  }

  // ========== API Key Methods ==========

  /**
   * Create a new API key
   */
  createApiKey(data: {
    id: string;
    keyValue: string;
    keyPreview?: string;
    userId: string;
    name?: string;
    scopes: string[];
  }): any {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO api_keys (id, key_value, key_preview, user_id, name, scopes, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);

    stmt.run(
      data.id,
      data.keyValue,
      data.keyPreview || null,
      data.userId,
      data.name || null,
      JSON.stringify(data.scopes),
      now
    );

    return {
      id: data.id,
      keyValue: data.keyValue,
      keyPreview: data.keyPreview,
      userId: data.userId,
      name: data.name,
      scopes: data.scopes,
      isActive: true,
      createdAt: now,
      lastUsedAt: null,
    };
  }

  /**
   * List all API keys for a user
   */
  listApiKeysByUserId(userId: string): any[] {
    const stmt = this.db.prepare(`
      SELECT id, key_value, key_preview, user_id, name, scopes, is_active, created_at, last_used_at
      FROM api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(userId) as any[];

    return rows.map(row => ({
      id: row.id,
      keyValue: row.key_value,
      keyPreview: row.key_preview,
      userId: row.user_id,
      name: row.name,
      scopes: JSON.parse(row.scopes),
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    }));
  }

  /**
   * Get API key by ID
   */
  getApiKeyById(id: string): any | null {
    const stmt = this.db.prepare(`
      SELECT id, key_value, key_preview, user_id, name, scopes, is_active, created_at, last_used_at
      FROM api_keys
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      keyValue: row.key_value,
      keyPreview: row.key_preview,
      userId: row.user_id,
      name: row.name,
      scopes: JSON.parse(row.scopes),
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    };
  }

  /**
   * Update API key
   */
  updateApiKey(id: string, updates: { name?: string; scopes?: string[] }): any | null {
    const existing = this.getApiKeyById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name || null);
    }

    if (updates.scopes !== undefined) {
      fields.push('scopes = ?');
      values.push(JSON.stringify(updates.scopes));
    }

    if (fields.length === 0) return existing;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE api_keys SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return this.getApiKeyById(id);
  }

  /**
   * Toggle API key status
   */
  toggleApiKeyStatus(id: string, isActive: boolean): any | null {
    const stmt = this.db.prepare('UPDATE api_keys SET is_active = ? WHERE id = ?');
    const result = stmt.run(isActive ? 1 : 0, id);

    if (result.changes === 0) return null;

    return this.getApiKeyById(id);
  }

  /**
   * Delete API key
   */
  deleteApiKey(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM api_keys WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Update API key's last used timestamp
   */
  updateApiKeyLastUsed(keyValue: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE api_keys SET last_used_at = ? WHERE key_value = ?');
    stmt.run(now, keyValue);
  }

  // ========== API Access Log Methods ==========

  /**
   * Create an access log entry
   */
  createAccessLog(data: {
    id: string;
    apiKeyId: string;
    userId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    ipAddress?: string;
    userAgent?: string;
  }): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO api_access_logs (
        id, api_key_id, user_id, endpoint, method, status_code,
        ip_address, user_agent, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.apiKeyId,
      data.userId,
      data.endpoint,
      data.method,
      data.statusCode,
      data.ipAddress || null,
      data.userAgent || null,
      now
    );
  }

  /**
   * Get access logs for an API key
   */
  getAccessLogsByApiKeyId(apiKeyId: string, limit = 100, offset = 0): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM api_access_logs
      WHERE api_key_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(apiKeyId, limit, offset) as any[];

    return rows.map(row => ({
      id: row.id,
      apiKeyId: row.api_key_id,
      userId: row.user_id,
      endpoint: row.endpoint,
      method: row.method,
      statusCode: row.status_code,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      timestamp: row.timestamp,
    }));
  }

  /**
   * Get access logs for a user
   */
  getAccessLogsByUserId(userId: string, limit = 100, offset = 0): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM api_access_logs
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(userId, limit, offset) as any[];

    return rows.map(row => ({
      id: row.id,
      apiKeyId: row.api_key_id,
      userId: row.user_id,
      endpoint: row.endpoint,
      method: row.method,
      statusCode: row.status_code,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      timestamp: row.timestamp,
    }));
  }

  /**
   * List AI categories for a user
   */
  listAiCategories(userId: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ai_categories
      WHERE user_id = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(userId) as any[];

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      key: row.key,
      name: row.name,
      description: row.description,
      examples: row.examples ? JSON.parse(row.examples) : [],
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Create AI category
   */
  createAiCategory(category: any): any {
    const stmt = this.db.prepare(`
      INSERT INTO ai_categories (
        id, user_id, key, name, description, examples, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      category.id,
      category.userId,
      category.key,
      category.name,
      category.description ?? null,
      category.examples ? JSON.stringify(category.examples) : null,
      category.isActive ? 1 : 0,
      category.createdAt,
      category.updatedAt
    );

    return category;
  }

  /**
   * Update AI category
   */
  updateAiCategory(userId: string, id: string, data: any): any | null {
    const fields = Object.keys(data)
      .filter(key => key !== 'id' && key !== 'userId' && key !== 'createdAt')
      .map(key => {
        const dbKey = this.camelToSnake(key);
        let value = data[key];
        if (key === 'isActive') value = value ? 1 : 0;
        if (key === 'examples') value = value ? JSON.stringify(value) : null;
        return `${dbKey} = ?`;
      });

    if (fields.length === 0) return null;

    const values = Object.keys(data)
      .filter(key => key !== 'id' && key !== 'userId' && key !== 'createdAt')
      .map(key => {
        let value = data[key];
        if (key === 'isActive') return value ? 1 : 0;
        if (key === 'examples') return value ? JSON.stringify(value) : null;
        return value;
      });

    values.push(new Date().toISOString()); // updated_at
    values.push(userId);
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE ai_categories
      SET ${fields.join(', ')}, updated_at = ?
      WHERE user_id = ? AND id = ?
    `);

    const result = stmt.run(...values);
    if (result.changes === 0) return null;

    return this.getAiCategoryById(userId, id);
  }

  /**
   * Get AI category by ID
   */
  getAiCategoryById(userId: string, id: string): any | null {
    const stmt = this.db.prepare(`
      SELECT * FROM ai_categories
      WHERE user_id = ? AND id = ?
    `);

    const row = stmt.get(userId, id) as any;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      key: row.key,
      name: row.name,
      description: row.description,
      examples: row.examples ? JSON.parse(row.examples) : [],
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Delete AI category
   */
  deleteAiCategory(userId: string, id: string): any | null {
    // First get the category to return it
    const category = this.getAiCategoryById(userId, id);
    if (!category) return null;

    const stmt = this.db.prepare(`
      DELETE FROM ai_categories
      WHERE user_id = ? AND id = ?
    `);

    const result = stmt.run(userId, id);
    if (result.changes === 0) return null;

    return category;
  }

  /**
   * List AI templates for a user
   */
  listAiTemplates(userId: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ai_templates
      WHERE user_id = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(userId) as any[];

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      prompt: row.prompt,
      isActive: Boolean(row.is_active),
      confirmedCoverage: row.confirmed_coverage ? JSON.parse(row.confirmed_coverage) : [],
      aiCoverage: row.ai_coverage ? JSON.parse(row.ai_coverage) : [],
      confirmedAt: row.confirmed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Create AI template
   */
  createAiTemplate(template: any): any {
    const stmt = this.db.prepare(`
      INSERT INTO ai_templates (
        id, user_id, name, description, prompt, is_active, 
        confirmed_coverage, ai_coverage, confirmed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      template.id,
      template.userId,
      template.name,
      template.description ?? null,
      template.prompt,
      template.isActive ? 1 : 0,
      template.confirmedCoverage ? JSON.stringify(template.confirmedCoverage) : null,
      template.aiCoverage ? JSON.stringify(template.aiCoverage) : null,
      template.confirmedAt ?? null,
      template.createdAt,
      template.updatedAt
    );

    return template;
  }

  /**
   * Update AI template
   */
  updateAiTemplate(userId: string, id: string, data: any): any | null {
    const fields = Object.keys(data)
      .filter(key => key !== 'id' && key !== 'userId' && key !== 'createdAt')
      .map(key => {
        const dbKey = this.camelToSnake(key);
        let value = data[key];
        if (key === 'isActive') value = value ? 1 : 0;
        if (key === 'confirmedCoverage' || key === 'aiCoverage') {
          value = value ? JSON.stringify(value) : null;
        }
        return `${dbKey} = ?`;
      });

    if (fields.length === 0) return null;

    const values = Object.keys(data)
      .filter(key => key !== 'id' && key !== 'userId' && key !== 'createdAt')
      .map(key => {
        let value = data[key];
        if (key === 'isActive') return value ? 1 : 0;
        if (key === 'confirmedCoverage' || key === 'aiCoverage') {
          return value ? JSON.stringify(value) : null;
        }
        return value;
      });

    values.push(new Date().toISOString()); // updated_at
    values.push(userId);
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE ai_templates
      SET ${fields.join(', ')}, updated_at = ?
      WHERE user_id = ? AND id = ?
    `);

    const result = stmt.run(...values);
    if (result.changes === 0) return null;

    return this.getAiTemplateById(userId, id);
  }

  /**
   * Get AI template by ID
   */
  getAiTemplateById(userId: string, id: string): any | null {
    const stmt = this.db.prepare(`
      SELECT * FROM ai_templates
      WHERE user_id = ? AND id = ?
    `);

    const row = stmt.get(userId, id) as any;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      prompt: row.prompt,
      isActive: Boolean(row.is_active),
      confirmedCoverage: row.confirmed_coverage ? JSON.parse(row.confirmed_coverage) : [],
      aiCoverage: row.ai_coverage ? JSON.parse(row.ai_coverage) : [],
      confirmedAt: row.confirmed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Activate AI template (deactivate all others for the user)
   */
  activateAiTemplate(userId: string, id: string): any | null {
    // Deactivate all templates for the user
    const deactivateStmt = this.db.prepare(`
      UPDATE ai_templates
      SET is_active = 0, updated_at = ?
      WHERE user_id = ?
    `);
    deactivateStmt.run(new Date().toISOString(), userId);

    // Activate the specified template
    const activateStmt = this.db.prepare(`
      UPDATE ai_templates
      SET is_active = 1, updated_at = ?
      WHERE user_id = ? AND id = ?
    `);
    const result = activateStmt.run(new Date().toISOString(), userId, id);

    if (result.changes === 0) return null;

    return this.getAiTemplateById(userId, id);
  }

  /**
   * Delete AI template
   */
  deleteAiTemplate(userId: string, id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM ai_templates
      WHERE user_id = ? AND id = ?
    `);

    const result = stmt.run(userId, id);
    return result.changes > 0;
  }

  // ========== LLM Usage Log Methods ==========

  /**
   * Create an LLM usage log entry
   */
  createLlmUsageLog(data: {
    id: string;
    userId?: string;
    model: string;
    provider: string;
    requestMessages: string;
    responseContent?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    status: string;
    errorMessage?: string;
    sessionId?: string;
    sessionType?: string;
  }): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO llm_usage_logs (
        id, user_id, model, provider, request_messages, response_content,
        prompt_tokens, completion_tokens, total_tokens, status, error_message,
        session_id, session_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.userId ?? null,
      data.model,
      data.provider,
      data.requestMessages,
      data.responseContent ?? null,
      data.promptTokens ?? 0,
      data.completionTokens ?? 0,
      data.totalTokens ?? 0,
      data.status,
      data.errorMessage ?? null,
      data.sessionId ?? null,
      data.sessionType ?? null,
      now
    );
  }

  /**
   * Get LLM usage logs with filters
   */
  getLlmUsageLogs(filters: {
    userId?: string;
    model?: string;
    provider?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    sessionId?: string;
    sessionType?: string;
    limit?: number;
    offset?: number;
  }): { data: any[]; total: number } {
    let query = 'SELECT * FROM llm_usage_logs WHERE 1=1';
    const params: any[] = [];

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.model) {
      query += ' AND model = ?';
      params.push(filters.model);
    }

    if (filters.provider) {
      query += ' AND provider = ?';
      params.push(filters.provider);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.sessionId) {
      query += ' AND session_id = ?';
      params.push(filters.sessionId);
    }

    if (filters.sessionType) {
      query += ' AND session_type = ?';
      params.push(filters.sessionType);
    }

    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    // Get total count
    const countStmt = this.db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as count'));
    const countResult = countStmt.get(...params) as any;
    const total = countResult.count;

    // Add sorting and pagination
    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    const data = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      model: row.model,
      provider: row.provider,
      requestMessages: row.request_messages && row.request_messages.trim() !== '' ? JSON.parse(row.request_messages) : [],
      responseContent: row.response_content,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
      totalTokens: row.total_tokens,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));

    return { data, total };
  }

  /**
   * Get LLM usage statistics
   */
  getLlmUsageStatistics(filters: {
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): {
    totalCalls: number;
    successCalls: number;
    errorCalls: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    byModel: Array<{ model: string; calls: number; tokens: number }>;
    byProvider: Array<{ provider: string; calls: number; tokens: number }>;
    trendData: Array<{ date: string; calls: number; tokens: number }>;
  } {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.userId) {
      whereClause += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    // Total calls
    const totalStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM llm_usage_logs ${whereClause}`
    );
    const totalResult = totalStmt.get(...params) as any;
    const totalCalls = totalResult.count;

    // Success/Error calls
    const successStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM llm_usage_logs ${whereClause} AND status = 'success'`
    );
    const successResult = successStmt.get(...params) as any;
    const successCalls = successResult.count;
    const errorCalls = totalCalls - successCalls;

    // Token usage
    const tokenStmt = this.db.prepare(
      `SELECT
        SUM(total_tokens) as total,
        SUM(prompt_tokens) as prompt,
        SUM(completion_tokens) as completion
       FROM llm_usage_logs ${whereClause}`
    );
    const tokenResult = tokenStmt.get(...params) as any;
    const totalTokens = tokenResult.total || 0;
    const promptTokens = tokenResult.prompt || 0;
    const completionTokens = tokenResult.completion || 0;

    // By model
    const byModelStmt = this.db.prepare(
      `SELECT model, COUNT(*) as calls, SUM(total_tokens) as tokens
       FROM llm_usage_logs ${whereClause}
       GROUP BY model
       ORDER BY calls DESC`
    );
    const byModelRows = byModelStmt.all(...params) as any[];
    const byModel = byModelRows.map(row => ({
      model: row.model,
      calls: row.calls,
      tokens: row.tokens || 0,
    }));

    // By provider
    const byProviderStmt = this.db.prepare(
      `SELECT provider, COUNT(*) as calls, SUM(total_tokens) as tokens
       FROM llm_usage_logs ${whereClause}
       GROUP BY provider
       ORDER BY calls DESC`
    );
    const byProviderRows = byProviderStmt.all(...params) as any[];
    const byProvider = byProviderRows.map(row => ({
      provider: row.provider,
      calls: row.calls,
      tokens: row.tokens || 0,
    }));

    // Trend data (by date)
    const trendStmt = this.db.prepare(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as calls,
        SUM(total_tokens) as tokens
       FROM llm_usage_logs ${whereClause}
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 30`
    );
    const trendRows = trendStmt.all(...params) as any[];
    const trendData = trendRows.map(row => ({
      date: row.date,
      calls: row.calls,
      tokens: row.tokens || 0,
    }));

    return {
      totalCalls,
      successCalls,
      errorCalls,
      totalTokens,
      promptTokens,
      completionTokens,
      byModel,
      byProvider,
      trendData,
    };
  }

  /**
   * Get LLM usage grouped by session
   */
  getLlmUsageBySession(filters: {
    userId?: string;
    sessionType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): { data: any[]; total: number } {
    let query = `
      SELECT
        session_id,
        session_type,
        COUNT(*) as calls,
        MAX(total_tokens) as total_tokens,
        MAX(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens,
        MIN(created_at) as started_at,
        MAX(created_at) as ended_at,
        model,
        provider
      FROM llm_usage_logs
      WHERE session_id IS NOT NULL
    `;
    const params: any[] = [];

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.sessionType) {
      query += ' AND session_type = ?';
      params.push(filters.sessionType);
    }

    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    // Get total count
    const countQuery = query.replace('SELECT\n        session_id, session_type, COUNT(*) as calls, MAX(total_tokens) as total_tokens, MAX(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens, MIN(created_at) as started_at, MAX(created_at) as ended_at, model, provider',
      'SELECT COUNT(DISTINCT session_id) as count');
    const countStmt = this.db.prepare(countQuery);
    const countResult = countStmt.get(...params) as any;
    const total = countResult.count;

    // Add grouping and ordering
    query += `
      GROUP BY session_id, session_type, model, provider
      ORDER BY started_at DESC
    `;

    // Add pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    const data = rows.map(row => ({
      sessionId: row.session_id,
      sessionType: row.session_type,
      calls: row.calls,
      totalTokens: (row.prompt_tokens || 0) + (row.completion_tokens || 0),
      promptTokens: row.prompt_tokens || 0,
      completionTokens: row.completion_tokens || 0,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      duration: new Date(row.ended_at).getTime() - new Date(row.started_at).getTime(),
      model: row.model,
      provider: row.provider,
    }));

    return { data, total };
  }
}

// Singleton instance
let dbInstance: DatabaseManager | null = null;

export const getDatabase = (): DatabaseManager => {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
    dbInstance.initialize();
  }
  return dbInstance;
};

export const closeDatabase = (): void => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};
