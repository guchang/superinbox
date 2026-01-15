/**
 * Storage Layer - Database Manager
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
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
   * Initialize database schema
   */
  initialize(): void {
    if (this.initialized) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        original_content TEXT NOT NULL,
        content_type TEXT NOT NULL,
        source TEXT NOT NULL,
        intent TEXT NOT NULL,
        entities TEXT,
        summary TEXT,
        suggested_title TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        distributed_targets TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        processed_at TEXT
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
        user_id TEXT NOT NULL,
        scopes TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_used_at TEXT
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
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      CREATE INDEX IF NOT EXISTS idx_items_intent ON items(intent);
      CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
      CREATE INDEX IF NOT EXISTS idx_distribution_results_item_id ON distribution_results(item_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON api_keys(key_value);
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
        intent, entities, summary, suggested_title,
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
      item.intent,
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
   * Get items by user ID with filters
   */
  getItemsByUserId(userId: string, filter: QueryFilter = {}): Item[] {
    let query = 'SELECT * FROM items WHERE user_id = ?';
    const params: any[] = [userId];

    if (filter.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter.intent) {
      query += ' AND intent = ?';
      params.push(filter.intent);
    }

    if (filter.source) {
      query += ' AND source = ?';
      params.push(filter.source);
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
        intent = ?,
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
      updated.intent,
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
  validateApiKey(keyValue: string): { valid: boolean; userId?: string; scopes?: string[] } {
    const stmt = this.db.prepare(`
      SELECT user_id, scopes FROM api_keys
      WHERE key_value = ? AND is_active = 1
    `);

    const row = stmt.get(keyValue) as any;

    if (!row) {
      return { valid: false };
    }

    // Update last used timestamp
    const updateStmt = this.db.prepare(`
      UPDATE api_keys SET last_used_at = ? WHERE key_value = ?
    `);
    updateStmt.run(new Date().toISOString(), keyValue);

    return {
      valid: true,
      userId: row.user_id,
      scopes: JSON.parse(row.scopes)
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
      intent: row.intent,
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
