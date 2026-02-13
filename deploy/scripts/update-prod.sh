#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

COMPOSE_FILE="$REPO_DIR/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/deploy/env/.env.prod"
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

echo "[1/9] Checking required files..."
for file in \
  "$COMPOSE_FILE" \
  "$ENV_FILE"
do
  if [[ ! -f "$file" ]]; then
    echo "[ERROR] Missing required file: $file"
    exit 1
  fi
done

echo "[2/9] Checking repository..."
cd "$REPO_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  if [[ "$AUTO_STASH" -eq 1 ]]; then
    echo "[INFO] Tracked changes found, stashing tracked files only..."
    git stash push -m "prod-auto-stash-$(date +%Y%m%d%H%M%S)"
  else
    echo "[ERROR] Tracked file changes detected."
    echo "Run with --stash, or handle manually:"
    echo "  cd $REPO_DIR && git stash push -m \"prod-local\""
    exit 1
  fi
fi

echo "[3/9] Pulling latest code..."
git fetch "$REMOTE"
git pull --ff-only "$REMOTE" "$BRANCH"

echo "[4/9] Rebuilding and restarting backend/web..."
if [[ "$BUILD" -eq 1 ]]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
else
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
fi

echo "[5/9] Container status"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo "[6/9] Recent logs (backend/web)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=120 backend web || true

echo "[7/9] Health check (backend)"
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend node -e "require('http').get('http://localhost:3001/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"; then
  echo "[SUCCESS] Backend health check OK"
else
  echo "[ERROR] Backend health check failed, please inspect logs."
  exit 1
fi

echo "[8/9] Health check (web)"
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T web node -e "require('http').get('http://localhost:3000',(r)=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"; then
  echo "[SUCCESS] Web health check OK"
else
  echo "[ERROR] Web health check failed, please inspect logs."
  exit 1
fi

echo "[9/9] Done"

