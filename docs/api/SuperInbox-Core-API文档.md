# SuperInbox Core API 文档（当前实现）

**版本：** v0.1.0（与后端运行版本一致）  
**最后更新：** 2026-02-08  
**维护状态：** Active

> 本文档已按当前后端代码逐项核对。若与其他历史文档冲突，请以以下源码为准：
> `backend/src/index.ts`、`backend/src/**/routes/*.ts`、`backend/src/**/controllers/*.ts`。

---

## 目录

1. [基础信息](#基础信息)
2. [认证与权限](#认证与权限)
3. [健康检查与服务信息](#健康检查与服务信息)
4. [认证 API（JWT）](#认证-apijwt)
5. [API Key 管理](#api-key-管理)
6. [Inbox API](#inbox-api)
7. [Intelligence API](#intelligence-api)
8. [分类管理 API](#分类管理-api)
9. [路由与分发 API](#路由与分发-api)
10. [MCP 适配器 API](#mcp-适配器-api)
11. [设置 API](#设置-api)
12. [访问日志与导出 API](#访问日志与导出-api)
13. [LLM 使用统计 API](#llm-使用统计-api)
14. [完整接口清单（自动核对）](#完整接口清单自动核对)

---

## 基础信息

### Base URL

- 本地开发：`http://localhost:3000`
- API 前缀：`/v1`

### Content-Type

- JSON 接口：`application/json`
- 上传接口：`multipart/form-data`
- SSE 接口：`text/event-stream`

### 标准响应格式

成功响应通常为：

```json
{
  "success": true,
  "data": {}
}
```

错误响应统一由 `sendError` 生成：

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

## 认证与权限

当前服务支持两类身份：

1. **JWT 用户令牌**（登录后获得）
2. **API Key**（通过 JWT 登录后创建）

### 令牌传递方式

- HTTP Header（推荐）：`Authorization: Bearer <token_or_api_key>`
- Cookie（JWT）：`superinbox_auth_token`
- SSE 场景可通过 query 传 token：`?token=...`

### 作用域（Scopes）

- 代码中存在作用域检查能力（如 `admin:full`、`content:all`）。
- 当前多数业务路由主要依赖“是否登录/是否有有效 key”。
- 管理类接口（尤其访问日志统计）依赖 `admin:full`。

---

## 健康检查与服务信息

### `GET /health`
基础健康检查。

### `GET /v1/health`
同上，`/v1` 前缀版本。

### `GET /ping`
返回 `{"pong": true}`。

### `GET /api`
返回服务名称、版本、基础端点信息。

---

## 认证 API（JWT）

> 路由前缀：`/v1/auth`

### `POST /v1/auth/register`
注册账号。

请求体：

```json
{
  "username": "demo",
  "email": "demo@example.com",
  "password": "123456"
}
```

返回：用户信息 + `token` + `refreshToken`，并写入 cookie。

### `POST /v1/auth/login`
账号登录。

请求体：

```json
{
  "username": "demo",
  "password": "123456"
}
```

### `POST /v1/auth/refresh`
刷新访问令牌。

请求体：

```json
{
  "refreshToken": "..."
}
```

### `POST /v1/auth/logout`
退出登录（依赖 refresh token cookie）。

### `GET /v1/auth/me`
获取当前登录用户信息。

---

## API Key 管理

> 路由前缀：`/v1/auth/api-keys`  
> 该模块要求 **JWT 身份**（`authenticateJwt`）

### `POST /v1/auth/api-keys`
创建 API Key。

请求体：

```json
{
  "name": "My Integration",
  "scopes": ["inbox:read", "inbox:write", "content:all"]
}
```

说明：
- `scopes` 必填且必须是非空数组。
- 创建成功后只会返回一次完整 `apiKey`。

### `GET /v1/auth/api-keys`
列出当前用户 API Keys（仅返回 `keyPreview`，不返回完整 key）。

### `GET /v1/auth/api-keys/:id`
查看单个 API Key 元信息。

### `PATCH /v1/auth/api-keys/:id`
更新 `name` 和/或 `scopes`。

### `POST /v1/auth/api-keys/:id/disable`
禁用 key。

### `POST /v1/auth/api-keys/:id/enable`
启用 key。

### `POST /v1/auth/api-keys/:id/toggle`
兼容旧版的开关接口（需传 `isActive: boolean`）。

### `POST /v1/auth/api-keys/:id/regenerate`
重置 key，返回新的完整 `apiKey`（同样仅一次）。

### `DELETE /v1/auth/api-keys/:id`
删除 key。

### `GET /v1/auth/api-keys/:id/logs`
查询该 key 的访问日志（分页参数：`limit`、`offset`）。

---

## Inbox API

> 路由前缀：`/v1/inbox`

### 1) 创建与查询

#### `POST /v1/inbox`
创建单条文本/URL记录。

请求体：

```json
{
  "content": "打车花了30元",
  "type": "text",
  "source": "ios",
  "metadata": {}
}
```

字段约束：
- `content` 必填，1-10000 字符。
- `type` 可选：`text | image | url | audio | file | mixed`。

#### `GET /v1/inbox`
分页查询。

支持参数（以代码为准）：
- 分页：`page`、`limit`、`offset`
- 筛选：`status`、`category`、`source`、`query`、`hastype`
- 时间：`since`、`startDate`、`endDate`
- 排序：`sortBy`、`sortOrder`

#### `GET /v1/inbox/search`
关键字搜索。

参数：
- `q`（必填）
- `category`（可选）
- `limit`（可选，最大 100）

#### `GET /v1/inbox/sources`
返回当前用户已使用过的 source 列表。

#### `GET /v1/inbox/:id`
查询单条记录详情（含解析结果、分发历史、路由状态等）。

#### `PUT /v1/inbox/:id`
更新记录字段。

请求体支持：
- `content`
- `category`
- `status`（`pending | processing | completed | failed | archived`）

#### `DELETE /v1/inbox/:id`
删除记录。

### 2) 批量与上传

#### `POST /v1/inbox/batch`
批量创建。

请求体：

```json
{
  "entries": [
    { "content": "A" },
    { "content": "B", "source": "telegram" }
  ]
}
```

#### `POST /v1/inbox/file`
单文件上传，字段：
- `file`（必填）
- `content`（可选）
- `source`（可选）

#### `POST /v1/inbox/files`
多文件上传，字段：
- `files`（必填，数组）
- `content`（可选）
- `source`（可选）

上传限制（由上传中间件控制）：
- 允许常见图片、PDF、Markdown、文本、zip、音频、视频 MIME。
- 默认最大单文件大小：`config.storage.maxUploadSize`（默认 100MB）。
- 默认最大文件数：`config.storage.maxUploadFiles`（默认 20）。

### 3) 文件访问与 AI 重试

#### `GET /v1/inbox/:id/file`
读取主文件（inline）。

#### `GET /v1/inbox/:id/file/:index`
读取多文件中的指定文件。

#### `GET /v1/inbox/:id/file/download`
下载主文件。

#### `GET /v1/inbox/:id/file/:index/download`
下载指定索引文件。

#### `POST /v1/inbox/:id/retry`
仅当记录状态为 `failed` 时可触发 AI 重试。

#### `POST /v1/inbox/:id/reclassify`
无论成功/失败都可触发重新分类（处理中状态除外）。

### 4) 路由进度

#### `GET /v1/inbox/:id/routing-progress`
SSE 实时流。

常见事件类型（实际发送值）：
- `routing:start`
- `routing:rule-matched`
- `routing:dispatching`
- `routing:dispatched`
- `routing:complete`
- `routing:failed`
- `routing:skipped`
- `ai.completed`
- `ai.failed`

### 5) 批量重分发

#### `POST /v1/inbox/batch-redistribute`
按过滤条件批量重新分发。

请求体可选：

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
查看最近重分发统计。

---

## Intelligence API

> 路由前缀：`/v1/intelligence`

### Parse 结果

#### `GET /v1/intelligence/parse/:id`
获取 AI 解析结果。

#### `PATCH /v1/intelligence/parse/:id`
人工修正解析。

请求体：

```json
{
  "category": "expense",
  "entities": { "amount": 30, "currency": "CNY" },
  "feedback": "识别正确，只修正币种"
}
```

### Prompt 模板（当前为占位实现）

以下接口当前返回 mock / 占位数据，用于前端联调：
- `GET /v1/intelligence/prompts`
- `GET /v1/intelligence/prompts/:id`
- `POST /v1/intelligence/prompts`
- `PUT /v1/intelligence/prompts/:id`
- `DELETE /v1/intelligence/prompts/:id`

---

## 分类管理 API

> 路由前缀：`/v1/categories`

### 分类 CRUD

- `GET /v1/categories`
- `POST /v1/categories`
- `PUT /v1/categories/:id`
- `DELETE /v1/categories/:id`

`POST /v1/categories` 关键字段：
- 必填：`key`、`name`
- 可选：`description`、`examples`、`icon`、`color`、`sortOrder`、`isActive`

### 分类 Prompt 管理

- `GET /v1/categories/prompt`
- `PUT /v1/categories/prompt`
- `POST /v1/categories/prompt/generate`
- `POST /v1/categories/prompt/reset`
- `POST /v1/categories/prompt/rollback`

`POST /v1/categories/prompt/generate` 请求体：

```json
{
  "mode": "low_cost",
  "requirement": "可选，自定义模式必填",
  "language": "zh-CN"
}
```

`mode` 允许值：`low_cost | high_precision | custom`。

---

## 路由与分发 API

> 路由前缀：`/v1/routing`

### 规则管理

- `GET /v1/routing/rules`
- `GET /v1/routing/rules/:id`
- `POST /v1/routing/rules`
- `PUT /v1/routing/rules/:id`
- `DELETE /v1/routing/rules/:id`

`POST /v1/routing/rules` 必填：
- `name`（string）
- `conditions`（array）
- `actions`（array）

### 规则调试与手动分发

#### `POST /v1/routing/rules/:id/test`
当前返回占位测试结果（`matched: true`）。

#### `POST /v1/routing/dispatch/:id`
手动触发指定 item 的分发。

请求体可选：

```json
{
  "adapters": ["mcp"],
  "force": false
}
```

#### `POST /v1/routing/connectors/test`
测试一组 MCP server 连接。

请求体结构：

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
SSE 流式调试分发（响应为 `text/event-stream`）。

请求体关键字段：
- `content`（必填）
- `mcpAdapterId`（必填）
- `instructions`（必填）
- `toolName`（可选）
- `params`（可选）

---

## MCP 适配器 API

> 路由前缀：`/v1/mcp-adapters`

### 基础 CRUD

- `GET /v1/mcp-adapters`
- `GET /v1/mcp-adapters/:id`
- `POST /v1/mcp-adapters`
- `PUT /v1/mcp-adapters/:id`
- `DELETE /v1/mcp-adapters/:id`

创建时常用字段：
- 基础：`name`、`serverType`、`serverUrl`
- 传输：`transportType`（`http`/`stdio`）、`command`、`env`
- 鉴权：`authType`（`api_key`/`oauth`/`none`）、`apiKey`、`oauthAccessToken`
- LLM：`llmProvider`、`llmApiKey`、`llmModel`、`llmBaseUrl`
- 运行：`timeout`、`maxRetries`、`cacheTtl`、`enabled`

### 检测与工具发现

- `POST /v1/mcp-adapters/:id/test`：连通性与鉴权检查
- `GET /v1/mcp-adapters/:id/tools`：拉取工具清单（`name`、`description`）

---

## 设置 API

> 路由前缀：`/v1/settings`

- `GET /v1/settings/statistics`：系统统计
- `GET /v1/settings/timezone`：获取当前用户时区
- `PUT /v1/settings/timezone`：更新时区
- `GET /v1/settings/llm`：获取用户 LLM 配置（合并默认值）
- `PUT /v1/settings/llm`：更新用户 LLM 配置
- `GET /v1/settings/logs`：**已废弃**，仅返回空日志及废弃提示

`PUT /v1/settings/llm` 支持字段：
- `provider`
- `model`
- `baseUrl`
- `apiKey`
- `timeout`
- `maxTokens`

---

## 访问日志与导出 API

> 路由前缀：`/v1/auth`

### 查询日志

- `GET /v1/auth/logs`（admin）
- `GET /v1/auth/api-keys/:keyId/logs`

查询参数：
- `startDate`
- `endDate`
- `method`（支持多个）
- `endpoint`
- `status`（`success | error | denied`）
- `page`
- `limit`（最大 200）

### 导出

- `POST /v1/auth/logs/export`
- `GET /v1/auth/logs/exports/:exportId`
- `GET /v1/auth/logs/exports/:exportId/download`

创建导出请求体：

```json
{
  "format": "csv",
  "startDate": "2026-01-01T00:00:00.000Z",
  "endDate": "2026-01-31T23:59:59.999Z",
  "includeFields": ["timestamp", "method", "endpoint", "status"]
}
```

`format` 允许：`csv | json | xlsx`（xlsx 当前会回退到 csv 写出逻辑）。

### 统计

- `GET /v1/auth/logs/statistics`（admin）

参数：
- `timeRange`（`today | week | month | all`）
- `startDate`
- `endDate`

---

## LLM 使用统计 API

> 路由前缀：`/v1/ai/usage`

- `GET /v1/ai/usage/statistics`
- `GET /v1/ai/usage/logs`
- `GET /v1/ai/usage/sessions`
- `GET /v1/ai/usage/feedback`

通用参数：
- `userId`（仅 admin 可查他人）
- `startDate`
- `endDate`
- 分页：`page`、`pageSize`（最大 200）

`/logs` 额外支持：`model`、`provider`、`status`、`sessionId`、`sessionType`。

---

## 完整接口清单（自动核对）

以下清单由路由源码自动提取（含 `/v1` 前缀与健康检查接口）：

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

## 维护说明

- 代码变更后，请优先更新本文件，再更新其他对外文档。
- 建议每次发布前执行一次“路由提取对比”，确保文档与代码一致。
- 若未来新增 OpenAPI 规范文件，请将该规范设为唯一真相源（single source of truth）。
