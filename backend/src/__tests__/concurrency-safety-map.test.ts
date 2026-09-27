// #142 — the Concurrency Safety Layer map is only worth something while it is
// true. This fails when (a) a covered route file gains a mutating route the map
// does not list, (b) the map lists a route that no longer exists, or (c) any
// piece of evidence behind a claimed mechanism is gone from the code.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { CONCURRENCY_SAFETY_MAP, COVERED_ROUTE_FILES } from '../utils/concurrency-safety-map'

const REPO = join(__dirname, '..', '..', '..')
const read = (file: string) => readFileSync(join(REPO, file), 'utf8')

function mutatingRoutes(routeFile: string): string[] {
  const source = read(`backend/src/routes/${routeFile}`)
  const found: string[] = []
  const pattern = /fastify\.(post|put|patch|delete)(?:<[^>]*>)?\(\s*['"`]([^'"`]+)['"`]/g
  for (const match of source.matchAll(pattern)) found.push(`${match[1]!.toUpperCase()} ${match[2]}`)
  return found
}

describe('concurrency safety map', () => {
  it.each(COVERED_ROUTE_FILES)(
    'every mutating route in %s is mapped, and nothing else',
    (routeFile) => {
      const declared = mutatingRoutes(routeFile).sort()
      const mapped = CONCURRENCY_SAFETY_MAP.filter((e) => e.routeFile === routeFile)
        .map((e) => e.route)
        .sort()
      expect(mapped).toEqual(declared)
    },
  )

  it('every claimed mechanism has its evidence in the code', () => {
    const missing = CONCURRENCY_SAFETY_MAP.flatMap((entry) =>
      entry.evidence
        .filter((evidence) => !read(evidence.file).includes(evidence.text))
        .map((evidence) => `${entry.route} → ${evidence.file}: ${evidence.text}`),
    )
    expect(missing).toEqual([])
  })

  it('every entry names at least one mechanism and one piece of evidence', () => {
    for (const entry of CONCURRENCY_SAFETY_MAP) {
      expect(entry.mechanisms.length, entry.route).toBeGreaterThan(0)
      expect(entry.evidence.length, entry.route).toBeGreaterThan(0)
    }
  })

  it('no route claims worker_threads — none use them', () => {
    const map = read('backend/src/utils/concurrency-safety-map.ts')
    expect(map).toContain('worker_threads: NO route uses them')
    const src = ['backend/src/index.ts', 'backend/src/services/workspace/backup-formats.ts']
    for (const file of src) expect(read(file)).not.toContain('worker_threads')
  })
})
