# Hisabche Nginx Edge Deployment & Rollback Runbook

**Status:** Configuration Implemented (`infra/nginx/nginx.conf`, `infra/nginx/hisabche.conf`) — Local `nginx` binary unavailable on dev host (`NOT_DEPLOYED` on live servers).

## 1. Preflight Checklist

- Verify `NGINX_RELOAD_WEBHOOK_SECRET` (>= 16 chars) is provisioned on both backend and edge controller.
- Verify TLS certificates exist at `/etc/letsencrypt/live/hisabche.com/{fullchain.pem,privkey.pem,chain.pem}`.
- Verify upstream services listen on `127.0.0.1:3001` (Fastify API) and `127.0.0.1:3000` (Next.js Web).
- Replace placeholder maintenance bypass token in `hisabche.conf` with a high-entropy secret header before enabling in production.

## 2. Configuration Validation

```bash
sudo nginx -t -c /etc/nginx/nginx.conf
```

Abort immediately if `nginx -t` exits non-zero.

## 3. Atomic Backup & Safe Deployment

```bash
TS=$(date -u +%Y%m%dT%H%M%SZ)
sudo cp -a /etc/nginx/nginx.conf "/etc/nginx/nginx.conf.bak.$TS"
sudo cp -a /etc/nginx/conf.d/hisabche.conf "/etc/nginx/conf.d/hisabche.conf.bak.$TS"
sudo install -m 0644 infra/nginx/nginx.conf /etc/nginx/nginx.conf
sudo install -m 0644 infra/nginx/hisabche.conf /etc/nginx/conf.d/hisabche.conf
sudo nginx -t && sudo nginx -s reload
```

## 4. Health & Post-Deployment Verification

```bash
curl -fsS https://hisabche.com/api/health
curl -fsS https://hisabche.com/api/health/db
```

## 5. Deterministic Rollback

```bash
sudo cp -a "/etc/nginx/nginx.conf.bak.$TS" /etc/nginx/nginx.conf
sudo cp -a "/etc/nginx/conf.d/hisabche.conf.bak.$TS" /etc/nginx/conf.d/hisabche.conf
sudo nginx -t && sudo nginx -s reload
```
