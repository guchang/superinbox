# SuperInbox

Language: **English** | [简体中文](./README.zh-CN.md)

GitHub: [guchang/superinbox](https://github.com/guchang/superinbox)

## Product Positioning

Reducing capture friction is the core goal of SuperInbox.  
When ideas appear, users should not have to think about which app to open first.

SuperInbox lowers the input barrier so you can capture anything quickly, while AI handles classification, extraction, and routing in the background.

## Core Value

- **Multi-entry capture**: Web, CLI, Bot, API, and MCP entry points.
- **AI processing**: Automatic classification and information extraction.
- **Flexible routing**: Route to Notion, Todoist, Feishu, and other downstream tools.
- **Self-host friendly**: Open-source core with local/private deployment support.

## Typical Scenarios

### 🧠 Personal Knowledge Management

> **Scenario**: Capture ideas instantly

> **Flow**: Quick input → AI categorizes as `idea` → auto-save to Notion

### 📥 Information Collection

> **Scenario**: Forward links while browsing on mobile

> **Flow**: Send to Telegram Bot → AI categorizes as `bookmark` → distribute to Notion

### ✅ Task Management

> **Scenario**: Create tasks quickly

> **Flow**: Input "Meeting at 3 PM tomorrow" → AI extracts time → create Todoist task

### 💰 Expense Logging

> **Scenario**: Auto-categorized spending records

> **Flow**: Input "Spent 25 yuan on coffee" → AI extracts amount/context → write to Feishu sheet

## Quick Start

### One-Command Startup

**macOS / Linux:**

```bash
./start.sh
```

Startup script automatically:

- ✅ Checks dependencies
- ✅ Detects port conflicts and offers handling options
- ✅ Starts backend and frontend services

**Service URLs:**

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000/v1

## Common Commands

```bash
# Check status
./start.sh status

# Stop services
./start.sh stop

# Restart services
./start.sh restart
```

## CLI Companion

SuperInbox includes a companion CLI tool: `sinbox`. It is optimized for terminal-first and script-friendly capture workflows.

Quick example:

```bash
# Install CLI
cd ./cli
npm install
npm link

# Configure and verify
sinbox config
sinbox status

# Add and list
sinbox add "Meeting at 3 PM tomorrow"
sinbox list
```

See full CLI docs (bilingual): [`cli/README.md`](./cli/README.md)

## MCP (Codex / Claude Code)

SuperInbox publishes a stdio MCP server package: `@superinbox/mcp-server`.

1) Start backend first (ensure `http://127.0.0.1:3000` is reachable)
2) Add the server to your MCP config (replace API key as needed):

```json
{
  "mcpServers": {
    "superinbox": {
      "command": "npx",
      "args": ["-y", "@superinbox/mcp-server"],
      "env": {
        "SUPERINBOX_BASE_URL": "http://127.0.0.1:3000",
        "SUPERINBOX_API_KEY": "sk_xxx"
      }
    }
  }
}
```

Optional: pin to an exact package version for reproducibility:

```json
{
  "mcpServers": {
    "superinbox": {
      "command": "npx",
      "args": ["-y", "@superinbox/mcp-server@<version>"],
      "env": {
        "SUPERINBOX_BASE_URL": "http://127.0.0.1:3000",
        "SUPERINBOX_API_KEY": "sk_xxx"
      }
    }
  }
}
```

For local development/debugging, you can still run the source server directly:

```json
{
  "mcpServers": {
    "superinbox": {
      "command": "/path/to/SuperInbox/backend/node_modules/.bin/tsx",
      "args": ["/path/to/SuperInbox/backend/src/mcp/server.ts"],
      "env": {
        "SUPERINBOX_BASE_URL": "http://127.0.0.1:3000",
        "SUPERINBOX_API_KEY": "sk_xxx"
      }
    }
  }
}
```

## Documentation

- [中文主文档](./README.zh-CN.md) - 项目中文介绍
- [Startup Guide](./docs/guides/启动工具使用说明.md) - unified startup guide
- [Docs Index](./docs/README.md) - documentation entry point
- [SuperInbox Core API](./docs/api/SuperInbox-Core-API文档.md) - backend APIs
- [SuperInbox CLI (Bilingual)](./cli/README.md) - CLI setup, commands, and FAQ
- [MCP Server Package](./packages/mcp-server/README.md) - npm MCP setup and troubleshooting

## Project Structure

```text
SuperInbox/
├── backend/        # Backend service (Express + SQLite)
├── web/            # Frontend app (Next.js + React)
├── cli/            # CLI tool
├── packages/       # Publishable packages (including MCP server)
├── start.sh        # Bash startup script
├── start.js        # Node.js startup script
└── README.md       # English README (this file)
```

## Ports

Default ports:

- Backend: 3000
- Frontend: 3001

Custom ports:

```bash
BACKEND_PORT=8080 FRONTEND_PORT=8081 ./start.sh
```

## System Requirements

- Node.js >= 18.0.0
- npm
- macOS / Linux / Windows

## License

MIT
