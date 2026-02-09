#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="deploy/env/.env.prod"
DATA_PATH="deploy/certbot"
RSA_KEY_SIZE=4096

if [ ! -f "$ENV_FILE" ]; then
  echo "[ERROR] Missing $ENV_FILE"
  echo "Copy deploy/env/.env.prod.example to deploy/env/.env.prod first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

DOMAIN="${DOMAIN:-}"
EMAIL="${LETSENCRYPT_EMAIL:-}"
STAGING="${STAGING:-0}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "[ERROR] DOMAIN or LETSENCRYPT_EMAIL is empty in $ENV_FILE"
  exit 1
fi

mkdir -p "$DATA_PATH/conf" "$DATA_PATH/www"

if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ] || [ ! -e "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
  echo "[INFO] Downloading recommended TLS parameters..."
  curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/_internal/tls_configs/options-ssl-nginx.conf > "$DATA_PATH/conf/options-ssl-nginx.conf"
  curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/_internal/tls_configs/ssl-dhparams.pem > "$DATA_PATH/conf/ssl-dhparams.pem"
fi

echo "[INFO] Creating temporary self-signed certificate for bootstrapping..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --entrypoint \
  "sh -c 'mkdir -p /etc/letsencrypt/live/$DOMAIN && openssl req -x509 -nodes -newkey rsa:2048 -days 1 -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem -subj /CN=localhost'" \
  certbot

echo "[INFO] Starting nginx..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d nginx

echo "[INFO] Removing temporary certificate..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --entrypoint \
  "sh -c 'rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN && rm -f /etc/letsencrypt/renewal/$DOMAIN.conf'" \
  certbot

STAGING_ARG=""
if [ "$STAGING" != "0" ]; then
  STAGING_ARG="--staging"
fi

echo "[INFO] Requesting Let's Encrypt certificate for $DOMAIN ..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  $STAGING_ARG \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  --rsa-key-size "$RSA_KEY_SIZE" \
  --agree-tos \
  --force-renewal

echo "[INFO] Reloading nginx..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec nginx nginx -s reload

echo "[INFO] Starting all services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "[SUCCESS] HTTPS deployment bootstrap complete for $DOMAIN"
