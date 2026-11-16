// ============================================
// Guard: docs/industries says what the code says (V69.1–V69.4)
//
// The documents are rendered from the code by `industry-docs/build.ts`. This
// suite proves they are complete AND that they are still what the builder
// produces — so a registered trade cannot be left without a document, a
// document cannot outlive its trade, and nobody can type a route, an endpoint
// or a «verified» into a file by hand.
//
// To rewrite the files after a real change:
//   node scripts/industry/generate-industry-docs.mjs
//
// It lives in packages/ui, not packages/validation, because it reads the menu
// suggestion (`dnaActiveModules`) and the navigation contract — packages that
// validation must not depend on.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { INDUSTRY_KEYS } from '@hisabche/validation'

import {
  README_HEADINGS,
  REPRESENTATIVE_FILES,
  STATUS_LABELS,
  buildIndustryDocs,
} from './industry-docs/build'
import { FAMILY_IDS, FAMILY_OF, REPRESENTATIVES } from './industry-docs/content'

const ROOT = path.resolve(__dirname, '../../../..')
const DOCS = path.join(ROOT, 'docs/industries')
/** Written by its own generator and guarded by `industry-registry-doc.test.ts`. */
const OWN_GENERATOR = new Set([
  'INDUSTRY-REGISTRY.md',
  // V70.1 — written by `scripts/industry/generate-gap-matrix.mjs` from
  // `competitor-gaps.data.mjs` and measured against the repository, so it
  // lives in this folder without being a per-industry specification.
  'COMPETITOR-GAP-MATRIX.md',
])

const built = buildIndustryDocs(ROOT)

if (process.env.UPDATE_INDUSTRY_DOCS === '1') {
  for (const file of built) {
    const target = path.join(DOCS, file.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, file.content)
  }
  // A file the builder no longer produces is a document without an owner.
  const wanted = new Set(built.map((file) => file.path))
  for (const existing of onDisk()) {
    if (!wanted.has(existing) && !OWN_GENERATOR.has(existing)) fs.rmSync(path.join(DOCS, existing))
  }
  for (const entry of fs.readdirSync(DOCS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(DOCS, entry.name)
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
  }
}

function onDisk(dir = DOCS, prefix = ''): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...onDisk(path.join(dir, entry.name), relative))
    else if (entry.name.endsWith('.md')) out.push(relative)
  }
  return out
}

const byPath = new Map(built.map((file) => [file.path, file.content]))

describe('docs/industries is complete', () => {
  it('every registered id has a README and no README is ownerless', () => {
    const readmes = built
      .filter((file) => /^[A-Za-z]+\/README\.md$/.test(file.path))
      .map((file) => file.path.split('/')[0])
    expect([...readmes].sort()).toEqual([...INDUSTRY_KEYS].sort())
    expect(INDUSTRY_KEYS).toHaveLength(67)
  })

  it('every id belongs to exactly one of the thirteen families, and none is empty', () => {
    expect(FAMILY_IDS).toHaveLength(13)
    expect(Object.keys(FAMILY_OF).sort()).toEqual([...INDUSTRY_KEYS].sort())
    for (const family of FAMILY_IDS) {
      expect(byPath.has(`families/${family}.md`)).toBe(true)
      const members = INDUSTRY_KEYS.filter((id) => FAMILY_OF[id] === family)
      expect({ family, members: members.length > 0 }).toEqual({ family, members: true })
    }
  })

  it('every README carries the eight headings, in order', () => {
    for (const id of INDUSTRY_KEYS) {
      const text = byPath.get(`${id}/README.md`) ?? ''
      let cursor = 0
      for (const heading of README_HEADINGS) {
        const at = text.indexOf(`### ${heading}`, cursor)
        expect({ id, heading, found: at >= 0 }).toEqual({ id, heading, found: true })
        cursor = at + 1
      }
    }
  })

  it('the four representatives have all eight files', () => {
    const representatives = Object.keys(REPRESENTATIVES)
    expect(representatives.sort()).toEqual(['beautySalon', 'clothing', 'education', 'repairs'])
    for (const id of representatives) {
      for (const file of REPRESENTATIVE_FILES) {
        expect({ id, file, present: byPath.has(`${id}/${file}`) }).toEqual({
          id,
          file,
          present: true,
        })
      }
    }
  })

  it('a trade a representative «also covers» is a registered trade', () => {
    for (const spec of Object.values(REPRESENTATIVES)) {
      for (const id of spec?.alsoCovers ?? []) expect(INDUSTRY_KEYS).toContain(id)
    }
  })

  it('status labels come from the closed list', () => {
    const allowed = new Set<string>(STATUS_LABELS)
    for (const file of built) {
      for (const match of file.content.matchAll(/`([A-Z]+(?:_[A-Z]+)+)`/g)) {
        const word = String(match[1])
        if (!/^(EXISTING|CONFIGURATION|NEW|NOT|BLOCKED)_/.test(word)) continue
        expect({ file: file.path, word, allowed: allowed.has(word) }).toEqual({
          file: file.path,
          word,
          allowed: true,
        })
      }
    }
  })

  it('every «verified» capability or journey names a test file that exists', () => {
    for (const file of built) {
      for (const line of file.content.split('\n')) {
        if (!line.includes('`EXISTING_AND_VERIFIED`')) continue
        // Counting rows (the acceptance table) state a number, not a claim about one thing.
        if (/^\| `EXISTING_AND_VERIFIED` \| \d+ \|$/.test(line)) continue
        if (line.includes('فقط وقتی است که')) continue
        const tests = [...line.matchAll(/`([^`]+\.(?:test|spec)\.tsx?)`/g)].map((m) => String(m[1]))
        // The capability matrix lists the label per capability; its proof is in the trade README row.
        if (file.path === 'SHARED-CAPABILITY-MATRIX.md') continue
        if (line.startsWith('- تجربه‌ی اختصاصی صنف')) continue
        expect({ file: file.path, line, hasTest: tests.length > 0 }).toEqual({
          file: file.path,
          line,
          hasTest: true,
        })
        for (const test of tests) {
          expect({ test, exists: fs.existsSync(path.join(ROOT, test)) }).toEqual({
            test,
            exists: true,
          })
        }
      }
    }
  })

  it('no document says TODO or TBD', () => {
    for (const file of built) {
      expect({ file: file.path, clean: !/\b(TODO|TBD)\b/.test(file.content) }).toEqual({
        file: file.path,
        clean: true,
      })
    }
  })

  it('the documents are not all «verified»: the honest labels are in use', () => {
    const all = built.map((file) => file.content).join('\n')
    expect(all).toContain('`CONFIGURATION_REQUIRED`')
    expect(all).toContain('`NEW_CAPABILITY_REQUIRED`')
    expect(all).toContain('`EXISTING_BUT_INCOMPLETE`')
  })
})

describe('docs/industries is what the builder produces', () => {
  it('the files on disk are exactly the built set', () => {
    const wanted = built.map((file) => file.path).sort()
    const present = onDisk()
      .filter((file) => !OWN_GENERATOR.has(file))
      .sort()
    expect(present).toEqual(wanted)
  })

  it('every file matches the builder byte for byte', () => {
    const stale = built
      .filter((file) => {
        const target = path.join(DOCS, file.path)
        if (!fs.existsSync(target)) return true
        return fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== file.content
      })
      .map((file) => file.path)
    expect(stale).toEqual([])
  })
})
