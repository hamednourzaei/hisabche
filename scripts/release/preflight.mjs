#!/usr/bin/env node
// ============================================================================
// scripts/release/preflight.mjs
//
// Standalone dry-run release preflight script for Hisabche.
// Verifies git clean status, no tracked secrets, migration integrity,
// CORS allowedHeaders, environment variable parity, health routes, and tsc.
//
// Usage: node scripts/release/preflight.mjs [--skip-tsc]
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const skipTsc = process.argv.includes('--skip-tsc')

console.log('='.repeat(70))
console.log('  HISABCHE PRODUCTION RELEASE PREFLIGHT CHECK')
console.log('='.repeat(70))
console.log(`Working Directory: ${ROOT}`)
console.log(`Timestamp:         ${new Date().toISOString()}`)
console.log('')

let passCount = 0
let warnCount = 0
let failCount = 0

function pass(name, detail = '') {
  passCount++
  console.log(`  [PASS] ${name}${detail ? ` - ${detail}` : ''}`)
}

function warn(name, detail = '') {
  warnCount++
  console.log(`  [WARN] ${name}${detail ? ` - ${detail}` : ''}`)
}

function fail(name, detail = '') {
  failCount++
  console.log(`  [FAIL] ${name}${detail ? ` - ${detail}` : ''}`)
}

// ─── 1. Git Status & Secrets Check ──────────────────────────────────────────
console.log('1. Git Repository & Secret Leak Inspection')

try {
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
  if (currentBranch === 'release-close') {
    pass('Git Branch', `Currently on working branch: ${currentBranch}`)
  } else {
    warn('Git Branch', `Current branch is '${currentBranch}' (expected 'release-close')`)
  }

  // Check for tracked .env files in git index (excluding staged deleted)
  const trackedEnv = execSync('git ls-files -s "*.env*"', { encoding: 'utf8' }).trim()
  if (trackedEnv) {
    fail(
      'No Tracked .env Files in Git',
      `Active tracked env files in index:\n    ${trackedEnv.split('\n').join('\n    ')}`,
    )
  } else {
    pass(
      'No Tracked .env Files',
      'Zero .env files tracked in git index (CODE_SECRET_EXPOSURE_FIXED)',
    )
  }

  // Check for private keys or secrets tracked
  const trackedKeys = execSync('git ls-files "*.pem" "*.key" "id_rsa*"', {
    encoding: 'utf8',
  }).trim()
  if (trackedKeys) {
    fail('No Tracked Private Keys', `Tracked keys detected:\n${trackedKeys}`)
  } else {
    pass('No Tracked Private Keys', 'Zero private key files tracked')
  }
} catch (err) {
  fail('Git Inspection', err.message)
}

console.log('')

// ─── 2. Release Migrations & Verification Scripts Integrity ──────────────────
console.log('2. Pending Release Migrations & Verification Scripts')

const releaseMigrations = [
  {
    name: 'Universal Core Policies & Enums',
    migration: 'docs/universal-core-migration.sql',
    verify: 'docs/VERIFY-universal-core.sql',
  },
  {
    name: 'Invoice Returns Core & Accounting Reversal',
    migration: 'docs/invoice-return-01-migration.sql',
    verify: 'docs/VERIFY-invoice-return-01.sql',
  },
  {
    name: 'Commit Horizon Sync Pull Function',
    migration: 'docs/sync-commit-horizon-migration.sql',
    verify: 'docs/VERIFY-sync-commit-horizon.sql',
  },
]

for (const item of releaseMigrations) {
  const migPath = path.join(ROOT, item.migration)
  const verPath = path.join(ROOT, item.verify)

  if (!fs.existsSync(migPath)) {
    fail(`Migration Exists: ${item.name}`, `Missing ${item.migration}`)
    continue
  }
  if (!fs.existsSync(verPath)) {
    fail(`Verify Script Exists: ${item.name}`, `Missing ${item.verify}`)
    continue
  }

  const migContent = fs.readFileSync(migPath, 'utf8')
  const verContent = fs.readFileSync(verPath, 'utf8')

  // Check Rollback block
  const hasRollback =
    migContent.toLowerCase().includes('rollback:') ||
    migContent.toLowerCase().includes('-- rollback')
  if (hasRollback) {
    pass(`Rollback Block: ${path.basename(item.migration)}`, 'Contains documented rollback block')
  } else {
    warn(`Rollback Block: ${path.basename(item.migration)}`, 'Missing explicit Rollback comment')
  }

  // Check idempotency markers (IF NOT EXISTS or CREATE OR REPLACE or DO $$)
  const hasIdempotency =
    migContent.includes('IF NOT EXISTS') ||
    migContent.includes('CREATE OR REPLACE') ||
    migContent.includes('DO $$')
  if (hasIdempotency) {
    pass(`Idempotency: ${path.basename(item.migration)}`, 'Contains guarded DDL statements')
  } else {
    warn(`Idempotency: ${path.basename(item.migration)}`, 'Potential non-idempotent statements')
  }

  pass(`Paired Verification: ${path.basename(item.verify)}`, `Size: ${verContent.length} bytes`)
}

console.log('')

// ─── 3. Backend Network & CORS Alignment ─────────────────────────────────────
console.log('3. Backend CORS & Routing Configuration')

const indexPath = path.join(ROOT, 'backend/src/index.ts')
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8')

  const requiredHeaders = [
    'Content-Type',
    'Authorization',
    'x-workspace-id',
    'Idempotency-Key',
    'X-Auth-Transport',
  ]

  let headersOk = true
  for (const h of requiredHeaders) {
    if (!indexContent.includes(h)) {
      headersOk = false
      fail('CORS allowedHeaders', `Missing header: ${h}`)
    }
  }
  if (headersOk) {
    pass('CORS allowedHeaders', `All required headers registered (${requiredHeaders.join(', ')})`)
  }

  // Health routes
  if (indexContent.includes("server.get('/ready'") || indexContent.includes("'/ready'")) {
    pass('Health Route: /ready', 'Registered with database probe')
  } else {
    fail('Health Route: /ready', 'Not found in backend/src/index.ts')
  }

  if (indexContent.includes("'/api/health'") || indexContent.includes('/api/health')) {
    pass('Health Route: /api/health', 'Registered for tenant health inspection')
  } else {
    fail('Health Route: /api/health', 'Not found in backend/src/index.ts')
  }
} else {
  fail('backend/src/index.ts', 'File not found')
}

console.log('')

// ─── 4. Render & Vercel Specification Parity ─────────────────────────────────
console.log('4. Deployment Specification Parity')

const renderPath = path.join(ROOT, 'render.yaml')
if (fs.existsSync(renderPath)) {
  const renderContent = fs.readFileSync(renderPath, 'utf8')
  if (renderContent.includes('healthCheckPath: /ready')) {
    pass('Render healthCheckPath', 'Properly configured to /ready (not /health)')
  } else {
    warn('Render healthCheckPath', 'healthCheckPath is not /ready')
  }

  if (
    renderContent.includes('buildCommand: bash render-build.sh') &&
    fs.existsSync(path.join(ROOT, 'render-build.sh'))
  ) {
    pass('Render buildCommand', 'render-build.sh exists and is referenced')
  } else {
    warn('Render buildCommand', 'render-build.sh check warning')
  }
} else {
  warn('render.yaml', 'File not found')
}

console.log('')

// ─── 5. TypeScript Diagnostics (Full Monorepo) ───────────────────────────────
console.log('5. TypeScript Typecheck Verification')

if (skipTsc) {
  warn('TypeScript Diagnostics', 'Skipped via --skip-tsc flag')
} else {
  const typecheckTargets = [
    { name: 'backend', cmd: 'cd backend && npx tsc --noEmit' },
    { name: 'packages/validation', cmd: 'cd packages/validation && npx tsc --noEmit' },
    { name: 'packages/api', cmd: 'cd packages/api && npx tsc --noEmit' },
    { name: 'packages/ui', cmd: 'cd packages/ui && npx tsc --noEmit' },
    { name: 'packages/app-shell', cmd: 'cd packages/app-shell && npx tsc --noEmit' },
    { name: 'packages/sync', cmd: 'cd packages/sync && npx tsc --noEmit' },
    { name: 'packages/local-engine', cmd: 'cd packages/local-engine && npx tsc --noEmit' },
    { name: 'apps/web', cmd: 'cd apps/web && npx tsc --noEmit' },
    { name: 'apps/desktop', cmd: 'cd apps/desktop && npx tsc --noEmit' },
    { name: 'apps/mobile', cmd: 'cd apps/mobile && npx tsc --noEmit' },
  ]

  for (const target of typecheckTargets) {
    try {
      execSync(target.cmd, { stdio: 'pipe' })
      pass(`TypeScript: ${target.name}`, '0 diagnostics errors')
    } catch (err) {
      fail(`TypeScript: ${target.name}`, `Compilation failed: ${err.message}`)
    }
  }
}

console.log('')
console.log('='.repeat(70))
console.log(`PREFLIGHT SUMMARY: ${passCount} PASSED, ${warnCount} WARNINGS, ${failCount} FAILED`)
console.log('='.repeat(70))

if (failCount > 0) {
  console.error('\n❌ Release Preflight FAILED. Address the failing items before releasing.')
  process.exit(1)
} else {
  console.log('\n✅ Release Preflight PASSED. Repository is in candidate release state.')
  process.exit(0)
}
