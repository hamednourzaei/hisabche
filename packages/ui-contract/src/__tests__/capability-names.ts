// ============================================
// The server's capability list, read from the server's own file.
//
// ---------------------------------------------------------------------------
// WHY THIS IS READ FROM DISK AND NOT IMPORTED
//
// `@hisabche/ui-contract` must not depend on the backend — it is consumed by
// mobile and by the browser, and pulling a Fastify service graph into either
// would be absurd. But a hardcoded copy of the capability list would drift the
// first time somebody renames one, and the gate would silently never open.
//
// So the test reads `authorization.domain.ts` as text and extracts the array.
// The same technique `nav-destinations.test.ts` uses to prove a route exists:
// when TypeScript cannot connect two things, look at the file.
// ============================================

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

const SOURCE = join(ROOT, 'backend', 'src', 'services', 'authorization', 'authorization.domain.ts')

function readCapabilities(): string[] {
  const text = readFileSync(SOURCE, 'utf8')

  const block = /export const CAPABILITIES = \[([\s\S]*?)\] as const/.exec(text)
  if (!block) throw new Error(`could not read CAPABILITIES from ${SOURCE}`)

  // Comments first: the block is heavily annotated, and a capability named in
  // a comment is not a capability.
  const body = block[1]!.replace(/\/\/.*$/gm, '')

  return [...body.matchAll(/'([\w.]+)'/g)].map((match) => match[1]!)
}

export const CAPABILITY_NAMES: readonly string[] = readCapabilities()
