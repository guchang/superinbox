#!/usr/bin/env bash
# @raycast.schemaVersion 1
# @raycast.title Inbox List
# @raycast.mode fullOutput
# @raycast.icon 📋
# @raycast.packageName SuperInbox
# @raycast.description List recent items in SuperInbox
# @raycast.author xssptmxk
# @raycast.authorURL https://github.com/xssptmxk

CLI_CMD=()
if [ -n "${SINBOX_CLI:-}" ] && [ -x "$SINBOX_CLI" ]; then
  CLI_CMD=("$SINBOX_CLI")
elif command -v sinbox >/dev/null 2>&1; then
  CLI_CMD=("$(command -v sinbox)")
elif command -v npx >/dev/null 2>&1; then
  CLI_CMD=(npx -y superinbox-cli)
fi

if [ ${#CLI_CMD[@]} -eq 0 ]; then
  echo "❌ sinbox CLI not found"
  echo "Install CLI: cd /path/to/SuperInbox/cli && npm install && npm link"
  exit 1
fi

ITEMS=$("${CLI_CMD[@]}" list --limit "${SINBOX_LIMIT:-10}" --json 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Failed to fetch items"
  echo "$ITEMS"
  exit 1
fi

echo "$ITEMS" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));

if (!Array.isArray(data) || data.length === 0) {
  console.log('📭 No items found');
  process.exit(0);
}

console.log('📋 SuperInbox - Recent Items\\n');

data.forEach((item, index) => {
  const id = (item.id || '').substring(0, 8);
  const content = (item.originalContent || item.content || '').substring(0, 50).replace(/\\n/g, ' ');
  const status = item.status || 'unknown';
  const category = item.category || 'unknown';
  const date = new Date(item.createdAt).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const paddedIndex = String(index + 1).padStart(2, ' ');
  const paddedId = id.padEnd(8, ' ');
  const paddedStatus = status.padEnd(10, ' ');
  const paddedCategory = category.padEnd(8, ' ');

  console.log(\`\${paddedIndex}. \${content}\`);
  console.log(\`    [\${paddedId}] \${paddedCategory} | \${paddedStatus} | \${date}\`);
  console.log('');
});

console.log(\`Total: \${data.length} items\`);
"
