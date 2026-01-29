# SuperInbox Core API 文档

**版本：** v1.0.0  
**最后更新：** 2026-01-15

## 目录

1. [概述](#概述)
2. [认证与安全](#认证与安全)
   - [API Key 认证](#api-key-认证)
   - [权限范围 (Scopes)](#权限范围-scopes)
3. [Inbox API](#inbox-api)
   - [创建记录](#1-创建记录)
   - [批量创建记录](#2-批量创建记录)
   - [查询记录列表](#3-查询记录列表)
   - [获取单条记录](#4-获取单条记录)
   - [搜索记录](#5-搜索记录)
   - [删除记录](#6-删除记录)
4. [AI 处理引擎 API](#ai-处理引擎-api)
   - [获取解析结果](#1-获取解析结果)
   - [修正解析结果](#2-修正解析结果)
   - [配置 Prompt 模板](#3-配置-prompt-模板)
5. [分发路由层 API](#分发路由层-api)
   - [获取路由规则](#1-获取路由规则)
   - [创建路由规则](#2-创建路由规则)
   - [更新路由规则](#3-更新路由规则)
   - [删除路由规则](#4-删除路由规则)
   - [手动触发分发](#5-手动触发分发)
6. [适配器接口规范](#适配器接口规范)
   - [IAdapter 接口定义](#iadapter-接口定义)
   - [数据类型定义](#数据类型定义)
   - [内置适配器](#内置适配器)
   - [注册自定义适配器](#注册自定义适配器)
7. [API Key 管理](#api-key-管理)
   - [创建 API Key](#1-创建-api-key)
   - [列出所有 API Keys](#2-列出所有-api-keys)
   - [获取单个 API Key 详情](#3-获取单个-api-key-详情)
   - [更新 API Key](#4-更新-api-key)
   - [禁用 API Key](#5-禁用-api-key)
   - [启用 API Key](#6-启用-api-key)
   - [重新生成 API Key](#7-重新生成-api-key)
   - [删除 API Key](#8-删除-api-key)
8. [API 访问日志与审计](#api-访问日志与审计)
   - [查询 API 访问日志](#1-查询-api-访问日志)
   - [查询全局访问日志](#2-查询全局访问日志需要管理员权限)
   - [导出访问日志](#3-导出访问日志)
   - [获取导出任务状态](#4-获取导出任务状态)
   - [下载导出文件](#5-下载导出文件)
9. [API 使用统计](#api-使用统计)
   - [获取 API Key 使用统计](#1-获取-api-key-使用统计)
   - [获取全局使用统计](#2-获取全局使用统计需要管理员权限)
10. [错误码说明](#错误码说明)
11. [Webhook 事件](#webhook-事件)
    - [配置 Webhook](#配置-webhook)
    - [事件类型](#事件类型)
    - [Webhook 签名验证](#webhook-签名验证)
12. [SDK 使用示例](#sdk-使用示例)
    - [JavaScript/TypeScript SDK](#javascripttypescript-sdk)
    - [Python SDK](#python-sdk)
13. [附录](#附录)
    - [支持的意图类型](#a-支持的意图类型)
    - [环境变量配置](#b-环境变量配置)
    - [Docker 部署](#c-docker-部署)

---

## 概述

SuperInbox Core 是一个开源的全渠道智能信息收纳与路由系统。本文档描述了核心模块的 RESTful API 接口、SDK 接口以及扩展规范。

### 基础信息

- **Base URL (本地部署):** `http://localhost:3000/api/v1`
- **Content-Type:** `application/json`
- **字符编码:** UTF-8

---

## 认证与安全

### API Key 认证

所有 API 请求需要在 Header 中携带 API Key：

```http
Authorization: Bearer YOUR_API_KEY
```

### 权限范围 (Scopes)

SuperInbox 支持细粒度的权限控制，每个 API Key 可以配置不同的访问范围：

#### 基础权限

| Scope | 说明 |
|-------|------|
| `inbox:write` | 创建新记录 |
| `inbox:read` | 读取记录列表和详情 |
| `inbox:delete` | 删除记录 |
| `intelligence:read` | 读取 AI 解析结果 |
| `intelligence:write` | 修正 AI 解析结果 |
| `routing:read` | 读取路由规则 |
| `routing:write` | 创建和修改路由规则 |
| `admin:full` | 完整管理权限（包括 API Key 管理） |

#### 内容分类权限

可以限制 API Key 只能访问特定意图类型的数据：

| Scope | 说明 |
|-------|------|
| `content:todo` | 只能访问待办类型 |
| `content:finance` | 只能访问账务类型 |
| `content:idea` | 只能访问灵感类型 |
| `content:log` | 只能访问记录类型 |
| `content:link` | 只能访问收藏类型 |
| `content:habit` | 只能访问习惯打卡类型 |
| `content:all` | 可以访问所有类型 |

**注意：** 如果未指定任何 `content:*` 权限，默认为 `content:all`。

#### 权限组合示例

```json
{
  "scopes": [
    "inbox:read",
    "content:idea",
    "content:link"
  ]
}
```
上述配置表示：该 API Key 只能读取"灵感"和"收藏"类型的记录，无法访问账务等其他类型。

---

## Inbox API

所有与收件箱相关的操作，包括创建、查询、搜索和删除记录。

### 1. 创建记录

接收用户输入的原始信息，支持纯文本、文件或混合提交。

```http
POST /inbox
```

**支持两种 Content-Type：**

#### 方式 A：JSON 格式（推荐用于纯文本/URL）

**Content-Type:** `application/json`

```json
{
  "content": "打车花了 30 元",
  "source": "telegram"
}
```

**参数说明：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 文字内容或 URL |
| source | string | 否 | 来源标识（如 `telegram`, `ios`, `web`, `raycast`），用于统计和调试 |
| metadata | object | 否 | 扩展元数据，可包含任意自定义字段（如地理位置、设备信息、标签等） |

#### 方式 B：表单格式（用于文件上传或统一接口）

**Content-Type:** `multipart/form-data`

**表单字段：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 否 | 文字内容或 URL |
| file | file | 否 | 文件（图片、PDF、音频等），可多个 |
| source | string | 否 | 来源标识 |
| metadata | string | 否 | JSON 格式的扩展元数据字符串 |

**注意：** `content` 和 `file` 至少提供一个。

**示例 1 - 纯文本（两种方式等价）：**

```bash
# JSON 方式（更简洁）
curl -X POST http://localhost:3000/api/v1/inbox \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"打车花了 30 元","source":"ios"}'

# 表单方式
curl -X POST http://localhost:3000/api/v1/inbox \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "content=打车花了 30 元" \
  -F "source=ios"
```

**示例 2 - 文件+文字：**

```bash
curl -X POST http://localhost:3000/api/v1/inbox \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@receipt.jpg" \
  -F "content=今天的打车发票" \
  -F "source=ios"
```

**示例 3 - 纯文件：**

```bash
curl -X POST http://localhost:3000/api/v1/inbox \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@screenshot.png"
```

**响应：**

```json
{
  "id": "entry_abc123",
  "status": "processing",
  "message": "记录已接收，正在处理中",
  "files": [
    {
      "fileId": "file_xyz789",
      "fileName": "receipt.jpg",
      "fileSize": 245678,
      "mimeType": "image/jpeg",
      "url": "/files/file_xyz789"
    }
  ],
  "createdAt": "2026-01-15T10:30:00Z"
}
```

### 2. 批量创建记录

用于一次性提交多条记录，支持文本、URL 和文件混合提交。

```http
POST /inbox/batch
```

#### 场景 A：纯文本/URL 批量提交

**Content-Type:** `application/json`

```json
{
  "entries": [
    {
      "content": "明天下午3点开会",
      "source": "web",
      "metadata": {}
    },
    {
      "content": "https://example.com/article",
      "source": "web"
    }
  ]
}
```

**entries 数组中每个对象的字段：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 文字内容或 URL |
| source | string | 否 | 来源标识 |
| metadata | object | 否 | 扩展元数据 |

#### 场景 B：包含文件的批量提交

**Content-Type:** `multipart/form-data`

**表单字段：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| entries | string | 是 | JSON 字符串，包含所有记录的元数据 |
| file_0, file_1, ... | file | 否 | 文件内容，字段名对应 entries 中的索引 |

**示例：**

```bash
curl -X POST http://localhost:3000/api/v1/inbox/batch \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F 'entries=[
    {"content":"今天的发票","fileIndex":0,"source":"ios"},
    {"content":"明天下午3点开会","source":"ios"},
    {"content":"https://example.com/article"},
    {"content":"会议记录","fileIndex":1}
  ]' \
  -F "file_0=@receipt.jpg" \
  -F "file_1=@meeting-notes.pdf"
```

**entries 字段说明：**
- `content`：必填，文字内容或 URL
- `source`：可选，来源标识
- `metadata`：可选，扩展元数据（JSON 对象）
- `fileIndex`：可选，指向对应的文件字段（file_0, file_1...）

**响应：**

```json
{
  "total": 4,
  "succeeded": 4,
  "failed": 0,
  "entries": [
    {
      "id": "entry_abc123",
      "status": "processing",
      "files": [{"fileId": "file_xyz789", "fileName": "receipt.jpg"}]
    },
    {
      "id": "entry_abc124",
      "status": "processing",
      "files": []
    },
    {
      "id": "entry_abc125",
      "status": "processing",
      "files": []
    },
    {
      "id": "entry_abc126",
      "status": "processing",
      "files": [{"fileId": "file_xyz790", "fileName": "meeting-notes.pdf"}]
    }
  ]
}
```

### 3. 查询记录列表

```http
GET /inbox
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，默认 1 |
| limit | integer | 每页数量，默认 20，最大 100 |
| intent | string | 按意图筛选：`expense`, `todo`, `idea`, `link` |
| source | string | 按来源筛选 |
| startDate | string | 开始日期 (ISO 8601) |
| endDate | string | 结束日期 (ISO 8601) |
| status | string | 处理状态：`processing`, `completed`, `failed` |

**示例：**

```http
GET /inbox?intent=expense&limit=10&page=1
```

**响应：**

```json
{
  "total": 156,
  "page": 1,
  "limit": 10,
  "entries": [
    {
      "id": "entry_abc123",
      "content": "打车花了 30 元",
      "source": "telegram",
      "intent": "expense",
      "entities": {
        "amount": 30,
        "currency": "CNY",
        "category": "交通"
      },
      "status": "completed",
      "createdAt": "2026-01-15T10:30:00Z",
      "routedTo": ["notion"]
    }
  ]
}
```

### 4. 获取单条记录

```http
GET /inbox/{entryId}
```

**响应：**

```json
{
  "id": "entry_abc123",
  "content": "打车花了 30 元",
  "source": "telegram",
  "parsed": {
    "intent": "expense",
    "confidence": 0.95,
    "entities": {
      "amount": 30,
      "currency": "CNY",
      "category": "交通"
    }
  },
  "routingHistory": [
    {
      "adapter": "notion",
      "status": "success",
      "timestamp": "2026-01-15T10:30:10Z"
    }
  ],
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T10:30:10Z"
}
```

### 5. 搜索记录

```http
GET /inbox/search
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| q | string | 搜索关键词 |
| intent | string | 意图筛选 |
| limit | integer | 结果数量 |

**示例：**

```http
GET /inbox/search?q=打车&intent=expense
```

### 6. 删除记录

```http
DELETE /inbox/{entryId}
```

**响应：**

```json
{
  "success": true,
  "message": "记录已删除"
}
```

---

## AI 处理引擎 API

### 1. 获取解析结果

```http
GET /intelligence/parse/{entryId}
```

**响应：**

```json
{
  "entryId": "entry_abc123",
  "originalContent": "打车花了 30 元",
  "parsed": {
    "intent": "expense",
    "confidence": 0.95,
    "entities": {
      "amount": 30,
      "currency": "CNY",
      "category": "交通"
    }
  },
  "parsedAt": "2026-01-15T10:30:05Z"
}
```

### 2. 修正解析结果

用户手动修正 AI 识别结果，系统将学习用户偏好。

```http
PATCH /intelligence/parse/{entryId}
```

**请求体：**

```json
{
  "intent": "expense",
  "entities": {
    "amount": 30,
    "currency": "CNY",
    "category": "餐饮"
  },
  "feedback": "这是餐饮消费，不是交通"
}
```

**响应：**

```json
{
  "success": true,
  "message": "已更新解析结果并记录反馈",
  "updatedAt": "2026-01-15T10:35:00Z"
}
```

### 3. 配置 Prompt 模板

```http
GET /intelligence/prompts
```

**响应：**

```json
{
  "prompts": [
    {
      "id": "prompt_expense",
      "name": "账单识别",
      "intent": "expense",
      "template": "从以下文本中提取消费信息...",
      "isActive": true
    },
    {
      "id": "prompt_todo",
      "name": "待办识别",
      "intent": "todo",
      "template": "识别任务和截止时间...",
      "isActive": true
    }
  ]
}
```

```http
PUT /intelligence/prompts/{promptId}
```

**请求体：**

```json
{
  "template": "自定义的 Prompt 模板内容",
  "isActive": true
}
```

---

## 分发路由层 API

### 1. 获取路由规则

```http
GET /routing/rules
```

**响应：**

```json
{
  "rules": [
    {
      "id": "rule_001",
      "name": "账单同步到 Notion",
      "condition": {
        "intent": "expense"
      },
      "actions": [
        {
          "adapter": "notion",
          "config": {
            "databaseId": "abc123",
            "mapping": {
              "amount": "金额",
              "category": "分类"
            }
          }
        }
      ],
      "isActive": true,
      "priority": 1
    }
  ]
}
```

### 2. 创建路由规则

```http
POST /routing/rules
```

**请求体：**

```json
{
  "name": "灵感同步到 Obsidian",
  "condition": {
    "intent": "idea"
  },
  "actions": [
    {
      "adapter": "obsidian",
      "config": {
        "vault": "MyVault",
        "folder": "Ideas",
        "template": "idea-template.md"
      }
    }
  ],
  "isActive": true,
  "priority": 2
}
```

**响应：**

```json
{
  "id": "rule_002",
  "name": "灵感同步到 Obsidian",
  "isActive": true,
  "createdAt": "2026-01-15T11:00:00Z"
}
```

### 3. 更新路由规则

```http
PUT /routing/rules/{ruleId}
```

**请求体：**

```json
{
  "name": "更新后的规则名称",
  "condition": {
    "intent": "expense",
    "entities": {
      "amount": { "$gt": 100 }
    }
  },
  "actions": [
    {
      "adapter": "notion",
      "config": {
        "databaseId": "abc123"
      }
    }
  ],
  "isActive": true,
  "priority": 1
}
```

**响应：**

```json
{
  "success": true,
  "message": "路由规则已更新",
  "updatedAt": "2026-01-15T11:05:00Z"
}
```

### 4. 删除路由规则

```http
DELETE /routing/rules/{ruleId}
```

**响应：**

```json
{
  "success": true,
  "message": "路由规则已删除"
}
```

### 5. 手动触发分发

对已存在的记录手动触发分发。

```http
POST /routing/dispatch/{entryId}
```

**请求体（可选）：**

```json
{
  "adapters": ["notion", "webhook"],
  "force": true
}
```

**响应：**

```json
{
  "entryId": "entry_abc123",
  "dispatched": [
    {
      "adapter": "notion",
      "status": "success",
      "message": "已同步到 Notion"
    },
    {
      "adapter": "webhook",
      "status": "success",
      "message": "Webhook 已触发"
    }
  ]
}
```

---

## 适配器接口规范

### IAdapter 接口定义

所有适配器必须实现以下接口：

```typescript
interface IAdapter {
  /**
   * 适配器唯一标识
   */
  readonly id: string;
  
  /**
   * 适配器显示名称
   */
  readonly name: string;
  
  /**
   * 适配器版本
   */
  readonly version: string;
  
  /**
   * 验证配置是否有效
   */
  validate(config: AdapterConfig): Promise<ValidationResult>;
  
  /**
   * 发送数据到目标平台
   */
  send(entry: ParsedEntry, config: AdapterConfig): Promise<SendResult>;
  
  /**
   * 测试连接
   */
  testConnection(config: AdapterConfig): Promise<boolean>;
  
  /**
   * 获取配置模板
   */
  getConfigSchema(): ConfigSchema;
}
```

### 数据类型定义

```typescript
interface ParsedEntry {
  id: string;
  content: string;
  type: 'text' | 'image' | 'url' | 'file';
  intent: string;
  entities: Record<string, any>;
  metadata?: Record<string, any>;
}

interface AdapterConfig {
  [key: string]: any;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

interface SendResult {
  success: boolean;
  message?: string;
  externalId?: string;
  error?: string;
}

interface ConfigSchema {
  fields: ConfigField[];
}

interface ConfigField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  required: boolean;
  description?: string;
  options?: Array<{ label: string; value: any }>;
}
```

### 内置适配器

#### 1. Notion Adapter

**配置参数：**

```json
{
  "apiToken": "secret_xxx",
  "databaseId": "abc123",
  "mapping": {
    "amount": "金额",
    "category": "分类",
    "date": "日期"
  }
}
```

#### 2. Obsidian Adapter

**配置参数：**

```json
{
  "vault": "MyVault",
  "folder": "Inbox",
  "template": "default-template.md",
  "fileNamePattern": "{{date}}-{{title}}.md"
}
```

#### 3. Webhook Adapter

**配置参数：**

```json
{
  "url": "https://example.com/webhook",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer token"
  },
  "bodyTemplate": "{{json}}"
}
```

### 注册自定义适配器

```http
POST /adapters/register
```

**请求体：**

```json
{
  "id": "my-custom-adapter",
  "name": "My Custom Adapter",
  "version": "1.0.0",
  "endpoint": "http://localhost:4000/adapter",
  "configSchema": {
    "fields": [
      {
        "name": "apiKey",
        "type": "string",
        "label": "API Key",
        "required": true
      }
    ]
  }
}
```

---

## API Key 管理

### 1. 创建 API Key

```http
POST /auth/api-keys
```

**请求体：**

```json
{
  "name": "My iOS Shortcut",
  "description": "用于 iOS 快捷指令的写入权限",
  "scopes": ["inbox:write", "content:all"],
  "accessControl": {
    "allowedIntents": ["todo", "finance", "idea"],
    "deniedIntents": [],
    "allowedTags": [],
    "deniedTags": ["private", "confidential"],
    "rateLimit": {
      "requestsPerMinute": 60,
      "requestsPerDay": 1000
    }
  },
  "expiresAt": "2027-01-15T00:00:00Z"
}
```

**参数说明：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | API Key 名称 |
| description | string | 否 | 描述信息 |
| scopes | string[] | 是 | 权限范围列表 |
| accessControl | object | 否 | 访问控制配置 |
| accessControl.allowedIntents | string[] | 否 | 白名单：允许访问的意图类型（为空表示不限制） |
| accessControl.deniedIntents | string[] | 否 | 黑名单：禁止访问的意图类型 |
| accessControl.allowedTags | string[] | 否 | 白名单：允许访问的标签（为空表示不限制） |
| accessControl.deniedTags | string[] | 否 | 黑名单：禁止访问的标签 |
| accessControl.rateLimit | object | 否 | 速率限制配置 |
| expiresAt | string | 否 | 过期时间（ISO 8601 格式），不设置则永不过期 |

**访问控制逻辑：**
1. 如果设置了 `allowedIntents`，则只能访问白名单内的类型
2. `deniedIntents` 优先级高于 `allowedIntents`
3. 标签过滤同理：先检查白名单，再检查黑名单
4. 黑名单优先级始终最高

**响应：**

```json
{
  "id": "key_abc123",
  "apiKey": "sk_live_abc123def456ghi789...",
  "name": "My iOS Shortcut",
  "description": "用于 iOS 快捷指令的写入权限",
  "scopes": ["inbox:write", "content:all"],
  "accessControl": {
    "allowedIntents": ["todo", "finance", "idea"],
    "deniedIntents": [],
    "allowedTags": [],
    "deniedTags": ["private", "confidential"],
    "rateLimit": {
      "requestsPerMinute": 60,
      "requestsPerDay": 1000
    }
  },
  "status": "active",
  "expiresAt": "2027-01-15T00:00:00Z",
  "createdAt": "2026-01-15T10:30:00Z",
  "lastUsedAt": null
}
```

**安全提示：** `apiKey` 字段仅在创建时返回一次，请妥善保存。后续无法再次查看完整密钥。

### 2. 列出所有 API Keys

```http
GET /auth/api-keys
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 筛选状态：`active`, `disabled`, `expired` |
| page | integer | 页码，默认 1 |
| limit | integer | 每页数量，默认 20 |

**响应：**

```json
{
  "total": 5,
  "page": 1,
  "limit": 20,
  "keys": [
    {
      "id": "key_abc123",
      "name": "My iOS Shortcut",
      "description": "用于 iOS 快捷指令的写入权限",
      "scopes": ["inbox:write", "content:all"],
      "accessControl": {
        "allowedIntents": ["todo", "finance", "idea"],
        "deniedIntents": [],
        "allowedTags": [],
        "deniedTags": ["private", "confidential"]
      },
      "status": "active",
      "prefix": "sk_live_abc123...",
      "expiresAt": "2027-01-15T00:00:00Z",
      "createdAt": "2026-01-15T10:30:00Z",
      "lastUsedAt": "2026-01-15T14:20:00Z",
      "usageStats": {
        "totalRequests": 1523,
        "requestsToday": 45,
        "lastRequestIp": "192.168.1.100"
      }
    }
  ]
}
```

**注意：** 出于安全考虑，列表接口只返回密钥前缀（如 `sk_live_abc123...`），不返回完整密钥。

### 3. 获取单个 API Key 详情

```http
GET /auth/api-keys/{keyId}
```

**响应：**

```json
{
  "id": "key_abc123",
  "name": "My iOS Shortcut",
  "description": "用于 iOS 快捷指令的写入权限",
  "scopes": ["inbox:write", "content:all"],
  "accessControl": {
    "allowedIntents": ["todo", "finance", "idea"],
    "deniedIntents": [],
    "allowedTags": [],
    "deniedTags": ["private", "confidential"],
    "rateLimit": {
      "requestsPerMinute": 60,
      "requestsPerDay": 1000
    }
  },
  "status": "active",
  "prefix": "sk_live_abc123...",
  "expiresAt": "2027-01-15T00:00:00Z",
  "createdAt": "2026-01-15T10:30:00Z",
  "lastUsedAt": "2026-01-15T14:20:00Z",
  "usageStats": {
    "totalRequests": 1523,
    "requestsToday": 45,
    "requestsThisMonth": 8934,
    "lastRequestIp": "192.168.1.100",
    "lastRequestUserAgent": "Shortcuts/1.0"
  }
}
```

### 4. 更新 API Key

```http
PATCH /auth/api-keys/{keyId}
```

**请求体：**

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "scopes": ["inbox:write", "inbox:read", "content:idea"],
  "accessControl": {
    "allowedIntents": ["idea", "link"],
    "deniedTags": ["private"]
  },
  "expiresAt": "2028-01-15T00:00:00Z"
}
```

**注意：** 所有字段均为可选，只更新提供的字段。

**响应：**

```json
{
  "success": true,
  "message": "API Key 已更新",
  "key": {
    "id": "key_abc123",
    "name": "Updated Name",
    "scopes": ["inbox:write", "inbox:read", "content:idea"],
    "updatedAt": "2026-01-15T15:00:00Z"
  }
}
```

### 5. 禁用 API Key

```http
POST /auth/api-keys/{keyId}/disable
```

**响应：**

```json
{
  "success": true,
  "message": "API Key 已禁用",
  "key": {
    "id": "key_abc123",
    "status": "disabled",
    "disabledAt": "2026-01-15T15:10:00Z"
  }
}
```

### 6. 启用 API Key

```http
POST /auth/api-keys/{keyId}/enable
```

**响应：**

```json
{
  "success": true,
  "message": "API Key 已启用",
  "key": {
    "id": "key_abc123",
    "status": "active",
    "enabledAt": "2026-01-15T15:15:00Z"
  }
}
```

### 7. 重新生成 API Key

出于安全考虑，如果怀疑密钥泄露，可以重新生成新的密钥值，同时保留原有配置。

```http
POST /auth/api-keys/{keyId}/regenerate
```

**响应：**

```json
{
  "success": true,
  "message": "API Key 已重新生成，旧密钥已失效",
  "apiKey": "sk_live_new789xyz456...",
  "key": {
    "id": "key_abc123",
    "prefix": "sk_live_new789...",
    "regeneratedAt": "2026-01-15T15:20:00Z"
  }
}
```

**警告：** 旧密钥将立即失效，使用旧密钥的应用将无法访问。

### 8. 删除 API Key

```http
DELETE /auth/api-keys/{keyId}
```

**响应：**

```json
{
  "success": true,
  "message": "API Key 已永久删除",
  "deletedAt": "2026-01-15T15:25:00Z"
}
```

**警告：** 删除操作不可逆，相关的访问日志将被保留用于审计。

---

## API 访问日志与审计

### 1. 查询 API 访问日志

```http
GET /auth/api-keys/{keyId}/logs
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| startDate | string | 开始日期 (ISO 8601) |
| endDate | string | 结束日期 (ISO 8601) |
| method | string | HTTP 方法：`GET`, `POST`, `PUT`, `DELETE` |
| endpoint | string | 接口路径筛选，如 `/inbox` |
| status | string | 响应状态：`success`, `error`, `denied` |
| page | integer | 页码，默认 1 |
| limit | integer | 每页数量，默认 50，最大 200 |

**示例：**

```http
GET /auth/api-keys/key_abc123/logs?startDate=2026-01-01T00:00:00Z&status=success&limit=100
```

**响应：**

```json
{
  "total": 1523,
  "page": 1,
  "limit": 100,
  "logs": [
    {
      "id": "log_xyz789",
      "timestamp": "2026-01-15T14:20:35Z",
      "method": "POST",
      "endpoint": "/api/v1/inbox",
      "status": "success",
      "statusCode": 200,
      "requestSize": 245,
      "responseSize": 512,
      "duration": 1234,
      "ip": "192.168.1.100",
      "userAgent": "Shortcuts/1.0",
      "metadata": {
        "entryId": "entry_abc123",
        "intent": "todo"
      }
    },
    {
      "id": "log_xyz790",
      "timestamp": "2026-01-15T14:18:22Z",
      "method": "GET",
      "endpoint": "/api/v1/inbox",
      "status": "success",
      "statusCode": 200,
      "requestSize": 0,
      "responseSize": 3456,
      "duration": 89,
      "ip": "192.168.1.100",
      "userAgent": "Mozilla/5.0",
      "queryParams": {
        "intent": "idea",
        "limit": "10"
      }
    },
    {
      "id": "log_xyz791",
      "timestamp": "2026-01-15T14:15:10Z",
      "method": "GET",
      "endpoint": "/api/v1/inbox",
      "status": "denied",
      "statusCode": 403,
      "requestSize": 0,
      "responseSize": 156,
      "duration": 12,
      "ip": "192.168.1.100",
      "userAgent": "curl/7.68.0",
      "error": {
        "code": "AUTH_INSUFFICIENT_SCOPE",
        "message": "该 API Key 无权访问 finance 类型的数据"
      }
    }
  ]
}
```

### 2. 查询全局访问日志（需要管理员权限）

```http
GET /auth/logs
```

**查询参数：** 同上，但不限定特定 API Key。

**响应格式：** 同上，但每条日志会额外包含 `apiKeyId` 和 `apiKeyName` 字段。

### 3. 导出访问日志

```http
POST /auth/api-keys/{keyId}/logs/export
```

**请求体：**

```json
{
  "startDate": "2026-01-01T00:00:00Z",
  "endDate": "2026-01-31T23:59:59Z",
  "format": "csv",
  "includeFields": ["timestamp", "method", "endpoint", "status", "ip"]
}
```

**参数说明：**

| 参数 | 类型 | 说明 |
|------|------|------|
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |
| format | string | 导出格式：`csv`, `json`, `xlsx` |
| includeFields | string[] | 要包含的字段列表 |

**响应：**

```json
{
  "success": true,
  "exportId": "export_abc123",
  "status": "processing",
  "message": "导出任务已创建，预计 2 分钟后完成"
}
```

### 4. 获取导出任务状态

```http
GET /auth/logs/exports/{exportId}
```

**响应：**

```json
{
  "exportId": "export_abc123",
  "status": "completed",
  "downloadUrl": "/api/v1/auth/logs/exports/export_abc123/download",
  "fileSize": 2456789,
  "recordCount": 15234,
  "expiresAt": "2026-01-16T15:30:00Z",
  "createdAt": "2026-01-15T15:30:00Z",
  "completedAt": "2026-01-15T15:32:15Z"
}
```

### 5. 下载导出文件

```http
GET /auth/logs/exports/{exportId}/download
```

**响应：** 文件流（CSV/JSON/XLSX）

---

## API 使用统计

### 1. 获取 API Key 使用统计

```http
GET /auth/api-keys/{keyId}/stats
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| period | string | 统计周期：`day`, `week`, `month`, `year` |
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |

**响应：**

```json
{
  "keyId": "key_abc123",
  "period": "month",
  "startDate": "2026-01-01T00:00:00Z",
  "endDate": "2026-01-31T23:59:59Z",
  "summary": {
    "totalRequests": 8934,
    "successfulRequests": 8756,
    "failedRequests": 178,
    "deniedRequests": 23,
    "averageResponseTime": 234,
    "totalDataTransferred": 45678901
  },
  "byEndpoint": [
    {
      "endpoint": "/api/v1/inbox",
      "method": "POST",
      "count": 5234,
      "successRate": 0.98
    },
    {
      "endpoint": "/api/v1/inbox",
      "method": "GET",
      "count": 3456,
      "successRate": 0.99
    }
  ],
  "byIntent": [
    {
      "intent": "todo",
      "count": 3456
    },
    {
      "intent": "idea",
      "count": 2345
    },
    {
      "intent": "finance",
      "count": 1234
    }
  ],
  "byDay": [
    {
      "date": "2026-01-01",
      "requests": 234,
      "successRate": 0.97
    },
    {
      "date": "2026-01-02",
      "requests": 345,
      "successRate": 0.98
    }
  ],
  "topErrors": [
    {
      "code": "AUTH_INSUFFICIENT_SCOPE",
      "count": 15,
      "percentage": 0.17
    },
    {
      "code": "RATE_LIMIT_EXCEEDED",
      "count": 8,
      "percentage": 0.09
    }
  ]
}
```

### 2. 获取全局使用统计（需要管理员权限）

```http
GET /auth/stats
```

**查询参数：** 同上

**响应：** 包含所有 API Keys 的聚合统计数据，格式类似上述响应，但会额外包含 `byApiKey` 字段。

---

## 错误码说明

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `AUTH_INVALID_API_KEY` | 401 | API Key 无效或已过期 |
| `AUTH_API_KEY_DISABLED` | 401 | API Key 已被禁用 |
| `AUTH_API_KEY_EXPIRED` | 401 | API Key 已过期 |
| `AUTH_INSUFFICIENT_SCOPE` | 403 | API Key 权限不足 |
| `AUTH_CONTENT_TYPE_DENIED` | 403 | API Key 无权访问该内容类型 |
| `AUTH_TAG_DENIED` | 403 | API Key 无权访问包含该标签的内容 |
| `AUTH_ADMIN_REQUIRED` | 403 | 需要管理员权限 |
| `INBOX_INVALID_INPUT` | 400 | 输入内容格式错误 |
| `INBOX_FILE_TOO_LARGE` | 413 | 文件大小超过限制 |
| `PARSE_FAILED` | 500 | AI 解析失败 |
| `PARSE_TIMEOUT` | 504 | AI 解析超时 |
| `STORAGE_NOT_FOUND` | 404 | 记录不存在 |
| `ROUTING_NO_RULE_MATCHED` | 422 | 没有匹配的路由规则 |
| `ADAPTER_CONFIG_INVALID` | 400 | 适配器配置无效 |
| `ADAPTER_SEND_FAILED` | 502 | 适配器发送失败 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `API_KEY_NOT_FOUND` | 404 | API Key 不存在 |
| `API_KEY_DUPLICATE_NAME` | 409 | API Key 名称已存在 |
| `EXPORT_NOT_FOUND` | 404 | 导出任务不存在 |
| `EXPORT_EXPIRED` | 410 | 导出文件已过期 |

**错误响应格式：**

```json
{
  "error": {
    "code": "PARSE_FAILED",
    "message": "AI 解析失败，请稍后重试",
    "details": {
      "entryId": "entry_abc123",
      "reason": "LLM API 返回错误"
    }
  }
}
```

**权限错误示例：**

```json
{
  "error": {
    "code": "AUTH_CONTENT_TYPE_DENIED",
    "message": "该 API Key 无权访问 finance 类型的数据",
    "details": {
      "apiKeyId": "key_abc123",
      "requestedIntent": "finance",
      "allowedIntents": ["todo", "idea", "link"]
    }
  }
}
```

```json
{
  "error": {
    "code": "AUTH_TAG_DENIED",
    "message": "该 API Key 无权访问包含 'private' 标签的内容",
    "details": {
      "apiKeyId": "key_abc123",
      "deniedTag": "private",
      "deniedTags": ["private", "confidential"]
    }
  }
}
```

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求频率超限，请稍后重试",
    "details": {
      "limit": 60,
      "window": "1 minute",
      "retryAfter": 45
    }
  }
}
```

---

## Webhook 事件

SuperInbox Core 支持通过 Webhook 接收外部事件。

### 配置 Webhook

```http
POST /webhooks
```

**请求体：**

```json
{
  "url": "https://your-server.com/webhook",
  "events": ["entry.created", "entry.parsed", "entry.routed"],
  "secret": "your_webhook_secret"
}
```

### 事件类型

#### 1. entry.created

记录创建时触发。

**Payload：**

```json
{
  "event": "entry.created",
  "timestamp": "2026-01-15T10:30:00Z",
  "data": {
    "id": "entry_abc123",
    "content": "打车花了 30 元",
    "type": "text",
    "source": "telegram"
  }
}
```

#### 2. entry.parsed

AI 解析完成时触发。

**Payload：**

```json
{
  "event": "entry.parsed",
  "timestamp": "2026-01-15T10:30:05Z",
  "data": {
    "id": "entry_abc123",
    "intent": "expense",
    "entities": {
      "amount": 30,
      "currency": "CNY"
    }
  }
}
```

#### 3. entry.routed

分发完成时触发。

**Payload：**

```json
{
  "event": "entry.routed",
  "timestamp": "2026-01-15T10:30:10Z",
  "data": {
    "id": "entry_abc123",
    "adapters": [
      {
        "name": "notion",
        "status": "success"
      }
    ]
  }
}
```

### Webhook 签名验证

每个 Webhook 请求都会在 Header 中包含签名：

```http
X-SuperInbox-Signature: sha256=abc123...
```

**验证方法：**

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

---

## SDK 使用示例

### JavaScript/TypeScript SDK

```bash
npm install @superinbox/core-sdk
```

```typescript
import { SuperInboxClient } from '@superinbox/core-sdk';

const client = new SuperInboxClient({
  apiKey: 'sk_live_abc123',
  baseUrl: 'http://localhost:3000/api/v1'
});

// 创建记录
const entry = await client.inbox.create({
  content: '明天下午3点开会',
  type: 'text',
  source: 'web'
});

// 查询记录
const entries = await client.inbox.list({
  intent: 'todo',
  limit: 10
});

// 创建路由规则
const rule = await client.routing.createRule({
  name: '待办同步到 Todoist',
  condition: { intent: 'todo' },
  actions: [{
    adapter: 'todoist',
    config: { projectId: '123' }
  }]
});

// API Key 管理
const newKey = await client.auth.createApiKey({
  name: 'Third Party App',
  scopes: ['inbox:read', 'content:idea'],
  accessControl: {
    allowedIntents: ['idea', 'link'],
    deniedTags: ['private']
  }
});

// 查询 API Keys
const keys = await client.auth.listApiKeys({
  status: 'active'
});

// 查看访问日志
const logs = await client.auth.getApiKeyLogs('key_abc123', {
  startDate: '2026-01-01T00:00:00Z',
  limit: 100
});

// 获取使用统计
const stats = await client.auth.getApiKeyStats('key_abc123', {
  period: 'month'
});

// 禁用 API Key
await client.auth.disableApiKey('key_abc123');

// 重新生成 API Key
const regenerated = await client.auth.regenerateApiKey('key_abc123');
console.log('New API Key:', regenerated.apiKey);
```

### Python SDK

```bash
pip install superinbox-core
```

```python
from superinbox import SuperInboxClient

client = SuperInboxClient(
    api_key='sk_live_abc123',
    base_url='http://localhost:3000/api/v1'
)

# 创建记录
entry = client.inbox.create(
    content='打车花了 30 元',
    type='text',
    source='telegram'
)

# 查询记录
entries = client.inbox.list(
    intent='expense',
    limit=10
)

# API Key 管理
new_key = client.auth.create_api_key(
    name='Third Party App',
    scopes=['inbox:read', 'content:idea'],
    access_control={
        'allowed_intents': ['idea', 'link'],
        'denied_tags': ['private']
    }
)

# 查询 API Keys
keys = client.auth.list_api_keys(status='active')

# 查看访问日志
logs = client.auth.get_api_key_logs(
    'key_abc123',
    start_date='2026-01-01T00:00:00Z',
    limit=100
)

# 获取使用统计
stats = client.auth.get_api_key_stats(
    'key_abc123',
    period='month'
)

# 禁用 API Key
client.auth.disable_api_key('key_abc123')

# 重新生成 API Key
regenerated = client.auth.regenerate_api_key('key_abc123')
print(f'New API Key: {regenerated["apiKey"]}')
```

---

## 附录

### A. 支持的意图类型

| 意图 | 说明 | 典型实体 |
|------|------|----------|
| `expense` | 消费记账 | amount, currency, category, merchant |
| `todo` | 待办任务 | task, dueDate, tags |
| `idea` | 灵感笔记 | title, content, tags |
| `link` | 网页收藏 | url, title, summary, tags |
| `event` | 日程安排 | title, startTime, endTime, location |
| `contact` | 联系人信息 | name, phone, email, company |

### B. 环境变量配置

```bash
# 服务配置
PORT=3000
NODE_ENV=production

# 数据库
DATABASE_PATH=./data/superinbox.db

# AI 配置
LLM_PROVIDER=openai
LLM_API_KEY=sk-xxx
LLM_MODEL=gpt-4
LLM_TIMEOUT=30000

# 文件存储
STORAGE_PATH=./data/files
MAX_FILE_SIZE=10485760

# 安全
API_KEY_SECRET=your-secret-key
WEBHOOK_SECRET=your-webhook-secret

# API Key 配置
API_KEY_DEFAULT_EXPIRY_DAYS=365
API_KEY_MAX_PER_USER=50
API_KEY_LOG_RETENTION_DAYS=90

# 速率限制（全局默认）
RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_REQUESTS_PER_DAY=10000

# 日志
LOG_LEVEL=info
LOG_PATH=./logs
ACCESS_LOG_ENABLED=true
ACCESS_LOG_RETENTION_DAYS=90
```

### C. Docker 部署

```bash
docker run -d \
  --name superinbox-core \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e LLM_API_KEY=sk-xxx \
  superinbox/core:latest
```

**docker-compose.yml：**

```yaml
version: '3.8'

services:
  superinbox-core:
    image: superinbox/core:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./config:/app/config
    environment:
      - LLM_PROVIDER=openai
      - LLM_API_KEY=${LLM_API_KEY}
      - NODE_ENV=production
    restart: unless-stopped
```

---

## 更新日志

### v1.0.0 (2026-01-15)

- 初始版本发布
- 实现核心捕获、解析、存储、路由功能
- 内置 Notion、Obsidian、Webhook 适配器
- 提供 RESTful API 和 SDK

---

## 技术支持

- **文档：** https://docs.superinbox.dev
- **GitHub：** https://github.com/superinbox/core
- **社区：** https://community.superinbox.dev
- **问题反馈：** https://github.com/superinbox/core/issues

---

**© 2026 SuperInbox. Licensed under MIT.**
