# @superinbox/mcp-server

SuperInbox MCP server over stdio, published as an npm executable package.

## Requirements

- Node.js >= 18
- A running SuperInbox backend (`http://127.0.0.1:3000` by default)
- A valid SuperInbox API key

## Quick Start

Use `npx` directly from your MCP client config:

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

For deterministic environments, pin to an exact version:

```json
{
  "mcpServers": {
    "superinbox": {
      "command": "npx",
      "args": ["-y", "@superinbox/mcp-server@0.1.0"],
      "env": {
        "SUPERINBOX_BASE_URL": "http://127.0.0.1:3000",
        "SUPERINBOX_API_KEY": "sk_xxx"
      }
    }
  }
}
```

## Runtime Environment Variables

- `SUPERINBOX_BASE_URL`: SuperInbox backend base URL (default: `http://127.0.0.1:3000`)
- `SUPERINBOX_API_KEY`: SuperInbox API key (required)

## Exposed MCP Tools

- `inbox.create` / `inbox_create`: create a new inbox item
- `inbox.list` / `inbox_list`: list items with filters and pagination
- `inbox.search` / `inbox_search`: search items by keyword
- `inbox.get` / `inbox_get`: fetch one item by `id`

## Troubleshooting

- `SUPERINBOX_API_KEY is not set`
  - Add `SUPERINBOX_API_KEY` in MCP server `env`.
- `HTTP 401` or `HTTP 403`
  - API key is invalid, expired, or lacks permission.
- `ECONNREFUSED` or timeout
  - Ensure backend is running and `SUPERINBOX_BASE_URL` is reachable from the MCP client host.
- `npx: command not found`
  - Install Node.js 18+ and ensure Node/npm are in `PATH`.

## Local Development

```bash
npm install
npm run build
SUPERINBOX_BASE_URL=http://127.0.0.1:3000 SUPERINBOX_API_KEY=sk_xxx node dist/index.js
```

## Maintainer: Publish

```bash
npm login
npm publish --access public
```
