/**
 * Database Migrations Runner
 */

import { getDatabase } from '../database.js';
import crypto from 'crypto';

const migrations = [
  {
    version: '001',
    name: 'initial_schema',
    up: `
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

      CREATE TABLE IF NOT EXISTS migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
      CREATE INDEX IF NOT EXISTS idx_distribution_results_item_id ON distribution_results(item_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON api_keys(key_value);
    `
  },
  {
    version: '002',
    name: 'enhance_access_logs',
    up: `
      -- Drop existing api_access_logs table and recreate with enhanced fields
      DROP TABLE IF EXISTS api_access_logs;

      CREATE TABLE IF NOT EXISTS api_access_logs (
        id TEXT PRIMARY KEY,
        api_key_id TEXT NOT NULL,
        api_key_name TEXT,
        user_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        full_url TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        status TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        request_size INTEGER DEFAULT 0,
        response_size INTEGER DEFAULT 0,
        duration INTEGER NOT NULL,
        request_headers TEXT,
        request_body TEXT,
        query_params TEXT,
        response_body TEXT,
        error_code TEXT,
        error_message TEXT,
        error_details TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_api_key_id ON api_access_logs(api_key_id);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_user_id ON api_access_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_timestamp ON api_access_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_status ON api_access_logs(status);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_method ON api_access_logs(method);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_endpoint ON api_access_logs(endpoint);

      -- Create export tasks table
      CREATE TABLE IF NOT EXISTS export_tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        format TEXT NOT NULL,
        status TEXT NOT NULL,
        filters TEXT,
        file_path TEXT,
        file_size INTEGER DEFAULT 0,
        record_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        expires_at TEXT,
        error_message TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_export_tasks_user_id ON export_tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_export_tasks_status ON export_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_export_tasks_expires_at ON export_tasks(expires_at);
    `
  },
  {
    version: '003',
    name: 'rename_intent_to_category',
    up: `
      -- Drop old index on intent if it exists
      DROP INDEX IF EXISTS idx_items_intent;

      -- Check if category column exists, if not add it
      -- (This migration may have already been applied)
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
    `
  },
  {
    version: '004',
    name: 'add_mcp_adapter_configs',
    up: `
      -- Create MCP adapter configs table
      CREATE TABLE IF NOT EXISTS mcp_adapter_configs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,

        -- MCP Server configuration
        server_url TEXT NOT NULL,
        server_type TEXT NOT NULL,

        -- Authentication configuration
        auth_type TEXT NOT NULL DEFAULT 'api_key',
        api_key TEXT,
        oauth_provider TEXT,
        oauth_access_token TEXT,
        oauth_refresh_token TEXT,
        oauth_token_expires_at TEXT,
        oauth_scopes TEXT,

        -- Tool configuration
        default_tool_name TEXT,
        tool_config_cache TEXT,

        -- LLM transformation configuration (optional, override system default)
        llm_provider TEXT,
        llm_api_key TEXT,
        llm_model TEXT,
        llm_base_url TEXT,

        -- Performance configuration
        timeout INTEGER DEFAULT 30000,
        max_retries INTEGER DEFAULT 3,
        cache_ttl INTEGER DEFAULT 300,

        -- Status
        enabled INTEGER DEFAULT 1,
        last_health_check TEXT,
        last_health_check_status TEXT,

        -- Timestamps
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_mcp_configs_user ON mcp_adapter_configs(user_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_configs_enabled ON mcp_adapter_configs(enabled);
      CREATE INDEX IF NOT EXISTS idx_mcp_configs_server_type ON mcp_adapter_configs(server_type);
      CREATE INDEX IF NOT EXISTS idx_mcp_configs_auth_type ON mcp_adapter_configs(auth_type);

      -- Add MCP reference to distribution_configs
      ALTER TABLE distribution_configs ADD COLUMN mcp_adapter_id TEXT;
      ALTER TABLE distribution_configs ADD COLUMN processing_instructions TEXT;
    `
  },
  {
    version: '005',
    name: 'add_stdio_transport_to_mcp_adapters',
    up: `
      -- Add transport type column
      ALTER TABLE mcp_adapter_configs ADD COLUMN transport_type TEXT DEFAULT 'http';

      -- Add stdio-specific columns
      ALTER TABLE mcp_adapter_configs ADD COLUMN command TEXT;
      ALTER TABLE mcp_adapter_configs ADD COLUMN env TEXT;

      -- Create index for transport type
      CREATE INDEX IF NOT EXISTS idx_mcp_configs_transport_type ON mcp_adapter_configs(transport_type);
    `
  },
  {
    version: '006',
    name: 'add_user_settings',
    up: `
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        timezone TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `
  },
  {
    version: '007',
    name: 'add_logo_color_to_mcp_adapters',
    up: `
      -- Add logo color column for auto-generated colored initials
      ALTER TABLE mcp_adapter_configs ADD COLUMN logo_color TEXT;

      -- Create index for logo color
      CREATE INDEX IF NOT EXISTS idx_mcp_configs_logo_color ON mcp_adapter_configs(logo_color);
    `
  },
  {
    version: '008',
    name: 'add_routing_rules_table',
    up: `
      -- Create routing rules table for custom user rules
      CREATE TABLE IF NOT EXISTS routing_rules (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        conditions TEXT NOT NULL,
        actions TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_routing_rules_user_id ON routing_rules(user_id);
      CREATE INDEX IF NOT EXISTS idx_routing_rules_is_active ON routing_rules(is_active);
      CREATE INDEX IF NOT EXISTS idx_routing_rules_is_system ON routing_rules(is_system);
      CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON routing_rules(priority);
    `
  },
  {
    version: '009',
    name: 'add_llm_usage_logs',
    up: `
      -- Create LLM usage logs table for tracking AI calls
      CREATE TABLE IF NOT EXISTS llm_usage_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        model TEXT NOT NULL,
        provider TEXT NOT NULL,
        request_messages TEXT NOT NULL,
        response_content TEXT,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_user_id ON llm_usage_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_model ON llm_usage_logs(model);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_provider ON llm_usage_logs(provider);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_status ON llm_usage_logs(status);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_created_at ON llm_usage_logs(created_at);
    `
  },
  {
    version: '010',
    name: 'add_llm_config_to_user_settings',
    up: `
      ALTER TABLE user_settings ADD COLUMN llm_provider TEXT;
      ALTER TABLE user_settings ADD COLUMN llm_model TEXT;
      ALTER TABLE user_settings ADD COLUMN llm_base_url TEXT;
      ALTER TABLE user_settings ADD COLUMN llm_api_key TEXT;
      ALTER TABLE user_settings ADD COLUMN llm_timeout INTEGER;
      ALTER TABLE user_settings ADD COLUMN llm_max_tokens INTEGER;
    `
  },
  {
    version: '011',
    name: 'add_session_tracking_to_llm_logs',
    up: `
      ALTER TABLE llm_usage_logs ADD COLUMN session_id TEXT;
      ALTER TABLE llm_usage_logs ADD COLUMN session_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_session_id ON llm_usage_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_session_type ON llm_usage_logs(session_type);
    `
  },
  {
    version: '012',
    name: 'add_rule_name_to_distribution_results',
    up: `
      ALTER TABLE distribution_results ADD COLUMN rule_name TEXT;
    `
  },
  {
    version: '013',
    name: 'remove_item_priority',
    up: `
      PRAGMA foreign_keys=off;

      BEGIN TRANSACTION;

      CREATE TABLE IF NOT EXISTS items_new (
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
        distributed_targets TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        processed_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO items_new (
        id, user_id, original_content, content_type, source,
        category, entities, summary, suggested_title,
        status, distributed_targets, created_at, updated_at, processed_at
      )
      SELECT
        id, user_id, original_content, content_type, source,
        category, entities, summary, suggested_title,
        status, distributed_targets, created_at, updated_at, processed_at
      FROM items;

      DROP TABLE items;
      ALTER TABLE items_new RENAME TO items;

      CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);

      COMMIT;
      PRAGMA foreign_keys=on;
    `
  },
  {
    version: '014',
    name: 'add_item_files_table',
    up: `
      CREATE TABLE IF NOT EXISTS item_files (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        file_name TEXT,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        file_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_item_files_item_id ON item_files(item_id);
      CREATE INDEX IF NOT EXISTS idx_item_files_file_type ON item_files(file_type);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_item_files_item_path ON item_files(item_id, file_path);
    `
  },
  {
    version: '015',
    name: 'add_category_icon_and_color',
    up: '-- handled in code for idempotency'
  }
];

export const runMigrations = async (): Promise<void> => {
  const db = getDatabase();

  console.log('Running migrations...');

  for (const migration of migrations) {
    const alreadyApplied = checkMigrationApplied(migration.version);

    if (!alreadyApplied) {
      console.log(`Applying migration: ${migration.version} - ${migration.name}`);
      if (migration.version === '015') {
        ensureAiCategoryAppearanceColumns(db);
      } else {
        (db as any).db.exec(migration.up);
      }
      if (migration.version === '014') {
        backfillItemFiles(db);
      }
      recordMigration(migration.version, migration.name);
    } else {
      console.log(`Migration ${migration.version} already applied, skipping.`);
    }
  }

  console.log('Migrations completed successfully.');
};

const checkMigrationApplied = (version: string): boolean => {
  const db = getDatabase();
  try {
    const stmt = (db as any).db.prepare('SELECT 1 FROM migrations WHERE version = ?');
    return stmt.get(version) !== undefined;
  } catch {
    return false;
  }
};

const recordMigration = (version: string, name: string): void => {
  const db = getDatabase();
  const stmt = (db as any).db.prepare(
    'INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );
  stmt.run(version, name, new Date().toISOString());
};

const ensureAiCategoryAppearanceColumns = (db: ReturnType<typeof getDatabase>): void => {
  const database = (db as any).db;
  const rows = database.prepare(`PRAGMA table_info(ai_categories)`).all() as Array<{ name: string }>;
  const existingColumns = new Set(rows.map((row) => row.name));

  if (!existingColumns.has('icon')) {
    database.exec('ALTER TABLE ai_categories ADD COLUMN icon TEXT');
  }

  if (!existingColumns.has('color')) {
    database.exec('ALTER TABLE ai_categories ADD COLUMN color TEXT');
  }
};

const backfillItemFiles = (db: ReturnType<typeof getDatabase>): void => {
  const database = (db as any).db;

  try {
    const rows = database.prepare('SELECT id, entities, created_at FROM items').all() as Array<{
      id: string;
      entities: string | null;
      created_at: string;
    }>;

    if (rows.length === 0) return;

    const insertStmt = database.prepare(`
      INSERT OR IGNORE INTO item_files (
        id, item_id, file_name, file_path, file_size, mime_type, file_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = database.transaction((entries: Array<{
      id: string;
      itemId: string;
      fileName: string | null;
      filePath: string;
      fileSize: number | null;
      mimeType: string | null;
      fileType: string;
      createdAt: string;
    }>) => {
      for (const entry of entries) {
        insertStmt.run(
          entry.id,
          entry.itemId,
          entry.fileName,
          entry.filePath,
          entry.fileSize,
          entry.mimeType,
          entry.fileType,
          entry.createdAt
        );
      }
    });

    const entries: Array<{
      id: string;
      itemId: string;
      fileName: string | null;
      filePath: string;
      fileSize: number | null;
      mimeType: string | null;
      fileType: string;
      createdAt: string;
    }> = [];

    for (const row of rows) {
      if (!row.entities) continue;

      let entities: any = {};
      try {
        entities = JSON.parse(row.entities);
      } catch {
        entities = {};
      }

      const allFiles = Array.isArray(entities.allFiles) ? entities.allFiles : [];
      const fileEntries = allFiles.length > 0
        ? allFiles
        : (entities.filePath || entities.fileName || entities.mimeType)
          ? [{
              filePath: entities.filePath,
              fileName: entities.fileName,
              fileSize: entities.fileSize,
              mimeType: entities.mimeType
            }]
          : [];

      for (const file of fileEntries) {
        if (!file?.filePath) continue;
        const mimeType = typeof file.mimeType === 'string' ? file.mimeType : null;
        const fileType = mimeType?.startsWith('image/')
          ? 'image'
          : mimeType?.startsWith('audio/')
            ? 'audio'
            : 'file';
        entries.push({
          id: crypto.randomUUID(),
          itemId: row.id,
          fileName: typeof file.fileName === 'string' ? file.fileName : null,
          filePath: file.filePath,
          fileSize: typeof file.fileSize === 'number' ? file.fileSize : null,
          mimeType,
          fileType,
          createdAt: row.created_at
        });
      }
    }

    if (entries.length > 0) {
      insertMany(entries);
    }
  } catch (error) {
    console.error('Failed to backfill item_files:', error);
  }
};

// Run migrations if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
