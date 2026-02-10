# SuperInbox Core Backend / SuperInbox 核心后端

SuperInbox Core is the backend service for unified capture and intelligent routing.  
SuperInbox Core 是“统一采集 + 智能路由”能力的核心后端服务。

## Core Capabilities / 核心能力

- **Multi-source capture / 多端采集**: receive raw data (text/image/link/audio)
- **AI processing / AI 处理**: intent detection, entity extraction, smart categorization
- **Storage / 存储层**: local SQLite persistence
- **Routing / 分发路由**: dispatch to Notion, Obsidian, Webhook, etc.

## Quick Start / 快速开始

### 1) Install dependencies / 安装依赖

```bash
npm install
```

### 2) Configure env / 配置环境变量

```bash
cp .env.example .env
# edit .env with required values / 编辑必要配置
```

### 3) Initialize database / 初始化数据库

```bash
npm run db:migrate
npm run db:seed
```

### 4) Start development server / 启动开发服务

```bash
npm run dev
```

## Project Structure / 项目结构

```text
backend/
├── src/
│   ├── capture/          # Capture endpoints / 采集入口
│   ├── ai/               # AI processing engine / AI 处理引擎
│   ├── storage/          # Storage layer / 存储层
│   ├── router/           # Routing adapters / 分发路由适配器
│   ├── middleware/       # Express middleware
│   ├── config/           # Configuration
│   ├── types/            # TypeScript types
│   └── index.ts          # App entry
├── tests/                # Tests
└── package.json
```

## API Documentation / API 文档

- Chinese: [`../docs/api/SuperInbox-Core-API文档.md`](../docs/api/SuperInbox-Core-API文档.md)
- English: [`../docs/api/SuperInbox-Core-API.en.md`](../docs/api/SuperInbox-Core-API.en.md)

### Core Endpoints / 核心接口

- `POST /v1/inbox` - create and process input
- `GET /v1/inbox` - list items
- `GET /v1/inbox/:id` - get item detail
- `PUT /v1/inbox/:id` - update item
- `DELETE /v1/inbox/:id` - delete item
- `POST /v1/routing/dispatch/:id` - trigger dispatch manually

## Tech Stack / 技术栈

- Runtime: Node.js 18+
- Language: TypeScript
- Framework: Express.js
- Database: SQLite (`better-sqlite3`)
- AI: LLM APIs (OpenAI / DeepSearch / 智谱)
- Validation: Zod

## Development / 开发指南

### Tests / 测试

```bash
npm test
npm run test:coverage
```

### Lint / 代码检查

```bash
npm run lint
```

### Build / 构建

```bash
npm run build
```

## Docker / Docker 部署

```bash
docker-compose up -d
```

## License / 许可证

MIT
