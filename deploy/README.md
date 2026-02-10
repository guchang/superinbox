# Docker Production Deployment (HTTPS) / 生产环境部署（HTTPS）

This guide shows how to deploy SuperInbox with Docker Compose and HTTPS.  
本指南用于通过 Docker Compose + HTTPS 部署 SuperInbox。

## 1) Prepare env file / 准备环境变量

```bash
cp deploy/env/.env.prod.example deploy/env/.env.prod
```

Edit `deploy/env/.env.prod` and make sure these are set:  
编辑 `deploy/env/.env.prod`，确保至少设置以下变量：

> Nginx virtual host config is generated from `deploy/nginx/templates/superinbox.conf.template` using `DOMAIN`.  
> Nginx 虚拟主机配置会基于 `DOMAIN` 从模板自动生成。

- `DOMAIN`
- `LETSENCRYPT_EMAIL`
- `JWT_SECRET`

## 2) Bootstrap HTTPS and start / 初始化 HTTPS 并启动

```bash
./deploy/scripts/init-letsencrypt.sh
```

## 3) Check status / 查看状态

```bash
docker compose -f docker-compose.prod.yml --env-file deploy/env/.env.prod ps
```

## 4) View logs / 查看日志

```bash
docker compose -f docker-compose.prod.yml --env-file deploy/env/.env.prod logs -f
```

## 5) Routine operations / 日常运维命令

```bash
# restart all / 重启全部服务
docker compose -f docker-compose.prod.yml --env-file deploy/env/.env.prod restart

# stop all / 停止全部服务
docker compose -f docker-compose.prod.yml --env-file deploy/env/.env.prod down

# rebuild and start / 重建并启动
docker compose -f docker-compose.prod.yml --env-file deploy/env/.env.prod up -d --build
```

## 6) Channel Bot standalone deployment (optional) / Channel Bot 独立部署（可选）

Channel Bot is recommended as an optional standalone service.  
Channel Bot 推荐作为可选独立服务部署。

```bash
# prepare config / 首次准备配置
cp deploy/channel-bot/.env.prod.example deploy/channel-bot/.env.prod

# fill required vars / 填写关键变量
# at least CORE_API_URL; Telegram: TELEGRAM_BOT_TOKEN;
# Lark: LARK_APP_ID / LARK_APP_SECRET
vi deploy/channel-bot/.env.prod

# deploy or update / 启动或更新
./deploy/channel-bot/update.sh
```

Useful commands / 常用命令:

```bash
# status / 查看状态
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod ps

# logs / 查看日志
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod logs -f channel-bot

# stop / 停止服务
docker compose -f deploy/channel-bot/docker-compose.yml --env-file deploy/channel-bot/.env.prod down
```

## Related Docs / 相关文档

- [Project README](../README.md)
- [项目中文文档](../README.zh-CN.md)
- [Channel Bot README](../channel-bot/README.md)
