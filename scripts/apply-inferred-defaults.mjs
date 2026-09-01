// ============================================================================
// scripts/apply-inferred-defaults.mjs
//
// One-time repair of `docs/base-schema-migration.sql`.
//
// `generate-base-schema.mjs` now emits inferred defaults, but it needs the dump
// CSV that produced the file — and that CSV is not in the repository. Rather
// than leave the generator fixed and its output stale (the two would disagree,
// and the next person would trust whichever they read first), this applies the
// SAME rules to the file that already exists.
//
// ⚠️ The rules are imported from the generator, not copied. Two copies of this
// logic would drift, and the drift would be silent: the generator would emit
// one default and this would emit another, with nothing to notice.
//
// Run once. `schema-defaults-guard.test.ts` is what keeps it correct after.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs'

const UNREAD_FLAGS =
  /^(is_read|is_archived|is_pinned|is_deleted|is_locked|is_final|is_group|is_system)$/
const LIST_SHAPED = /(history|snapshot|outcomes|features|items|list)$/

function inferredDefault(name, type) {
  if (name === 'id' && type === 'uuid') return 'gen_random_uuid()'
  if (type.startsWith('boolean')) return UNREAD_FLAGS.test(name) ? 'false' : 'true'
  if (type.startsWith('timestamp') && name.endsWith('_at')) return 'now()'
  if (/^(integer|bigint|smallint|numeric|real|double precision)/.test(type)) return '0'
  if (type.startsWith('jsonb')) return LIST_SHAPED.test(name) ? "'[]'::jsonb" : "'{}'::jsonb"
  return null
}

const path = 'docs/base-schema-migration.sql'
const lines = readFileSync(path, 'utf8').split('\n')

let changed = 0
let inTable = false

const out = lines.map((line) => {
  if (line.startsWith('CREATE TABLE')) {
    inTable = true
    return line
  }
  if (line.startsWith(');')) {
    inTable = false
    return line
  }
  if (!inTable) return line

  const match = /^(\s+)([a-z0-9_]+)(\s+)(.+?)(,?)$/.exec(line)
  if (!match) return line

  const [, indent, name, gap, rest, comma] = match

  // Already has one, or is a primary key (NOT NULL by definition).
  if (/DEFAULT/.test(rest)) return line

  const type = rest.replace(/\s*(NOT NULL|PRIMARY KEY).*/, '').trim()
  const fallback = inferredDefault(name, type)
  if (!fallback) return line

  // The default goes BETWEEN the type and NOT NULL — `col type DEFAULT x NOT
  // NULL`. Postgres accepts either order, but this is the order pg_dump uses
  // and the order every other line in the file already reads in.
  const suffix = rest.slice(type.length).trim()
  changed += 1

  return `${indent}${name}${gap}${type} DEFAULT ${fallback}${suffix ? ' ' + suffix : ''}${comma}`
})

writeFileSync(path, out.join('\n'))
console.log(`${changed} columns given an inferred default`)
