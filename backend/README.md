# SuperInbox Core Backend

SuperInbox Core 是一个"数字化信息的统一入口与智能路由系统"的核心后端服务。

## 核心功能

- **多端采集层**: 接收来自各种渠道的原始数据（文本、图片、链接、音频）
- **AI 处理引擎**: 意图识别、实体提取、智能分类
- **存储层**: 本地 SQLite 数据库存储
- **分发路由层**: 自动分发到 Notion、Obsidian、Webhook 等目标平台

## 快速开始

### 安装依赖

\`\`\`bash
npm install
\`\`\`

### 配置环境变量

\`\`\`bash
cp .env.example .env
# 编辑 .env 文件，填入必要的配置
\`\`\`

### 初始化数据库

\`\`\`bash
npm run db:migrate
npm run db:seed
\`\`\`

### 启动开发服务器

\`\`\`bash
npm run dev
\`\`\`

## 项目结构

\`\`\`
backend/
├── src/
│   ├── capture/          # 捕获层 - API 接收端点
│   ├── ai/               # AI 处理引擎
│   ├── storage/          # 存储层 - 数据库操作
│   ├── router/           # 分发路由层 - 适配器
│   ├── middleware/       # Express 中间件
│   ├── config/           # 配置管理
│   ├── types/            # TypeScript 类型定义
│   └── index.ts          # 应用入口
├── tests/                # 测试文件
└── package.json
\`\`\`

## API 文档

详细的 API 文档请参考 \`SuperInbox-Core-API文档.md\`

### 核心端点

- `POST /v1/inbox` - 接收并处理输入内容
- `GET /v1/items` - 获取所有项目
- `GET /v1/items/:id` - 获取单个项目详情
- `PUT /v1/items/:id` - 更新项目
- `DELETE /v1/items/:id` - 删除项目
- `POST /v1/distribute` - 手动触发分发

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript
- **框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **AI**: 直接调用 LLM API (OpenAI/DeepSearch/智谱)
- **验证**: Zod

## 开发指南

### 运行测试

\`\`\`bash
npm test
npm run test:coverage
\`\`\`

### 代码检查

\`\`\`bash
npm run lint
\`\`\`

### 构建

\`\`\`bash
npm run build
\`\`\`

## Docker 部署

\`\`\`bash
docker-compose up -d
\`\`\`

## License

MIT
