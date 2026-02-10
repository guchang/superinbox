#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$REPO_DIR/deploy/channel-bot"
BRANCH="main"
REMOTE="origin"
BUILD=1
AUTO_STASH=0

for arg in "$@"; do
  case "$arg" in
    --no-build)
      BUILD=0
      ;;
    --stash)
      AUTO_STASH=1
      ;;
  esac
done

echo "[1/8] Checking repository..."
cd "$REPO_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  if [[ "$AUTO_STASH" -eq 1 ]]; then
    echo "[INFO] Tracked changes found, stashing tracked files only..."
    git stash push -m "channel-bot-auto-stash-$(date +%Y%m%d%H%M%S)"
  else
    echo "[ERROR] Tracked file changes detected."
    echo "Run with --stash, or handle manually:"
    echo "  cd $REPO_DIR && git stash push -m \"channel-bot-local\""
    exit 1
  fi
fi

echo "[2/8] Pulling latest code..."
git fetch "$REMOTE"
git pull --ff-only "$REMOTE" "$BRANCH"

echo "[3/8] Ensuring deploy files exist..."
for file in \
  "$DEPLOY_DIR/docker-compose.yml" \
  "$DEPLOY_DIR/.env.prod" \
  "$DEPLOY_DIR/update.sh" \
  "$REPO_DIR/channel-bot/Dockerfile.runtime" \
  "$REPO_DIR/channel-bot/package.json"
do
  if [[ ! -f "$file" ]]; then
    echo "[ERROR] Missing required file: $file"
    exit 1
  fi
done

echo "[4/8] Rebuilding and restarting channel-bot..."
cd "$DEPLOY_DIR"
if [[ "$BUILD" -eq 1 ]]; then
  docker compose up -d --build
else
  docker compose up -d
fi

echo "[5/8] Container status"
docker compose ps

echo "[6/8] Recent logs"
docker compose logs --tail=80 channel-bot || true

echo "[7/8] Health check"
if docker compose exec -T channel-bot node -e "require('http').get('http://localhost:3002/api/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"; then
  echo "[SUCCESS] Channel bot deploy finished"
else
  echo "[WARN] Channel bot health check failed, please inspect logs."
  exit 1
fi

echo "[8/8] Done"
