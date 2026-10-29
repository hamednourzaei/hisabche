// ============================================
// Hisabche Promo Reel Studio — Creative Intelligence Validator
// Script: scripts/validate-creative-intelligence.mjs
//
// Validates the completeness, structural integrity, schema validity,
// mathematical score consistency, and link resolution of the Creative Intelligence layer.
// Exits with code 0 on complete pass, code 1 on any failure.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CI_DIR = path.join(ROOT, 'docs/creative-intelligence')
const REELS_DIR = path.join(CI_DIR, 'reels')

console.log('🔍 Starting Creative Intelligence Library Validation...\n')

const errors = []
const warnings = []

// 1. Directory Checks
if (!fs.existsSync(CI_DIR) || !fs.existsSync(REELS_DIR)) {
  console.error(`❌ Fatal: Directory ${CI_DIR} or ${REELS_DIR} missing!`)
  process.exit(1)
}

// 2. Load runtime reels
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

// 3. Verify Master Files
const requiredMasterFiles = [
  'README.md',
  'SCORING-RUBRIC.md',
  'REPEATABILITY-AND-QUALITY-METHODOLOGY.md',
  'HOOK-STORY-ANALYSIS.md',
  'REPETITION-ANALYSIS.md',
  'PRIORITIZED-IMPROVEMENTS.md',
  'PLATFORM-READINESS.md',
  'RENDER-REVIEW.md',
  'AUDIENCE-TESTING-PLAN.md',
  'FINAL-REPORT.md',
  'creative-catalogue.json',
]

for (const mf of requiredMasterFiles) {
  const mfPath = path.join(CI_DIR, mf)
  if (!fs.existsSync(mfPath)) {
    errors.push(`Missing master deliverable: ${mf}`)
  } else {
    const size = fs.statSync(mfPath).size
    if (size === 0) errors.push(`Master deliverable is empty: ${mf}`)
  }
}

// 4. Validate creative-catalogue.json
const catJsonPath = path.join(CI_DIR, 'creative-catalogue.json')
if (fs.existsSync(catJsonPath)) {
  try {
    const jsonContent = JSON.parse(fs.readFileSync(catJsonPath, 'utf8'))
    if (jsonContent.totalReels !== REELS.length) {
      errors.push(
        `creative-catalogue.json totalReels (${jsonContent.totalReels}) does not match runtime (${REELS.length})`,
      )
    }
    if (!Array.isArray(jsonContent.reels) || jsonContent.reels.length !== REELS.length) {
      errors.push(`creative-catalogue.json reels array length mismatch`)
    } else {
      for (const r of jsonContent.reels) {
        if (!r.id || !r.title || !r.score || !r.improvements) {
          errors.push(`Reel ${r.id || 'unknown'} has missing properties in creative-catalogue.json`)
        }
        // Verify score formula
        const dims = r.score.dimensions
        if (dims) {
          const expectedScore = Math.round(
            (dims.hookClarity * 0.15 +
              dims.problemRelevance * 0.15 +
              dims.storyProgression * 0.15 +
              dims.messageClarity * 0.15 +
              dims.visualHierarchy * 0.1 +
              dims.motionCoherence * 0.1 +
              dims.pacingDensity * 0.1 +
              dims.ctaClarity * 0.05 +
              dims.distinctiveness * 0.05) *
              10,
          )
          if (Math.abs(expectedScore - r.score.sourceBasedScore) > 1) {
            errors.push(
              `Reel ${r.id} score math mismatch: expected ${expectedScore}, found ${r.score.sourceBasedScore}`,
            )
          }
        }
      }
    }
  } catch (err) {
    errors.push(`creative-catalogue.json parse error: ${err.message}`)
  }
}

// 5. Validate 107 Individual Creative Briefs
const requiredSections = [
  '# Creative Intelligence Brief',
  '## A. Identity',
  '## B. Strategic Objective',
  '## C. Hook Intelligence',
  '## D. Problem and Story Progression',
  '## E. Scene-by-Scene Direction',
  '## F. Typography and Visual System',
  '## G. Audio Direction',
  '## H. CTA Audit',
  '## I. Creative Improvement Opportunities',
  '## J. Evidence and Confidence',
]

const verifiedBriefs = []

for (let i = 0; i < REELS.length; i++) {
  const reel = REELS[i]
  const padId = String(reel.id).padStart(2, '0')
  const fileName = `reel-${padId}.md`
  const filePath = path.join(REELS_DIR, fileName)

  if (!fs.existsSync(filePath)) {
    errors.push(`Missing creative brief: ${fileName}`)
    continue
  }

  const content = fs.readFileSync(filePath, 'utf8')
  if (content.length < 500) {
    errors.push(`Brief for Reel ${padId} is suspiciously short (${content.length} chars)`)
  }

  for (const sec of requiredSections) {
    if (!content.includes(sec)) {
      errors.push(`Reel ${padId} brief is missing required section: "${sec}"`)
    }
  }

  const expectedDuration =
    reel.duration || (reel.scenes?.length ? reel.scenes[reel.scenes.length - 1].end : 0)
  if (!content.includes(`| Actual Duration | **${expectedDuration}s** |`)) {
    errors.push(`Reel ${padId} duration in brief does not match source (${expectedDuration}s)`)
  }

  if (!content.includes(`| Reel ID | **${padId}** |`)) {
    errors.push(`Reel ${padId} ID in brief identity table does not match`)
  }

  verifiedBriefs.push(padId)
}

// 6. Validate Markdown Links
const filesWithLinks = [
  path.join(CI_DIR, 'README.md'),
  path.join(CI_DIR, 'HOOK-STORY-ANALYSIS.md'),
  path.join(CI_DIR, 'REPETITION-ANALYSIS.md'),
  path.join(CI_DIR, 'PRIORITIZED-IMPROVEMENTS.md'),
]

for (const fwl of filesWithLinks) {
  if (fs.existsSync(fwl)) {
    const fContent = fs.readFileSync(fwl, 'utf8')
    const links = [...fContent.matchAll(/\[(?:Reel\s+)?(\d+)\]\((reels\/reel-\d+\.md)\)/g)]
    for (const link of links) {
      const targetPath = path.resolve(CI_DIR, link[2])
      if (!fs.existsSync(targetPath)) {
        errors.push(`Broken link in ${path.basename(fwl)}: ${link[0]} -> ${link[2]} not found`)
      }
    }
  }
}

console.log('======================================================')
console.log('📊 CREATIVE INTELLIGENCE VALIDATION REPORT')
console.log('======================================================')
console.log(`✓ Total Runtime Reels: ${REELS.length}`)
console.log(`✓ Verified Creative Briefs: ${verifiedBriefs.length} / ${REELS.length}`)
console.log(
  `✓ Master Deliverables Checked: ${requiredMasterFiles.length} / ${requiredMasterFiles.length}`,
)
console.log(`✓ Errors: ${errors.length}`)
console.log(`✓ Warnings: ${warnings.length}`)

if (errors.length > 0) {
  console.error('\n❌ VALIDATION FAILED with errors:')
  errors.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
} else {
  console.log('\n✅ ALL CREATIVE INTELLIGENCE DELIVERABLES PASSED 100% VALIDATION!')
  process.exit(0)
}
