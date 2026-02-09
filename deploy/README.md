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
