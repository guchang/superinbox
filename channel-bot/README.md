# @superinbox/channel-bot / SuperInbox 渠道机器人服务

> **Multi-platform message channel service for SuperInbox**  
> **SuperInbox 的多平台消息渠道服务**

Channel Bot receives messages from external platforms (Telegram, Lark, Wework, etc.) and forwards them to SuperInbox Core via REST API.  
Channel Bot 负责接收外部平台消息（Telegram、Lark、企业微信等），并通过 REST API 转发到 SuperInbox Core。

## Architecture / 架构

```text
┌─────────────────────────────────────────┐
│         SuperInbox Core                 │
│         (Port 3001)                     │
└─────────────────────────────────────────┘
                 ↑
                 │ HTTP (REST API)
                 │
┌────────────────┴────────────────────────┐
│         Channel Bot                     │
│         (Port 3002)                     │
│                                         │
│  ┌────────┬────────┬─────────────────┐ │
│  │Telegram│  Lark │    Wework       │ │
│  │Channel │Channel │    Channel     │ │
│  └────────┴────────┴─────────────────┘ │
└─────────────────────────────────────────┘
```

## Features / 特性

- **Decoupled architecture / 解耦架构**: deploy independently from SuperInbox Core
- **Simple communication / 通信简单**: pure HTTP REST API interaction
- **Extensible / 易扩展**: add new platforms via unified channel interface
- **Open ecosystem / 开放生态**: community developers can build custom bots

## Quick Start / 快速开始

### Prerequisites / 前置条件

- Node.js >= 20.0.0
- SuperInbox Core is running (default API endpoint: `http://localhost:3001/v1`)

### Installation / 安装

```bash
# Install dependencies / 安装依赖
npm install

# Copy env template / 复制环境变量模板
cp .env.example .env

# Edit .env / 编辑 .env
# - CORE_API_URL: SuperInbox Core API endpoint
# - TELEGRAM_BOT_TOKEN: Telegram bot token (if Telegram enabled)
# - LARK_APP_ID / LARK_APP_SECRET: Lark credentials (if Lark enabled)
```

### Development / 开发模式

```bash
npm run dev
```

### Production / 生产模式

```bash
npm run build
npm start
```

## Configuration / 配置

See [`.env.example`](./.env.example) for complete configuration options.  
完整配置项请参考 [`.env.example`](./.env.example)。

## Deployment (Docker, standalone) / 独立部署（Docker）

Channel Bot is designed as an optional standalone service and can be deployed independently from web/backend.  
Channel Bot 推荐作为可选独立服务部署，不与 web/backend 强绑定发布。

```bash
# from repo root / 在仓库根目录执行
cp deploy/channel-bot/.env.prod.example deploy/channel-bot/.env.prod

# edit required variables / 编辑关键变量
# CORE_API_URL, TELEGRAM_BOT_TOKEN (or Lark credentials)
vi deploy/channel-bot/.env.prod

# deploy or update / 部署或更新
./deploy/channel-bot/update.sh
```

Useful commands / 常用命令:

```bash
# status / 查看状态
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod ps

# logs / 查看日志
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod logs -f channel-bot

# stop / 停止服务
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod down
```

## Documentation / 相关文档

- [Project Docs / 项目文档中心](../docs/README.md)
- [Backend README](../backend/README.md)
- [Deploy README](../deploy/README.md)

## Contributing / 贡献

Contributions are welcome. Please open an issue or submit a pull request.  
欢迎贡献，欢迎提交 issue 或 pull request。

## License / 许可证

MIT

---

**SuperInbox Team**
