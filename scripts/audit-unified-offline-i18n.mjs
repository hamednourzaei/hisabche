import fs from 'node:fs'
import path from 'node:path'

const filesToAudit = [
  'packages/ui/src/components/ui/onboarding/local-first-run-form.tsx',
  'packages/app-shell/src/features/auth/login-page.tsx',
  'packages/app-shell/src/features/auth/offline-first-run.ts',
  'packages/app-shell/src/features/auth/offline-session.ts',
  'packages/ui/src/components/ui/settings/settings-page.tsx',
  'packages/app-shell/src/features/settings/settings-page.tsx',
  'packages/ui/src/components/ui/dashboard-header.tsx',
  'packages/ui/src/hooks/use-header-people.ts',
  'packages/ui/src/components/ui/notification-bell.tsx',
  'packages/ui/src/components/ui/notification-bell/EntityActivityCard.tsx',
  'packages/ui/src/lib/localize-notification.ts',
  'packages/local-engine/src/routes/feed.ts',
  'packages/local-engine/src/routes/workspace.ts',
  'packages/local-engine/src/routes/me.ts',
]

console.log('=== 1. Checking auth.localUser in i18n catalogs ===')
let missingInCatalog = 0
for (const lang of ['en', 'fa', 'af']) {
  const filePath = `packages/i18n/messages/${lang}/common.json`
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const localUser = content.auth?.localUser
  console.log(`[${lang}] auth.localUser = "${localUser}"`)
  if (!localUser) {
    missingInCatalog++
  }
}

console.log('\n=== 2. Strict Zero-Hardcoded-User-Text & Fallback Audit ===')
const persianRegex = /[\u0600-\u06FF]/g
const fallbackRegex = /\b(?:t|st)\(\s*['"][a-zA-Z0-9_.-]+['"]\s*,\s*['"][^'"]+['"]\s*\)/g

function stripComments(source) {
  // Strip block comments /* ... */ and JSX comments {/* ... */}
  let stripped = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '')
  // Strip line comments // ...
  stripped = stripped.replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  return stripped
}

let totalViolations = 0

for (const relPath of filesToAudit) {
  const fullPath = path.resolve(relPath)
  if (!fs.existsSync(fullPath)) {
    console.error(`NOT FOUND: ${relPath}`)
    totalViolations++
    continue
  }
  const rawContent = fs.readFileSync(fullPath, 'utf8')
  const cleanContent = stripComments(rawContent)
  const lines = cleanContent.split('\n')
  const findings = []

  // Skip regex fallback parser file from Persian check since it parses legacy DB rows
  const isLegacyParser = relPath.includes('localize-notification.ts')

  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed) return

    // 1. Check for hardcoded Persian strings in executable code / JSX text
    if (!isLegacyParser && persianRegex.test(trimmed)) {
      findings.push({ lineNum: idx + 1, type: 'USER_FACING_PERSIAN', text: trimmed })
      totalViolations++
    }

    // 2. Check for t('key', 'literal fallback') in UI/presentation components
    if (fallbackRegex.test(trimmed)) {
      findings.push({ lineNum: idx + 1, type: 'USER_FACING_FALLBACK', text: trimmed })
      totalViolations++
    }
  })

  console.log(`\nFile: ${relPath}`)
  if (findings.length === 0) {
    console.log('  [PASS] Clean! 0 hardcoded strings and 0 user-facing fallbacks.')
  } else {
    findings.forEach((f) => console.log(`  [FAIL] Line ${f.lineNum} (${f.type}): ${f.text}`))
  }
}

console.log(`\n===========================================`)
console.log(`Total Violations: ${totalViolations}`)
console.log(`Catalog Missing: ${missingInCatalog}`)

if (totalViolations > 0 || missingInCatalog > 0) {
  console.error('\nAUDIT FAILED: Hardcoded user-facing text or fallbacks detected.')
  process.exit(1)
} else {
  console.log('\nAUDIT PASSED: ZERO USER-FACING HARDCODED TEXT & FALLBACKS (100% CLEAN).')
}
