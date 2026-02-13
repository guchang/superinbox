# @superinbox/mcp-server

SuperInbox MCP server over stdio, published as an npm executable package.

Project: [guchang/superinbox](https://github.com/guchang/superinbox)

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
      "args": ["-y", "@superinbox/mcp-server@<version>"],
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

- `inbox.create` / `inbox_create`: create a new inbox item (text/url), or upload local files via `filePath`/`filePaths`/`fileBase64`
- `inbox.list` / `inbox_list`: list items with filters and pagination
- `inbox.search` / `inbox_search`: search items by keyword
- `inbox.get` / `inbox_get`: fetch one item by `id`
- `inbox.update` / `inbox_update`: update item `content` and/or `category` by `id`
- `inbox.delete` / `inbox_delete`: delete one item by `id`
- `category.list` / `category_list`: list categories
- `category.create` / `category_create`: create category with `key` and `name`
- `category.update` / `category_update`: rename category by `id`
- `category.delete` / `category_delete`: delete category by `id` (records are migrated to `trash`)

## Troubleshooting

- `SUPERINBOX_API_KEY is not set`
  - Add `SUPERINBOX_API_KEY` in MCP server `env`.
- `HTTP 401` or `HTTP 403`
  - API key is invalid, expired, or lacks permission.
- `ECONNREFUSED` or timeout
  - Ensure backend is running and `SUPERINBOX_BASE_URL` is reachable from the MCP client host.
- `File not found: ...`
  - When using `filePath`/`filePaths` (or legacy `type="file"` + `content="/path/to/file"`), the file must exist on the same machine where the MCP server process is running. Prefer absolute paths.
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
