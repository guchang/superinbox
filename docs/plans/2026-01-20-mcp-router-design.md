# MCP Router Design

**Date:** 2026-01-20
**Author:** AI Assistant + User
**Status:** Design Approved

## Overview

Integrate Model Context Protocol (MCP) into SuperInbox's routing system, enabling users to distribute inbox items to any MCP-compatible service through a unified, configuration-driven approach with LLM-powered data mapping.

## Design Decisions

### Core Principles

1. **Separation of Concerns**
   - MCP Adapter Configs: Define "how to connect to a platform"
   - Route Rules: Define "what content goes to which platform"

2. **Configuration-Driven**
   - All MCP integrations configured via JSON in database
   - No need to write code for new integrations
   - Natural language instructions for data mapping

3. **Intelligent Caching**
   - MCP clients cached by `mcp_adapter_config_id`
   - Idle timeout: 5 minutes (configurable)
   - Shared across multiple routes using the same adapter

4. **LLM-Powered Mapping**
   - Natural language instructions describe data transformation
   - LLM converts Item data to target tool format
   - Fallback to simple mapping on LLM failure

## Architecture

### Directory Structure

```
backend/src/router/
├── mcp/
│   ├── mcp-client-manager.ts      # MCP process lifecycle management
│   ├── llm-mapping.service.ts     # LLM data transformation
│   ├── unified-route.adapter.ts   # Main adapter implementation
│   └── schema-validator.ts        # JSON schema validation
├── config/
│   └── presets.md                 # Mapping instruction templates
└── types/
    └── mcp.types.ts               # MCP-related type definitions
```

### Core Components

#### 1. MCPClientManager

Manages MCP server process lifecycle with intelligent caching.

```typescript
class MCPClientManager {
  // Cache key: mcp_adapter_config_id
  private pool: Map<string, { client: Client; lastUsed: number }>;

  async getClient(
    routeId: string,
    config: TargetConfig
  ): Promise<Client>;

  markUsed(routeId: string): void;

  private async startNewClient(
    routeId: string,
    config: TargetConfig
  ): Promise<Client>;

  private async isAlive(client: Client): Promise<boolean>;
}
```

**Caching Strategy:**
- First request: Spawn new stdio process
- Subsequent requests: Reuse existing client
- Background task: Check for idle clients every minute
- Idle timeout: Close clients unused for 5+ minutes

#### 2. LLMMappingService

Transforms Item data to target tool format using LLM.

```typescript
class LLMMappingService {
  async transform(
    item: Item,
    instructions: string,
    targetSchema?: JSONSchema
  ): Promise<Record<string, unknown>>;

  async preview(
    item: Item,
    instructions: string
  ): Promise<{ transformed: unknown; reasoning: string }>;
}
```

**Prompt Template:**
```
You are a data transformation expert. Convert the inbox item to target format.

User instructions: {instructions}

Item data:
{item_data}

Target tool: {tool_name}
Tool schema: {tool_schema}

Output JSON format only.
```

**Fallback Strategy:**
- On LLM failure: Use simple field mapping
- Map: `suggestedTitle` → `title`, `originalContent` → `content`, etc.

#### 3. UnifiedRouteAdapter

Extends `BaseAdapter`, integrates all components.

```typescript
class UnifiedRouteAdapter extends BaseAdapter {
  readonly type = AdapterType.UNIFIED_ROUTE;
  readonly name = 'Unified Route Adapter';

  async distribute(item: Item): Promise<DistributionResult> {
    // 1. Get matching route configuration
    const route = this.getRouteForItem(item);

    // 2. Transform data via LLM
    const transformed = await this.llmService.transform(
      item,
      route.processing_instructions
    );

    // 3. Get MCP client (with caching)
    const client = await this.mcpManager.getClient(
      route.id,
      route.target
    );

    // 4. Call MCP tool (with retry)
    return await this.callWithRetry(
      client,
      route.target.tool,
      transformed
    );
  }
}
```

## Database Schema

### MCP Adapter Configs Table

Defines how to connect to MCP-compatible services.

```sql
CREATE TABLE mcp_adapter_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  server_command TEXT NOT NULL,
  server_args TEXT,              -- JSON array
  server_env TEXT NOT NULL,      -- JSON object with API keys, etc.
  idle_timeout INTEGER DEFAULT 300,
  max_retries INTEGER DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_mcp_configs_user ON mcp_adapter_configs(user_id);
```

### Route Rules Table

Defines when and how to distribute items.

```sql
CREATE TABLE route_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  priority INTEGER DEFAULT 0,
  trigger_conditions TEXT NOT NULL,    -- JSON: conditions array
  processing_instructions TEXT NOT NULL,
  mcp_adapter_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (mcp_adapter_id) REFERENCES mcp_adapter_configs(id)
);

CREATE INDEX idx_routes_user ON route_rules(user_id);
CREATE INDEX idx_routes_enabled ON route_rules(enabled);
```

## Data Flow

### Distribution Flow

```
Item → RouterService
       ↓
Find matching routes (trigger conditions, priority)
       ↓
For each route:
  1. Transform data (LLMMappingService)
  2. Get MCP client (MCPClientManager with caching)
  3. Call tool (with exponential backoff retry)
  4. Save result
```

### MCP Client Lifecycle

```
Service Start
  ↓
MCPClientManager init
  ├─ Idle check timer (every minute)
  └─ Process pool: Map<adapterId, {client, lastUsed}>

First request for adapter:
  - No process in pool
  - spawn(command, args, env)
  - Create Client, connect stdio
  - Store: {client, lastUsed: now}
  - Return client

Subsequent requests:
  - Process found in pool
  - Update lastUsed: now
  - Return client

Idle timer:
  - For each entry in pool
  - if (now - lastUsed > idle_timeout):
      - Close stdio process
      - Remove from pool
```

### Example: Todo → Notion

**Input Item:**
```json
{
  "id": "item-123",
  "category": "todo",
  "originalContent": "完成周报",
  "suggestedTitle": "周报",
  "entities": {
    "dueDate": "2026-01-22",
    "tags": ["工作", "重要"]
  }
}
```

**Processing Instructions:**
```
Convert to Notion task format:
- Title: use suggestedTitle
- Date: use dueDate (format YYYY-MM-DD)
- Tags: convert to multi-select
- Content: keep original content
```

**LLM Output:**
```json
{
  "parent": { "database_id": "xxx" },
  "properties": {
    "Name": {
      "title": [{ "text": { "content": "周报" } }]
    },
    "Date": {
      "date": { "start": "2026-01-22" }
    },
    "Tags": {
      "multi_select": [
        { "name": "工作" },
        { "name": "重要" }
      ]
    }
  }
}
```

## Error Handling

### Error Classification

| Error Type | Strategy |
|------------|----------|
| Config validation | Fail fast, show error in Web UI |
| MCP tool call (retryable) | Exponential backoff: 1s, 2s, 4s (max 3) |
| MCP tool call (non-retryable) | Fail immediately |
| LLM mapping failure | Fallback to simple field mapping |
| Process crash | Auto-restart (max 3 times, then mark failed) |
| Process idle timeout | Automatic cleanup |

### Retry Logic

```typescript
async callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (isRetryable(error)) {
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

function isRetryable(error: Error): boolean {
  const patterns = [
    /ECONNRESET/, /ETIMEDOUT/, /socket hang up/,
    /Broken pipe/, /process exited/
  ];
  return patterns.some(p => p.test(error.message));
}
```

## API Endpoints

### MCP Adapter Configs

```
GET    /v1/mcp-adapters          # List user's adapters
POST   /v1/mcp-adapters          # Create adapter
PUT    /v1/mcp-adapters/:id      # Update adapter
DELETE /v1/mcp-adapters/:id      # Delete adapter
POST   /v1/mcp-adapters/:id/test # Test connection
```

### Route Rules

```
GET    /v1/routes                # List user's routes
POST   /v1/routes                # Create route
PUT    /v1/routes/:id            # Update route
DELETE /v1/routes/:id            # Delete route
POST   /v1/routes/:id/preview    # Preview data transformation
POST   /v1/routes/:id/test       # Test route with sample item
```

## Web UI

### Pages

1. **`/settings/mcp-adapters`** - MCP adapter configs management
   - List all adapters
   - Add/Edit/Delete adapter
   - Test connection

2. **`/settings/routes`** - Route rules management
   - List all routes
   - Add/Edit/Delete route
   - Preview transformation
   - Test with sample item

### Configuration Flow

```
Step 1: Configure MCP Adapter
  - Name: "My Notion"
  - Server: npx -y @modelcontextprotocol/server-notion
  - Environment: NOTION_API_KEY=xxx
  - Test connection → Save

Step 2: Create Route Rule
  - Name: "Todos → Notion"
  - Trigger: category = "todo"
  - Target: Select "My Notion"
  - Instructions: "Convert to Notion task format..."
  - Preview → Test → Save
```

## Testing Strategy

### Unit Tests

- **MCPClientManager**: Cache behavior, idle timeout, process lifecycle
- **LLMMappingService**: Transformation, fallback logic
- **Retry Logic**: Retry on retryable errors, fail fast on others

### Integration Tests

- Complete distribution flow with mock MCP server
- Multiple concurrent routes
- Process crash and recovery

### E2E Tests

- Web UI: Complete setup flow (adapter → route → test)
- Distribution: Create item → verify in target service

### Performance Targets

- 100 concurrent distributions < 30 seconds
- MCP client reuse efficiency (same adapter = 1 process)

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

- [ ] MCPClientManager implementation
- [ ] LLMMappingService implementation
- [ ] UnifiedRouteAdapter skeleton
- [ ] Database migrations

### Phase 2: Configuration System (Week 2-3)

- [ ] MCP adapter config API
- [ ] Route rules API
- [ ] Web UI for configuration

### Phase 3: Integration & Testing (Week 3-4)

- [ ] End-to-end distribution flow
- [ ] Error handling and retry logic
- [ ] Comprehensive testing
- [ ] Documentation

## Open Questions

1. **Resource Management**: Should we limit number of concurrent MCP processes per user?
2. **Cost Control**: LLM calls per distribution can add up - implement caching?
3. **Security**: Validate user-provided MCP commands to prevent injection?

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [SuperInbox Architecture](../CLAUDE.md)
- Existing router adapters: `notion.adapter.ts`, `obsidian.adapter.ts`, `webhook.adapter.ts`
