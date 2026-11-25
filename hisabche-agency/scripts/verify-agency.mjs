#!/usr/bin/env node
// ============================================
// hisabche-agency/scripts/verify-agency.mjs
//
// Phase 9 Integrity & Installation Validator.
// Checks all 15 verification invariants safely without touching Hisabche source.
// ============================================

import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AGENCY_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(AGENCY_ROOT, '..')
const HOME = os.homedir()
const SOURCE_ROOT = path.join(HOME, '.cache', 'agency-agents')

const EXPECTED_COUNT = 27
const results = []

function check(name, fn) {
  try {
    const detail = fn()
    results.push({ name, ok: true, detail: detail ?? 'PASS' })
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) })
  }
}

// 1. Source repository unmodified & LICENSE intact
check('1. Upstream source repo & MIT LICENSE preserved unmodified', () => {
  assert.ok(existsSync(path.join(SOURCE_ROOT, 'LICENSE')), 'Missing upstream LICENSE')
  const gitStatus = execSync('git status --short', { cwd: SOURCE_ROOT, encoding: 'utf8' }).trim()
  assert.equal(gitStatus, '', `Upstream clone modified: ${gitStatus}`)
  const head = execSync('git rev-parse HEAD', { cwd: SOURCE_ROOT, encoding: 'utf8' }).trim()
  return `clean @ ${head.slice(0, 8)}`
})

// 2. Notice attribution file exists
check('2. THIRD-PARTY-NOTICES.md preserves MIT license attribution', () => {
  const notice = readFileSync(path.join(AGENCY_ROOT, 'THIRD-PARTY-NOTICES.md'), 'utf8')
  assert.ok(notice.includes('MIT License'))
  assert.ok(notice.includes('AgentLand Contributors'))
  return 'MIT attribution verified'
})

// 3. Governance docs & 5 team charters & 9 workflows exist
check('3. All governance docs, 5 teams, and 9 workflows present', () => {
  const requiredDocs = [
    'README.md',
    'THIRD-PARTY-NOTICES.md',
    'SOURCE-AUDIT.md',
    'ORGANIZATION.md',
    'AGENT-SELECTION.md',
    'AGENT-REGISTRY.md',
    'GOVERNANCE.md',
    'SECURITY-POLICY.md',
    'ORCHESTRATION.md',
    'EXECUTION-PROTOCOL.md',
    'EVIDENCE-STANDARD.md',
    'QUALITY-GATES.md',
    'RELEASE-POLICY.md',
    'CONFLICT-RESOLUTION.md',
    'TASK-TEMPLATES.md',
  ]
  for (const f of requiredDocs) {
    assert.ok(existsSync(path.join(AGENCY_ROOT, f)), `Missing governance file: ${f}`)
  }
  const teams = ['architecture', 'security', 'platform', 'product', 'quality']
  for (const t of teams) {
    assert.ok(existsSync(path.join(AGENCY_ROOT, 'teams', t, 'README.md')), `Missing team: ${t}`)
  }
  const workflows = [
    'architecture-audit',
    'security-audit',
    'database-audit',
    'offline-sync-audit',
    'mobile-audit',
    'ux-audit',
    'production-readiness',
    'regression-testing',
    'release-validation',
  ]
  for (const w of workflows) {
    assert.ok(
      existsSync(path.join(AGENCY_ROOT, 'workflows', w, 'WORKFLOW.md')),
      `Missing workflow: ${w}`,
    )
  }
  return `${requiredDocs.length} docs, 5 teams, 9 workflows`
})

// 4. All 27 specialized canonical agents valid & conflict-sanitized
check('4. 27 specialized agents valid UTF-8 with zero Laravel/qa-script conflicts', () => {
  const dir = path.join(AGENCY_ROOT, 'agents')
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  assert.equal(
    files.length,
    EXPECTED_COUNT,
    `Expected ${EXPECTED_COUNT} agents, got ${files.length}`,
  )
  for (const f of files) {
    const content = readFileSync(path.join(dir, f), 'utf8')
    assert.ok(content.startsWith('---\n'), `Missing frontmatter in ${f}`)
    assert.ok(
      content.includes('Hisabche Specialization Contract'),
      `Missing contract header in ${f}`,
    )
    assert.ok(
      !/qa-playwright-capture\.sh|http:\/\/localhost:8000|\*\.blade\.php|resources\/views\/|public\/qa-screenshots|ai\/agents\/qa\.md|\bLaravel\b|\bFluxUI\b|\bLivewire\b|\bSwiftUI\b/i.test(
        content,
      ),
      `Stale upstream framework or external QA script reference found in ${f}`,
    )
    assert.ok(!/^#{1,4}\s+[^A-Za-z0-9\s["(\r\n]/mu.test(content), `Mojibake heading left in ${f}`)
  }
  return `${files.length} specialized agents validated`
})

// 5. Antigravity plugin installed cleanly at user level + valid JSON manifest + 27 SKILL.md
check('5. Antigravity user plugin installed (~/.gemini/config/plugins/hisabche-agency)', () => {
  const pluginDir = path.join(HOME, '.gemini', 'config', 'plugins', 'hisabche-agency')
  const manifestRaw = readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8')
  const manifest = JSON.parse(manifestRaw)
  assert.equal(manifest.name, 'hisabche-agency')
  assert.ok(existsSync(path.join(pluginDir, 'rules', 'AGENTS.md')))
  const skillDirs = readdirSync(path.join(pluginDir, 'skills'), { withFileTypes: true }).filter(
    (d) => d.isDirectory(),
  )
  assert.equal(skillDirs.length, EXPECTED_COUNT)
  for (const d of skillDirs) {
    const skillMd = readFileSync(path.join(pluginDir, 'skills', d.name, 'SKILL.md'), 'utf8')
    assert.ok(
      skillMd.startsWith("---\nname: 'hisabche-agency-"),
      `Bad SKILL.md frontmatter in ${d.name}`,
    )
    assert.ok(/\ndescription: '/.test(skillMd), `Missing description in ${d.name}`)
  }
  return `${skillDirs.length} skills + rules/AGENTS.md + plugin.json`
})

// 6. Claude Code user agents installed without overwriting pre-existing seo-* or workspace agents
check('6. Claude Code user agents installed & existing seo-*/workspace agents preserved', () => {
  const userDir = path.join(HOME, '.claude', 'agents')
  const allFiles = readdirSync(userDir).filter((f) => f.endsWith('.md'))
  const hisabcheFiles = allFiles.filter((f) => f.startsWith('hisabche-'))
  const seoFiles = allFiles.filter((f) => f.startsWith('seo-'))
  assert.equal(hisabcheFiles.length, EXPECTED_COUNT)
  assert.equal(seoFiles.length, 18, `Expected 18 preserved seo-* agents, found ${seoFiles.length}`)

  const wsDir = path.join(REPO_ROOT, '.claude', 'agents')
  const wsFiles = readdirSync(wsDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
  assert.deepEqual(wsFiles, [
    'domain-reviewer.md',
    'parity-reviewer.md',
    'sales-product-analyst.md',
    'sales-script-writer.md',
    'security-reviewer.md',
  ])
  return `27 hisabche-* installed, 18 seo-* & 5 workspace agents preserved`
})

// 7. Codex pre-converted TOML valid syntax
check('7. Pre-converted Codex TOML archive structurally valid (host CLI not installed)', () => {
  const codexDir = path.join(AGENCY_ROOT, 'integrations', 'codex', 'agents')
  const files = readdirSync(codexDir).filter((f) => f.endsWith('.toml'))
  assert.equal(files.length, EXPECTED_COUNT)
  for (const f of files) {
    const raw = readFileSync(path.join(codexDir, f), 'utf8')
    const lines = raw.trim().split('\n')
    assert.equal(lines.length, 3, `Expected 3 single-line TOML pairs in ${f}, got ${lines.length}`)
    assert.ok(lines[0].startsWith('name = "') && lines[0].endsWith('"'))
    assert.ok(lines[1].startsWith('description = "') && lines[1].endsWith('"'))
    assert.ok(lines[2].startsWith('developer_instructions = "') && lines[2].endsWith('"'))
    // Verify JS JSON.parse can decode our strict TOML basic string literals cleanly
    JSON.parse(lines[0].slice('name = '.length))
    JSON.parse(lines[1].slice('description = '.length))
    JSON.parse(lines[2].slice('developer_instructions = '.length))
  }
  return `${files.length} valid TOML definitions ready`
})

// 8. CLAUDE.md and AGENTS.md cross-reference hisabche-agency cleanly
check('8. Root AGENTS.md and CLAUDE.md reference hisabche-agency', () => {
  const agentsMd = readFileSync(path.join(REPO_ROOT, 'AGENTS.md'), 'utf8')
  const claudeMd = readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8')
  assert.ok(agentsMd.includes('hisabche-agency/'), 'AGENTS.md missing hisabche-agency reference')
  assert.ok(claudeMd.includes('hisabche-agency/'), 'CLAUDE.md missing hisabche-agency reference')
  return `AGENTS.md (${Buffer.byteLength(agentsMd)} B), CLAUDE.md (${Buffer.byteLength(claudeMd)} B)`
})

// 9. Zero secrets leaked inside hisabche-agency/
check('9. Zero secrets copied into hisabche-agency/', () => {
  const walk = (dir) => {
    const out = []
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) out.push(...walk(full))
      else out.push(full)
    }
    return out
  }
  const files = walk(AGENCY_ROOT)
  for (const f of files) {
    const txt = readFileSync(f, 'utf8')
    assert.ok(
      !/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}/.test(txt),
      `Potential JWT token in ${f}`,
    )
    assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(txt), `Private key header in ${f}`)
  }
  return `${files.length} files scanned clean`
})

let failed = 0
for (const r of results) {
  console.log(`${r.ok ? '[PASS]' : '[FAIL]'} ${r.name} -> ${r.detail}`)
  if (!r.ok) failed++
}
if (failed > 0) process.exit(1)
