// Every file path and code symbol the Universal Business Core spec documents cite must exist.
//
//   node scripts/audit/verify-spec-references.mjs          # human summary, exit 1 if anything is missing
//   node scripts/audit/verify-spec-references.mjs --json   # machine-readable
//
// A reference to something that is PLANNED (not yet built) is allowed only when the line says so:
// it must contain one of  planned | to create | new file | will be | target | proposed | future.
// Anything else that does not exist is a claim the repository cannot back.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const repo = path.resolve(import.meta.dirname, '..', '..')
const asJson = process.argv.includes('--json')

const specDir = 'docs/architecture/universal-business-core'
const docs = [
  ...fs
    .readdirSync(path.join(repo, specDir))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `${specDir}/${f}`),
  ...[
    'docs/architecture/UNIFIED-CORE-AUDIT.md',
    'docs/architecture/UNIFIED-CORE-PROGRESS.md',
  ].filter((f) => fs.existsSync(path.join(repo, f))),
]

const PLANNED =
  /\b(planned|to create|new file|will be|target|proposed|future|not yet|does not exist|absent|missing|no such|nonexistent|hallucinat|deleted|removed)/i
const FILE_EXT = /\.(ts|tsx|mjs|cjs|js|json|sql|md|csv|yml|yaml)$/

const git = (args) => {
  try {
    return execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

const missingPaths = []
const unbackedSymbols = []
const symbolSites = new Map()
let paths = 0

for (const doc of docs) {
  const body = fs.readFileSync(path.join(repo, doc), 'utf8')
  // A document that declares its vocabulary TARGET is a design: names in it may not exist yet.
  // Paths in it are still checked — a path is either a file or it is not.
  const targetVocabulary = body.includes('<!-- target-vocabulary -->')
  const lines = body.split('\n')
  lines.forEach((text, index) => {
    const planned = PLANNED.test(text)
    for (const match of text.matchAll(/`([^`\n]+)`/g)) {
      const raw = match[1].trim()
      const file = raw.split(':')[0].replace(/^\.\//, '')

      if (
        /[\\/]/.test(file) &&
        FILE_EXT.test(file) &&
        !/\s/.test(file) &&
        !raw.startsWith('http')
      ) {
        paths++
        if (/[*{<]/.test(file)) continue
        if (!fs.existsSync(path.join(repo, file)) && !planned)
          missingPaths.push({ doc, line: index + 1, ref: raw })
        continue
      }
      if (/^[A-Za-z0-9_.-]+\.(ts|tsx|mjs|sql)$/.test(raw)) {
        paths++
        const found = git([
          'ls-files',
          '--cached',
          '--others',
          '--exclude-standard',
          '--',
          `**/${raw}`,
        ]).trim()
        if (!found && !planned) missingPaths.push({ doc, line: index + 1, ref: raw })
        continue
      }
      const name = /^([A-Za-z_][A-Za-z0-9_]{6,})(?:\(\))?$/.exec(raw)?.[1]
      if (!name) continue
      const camel = /^[a-z]+[A-Z]/.test(name) || /^[A-Z][a-z]+[A-Z]/.test(name)
      const snake = /^[a-z]+(_[a-z0-9]+)+$/.test(name)
      if (!camel && !snake) continue
      const sites = symbolSites.get(name) ?? []
      sites.push({ doc, line: index + 1, planned: planned || targetVocabulary })
      symbolSites.set(name, sites)
    }
  })
}

for (const [name, sites] of symbolSites) {
  const hits = git([
    'grep',
    '-l',
    '-w',
    '--untracked',
    '-e',
    name,
    '--',
    '*.ts',
    '*.tsx',
    '*.mjs',
    '*.sql',
    '*.json',
  ])
  const real = hits.split('\n').filter((f) => f && !f.startsWith('docs/architecture/'))
  if (real.length > 0) continue
  for (const site of sites)
    if (!site.planned) unbackedSymbols.push({ name, doc: site.doc, line: site.line })
}

const result = {
  docs: docs.length,
  pathRefs: paths,
  symbolRefs: symbolSites.size,
  missingPaths,
  unbackedSymbols,
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(
    `${docs.length} documents · ${paths} path references · ${symbolSites.size} distinct symbols\n` +
      `unbacked paths: ${missingPaths.length} · unbacked symbols (distinct): ${new Set(unbackedSymbols.map((s) => s.name)).size}`,
  )
  for (const m of missingPaths) console.log(`PATH  ${path.basename(m.doc)}:${m.line}  ${m.ref}`)
  for (const s of unbackedSymbols) console.log(`SYM   ${path.basename(s.doc)}:${s.line}  ${s.name}`)
}
process.exit(missingPaths.length + unbackedSymbols.length === 0 ? 0 : 1)
