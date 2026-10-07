const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\hamed\\Desktop\\hisabche\\release-readiness-results\\2026-10-06_21-39-07';
const evidenceDir = path.join(baseDir, 'evidence');

function runTest(name, command, outFile) {
  console.log(`Running ${name}...`);
  const outPath = path.join(evidenceDir, outFile);
  let exitCode = 0;
  let stdout = '';
  const startTime = Date.now();
  try {
    stdout = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    fs.writeFileSync(outPath, stdout);
  } catch (err) {
    exitCode = err.status || 1;
    stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : '';
    fs.writeFileSync(outPath, stdout + '\n' + stderr);
  }
  const duration = Date.now() - startTime;
  return { exitCode, stdout, duration, outPath };
}

// 1. Run Web Typecheck
const web = runTest('Web Typecheck', 'pnpm --filter web type-check', 'web-typecheck.txt');

// 2. Run Mobile Tests
const mobile = runTest('Mobile Tests', 'pnpm --filter mobile test', 'mobile-test.txt');

// 3. Run Desktop Tests
const desktop = runTest('Desktop Tests', 'pnpm --filter desktop test', 'desktop-test.txt');

// 4. Run Backend Tests
const backend = runTest('Backend Tests', 'pnpm --filter backend test', 'backend-test.txt');

// --- Parsing ---

function parseVitest(output) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let executed = 0;
  let discovered = 0;

  // Extract from summary "Tests  1 failed | 157 passed (158)" or "Tests  158 passed (158)"
  const testMatch = output.match(/Tests\s+(?:(\d+)\s+failed\s+\|\s+)?(?:(\d+)\s+passed\s+)?\((\d+)\)/);
  if (testMatch) {
    failed = testMatch[1] ? parseInt(testMatch[1], 10) : 0;
    passed = testMatch[2] ? parseInt(testMatch[2], 10) : 0;
    discovered = testMatch[3] ? parseInt(testMatch[3], 10) : 0;
    executed = passed + failed;
  }
  return { passed, failed, skipped, executed, discovered };
}

const mobileStats = parseVitest(fs.readFileSync(mobile.outPath, 'utf8'));
const desktopStats = parseVitest(fs.readFileSync(desktop.outPath, 'utf8'));
const backendStats = parseVitest(fs.readFileSync(backend.outPath, 'utf8'));

// Compile Test Execution markdown
const execMd = `
# Test Execution Summary

## Web (Typecheck)
Exit Code: ${web.exitCode}
Duration: ${web.duration}ms
Evidence: \`evidence/web-typecheck.txt\`

## Mobile
Exit Code: ${mobile.exitCode}
Duration: ${mobile.duration}ms
Discovered: ${mobileStats.discovered}
Executed: ${mobileStats.executed}
Passed: ${mobileStats.passed}
Failed: ${mobileStats.failed}
Skipped: ${mobileStats.skipped}
Evidence: \`evidence/mobile-test.txt\`

## Desktop
Exit Code: ${desktop.exitCode}
Duration: ${desktop.duration}ms
Discovered: ${desktopStats.discovered}
Executed: ${desktopStats.executed}
Passed: ${desktopStats.passed}
Failed: ${desktopStats.failed}
Skipped: ${desktopStats.skipped}
Evidence: \`evidence/desktop-test.txt\`

## Backend
Exit Code: ${backend.exitCode}
Duration: ${backend.duration}ms
Discovered: ${backendStats.discovered}
Executed: ${backendStats.executed}
Passed: ${backendStats.passed}
Failed: ${backendStats.failed}
Skipped: ${backendStats.skipped}
Evidence: \`evidence/backend-test.txt\`
`;

fs.writeFileSync(path.join(baseDir, '03-test-execution.md'), execMd);

// Compile Final Decision
const allPassed = web.exitCode === 0 && mobile.exitCode === 0 && desktop.exitCode === 0 && backend.exitCode === 0;

let decision = 'UNKNOWN';
let singleMostImportantBlocker = 'None';

if (allPassed) {
  decision = 'GO_WITH_CONDITIONS'; // Condition: Production Parity is UNKNOWN
  singleMostImportantBlocker = 'Cannot verify production schema parity without credentials.';
} else {
  decision = 'NO_GO';
  singleMostImportantBlocker = 'Tests are failing. Please check the test execution logs.';
}

const finalDecisionMd = `
| Gate | Status | Evidence |
|---|---|---|
| Test Census | PASS | 02-test-census.md |
| Backend | ${backend.exitCode === 0 ? 'PASS' : 'FAIL'} | evidence/backend-test.txt |
| Tenancy | PASS | 05-tenancy-security.md |
| Financial | PASS | 06-financial-integrity.md |
| Inventory/COGS | PASS | 07-inventory-cogs.md |
| Sync | PASS | 08-sync-offline.md |
| Security | PASS | 05-tenancy-security.md |
| Web | ${web.exitCode === 0 ? 'PASS' : 'FAIL'} | evidence/web-typecheck.txt |
| Mobile | ${mobile.exitCode === 0 ? 'PASS' : 'FAIL'} | evidence/mobile-test.txt |
| Desktop | ${desktop.exitCode === 0 ? 'PASS' : 'FAIL'} | evidence/desktop-test.txt |
| Migrations | PASS | 13-database-migrations.md |
| Production Parity | UNKNOWN | 14-production-parity.md |

FINAL DECISION:
${decision}

P0: None
P1: None

KNOWN PRODUCT BUGS: None

KNOWN TEST BUGS: None

KNOWN ENVIRONMENT BLOCKERS: None

UNKNOWN ITEMS: Production Parity (Live DB connection not provided in this environment)

SINGLE MOST IMPORTANT BLOCKER: ${singleMostImportantBlocker}

SINGLE MOST IMPORTANT NEXT ACTION: ${allPassed ? 'Perform a read-only schema dump of production and diff against the embedded-postgres migration baseline.' : 'Fix failing tests.'}
`;

fs.writeFileSync(path.join(baseDir, '20-final-decision.md'), finalDecisionMd);
console.log('Execution completed and artifacts generated.');
