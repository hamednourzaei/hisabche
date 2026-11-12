# Resilience & Load Test Scripts (k6)

Run against a **staging** environment only (never production without owner approval):

```bash
k6 run -e BASE_URL=https://staging.example.com -e AUTH_TOKEN=... scripts/resilience/sync-storm.js
k6 run -e BASE_URL=https://staging.example.com -e AUTH_TOKEN=... scripts/resilience/reports-flood.js
```
