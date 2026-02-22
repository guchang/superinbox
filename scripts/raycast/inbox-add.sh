#!/usr/bin/env bash
# @raycast.schemaVersion 1
# @raycast.title Inbox Add
# @raycast.mode compact
# @raycast.icon 📥
# @raycast.argument1 { "type": "text", "placeholder": "add everything" }
# @raycast.packageName SuperInbox
# @raycast.author xssptmxk
# @raycast.authorURL https://raycast.com/xssptmxk

CLI_CMD=()
if [ -n "${SINBOX_CLI:-}" ] && [ -x "$SINBOX_CLI" ]; then
  CLI_CMD=("$SINBOX_CLI")
elif command -v sinbox >/dev/null 2>&1; then
  CLI_CMD=("$(command -v sinbox)")
elif command -v npx >/dev/null 2>&1; then
  CLI_CMD=(npx -y superinbox-cli)
fi

CONTENT="$1"

if [ -z "$CONTENT" ]; then
  echo "❌ No content provided"
  exit 1
fi

if [ ${#CLI_CMD[@]} -eq 0 ]; then
  echo "❌ sinbox CLI not found"
  echo "Install CLI: cd /path/to/SuperInbox/cli && npm install && npm link"
  exit 1
fi

echo "⏳ Adding to inbox..."
OUTPUT=$("${CLI_CMD[@]}" add "$CONTENT" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Successfully added to SuperInbox!"
  echo ""
  echo "$OUTPUT" | head -n 3
else
  echo "❌ Failed to add"
  echo ""
  echo "$OUTPUT"
  exit 1
fi
