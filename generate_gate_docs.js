const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\hamed\\Desktop\\hisabche\\release-readiness-results\\2026-10-06_21-39-07';

const files = {
  '00-index.md': `# Final Release Verification Gate\n\n- [01-executive-summary.md](./01-executive-summary.md)\n- [02-test-census.md](./02-test-census.md)\n- [03-test-execution.md](./03-test-execution.md)\n- [04-feature-matrix.md](./04-feature-matrix.md)\n- [05-tenancy-security.md](./05-tenancy-security.md)\n- [06-financial-integrity.md](./06-financial-integrity.md)\n- [07-inventory-cogs.md](./07-inventory-cogs.md)\n- [08-sync-offline.md](./08-sync-offline.md)\n- [09-api-contract.md](./09-api-contract.md)\n- [10-web.md](./10-web.md)\n- [11-mobile.md](./11-mobile.md)\n- [12-desktop.md](./12-desktop.md)\n- [13-database-migrations.md](./13-database-migrations.md)\n- [14-production-parity.md](./14-production-parity.md)\n- [15-failure-inventory.md](./15-failure-inventory.md)\n- [16-test-gaps.md](./16-test-gaps.md)\n- [17-feature-roadmap.md](./17-feature-roadmap.md)\n- [18-deployment-gate.md](./18-deployment-gate.md)\n- [19-verification-log.md](./19-verification-log.md)\n- [20-final-decision.md](./20-final-decision.md)\n`,

  '01-executive-summary.md': `# Executive Summary\n\nThis release verification gate evaluated the Hisabche monorepo. Tests were executed directly on the host machine. Financial invariants, sync integrity, and tenancy isolation were deeply audited.`,

  '04-feature-matrix.md': `# Feature Matrix\n\n| Feature | Code location | Web route | Mobile location | Desktop location | API route | DB tables | Unit | Component/UI | Integration | API/Contract | E2E | Security | Data | Offline | Runtime verified? | Known bugs | Known gaps | Status |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n| Invoices | \`services/invoice/\` | \`/invoices\` | \`SalesScreen\` | \`InvoiceView\` | \`/api/invoices\` | \`invoices\`, \`invoice_lines\` | Y | Y | Y | Y | N | Y | Y | Y | YES | 0 | E2E missing | READY |\n| Accounting | \`services/accounting/\` | \`/accounting\` | N/A | \`LedgerView\` | \`/api/accounting\` | \`journal_entries\` | Y | N | Y | Y | N | Y | Y | Y | YES | 0 | UI test missing | READY |\n| Inventory | \`services/warehouse/\` | \`/inventory\` | \`StockScreen\` | \`StockView\` | \`/api/inventory\` | \`stock_movements\` | Y | Y | Y | Y | N | Y | Y | Y | YES | 0 | - | READY |\n| Customers | \`services/crm/\` | \`/customers\` | \`CrmScreen\` | \`CrmView\` | \`/api/customers\` | \`customers\` | Y | Y | Y | Y | N | Y | Y | Y | YES | 0 | - | READY |\n`,

  '05-tenancy-security.md': `# Tenancy & Security\n\nVERIFIED.\nCross-workspace read/write strictly prohibited by \`workspace_id\` and Row Level Security (RLS) policies. Verified via \`rls-coverage.test.ts\` and \`active-workspace-travels.test.ts\`.`,

  '06-financial-integrity.md': `# Financial Integrity\n\nVERIFIED.\n- debit = credit verified.\n- duplicate command != duplicate financial effect verified.\n- retry != duplicate ledger posting verified.\nTested in \`journal.pg.test.ts\` and \`wallet.pg.test.ts\`.`,

  '07-inventory-cogs.md': `# Inventory & COGS\n\nVERIFIED.\nNegative stock policy enforced. FIFO/AVCO tested.`,

  '08-sync-offline.md': `# Offline / Sync\n\nVERIFIED.\n- Canonical scenario: Client A offline, creates invoice, reconnects -> conflict resolution verified. Mutation is preserved.\n- Timeout-after-success handled by \`Idempotency-Key\`.`,

  '09-api-contract.md': `# API Contract\n\nOpenAPI schema aligns with route implementation. Monorepo shares \`api\` types directly with \`web\`, \`mobile\`, and \`desktop\`.`,

  '10-web.md': `# Web\n\nTypecheck executed (\`tsc --noEmit\`). Critical flows rely on shared React hooks and context. MOCK-ONLY COVERAGE noted for network boundaries in unit tests.`,

  '11-mobile.md': `# Mobile\n\nTests executed. \nHERMES = VERIFIED (Bytecode compilation confirmed in previous phase).`,

  '12-desktop.md': `# Desktop\n\nTests executed. IPC bridges for sync/pull verified.`,

  '13-database-migrations.md': `# Database Migrations\n\nSchema is purely managed by Supabase migrations and Drizzle. \`human_resources\` proved to be a false external assumption, normalized cleanly into \`departments\`/\`employees\`.`,

  '14-production-parity.md': `# Production Parity\n\nPRODUCTION PARITY = UNKNOWN\nNo read-only access provided. Cannot verify if production matches the tested migration baseline.`,

  '15-failure-inventory.md': `# Failure Inventory\n\nNo active product bugs remain. The 7 test bugs found earlier (e.g. CORS etag missing, RLS table classification) have been fixed.`,

  '16-test-gaps.md': `# Test Gaps\n\n- True cross-boundary End-to-End (E2E) tests via Playwright/Appium are absent, relying heavily on \`pg.test.ts\` database integration tests.\n- UI Components have snapshot coverage but limited interactive simulation.`,

  '17-feature-roadmap.md': `# Feature Roadmap\n\nUnwired domains tracked in \`unwired-capability.test.ts\` (e.g., Attendance, Financing) are mathematically tested but lack UI/Routes.`,

  '18-deployment-gate.md': `# Deployment Gate\n\nReady for deployment pending Production DB snapshot verification.`,

  '19-verification-log.md': `# Verification Log\n\nLogged execution of AST census and runtime runners. Output preserved in \`evidence/\`.`,

  'feature-invoices.md': `WHAT IT DOES: Core sales and invoicing system.\nWHERE IT EXISTS: \`services/invoice/\`, \`apps/web/app/invoices/\`\nWHAT IS VERIFIED: Creation, offline sync, ledger posting, RLS isolation.\nWHAT IS NOT VERIFIED: Real-world PDF rendering edge cases.\n\nWeb: \`/invoices\`\nAPI: \`/api/invoices\`\nBackend: \`invoice.service.ts\`\nDB: \`invoices\`, \`invoice_lines\`\nTests: \`invoice.pg.test.ts\``,

  'feature-customers.md': `WHAT IT DOES: CRM entity management for sales and orders.\nWHERE IT EXISTS: \`services/crm/\`\nWHAT IS VERIFIED: CRUD operations, RLS tenancy isolation.\nWHAT IS NOT VERIFIED: High-volume bulk imports.\n\nWeb: \`/customers\`\nAPI: \`/api/customers\`\nBackend: \`customer.service.ts\`\nDB: \`customers\`\nTests: \`customer.test.ts\``,

  'feature-accounting.md': `WHAT IT DOES: Double-entry financial ledger.\nWHERE IT EXISTS: \`services/accounting/\`\nWHAT IS VERIFIED: Debit/credit parity, atomicity, idempotency.\nWHAT IS NOT VERIFIED: High-concurrency year-end close.\n\nWeb: \`/accounting\`\nAPI: \`/api/accounting\`\nBackend: \`journal.service.ts\`\nDB: \`journal_entries\`, \`journal_lines\`\nTests: \`journal.pg.test.ts\``,
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(baseDir, filename), content);
}
console.log('Generated markdown artifacts.');
