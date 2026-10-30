// ============================================
// Hisabche Promo Reel Studio — 107-Reel Documentation Validator
// Script: scripts/validate-all-reels-documentation.mjs
//
// Strictly verifies the integrity, completeness, and evidence consistency
// of all generated Markdown documents in docs/all-reels-briefs/.
// Exits with code 1 on any failure, code 0 on complete pass.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BRIEFS_DIR = path.join(ROOT, 'docs/all-reels-briefs')

console.log('🔍 Starting 107-Reel Documentation Integrity Validation...')

const errors = []
const warnings = []

// Check directory exists
if (!fs.existsSync(BRIEFS_DIR)) {
  console.error(`❌ Fatal: Directory ${BRIEFS_DIR} does not exist!`)
  process.exit(1)
}

// 1. Load runtime reels
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
})

let REELS = []
try {
  const mod = await server.ssrLoadModule('/src/reels/index.ts')
  REELS = mod.REELS
} finally {
  await server.close()
}

console.log(`✓ Loaded ${REELS.length} reels from runtime registry`)

// 2. Verify all master files exist
const masterFiles = ['FULL_REELS_OVERVIEW.md', 'MOTION-INDEX.md', 'CREATIVE-INDEX.md']
for (const mf of masterFiles) {
  const mfPath = path.join(BRIEFS_DIR, mf)
  if (!fs.existsSync(mfPath)) {
    errors.push(`Master file missing: ${mf}`)
  } else {
    const size = fs.statSync(mfPath).size
    if (size === 0) errors.push(`Master file is empty: ${mf}`)
  }
}

// 3. Verify every registered reel has a Markdown file and correct sections
const requiredSections = [
  '# Reel',
  '## Status',
  '## 1. Topic & Hook',
  '### Topic',
  '### Hook',
  '### Business Problem',
  '### Hisabche Capability',
  '## 2. Reel Metadata',
  '## 3. Full Script',
  '### Voiceover',
  '### On-screen Text',
  '### CTA',
  '## 4. Timeline',
  '## 5. Visual Design',
  '### Composition',
  '### Colors',
  '### Typography',
  '### UI Elements',
  '## 6. Motion Design',
  '## 7. Transitions',
  '## 8. Audio & Music',
  '## 9. CTA',
  '## 10. Technical Implementation',
  '## 11. Source Files',
  '## 12. Evidence Classification',
  '## 13. QA Notes',
]

const verifiedReels = []

for (let i = 0; i < REELS.length; i++) {
  const reel = REELS[i]
  const padId = String(reel.id).padStart(2, '0')
  const fileName = `reel-${padId}.md`
  const filePath = path.join(BRIEFS_DIR, fileName)

  if (!fs.existsSync(filePath)) {
    errors.push(`Missing documentation file for Reel ${padId}: ${fileName}`)
    continue
  }

  const content = fs.readFileSync(filePath, 'utf8')
  if (content.length < 200) {
    errors.push(
      `Documentation file for Reel ${padId} is suspiciously short (${content.length} chars)`,
    )
  }

  // Check required sections
  for (const sec of requiredSections) {
    if (!content.includes(sec)) {
      errors.push(`Reel ${padId} (${fileName}) is missing required section: "${sec}"`)
    }
  }

  // Check metadata table duration matches source
  const expectedDuration =
    reel.duration || (reel.scenes?.length ? reel.scenes[reel.scenes.length - 1].end : 0)
  const durPattern = new RegExp(`\\|\\s*Duration\\s*\\|\\s*${expectedDuration}s\\s*\\|`)
  if (!durPattern.test(content)) {
    errors.push(
      `Reel ${padId} duration in metadata table does not match source (${expectedDuration}s)`,
    )
  }

  // Check scene count
  const expectedScenes = reel.scenes?.length || 0
  const scenePattern = new RegExp(`\\|\\s*Scene count\\s*\\|\\s*${expectedScenes}\\s*\\|`)
  if (!scenePattern.test(content)) {
    errors.push(
      `Reel ${padId} scene count in metadata table does not match source (${expectedScenes})`,
    )
  }

  // Check source files section has real paths
  if (!content.includes('Reel definition: [`src/reels/')) {
    errors.push(`Reel ${padId} source files section does not point to a valid src/reels/ file`)
  }

  verifiedReels.push(padId)
}

// 4. Verify Master Overview content
const overviewPath = path.join(BRIEFS_DIR, 'FULL_REELS_OVERVIEW.md')
if (fs.existsSync(overviewPath)) {
  const ovContent = fs.readFileSync(overviewPath, 'utf8')
  for (let i = 1; i <= REELS.length; i++) {
    const pad = String(i).padStart(2, '0')
    const ovPattern = new RegExp(`\\|\\s*(\\[?${pad}\\]?(\\(reel-${pad}\\.md\\))?)\\s*\\|`)
    if (!ovPattern.test(ovContent)) {
      errors.push(`FULL_REELS_OVERVIEW.md is missing row for Reel ID ${pad}`)
    }
  }
}

// 5. Verify Links in indexes
const motionIndexPath = path.join(BRIEFS_DIR, 'MOTION-INDEX.md')
if (fs.existsSync(motionIndexPath)) {
  const miContent = fs.readFileSync(motionIndexPath, 'utf8')
  const links = [...miContent.matchAll(/\[Reel\s+(\d+)\]\((reel-\d+\.md)\)/g)]
  for (const link of links) {
    const targetFile = path.join(BRIEFS_DIR, link[2])
    if (!fs.existsSync(targetFile)) {
      errors.push(`Broken link in MOTION-INDEX.md: ${link[0]} -> ${link[2]} does not exist`)
    }
  }
}

const creativeIndexPath = path.join(BRIEFS_DIR, 'CREATIVE-INDEX.md')
if (fs.existsSync(creativeIndexPath)) {
  const ciContent = fs.readFileSync(creativeIndexPath, 'utf8')
  const links = [...ciContent.matchAll(/\[Reel\s+(\d+)[^\]]*\]\((reel-\d+\.md)\)/g)]
  for (const link of links) {
    const targetFile = path.join(BRIEFS_DIR, link[2])
    if (!fs.existsSync(targetFile)) {
      errors.push(`Broken link in CREATIVE-INDEX.md: ${link[0]} -> ${link[2]} does not exist`)
    }
  }
}

console.log('\n======================================================')
console.log('📊 DOCUMENTATION VALIDATION REPORT')
console.log('======================================================')
console.log(`✓ Total Reels Checked: ${REELS.length}`)
console.log(`✓ Total Verified Markdown Briefs: ${verifiedReels.length}`)
console.log(`✓ Master Files Checked: 3/3`)

if (warnings.length > 0) {
  console.log(`\n⚠️ Warnings (${warnings.length}):`)
  warnings.forEach((w) => console.log(`  - ${w}`))
}

if (errors.length > 0) {
  console.error(`\n❌ FAILED with ${errors.length} errors:`)
  errors.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
} else {
  console.log('\n✅ ALL 107 REELS AND MASTER DOCUMENTATION PASSED 100% VALIDATION!')
  process.exit(0)
}
