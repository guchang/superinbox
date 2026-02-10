# @superinbox/channel-bot

> **Multi-platform message channel service for SuperInbox**

Channel Bot is the official multi-platform message channel service for SuperInbox. It receives messages from various platforms (Telegram, Lark, Wework, etc.) and forwards them to SuperInbox Core via REST API.

## Architecture

```
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

## Features

- **Decoupled Architecture** - Independent deployment from SuperInbox Core
- **Simple Communication** - Pure HTTP REST API interaction
- **Extensible** - Add new platforms by implementing a unified interface
- **Open Ecosystem** - Community developers can build their own bots

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- SuperInbox Core running on port 3001

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env and configure your settings
# - CORE_API_URL: SuperInbox Core API endpoint
# - TELEGRAM_BOT_TOKEN: Your Telegram bot token
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Configuration

See [`.env.example`](./.env.example) for all available configuration options.

## Deployment (Docker, standalone)

Channel Bot is designed as an optional standalone service. It can be deployed independently from web/backend.

```bash
# from repo root
cp deploy/channel-bot/.env.prod.example deploy/channel-bot/.env.prod

# edit required variables
# CORE_API_URL, CORE_API_KEY, TELEGRAM_BOT_TOKEN (or Lark creds)
vi deploy/channel-bot/.env.prod

# deploy / update
./deploy/channel-bot/update.sh
```

Useful commands:

```bash
# status
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod ps

# logs
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod logs -f channel-bot

# stop
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod down
```

## Documentation

- [Project Documentation](../docs/README.md)
- [Backend README](../backend/README.md)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT

---

**SuperInbox Team**
