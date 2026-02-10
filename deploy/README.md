# Docker Production Deployment (HTTPS)

## 1) Prepare env file

```bash
cp deploy/env/.env.prod.example deploy/env/.env.prod
```

Edit `deploy/env/.env.prod` and make sure these are set:

> Note: Nginx virtual host config is generated from `deploy/nginx/templates/superinbox.conf.template` using the `DOMAIN` value from `.env.prod`.

- `DOMAIN`
- `LETSENCRYPT_EMAIL`
- `LLM_API_KEY`
- `DEFAULT_API_KEY`
- `JWT_SECRET`
- `ENCRYPTION_KEY`

## 2) Bootstrap HTTPS certificate and start stack

```bash
./deploy/scripts/init-letsencrypt.sh
```

## 3) Check status

```bash
docker compose -f docker-compose.prod.yml --env-file deploy/env/.env.prod ps
```

## 4) View logs

```bash
docker compose -f docker-compose.prod.yml --env-file deploy/env/.env.prod logs -f
```

## 5) Routine operations

```bash
# restart all services
docker compose -f docker-compose.prod.yml --env-file deploy/env/.env.prod restart

# stop all services
docker compose -f docker-compose.prod.yml --env-file deploy/env/.env.prod down

# rebuild and restart
docker compose -f docker-compose.prod.yml --env-file deploy/env/.env.prod up -d --build
```

## 6) Channel Bot 独立部署（可选）

Channel Bot 推荐独立部署，不与主站 web/backend 绑定发布。

```bash
# 首次准备配置
cp deploy/channel-bot/.env.prod.example deploy/channel-bot/.env.prod

# 填写关键变量（至少 CORE_API_URL / CORE_API_KEY / TELEGRAM_BOT_TOKEN）
vi deploy/channel-bot/.env.prod

# 启动或更新 Channel Bot
./deploy/channel-bot/update.sh
```

常用命令：

```bash
# 查看状态
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod ps

# 查看日志
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod logs -f channel-bot

# 停止服务
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod down
```
