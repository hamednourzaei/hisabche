// ============================================
// packages/api/src/__tests__/helpers/scan-client-endpoints.ts
//
// Finds every endpoint the CLIENT calls: `apiClient.<verb>(<path>, …)` in the
// api hooks, the shared UI and the app shell. Used by the offline capability
// matrix guard — a call that is not in the matrix fails the build.
//
// ⚠️ A path is the FIRST argument when it is a string/template literal. A
// `${…}` hole becomes `:x`, as does a uuid. A call whose first argument is a
// variable cannot be named from source, so it is reported separately instead
// of silently skipped (`dynamic`).
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ScannedEndpoint {
  key: string
  file: string
}

const LINE_BREAK = new RegExp(String.fromCharCode(10))
const BACKSLASH = String.fromCharCode(92)
const COMMENT_LINE = new RegExp('^\\s*(//|\\*|/\\*)')
const IDENTIFIER = new RegExp('^[A-Za-z_$][\\w$]*')

type Verb = 'get' | 'post' | 'patch' | 'put' | 'delete'

/** Skip a balanced `<...>` generic starting at `index` (which must be `<`). */
function skipGeneric(source: string, index: number): number {
  let depth = 0
  for (let i = index; i < source.length; i++) {
    const ch = source[i]
    if (ch === '<') depth++
    else if (ch === '>' && source[i - 1] !== '=') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return index
}

export function normalizeEndpointPath(raw: string): string {
  const path = raw
    .replace(/\$\{[^}]*\}/g, ':x')
    .split('?')[0]!
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':x')
    .replace(/\/+$/, '')
  return path.length === 0 ? '/' : path
}

export function scanSource(
  source: string,
  file: string,
): { found: ScannedEndpoint[]; dynamic: string[] } {
  const found: ScannedEndpoint[] = []
  const dynamic: string[] = []
  const call = /apiClient\.(get|post|patch|put|delete)\b/g
  for (let m = call.exec(source); m; m = call.exec(source)) {
    const verb = m[1] as Verb
    const lineStart = source.lastIndexOf(String.fromCharCode(10), m.index) + 1
    if (COMMENT_LINE.test(source.slice(lineStart, m.index))) continue // a comment
    let i = m.index + m[0].length
    while (/\s/.test(source[i] ?? '')) i++
    if (source[i] === '<') i = skipGeneric(source, i)
    while (/\s/.test(source[i] ?? '')) i++
    if (source[i] !== '(') continue // a reference, not a call
    i++
    while (/\s/.test(source[i] ?? '')) i++
    const quote = source[i]
    if (quote !== "'" && quote !== '`' && quote !== '"') {
      const name = IDENTIFIER.exec(source.slice(i))?.[0]
      const constant = name
        ? new RegExp(`const ${name}\\s*=\\s*['"\`]([^'"\`]+)['"\`]`).exec(source)
        : null
      if (constant) {
        found.push({ key: `${verb.toUpperCase()} ${normalizeEndpointPath(constant[1]!)}`, file })
        continue
      }
      const line = source.slice(0, i).split(LINE_BREAK).length
      dynamic.push(`${verb.toUpperCase()} ${source.slice(i, i + 30)} @ ${file}:${line}`)
      continue
    }
    let j = i + 1
    let hole = 0
    while (j < source.length) {
      const ch = source[j]
      if (quote === '`' && ch === '$' && source[j + 1] === '{') hole++
      if (quote === '`' && ch === '}' && hole > 0) hole--
      if (ch === quote && hole === 0 && source[j - 1] !== '\\') break
      j++
    }
    const path = normalizeEndpointPath(source.slice(i + 1, j))
    found.push({ key: `${verb.toUpperCase()} ${path}`, file })
  }
  return { found, dynamic }
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(path, out)
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(path)
  }
}

/**
 * Files whose calls are generic transport, not endpoints of their own: the sync
 * engine replays whatever path a queued entry names (already in the matrix as
 * the entity's own route).
 */
const EXCLUDED_FILES = ['features/sync/sync-engine.ts']

/**
 * Calls whose path is a variable holding one of a fixed set of template
 * literals. Each is named here and checked to still be in the source.
 */
export const INDIRECT_ENDPOINTS: ReadonlyArray<{ file: string; marker: string; keys: string[] }> = [
  {
    // auth.store posts through one helper that takes the path as an argument.
    file: 'packages/app-shell/src/features/auth/auth.store.ts',
    marker: "'/auth/validate'",
    keys: ['POST /auth/login', 'POST /auth/signup'],
  },
  {
    file: 'packages/api/src/hooks/budgets.ts',
    marker: '/operations/budgets/${id}/submit',
    keys: [
      'POST /operations/budgets/:x/submit',
      'POST /operations/budgets/:x/approve',
      'POST /operations/budgets/:x/archive',
    ],
  },
]

export function scanClientEndpoints(repoRoot: string): {
  endpoints: Map<string, string>
  dynamic: string[]
} {
  const files: string[] = []
  for (const root of ['packages/api/src', 'packages/ui/src', 'packages/app-shell/src']) {
    walk(join(repoRoot, root), files)
  }
  const endpoints = new Map<string, string>()
  const dynamic: string[] = []
  for (const file of files) {
    if (EXCLUDED_FILES.some((suffix) => file.split(BACKSLASH).join('/').endsWith(suffix))) continue
    const shown = file.split(BACKSLASH).join('/').replace(repoRoot.split(BACKSLASH).join('/'), '')
    const result = scanSource(readFileSync(file, 'utf8'), shown)
    for (const f of result.found) if (!endpoints.has(f.key)) endpoints.set(f.key, f.file)
    // A dynamic call in a file named by INDIRECT_ENDPOINTS is accounted for there.
    dynamic.push(
      ...result.dynamic.filter((d) => !INDIRECT_ENDPOINTS.some((i) => d.includes(`@ /${i.file}:`))),
    )
  }
  for (const indirect of INDIRECT_ENDPOINTS) {
    const source = readFileSync(join(repoRoot, indirect.file), 'utf8')
    if (!source.includes(indirect.marker)) {
      dynamic.push(`stale INDIRECT_ENDPOINTS entry for ${indirect.file}`)
      continue
    }
    for (const key of indirect.keys) if (!endpoints.has(key)) endpoints.set(key, indirect.file)
  }
  return { endpoints, dynamic }
}
