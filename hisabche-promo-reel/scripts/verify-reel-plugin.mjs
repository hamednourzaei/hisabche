// ============================================
// Hisabche Studio — Reel Plugin Consistency & Integrity Verifier
//
// Verifies that the Fast-Track Reel Plugin contract files,
// manifest references, command entrypoints, and state files
// are 100% valid, resolved, and synchronized.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

console.log('\n======================================================')
console.log('🔍 Hisabche Reel Plugin Consistency Verifier')
console.log('======================================================\n')

let errors = []
let checked = 0

function assertFileExists(relPath, desc) {
  checked++
  const fullPath = path.resolve(ROOT, relPath)
  if (!fs.existsSync(fullPath)) {
    errors.push(`[MISSING FILE] ${desc}: ${relPath}`)
    return false
  }
  return true
}

function assertJsonValid(relPath, desc) {
  checked++
  const fullPath = path.resolve(ROOT, relPath)
  if (!fs.existsSync(fullPath)) {
    errors.push(`[MISSING JSON] ${desc}: ${relPath}`)
    return null
  }
  try {
    const raw = fs.readFileSync(fullPath, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    errors.push(`[MALFORMED JSON] ${desc}: ${relPath} (${err.message})`)
    return null
  }
}

// 1. Verify Plugin Manifest
console.log('Checking plugin manifest...')
const manifest = assertJsonValid('.claude/reel-plugin/plugin-manifest.json', 'Plugin Manifest')
if (manifest) {
  if (manifest.name !== 'hisabche-new-reels') errors.push('Manifest name mismatch')
  assertFileExists(manifest.entrypoint, 'Manifest entrypoint')
  assertFileExists(manifest.sdk, 'Manifest SDK')
  assertFileExists(manifest.guardrails, 'Manifest Guardrails')
  assertFileExists(manifest.sceneCatalog, 'Manifest Scene Catalog')
  assertFileExists(manifest.tokenCatalog, 'Manifest Token Catalog')
  assertFileExists(manifest.registrationContract, 'Manifest Registration Contract')
  assertFileExists(manifest.verificationContract, 'Manifest Verification Contract')
  assertFileExists(manifest.stateFile, 'Manifest State File')
  assertFileExists(manifest.recentReels, 'Manifest Recent Reels File')
  assertFileExists(manifest.versionFile, 'Manifest Version File')
}

// 2. Verify State and Version files
console.log('Checking state and version files...')
const state = assertJsonValid('.claude/reel-plugin/reel-state.json', 'Reel State')
if (state) {
  if (typeof state.lastReelId !== 'number') errors.push('state.lastReelId must be a number')
  if (typeof state.nextReelId !== 'number') errors.push('state.nextReelId must be a number')
  if (state.nextReelId !== state.lastReelId + 1)
    errors.push('state.nextReelId must be lastReelId + 1')
}

const version = assertJsonValid('.claude/reel-plugin/version.json', 'Plugin Version')
if (version) {
  if (!version.sdkVersion) errors.push('version.sdkVersion is required')
}

const recent = assertJsonValid('.claude/reel-plugin/recent-reels.json', 'Recent Reels Memory')
if (recent && !Array.isArray(recent)) {
  errors.push('recent-reels.json must be a JSON array')
}

// 3. Verify Commands and Skills
console.log('Checking commands and skills...')
assertFileExists('.claude/commands/new_reels.md', 'Slash Command new_reels')
assertFileExists('.claude/commands/new-reels.md', 'Slash Command new-reels')
assertFileExists('.claude/skills/new-reels/SKILL.md', 'Canonical Skill SKILL.md')

// 4. Verify Core Source Files referenced by SDK
console.log('Checking core repository source targets...')
assertFileExists('src/reels/index.ts', 'Global Reel Registry')
assertFileExists('src/data/reel-ledger.json', 'Reel Ledger')
assertFileExists('src/engine/types.ts', 'Core Engine Types')
assertFileExists('src/ui/icons.tsx', 'Icon Primitives')
assertFileExists('src/ui/card.tsx', 'Card Primitives')
assertFileExists('src/ui/rich.tsx', 'Rich Text Primitives')
assertFileExists('src/engine/sound.ts', 'Sound Engine')

console.log('\n======================================================')
if (errors.length === 0) {
  console.log(`✅ ALL CHECKS PASSED (${checked} assertions verified)`)
  console.log('The Hisabche Reel Plugin Fast-Track SDK is 100% consistent!')
  console.log('======================================================\n')
  process.exit(0)
} else {
  console.error(`❌ VERIFICATION FAILED with ${errors.length} error(s):`)
  errors.forEach((err) => console.error(`  - ${err}`))
  console.log('======================================================\n')
  process.exit(1)
}
