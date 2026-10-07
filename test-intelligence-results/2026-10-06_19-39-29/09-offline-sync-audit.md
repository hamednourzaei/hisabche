# Offline Sync Audit

- offline create: PRESERVED locally, likely REJECTED on server if conflicts exist.
- offline update: LOST if optimistic version doesn't match.
- offline delete: UNKNOWN.
- optimistic concurrency: Server drops stale writes.
- conflict resolution: LOST.
