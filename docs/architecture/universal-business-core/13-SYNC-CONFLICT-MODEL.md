# 13 — UNIFIED SYNC PROTOCOL & THREE-TIER CONFLICT MODEL

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/13-SYNC-CONFLICT-MODEL.md`

---

## 1. Sync Architecture Topology

Sync functions across two strictly separated channels:

1. **Pull (Server $\rightarrow$ SQLite)**:
   - Initial sync: Keyset pagination through `/sync/snapshot` (includes version, id, and full operational records).
   - Incremental sync: Change-log delta stream driven by cursor watermarks.
2. **Push (SQLite $\rightarrow$ Server)**:
   - Evaluated by `routeFor({ entity, operation, payload })`:
     - **Domain Route** (`POST /api/invoices`, `POST /api/payments`): All financial, stock, and status mutations move through domain services.
     - **Versioned Route** (`POST /api/sync/push`): Descriptive data only (e.g. phone numbers, categories).

---

## 2. Three-Tier Conflict Resolution Framework

```
                          Incoming Conflict Event
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
 [Tier 1: Auto]           [Tier 2: Business Rule]      [Tier 3: Human Review]
Descriptive attributes    Inventory / Credit caps      Reversals & Double Payouts
Latest version wins       Re-evaluate constraint       Placed in `sync_conflicts`
Zero financial effect     Adjust quantity or overage   Requires manager resolution
```

1. **Tier 1: Auto-Resolvable (`AUTO_RESOLVABLE`)**:
   - Applies only to non-financial descriptive attributes (e.g., customer address, product barcode label).
   - Higher version number or newest server timestamp wins.
2. **Tier 2: Business Rule Resolution (`BUSINESS_RULE_RESOLUTION`)**:
   - Stock movements: If two devices concurrently sell stock that drives balance negative, evaluate tenant's `NegativeStockPolicy`. If allowed, allow with warning; if refused, place sale in back-order state.
   - Package credits: If client redemptions exceed remaining credits, convert excess to `BILLABLE_OVERAGE`.
3. **Tier 3: Human Review (`HUMAN_REVIEW`)**:
   - Financial void/reversal conflicts or concurrent cash refunds against the same document.
   - Never overwritten. Staged in `sync_conflicts` with full audit history for owner decision.
