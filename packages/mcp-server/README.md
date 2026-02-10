# @superinbox/mcp-server

SuperInbox MCP server over stdio.

## Runtime environment variables

- `SUPERINBOX_BASE_URL`: SuperInbox backend base URL (default: `http://127.0.0.1:3000`)
- `SUPERINBOX_API_KEY`: SuperInbox API key (required)

## Usage (MCP client config)

```json
{
  "mcpServers": {
    "superinbox": {
      "command": "npx",
      "args": ["-y", "@superinbox/mcp-server"],
      "env": {
        "SUPERINBOX_BASE_URL": "https://superinbox.top",
        "SUPERINBOX_API_KEY": "sk_xxx"
      }
    }
  }
}
```

## Development

```bash
npm install
npm run build
SUPERINBOX_BASE_URL=http://127.0.0.1:3000 SUPERINBOX_API_KEY=sk_xxx node dist/index.js
```

## Publish

```bash
npm login
npm publish --access public
```
