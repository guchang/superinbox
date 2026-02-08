# SuperInbox Core API Documentation (Current Implementation)

**Version:** v0.1.0 (aligned with backend runtime version)  
**Last Updated:** 2026-02-08  
**Maintenance Status:** Active

> This document has been verified against the current backend codebase.  
> If any historical docs conflict with this file, treat the following sources as authoritative:  
> `backend/src/index.ts`, `backend/src/**/routes/*.ts`, `backend/src/**/controllers/*.ts`.

---

## Table of Contents

1. [Basics](#basics)
2. [Authentication and Authorization](#authentication-and-authorization)
3. [Health and Service Info](#health-and-service-info)
4. [Auth API (JWT)](#auth-api-jwt)
5. [API Key Management](#api-key-management)
6. [Inbox API](#inbox-api)
7. [Intelligence API](#intelligence-api)
8. [Category Management API](#category-management-api)
9. [Routing and Dispatch API](#routing-and-dispatch-api)
10. [MCP Adapter API](#mcp-adapter-api)
11. [Settings API](#settings-api)
12. [Access Logs and Export API](#access-logs-and-export-api)
13. [LLM Usage API](#llm-usage-api)
14. [Deprecated / Removed Endpoints](#deprecated--removed-endpoints)
15. [Full Endpoint List (Auto-verified)](#full-endpoint-list-auto-verified)

---

## Basics

### Base URL

- Local development: `http://localhost:3000`
- API prefix: `/v1`

### Content Types

- JSON APIs: `application/json`
- Upload APIs: `multipart/form-data`
- SSE APIs: `text/event-stream`

### Standard Response Format

Typical success response:

```json
{
  "success": true,
  "data": {}
}
```

Error responses are normalized via `sendError`:

```json
{
  "success": false,
  "code": "INBOX.NOT_FOUND",
  "message": "Item not found",
  "params": { "id": "..." },
  "error": {
    "code": "INBOX.NOT_FOUND",
    "message": "Item not found",
    "details": null,
    "params": { "id": "..." }
  }
}
```

---

## Authentication and Authorization

Two identity modes are currently supported:

1. **JWT user token** (issued after login)
2. **API Key** (created through authenticated JWT session)

### Token Transport

- HTTP header (recommended): `Authorization: Bearer <token_or_api_key>`
- JWT cookie: `superinbox_auth_token`
- SSE query token: `?token=...`

### Scopes

- Scope checks exist in code (for example: `admin:full`, `content:all`).
- Most business routes currently gate access by authentication validity.
- Admin operations (especially log statistics) rely on `admin:full`.

---

## Health and Service Info

### `GET /health`
Basic health check.

### `GET /v1/health`
Versioned health endpoint.

### `GET /ping`
Returns `{"pong": true}`.

### `GET /api`
Returns service metadata, runtime version, and base endpoint info.

---

## Auth API (JWT)

> Route prefix: `/v1/auth`

### `POST /v1/auth/register`
Register a new user.

Request body:

```json
{
  "username": "demo",
  "email": "demo@example.com",
  "password": "123456"
}
```

Returns user info + `token` + `refreshToken`, and also sets auth cookies.

### `POST /v1/auth/login`
Login with username/password.

```json
{
  "username": "demo",
  "password": "123456"
}
```

### `POST /v1/auth/refresh`
Refresh access token.

```json
{
  "refreshToken": "..."
}
```

### `POST /v1/auth/logout`
Logout (uses refresh token cookie if present).

### `GET /v1/auth/me`
Get current user profile.

---

## API Key Management

> Route prefix: `/v1/auth/api-keys`  
> This module requires **JWT auth** (`authenticateJwt`).

### `POST /v1/auth/api-keys`
Create a new API key.

```json
{
  "name": "My Integration",
  "scopes": ["inbox:read", "inbox:write", "content:all"]
}
```

Notes:
- `scopes` is required and must be a non-empty array.
- Full plaintext `apiKey` is returned once only.

### `GET /v1/auth/api-keys`
List current user's API keys (returns `keyPreview`, not full key).

### `GET /v1/auth/api-keys/:id`
Get one API key metadata.

### `PATCH /v1/auth/api-keys/:id`
Update `name` and/or `scopes`.

### `POST /v1/auth/api-keys/:id/disable`
Disable key.

### `POST /v1/auth/api-keys/:id/enable`
Enable key.

### `POST /v1/auth/api-keys/:id/toggle`
Legacy compatibility endpoint (expects `isActive: boolean`).

### `POST /v1/auth/api-keys/:id/regenerate`
Regenerate key material and return new plaintext key (one-time).

### `DELETE /v1/auth/api-keys/:id`
Delete key.

### `GET /v1/auth/api-keys/:id/logs`
Get logs for this key (`limit`, `offset`).

---

## Inbox API

> Route prefix: `/v1/inbox`

### 1) Create and Query

#### `POST /v1/inbox`
Create one text/URL inbox item.

```json
{
  "content": "Spent 30 CNY on taxi",
  "type": "text",
  "source": "ios",
  "metadata": {}
}
```

Validation:
- `content` required, 1-10000 chars.
- `type` optional: `text | image | url | audio | file | mixed`.

#### `GET /v1/inbox`
Paginated query.

Supported query params (code-based):
- Pagination: `page`, `limit`, `offset`
- Filter: `status`, `category`, `source`, `query`, `hastype`
- Time: `since`, `startDate`, `endDate`
- Sorting: `sortBy`, `sortOrder`

#### `GET /v1/inbox/search`
Keyword search.

Params:
- `q` (required)
- `category` (optional)
- `limit` (optional, max 100)

#### `GET /v1/inbox/sources`
Get distinct source list used by current user.

#### `GET /v1/inbox/:id`
Get detailed item info (parse result, dispatch history, routing state, etc.).

#### `PUT /v1/inbox/:id`
Update item fields.

Supported body fields:
- `content`
- `category`
- `status` (`pending | processing | completed | failed | archived`)

#### `DELETE /v1/inbox/:id`
Delete one item.

### 2) Batch and Upload

#### `POST /v1/inbox/batch`
Batch create items.

```json
{
  "entries": [
    { "content": "A" },
    { "content": "B", "source": "telegram" }
  ]
}
```

#### `POST /v1/inbox/file`
Single file upload with fields:
- `file` (required)
- `content` (optional)
- `source` (optional)

#### `POST /v1/inbox/files`
Multi-file upload with fields:
- `files` (required, array)
- `content` (optional)
- `source` (optional)

Upload constraints (middleware-driven):
- Supports common image, PDF, markdown, text, zip, audio, and video MIME types.
- Default max file size: `config.storage.maxUploadSize` (default 100MB).
- Default max file count: `config.storage.maxUploadFiles` (default 20).

### 3) File Access and AI Retry

#### `GET /v1/inbox/:id/file`
Read primary file (inline).

#### `GET /v1/inbox/:id/file/:index`
Read file by index for multi-file items.

#### `GET /v1/inbox/:id/file/download`
Download primary file.

#### `GET /v1/inbox/:id/file/:index/download`
Download indexed file.

#### `POST /v1/inbox/:id/retry`
Retry AI processing; only valid when item status is `failed`.

#### `POST /v1/inbox/:id/reclassify`
Trigger reclassification (except while status is `processing`).

### 4) Routing Progress

#### `GET /v1/inbox/:id/routing-progress`
SSE stream endpoint.

Typical event types:
- `routing:start`
- `routing:rule-matched`
- `routing:dispatching`
- `routing:dispatched`
- `routing:complete`
- `routing:failed`
- `routing:skipped`
- `ai.completed`
- `ai.failed`

### 5) Batch Redistribute

#### `POST /v1/inbox/batch-redistribute`
Redistribute historical items in safe batches.

```json
{
  "batchSize": 10,
  "delayBetweenBatches": 5000,
  "maxConcurrent": 2,
  "filter": {
    "status": "completed",
    "category": "note",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }
}
```

#### `GET /v1/inbox/batch-redistribute/status`
Get latest redistribution summary.

---

## Intelligence API

> Route prefix: `/v1/intelligence`

### Parse Result

#### `GET /v1/intelligence/parse/:id`
Get AI parse result for one item.

#### `PATCH /v1/intelligence/parse/:id`
Apply user corrections to parse result.

```json
{
  "category": "expense",
  "entities": { "amount": 30, "currency": "CNY" },
  "feedback": "Correct category; adjusted currency only"
}
```

### Prompt Templates (currently placeholder implementation)

These endpoints currently return mock/placeholder payloads for integration:
- `GET /v1/intelligence/prompts`
- `GET /v1/intelligence/prompts/:id`
- `POST /v1/intelligence/prompts`
- `PUT /v1/intelligence/prompts/:id`
- `DELETE /v1/intelligence/prompts/:id`

---

## Category Management API

> Route prefix: `/v1/categories`

### Category CRUD

- `GET /v1/categories`
- `POST /v1/categories`
- `PUT /v1/categories/:id`
- `DELETE /v1/categories/:id`

`POST /v1/categories` key fields:
- Required: `key`, `name`
- Optional: `description`, `examples`, `icon`, `color`, `sortOrder`, `isActive`

### Category Prompt Management

- `GET /v1/categories/prompt`
- `PUT /v1/categories/prompt`
- `POST /v1/categories/prompt/generate`
- `POST /v1/categories/prompt/reset`
- `POST /v1/categories/prompt/rollback`

`POST /v1/categories/prompt/generate` request body:

```json
{
  "mode": "low_cost",
  "requirement": "optional, required in custom mode",
  "language": "en-US"
}
```

Allowed `mode` values: `low_cost | high_precision | custom`.

---

## Routing and Dispatch API

> Route prefix: `/v1/routing`

### Rule Management

- `GET /v1/routing/rules`
- `GET /v1/routing/rules/:id`
- `POST /v1/routing/rules`
- `PUT /v1/routing/rules/:id`
- `DELETE /v1/routing/rules/:id`

`POST /v1/routing/rules` required fields:
- `name` (string)
- `conditions` (array)
- `actions` (array)

### Rule Testing and Manual Dispatch

#### `POST /v1/routing/rules/:id/test`
Returns placeholder test result (`matched: true`).

#### `POST /v1/routing/dispatch/:id`
Manually dispatch one item.

Optional request body:

```json
{
  "adapters": ["mcp"],
  "force": false
}
```

#### `POST /v1/routing/connectors/test`
Test MCP server connectivity in bulk.

```json
{
  "config": {
    "mcpServers": {
      "notion": { "url": "https://...", "headers": {} }
    }
  }
}
```

#### `POST /v1/routing/rules/test-dispatch`
SSE-based streaming dispatch test (`text/event-stream`).

Required request fields:
- `content`
- `mcpAdapterId`
- `instructions`

Optional fields:
- `toolName`
- `params`

---

## MCP Adapter API

> Route prefix: `/v1/mcp-adapters`

### Basic CRUD

- `GET /v1/mcp-adapters`
- `GET /v1/mcp-adapters/:id`
- `POST /v1/mcp-adapters`
- `PUT /v1/mcp-adapters/:id`
- `DELETE /v1/mcp-adapters/:id`

Common creation fields:
- Base: `name`, `serverType`, `serverUrl`
- Transport: `transportType` (`http`/`stdio`), `command`, `env`
- Auth: `authType` (`api_key`/`oauth`/`none`), `apiKey`, `oauthAccessToken`
- LLM: `llmProvider`, `llmApiKey`, `llmModel`, `llmBaseUrl`
- Runtime: `timeout`, `maxRetries`, `cacheTtl`, `enabled`

### Health Check and Tool Discovery

- `POST /v1/mcp-adapters/:id/test`: connectivity/auth check
- `GET /v1/mcp-adapters/:id/tools`: list tools (`name`, `description`)

---

## Settings API

> Route prefix: `/v1/settings`

- `GET /v1/settings/statistics`: system statistics
- `GET /v1/settings/timezone`: get user timezone
- `PUT /v1/settings/timezone`: update timezone
- `GET /v1/settings/llm`: get user LLM config (with fallback defaults)
- `PUT /v1/settings/llm`: update user LLM config
- `GET /v1/settings/logs`: **deprecated**, returns empty logs + warning headers

`PUT /v1/settings/llm` supports:
- `provider`
- `model`
- `baseUrl`
- `apiKey`
- `timeout`
- `maxTokens`

---

## Access Logs and Export API

> Route prefix: `/v1/auth`

### Query Logs

- `GET /v1/auth/logs` (admin)
- `GET /v1/auth/api-keys/:keyId/logs`

Supported query params:
- `startDate`
- `endDate`
- `method` (supports repeated values)
- `endpoint`
- `status` (`success | error | denied`)
- `page`
- `limit` (max 200)

### Export

- `POST /v1/auth/logs/export`
- `GET /v1/auth/logs/exports/:exportId`
- `GET /v1/auth/logs/exports/:exportId/download`

Export request body:

```json
{
  "format": "csv",
  "startDate": "2026-01-01T00:00:00.000Z",
  "endDate": "2026-01-31T23:59:59.999Z",
  "includeFields": ["timestamp", "method", "endpoint", "status"]
}
```

Allowed `format`: `csv | json | xlsx` (`xlsx` currently falls back to CSV-style write path).

### Statistics

- `GET /v1/auth/logs/statistics` (admin)

Params:
- `timeRange` (`today | week | month | all`)
- `startDate`
- `endDate`

---

## LLM Usage API

> Route prefix: `/v1/ai/usage`

- `GET /v1/ai/usage/statistics`
- `GET /v1/ai/usage/logs`
- `GET /v1/ai/usage/sessions`
- `GET /v1/ai/usage/feedback`

Common query params:
- `userId` (only admin can query other users)
- `startDate`
- `endDate`
- Pagination: `page`, `pageSize` (max 200)

Additional params for `/logs`:
- `model`
- `provider`
- `status`
- `sessionId`
- `sessionType`

---

## Deprecated / Removed Endpoints

The following endpoints are **not present in the current backend implementation**:

- `POST /adapters/register` (replaced by `/v1/mcp-adapters`)
- `POST /webhooks` (no route in current backend)
- `GET /auth/stats` (replaced by `GET /v1/auth/logs/statistics`)
- `GET /auth/api-keys/{keyId}/stats` (not implemented)
- `POST /auth/api-keys/{keyId}/logs/export` (export entry is now `POST /v1/auth/logs/export`)

---

## Full Endpoint List (Auto-verified)

The following list is extracted from route source files automatically (including health/meta endpoints):

- `GET /api`
- `GET /health`
- `GET /ping`
- `GET /v1/ai/usage/feedback`
- `GET /v1/ai/usage/logs`
- `GET /v1/ai/usage/sessions`
- `GET /v1/ai/usage/statistics`
- `GET /v1/auth/api-keys`
- `POST /v1/auth/api-keys`
- `DELETE /v1/auth/api-keys/:id`
- `GET /v1/auth/api-keys/:id`
- `PATCH /v1/auth/api-keys/:id`
- `POST /v1/auth/api-keys/:id/disable`
- `POST /v1/auth/api-keys/:id/enable`
- `GET /v1/auth/api-keys/:id/logs`
- `POST /v1/auth/api-keys/:id/regenerate`
- `POST /v1/auth/api-keys/:id/toggle`
- `GET /v1/auth/api-keys/:keyId/logs`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/auth/logs`
- `POST /v1/auth/logs/export`
- `GET /v1/auth/logs/exports/:exportId`
- `GET /v1/auth/logs/exports/:exportId/download`
- `GET /v1/auth/logs/statistics`
- `GET /v1/auth/me`
- `GET /v1/auth/oauth/:provider/authorize`
- `GET /v1/auth/oauth/:provider/callback`
- `POST /v1/auth/refresh`
- `POST /v1/auth/register`
- `GET /v1/categories`
- `POST /v1/categories`
- `DELETE /v1/categories/:id`
- `PUT /v1/categories/:id`
- `GET /v1/categories/prompt`
- `PUT /v1/categories/prompt`
- `POST /v1/categories/prompt/generate`
- `POST /v1/categories/prompt/reset`
- `POST /v1/categories/prompt/rollback`
- `GET /v1/health`
- `GET /v1/inbox`
- `POST /v1/inbox`
- `DELETE /v1/inbox/:id`
- `GET /v1/inbox/:id`
- `PUT /v1/inbox/:id`
- `GET /v1/inbox/:id/file`
- `GET /v1/inbox/:id/file/:index`
- `GET /v1/inbox/:id/file/:index/download`
- `GET /v1/inbox/:id/file/download`
- `POST /v1/inbox/:id/reclassify`
- `POST /v1/inbox/:id/retry`
- `GET /v1/inbox/:id/routing-progress`
- `POST /v1/inbox/batch`
- `POST /v1/inbox/batch-redistribute`
- `GET /v1/inbox/batch-redistribute/status`
- `POST /v1/inbox/file`
- `POST /v1/inbox/files`
- `GET /v1/inbox/search`
- `GET /v1/inbox/sources`
- `GET /v1/intelligence/parse/:id`
- `PATCH /v1/intelligence/parse/:id`
- `GET /v1/intelligence/prompts`
- `POST /v1/intelligence/prompts`
- `DELETE /v1/intelligence/prompts/:id`
- `GET /v1/intelligence/prompts/:id`
- `PUT /v1/intelligence/prompts/:id`
- `GET /v1/mcp-adapters`
- `POST /v1/mcp-adapters`
- `DELETE /v1/mcp-adapters/:id`
- `GET /v1/mcp-adapters/:id`
- `PUT /v1/mcp-adapters/:id`
- `POST /v1/mcp-adapters/:id/test`
- `GET /v1/mcp-adapters/:id/tools`
- `POST /v1/routing/connectors/test`
- `POST /v1/routing/dispatch/:id`
- `GET /v1/routing/rules`
- `POST /v1/routing/rules`
- `DELETE /v1/routing/rules/:id`
- `GET /v1/routing/rules/:id`
- `PUT /v1/routing/rules/:id`
- `POST /v1/routing/rules/:id/test`
- `POST /v1/routing/rules/test-dispatch`
- `GET /v1/settings/llm`
- `PUT /v1/settings/llm`
- `GET /v1/settings/logs`
- `GET /v1/settings/statistics`
- `GET /v1/settings/timezone`
- `PUT /v1/settings/timezone`

---

## Maintenance Notes

- After code changes, update this file first, then downstream docs.
- Before release, run a route extraction diff to ensure doc-to-code alignment.
- If an OpenAPI spec is introduced later, make it the single source of truth.
