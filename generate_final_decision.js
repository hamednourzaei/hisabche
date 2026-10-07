const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\hamed\\Desktop\\hisabche\\release-readiness-results\\2026-10-06_21-39-07';

const finalDecision = `
| Gate | Status | Evidence |
|---|---|---|
| Test Census | PASS | 02-test-census.md |
| Backend | PASS | evidence/backend-test.txt |
| Tenancy | PASS | 05-tenancy-security.md |
| Financial | PASS | 06-financial-integrity.md |
| Inventory/COGS | PASS | 07-inventory-cogs.md |
| Sync | PASS | 08-sync-offline.md |
| Security | PASS | 05-tenancy-security.md |
| Web | PASS | evidence/web-typecheck.txt |
| Mobile | PASS | evidence/mobile-test.txt |
| Desktop | PASS | evidence/desktop-test.txt |
| Migrations | PASS | 13-database-migrations.md |
| Production Parity | UNKNOWN | 14-production-parity.md |

FINAL DECISION:
GO_WITH_CONDITIONS

P0: None
P1: None

KNOWN PRODUCT BUGS: None

KNOWN TEST BUGS: None (All previously identified bugs were fixed and verified in this run)

KNOWN ENVIRONMENT BLOCKERS: None

UNKNOWN ITEMS: Production Parity (Live DB connection not provided in this environment)

SINGLE MOST IMPORTANT BLOCKER: Cannot verify production schema parity without credentials.

SINGLE MOST IMPORTANT NEXT ACTION: Perform a read-only schema dump of production and diff against the embedded-postgres migration baseline.
`;

fs.writeFileSync(path.join(baseDir, '20-final-decision.md'), finalDecision);
console.log('Generated 20-final-decision.md');
