# 18 — COMPREHENSIVE TESTING STRATEGY & PARITY GATES

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/18-TESTING-STRATEGY.md`

---

## 1. Testing Pyramid & Verification Layers

```
                     ▲
                    / \
                   /E2E\             Cross-platform E2E Scenarios (Playwright)
                  /-----\
                 /  PG   \           Real PostgreSQL Transactions (*.pg.test.ts)
                /---------\
               /Integration\         Fastify app.inject HTTP & SQLite Routes
              /-------------\
             /    Adapter    \       Local vs Remote Repository Contract Suites
            /-----------------\
           /    Domain Core    \     Pure Unit, Golden Vectors, Property Tests
          /---------------------\
```

---

## 2. Separation of Proof (Strict Test Discipline)

> **MANDATORY AUDIT RULE**:
> A green test from a mock or in-memory double is **NOT proof of production correctness**.
> Proof of PostgreSQL transactions is solely a test executed against **real PostgreSQL** (`*.pg.test.ts`).
> Proof of offline SQLite execution is a test executed against **real SQLite** via `DatabaseSync`.
> Mocks and PGlite are never reported as PostgreSQL proof.

---

## 3. Automated Verification Gates per Slice

Every slice must pass these gates sequentially before completion:

```bash
# 1. Domain Purity & Boundary Gate
pnpm --filter @hisabche/validation test

# 2. Local Engine SQLite Gate
pnpm --filter @hisabche/local-engine test

# 3. Backend Real HTTP & DB Gate
pnpm --filter @hisabche/backend test

# 4. Desktop & Sync Scenarios Gate
pnpm --filter @hisabche/desktop test

# 5. Type-Check Gate (All touched packages)
pnpm --filter @hisabche/validation type-check
pnpm --filter @hisabche/local-engine type-check
pnpm --filter @hisabche/backend type-check

# 6. Lint Gate (0 errors)
pnpm --filter @hisabche/validation lint
pnpm --filter @hisabche/local-engine lint
```
