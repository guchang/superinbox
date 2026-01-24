# MCP 连接器架构文档

> **最后更新:** 2025-01-24
> **版本:** 1.0.0

---

## 目录

- [概述](#概述)
- [目录结构](#目录结构)
- [核心架构](#核心架构)
- [核心组件](#核心组件)
- [数据流](#数据流)
- [认证机制](#认证机制)
- [支持的服务器类型](#支持的服务器类型)
- [类型定义](#类型定义)
- [API 端点](#api-端点)
- [扩展指南](#扩展指南)
- [最佳实践](#最佳实践)

---

## 概述

SuperInbox MCP 连接器提供了与 Model Context Protocol (MCP) 服务器的统一集成接口。支持两种传输方式（HTTP 和 Stdio），自动处理认证、数据转换和错误恢复。

**核心特性：**
- ✅ 双传输层支持（HTTP/Stdio）
- ✅ 自动传输类型检测
- ✅ 多种认证方式（API Key/OAuth）
- ✅ 智能 LLM 数据转换
- ✅ 工具发现和缓存
- ✅ 完善的错误处理

---

## 目录结构

```
backend/src/
├── router/
│   ├── adapters/
│   │   └── mcp-adapter.ts          # 统一 MCP 适配器（核心）
│   ├── mcp/
│   │   ├── http-mcp-client.ts      # HTTP 传输客户端
│   │   ├── stdio-mcp-client.ts     # Stdio 传输客户端
│   │   └── llm-mapping.service.ts  # LLM 数据转换
│   └── routes/
│       └── mcp-adapters.routes.ts  # 配置管理 API
├── types/
│   └── index.ts                    # 类型定义
```

---

## 核心架构

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    MCPAdapter                          │
│            (统一适配器入口 - mcp-adapter.ts)            │
├─────────────────────────────────────────────────────────┤
│  • 自动检测传输类型 (HTTP/Stdio)                        │
│  • 处理多种认证方式 (API Key/OAuth)                     │
│  • 智能 LLM 数据转换                                    │
│  • 工具发现和缓存                                       │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ HttpMcpClient    │    │ StdioMcpClient   │
│  HTTP 传输       │    │  Stdio 传输      │
│  • RESTful API   │    │  • JSON-RPC 2.0  │
│  • 远程服务器    │    │  • 子进程通信    │
│  • 自动重试      │    │  • stdin/stdout  │
└──────────────────┘    └──────────────────┘
```

### 双传输层架构

**HTTP 传输** (`HttpMcpClient`)
- 适用于远程 MCP 服务器
- 基于 RESTful API 的 HTTP 通信
- 支持自动重试、缓存和超时
- 配置：`serverUrl`、`authToken`

**Stdio 传输** (`StdioMcpClient`)
- 适用于本地命令行 MCP 服务器
- 基于 JSON-RPC 2.0 协议
- 通过 stdin/stdout 与子进程通信
- 配置：`command`、`args`、`env`

---

## 核心组件

### 1. MCPAdapter (`mcp-adapter.ts`)

**职责：** 统一适配器入口，自动选择传输方式

**关键方法：**

```typescript
class MCPAdapter extends BaseAdapter {
  // 初始化适配器
  async initialize(config: MCPAdapterConfig): Promise<void>

  // 分发条目到目标服务
  async distribute(item: Item): Promise<DistributionResult>

  // 获取工具架构
  async getToolSchema(toolName: string): Promise<Record<string, unknown>>

  // 列出可用工具
  async listTools(forceRefresh?: boolean): Promise<MCPTool[]>

  // 直接调用工具
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResponse>

  // 健康检查
  async healthCheck(): Promise<boolean>
}
```

**初始化流程：**

```typescript
// 自动检测传输类型
if (transportType === 'stdio') {
  await this.initializeStdioClient();
} else {
  await this.initializeHttpClient();
}
```

**分发流程：**

```typescript
async distribute(item: Item): Promise<DistributionResult> {
  // 1. 获取工具架构
  const toolSchema = await this.mcpClient.getToolSchema(toolName);

  // 2. LLM 数据转换（可选）
  if (processingInstructions) {
    transformedData = await llmService.transform(item, {
      instructions: processingInstructions,
      targetSchema: toolSchema.inputSchema,
      toolName
    });
  }

  // 3. 调用 MCP 工具
  const result = await this.mcpClient.callTool({
    name: toolName,
    arguments: { ...transformedData }
  });

  // 4. 处理结果
  return this.createResult(targetId, 'success', {
    externalId: result.id,
    externalUrl: result.url
  });
}
```

### 2. HttpMcpClient (`http-mcp-client.ts`)

**职责：** HTTP 传输实现

**特性：**
- RESTful API 调用
- 工具列表缓存（5分钟 TTL）
- 自动重试（指数退避）
- 健康检查机制

**端点：**
- `GET /tools` - 列出可用工具
- `POST /tools/call` - 调用工具
- `GET /health` - 健康检查

### 3. StdioMcpClient (`stdio-mcp-client.ts`)

**职责：** Stdio 传输实现

**特性：**
- JSON-RPC 2.0 协议
- 子进程管理
- 请求/响应映射
- 超时控制

**初始化步骤：**

```typescript
private async _initialize(): Promise<void> {
  // 1. 解析命令和参数
  const parts = this.config.command.split(' ');
  const cmd = parts[0];
  const args = [...parts.slice(1), ...(this.config.args || [])];

  // 2. 启动子进程
  this.process = spawn(cmd, args, {
    env: { ...process.env, ...this.config.env },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // 3. 发送初始化请求
  const initResponse = await this.sendRequest({
    jsonrpc: '2.0',
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo }
  });

  // 4. 发送 initialized 通知
  this.sendNotification({
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  });
}
```

### 4. LLMMappingService (`llm-mapping.service.ts`)

**职责：** LLM 数据格式转换

**转换流程：**

```typescript
async transform(
  item: Item,
  options: {
    instructions: string;
    targetSchema: Record<string, unknown>;
    toolName: string;
  }
): Promise<Record<string, unknown>> {
  // 1. 构建 Prompt
  const prompt = this.buildPrompt(item, instructions, targetSchema);

  // 2. 调用 LLM
  const result = await this.callLLM(prompt);

  // 3. 解析和验证
  const transformed = this.parseResponse(result);

  return transformed;
}
```

---

## 数据流

### 完整分发流程

```
用户创建路由规则
        │
        ▼
┌───────────────────┐
│ 配置 MCP 适配器   │
│ - serverType      │
│ - transportType   │
│ - authType        │
└─────────┬─────────┘
          │
          ▼
┌─────────────────────────────┐
│   MCPAdapter.initialize()   │
│   ├─ HTTP? → HttpMcpClient  │
│   └─ Stdio? → StdioMcpClient│
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│   用户发送收件箱条目         │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│   MCPAdapter.distribute()   │
│   1. getToolSchema()        │
│   2. LLM 转换 (可选)        │
│   3. callTool()             │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│   目标平台 (Notion/Todoist) │
└─────────────────────────────┘
```

---

## 认证机制

### 支持的认证方式

#### 1. API Key 认证

```typescript
{
  authType: 'api_key',
  apiKey: 'your-api-key'
}
```

#### 2. OAuth 认证

```typescript
{
  authType: 'oauth',
  oauthAccessToken: 'access-token',
  oauthRefreshToken: 'refresh-token'
}
```

**Todoist OAuth 特殊处理：**

```typescript
if (this.mcpConfig!.serverType === 'todoist') {
  let token = this.mcpConfig!.oauthAccessToken;

  // 降级到 API Key
  if (!token && this.mcpConfig!.apiKey) {
    token = this.mcpConfig!.apiKey;
  }

  if (token) {
    // 设置环境变量
    (env as Record<string, string>).TODOIST_API_KEY = token;

    // 通过 args 传递 header（避免 shell 转义问题）
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    args = parts.slice(1);
    args.push('--header', `Authorization: Bearer ${token}`);
    command = cmd;
  }
}
```

#### 3. 环境变量（Stdio）

```typescript
{
  command: 'npx @notionhq/server',
  env: {
    NOTION_TOKEN: 'ntn_xxx',
    GITHUB_TOKEN: 'ghp_xxx'
  }
}
```

### Token 处理优先级

```
1. OAuth Access Token (优先)
2. API Key (降级)
3. 环境变量 (最后)
```

---

## 支持的服务器类型

| 类型 | 传输方式 | 默认工具 | 认证方式 | 默认命令 |
|------|----------|----------|----------|----------|
| `notion` | Stdio | `API-post-page` | 环境变量 `NOTION_TOKEN` | `npx -y @notionhq/notion-mcp-server` |
| `github` | Stdio | `github-create-issue` | 环境变量 `GITHUB_TOKEN` | `npx -y @modelcontextprotocol/server-github` |
| `obsidian` | Stdio | `obsidian-create-note` | 环境变量 | `npx -y @modelcontextprotocol/server-obsidian` |
| `todoist` | Stdio | `addTasks` | Header (OAuth/API Key) | `npx -y mcp-remote https://ai.todoist.net/mcp` |
| `custom` | HTTP/Stdio | 自定义 | 自定义 | 用户自定义 |

### 服务器类型映射

```typescript
private getDefaultCommand(serverType: string): string {
  const commandMapping: Record<string, string> = {
    notion: 'npx -y @notionhq/notion-mcp-server',
    github: 'npx -y @modelcontextprotocol/server-github',
    obsidian: 'npx -y @modelcontextprotocol/server-obsidian',
    todoist: 'npx -y mcp-remote https://ai.todoist.net/mcp'
  };
  return commandMapping[serverType] || `npx @modelcontextprotocol/server-${serverType}`;
}

private inferToolName(serverType: string): string {
  const toolMapping: Record<string, string> = {
    notion: 'API-post-page',
    github: 'github-create-issue',
    obsidian: 'obsidian-create-note',
    todoist: 'addTasks'
  };
  return toolMapping[serverType] || 'create-resource';
}
```

---

## 类型定义

### MCPAdapterConfig

```typescript
interface MCPAdapterConfig {
  id: string;
  userId: string;
  name: string;
  serverType: string;              // "notion", "github", "todoist", "custom"
  transportType: 'http' | 'stdio';
  command?: string;                // Stdio 专用
  args?: string[];                 // 命令参数
  env?: Record<string, string>;    // 环境变量
  authType: 'api_key' | 'oauth' | 'none';
  apiKey?: string;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  defaultToolName?: string;
  timeout?: number;                // 默认 30000ms
  maxRetries?: number;             // HTTP 专用，默认 3
  logoColor?: string;
  enabled: boolean;
}
```

### MCPTool

```typescript
interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}
```

### MCPToolCallRequest / Response

```typescript
interface MCPToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

interface MCPToolCallResponse {
  content: unknown;
  isError?: boolean;
  id?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}
```

### StdioMcpClientConfig

```typescript
interface StdioMcpClientConfig {
  command: string;                 // 可执行文件
  args?: string[];                 // 命令参数
  env?: Record<string, string>;    // 环境变量
  timeout?: number;                // 默认 30000ms
}
```

---

## API 端点

### 配置管理 API

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/v1/mcp-adapters` | 列出所有配置 | 读取 |
| GET | `/v1/mcp-adapters/:id` | 获取单个配置 | 读取 |
| POST | `/v1/mcp-adapters` | 创建配置 | 写入 |
| PUT | `/v1/mcp-adapters/:id` | 更新配置 | 写入 |
| DELETE | `/v1/mcp-adapters/:id` | 删除配置 | 写入 |
| POST | `/v1/mcp-adapters/:id/test` | 测试连接 | 写入 |
| GET | `/v1/mcp-adapters/:id/tools` | 获取工具列表 | 读取 |

### OAuth 认证 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/v1/mcp-adapters/oauth/:type/authorize` | 获取 OAuth 授权 URL |
| GET | `/v1/mcp-adapters/oauth/:type/callback` | OAuth 回调处理 |

---

## 扩展指南

### 添加新的服务器类型

#### 步骤 1: 添加命令映射

在 `mcp-adapter.ts` 的 `getDefaultCommand()` 方法中添加：

```typescript
private getDefaultCommand(serverType: string): string {
  const commandMapping: Record<string, string> = {
    notion: 'npx -y @notionhq/notion-mcp-server',
    todoist: 'npx -y mcp-remote https://ai.todoist.net/mcp',
    newservice: 'npx -y @mcp/server-newservice' // 新增
  };
  return commandMapping[serverType];
}
```

#### 步骤 2: 添加工具名称映射

在 `inferToolName()` 方法中添加：

```typescript
private inferToolName(serverType: string): string {
  const toolMapping: Record<string, string> = {
    notion: 'API-post-page',
    todoist: 'addTasks',
    newservice: 'create-item' // 新增
  };
  return toolMapping[serverType];
}
```

#### 步骤 3: 添加数据转换指令（可选）

在 `getDefaultInstructions()` 方法中添加：

```typescript
private getDefaultInstructions(serverType: string): string {
  const instructions: Record<string, string> = {
    newservice: `Convert to NewService format:
- Use suggestedTitle as item title
- Map category to tags
- Convert dueDate to ISO 8601 format`
  };
  return instructions[serverType];
}
```

#### 步骤 4: 添加简单映射（可选）

在 `simpleMapping()` 方法中添加：

```typescript
private simpleMapping(item: Item, toolName: string): Record<string, unknown> {
  if (toolName === 'newservice-create-item') {
    return {
      title: item.suggestedTitle || item.originalContent.substring(0, 50),
      content: item.originalContent,
      tags: item.entities.tags || [],
      dueDate: item.entities.dueDate?.toISOString()
    };
  }
  // ... 其他映射
}
```

#### 步骤 5: 添加特殊认证处理（如需要）

在 `initializeStdioClient()` 方法中添加：

```typescript
if (this.mcpConfig!.serverType === 'newservice') {
  // 特殊认证逻辑
  if (this.mcpConfig!.apiKey) {
    (env as Record<string, string>).NEWSERVICE_API_KEY = this.mcpConfig!.apiKey;
  }
}
```

### 添加新的认证方式

#### 步骤 1: 扩展类型定义

在 `types/index.ts` 中添加：

```typescript
interface MCPAdapterConfig {
  // ... 现有字段
  authType: 'api_key' | 'oauth' | 'jwt' | 'none'; // 添加 jwt
  jwtToken?: string; // 新增
}
```

#### 步骤 2: 实现认证逻辑

在 `mcp-adapter.ts` 中添加：

```typescript
private getAuthToken(): string | undefined {
  if (this.mcpConfig?.authType === 'api_key' && this.mcpConfig.apiKey) {
    return this.mcpConfig.apiKey;
  }
  if (this.mcpConfig?.authType === 'oauth' && this.mcpConfig.oauthAccessToken) {
    return this.mcpConfig.oauthAccessToken;
  }
  if (this.mcpConfig?.authType === 'jwt' && this.mcpConfig.jwtToken) {
    return this.mcpConfig.jwtToken;
  }
  return undefined;
}
```

---

## 最佳实践

### 1. 使用统一适配器

优先使用 `mcp-adapter.ts`，它自动处理传输类型选择：

```typescript
import { mcpAdapter } from '../adapters/mcp-adapter.js';

// 自动检测传输类型
await mcpAdapter.initialize(config);
const result = await mcpAdapter.distribute(item);
```

### 2. 配置复用

相同的服务类型使用默认配置，减少重复设置：

```typescript
// 使用默认命令
const config = {
  serverType: 'todoist',
  transportType: 'stdio'
  // command 会自动使用默认值
};
```

### 3. 错误处理

利用内置的错误提取机制处理 API 错误：

```typescript
try {
  const result = await mcpAdapter.callTool(toolName, args);
} catch (error) {
  // 错误已包含详细消息
  logger.error('Tool call failed:', error.message);
}
```

### 4. 性能优化

启用工具缓存，避免重复查询：

```typescript
// 使用缓存
const tools = await mcpAdapter.listTools(false);

// 强制刷新
const tools = await mcpAdapter.listTools(true);
```

### 5. 安全考虑

敏感信息使用环境变量，避免明文存储：

```typescript
// 推荐：使用环境变量
{
  env: {
    NOTION_TOKEN: process.env.NOTION_TOKEN
  }
}

// 避免：硬编码敏感信息
{
  apiKey: 'secret_xxx' // 不要这样做
}
```

### 6. 参数传递（Stdio）

使用 `args` 数组而不是拼接命令字符串：

```typescript
// 推荐
{
  command: 'npx',
  args: ['-y', 'mcp-remote', 'https://ai.todoist.net/mcp', '--header', 'Authorization: Bearer token']
}

// 避免
{
  command: "npx -y mcp-remote https://ai.todoist.net/mcp --header 'Authorization: Bearer token'"
}
```

---

## 故障排查

### 常见问题

#### 1. Stdio 客户端启动失败

**错误:** `Error: spawn ENOENT`

**原因:** 命令或参数不正确

**解决方案:**
- 检查命令是否正确
- 确保 `command` 只包含可执行文件
- 使用 `args` 数组传递参数

#### 2. 认证失败（HTTP 401）

**错误:** `Tool call failed: HTTP 401 Unauthorized`

**原因:** Token 无效或未正确传递

**解决方案:**
- 检查 Token 是否有效
- 对于 Stdio，确保 Token 通过环境变量或 header 传递
- 检查 `authType` 配置是否正确

#### 3. 工具未找到

**错误:** `Tool xxx not found on MCP server`

**原因:** 工具名称不正确或服务器不支持

**解决方案:**
- 调用 `listTools()` 查看可用工具
- 检查 `defaultToolName` 配置
- 参考 MCP 服务器文档

#### 4. MCP 服务器进程退出

**错误:** `MCP server process exited`

**原因:** 服务器崩溃或超时

**解决方案:**
- 检查服务器日志
- 增加 `timeout` 配置
- 确保环境变量正确设置

---

## 相关资源

- [MCP 规范](https://modelcontextprotocol.io/)
- [Todoist MCP Server](https://github.com/Doist/todoist-ai)
- [Notion MCP Server](https://github.com/notionhq/notion-mcp-server)
- [SuperInbox 架构文档](/Users/wudao/SuperInbox/CLAUDE.md)

---

**文档维护者:** SuperInbox Team
**最后审核:** 2025-01-24
