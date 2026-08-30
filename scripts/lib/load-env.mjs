// ============================================================================
// scripts/lib/load-env.mjs
//
// Fill `process.env` from a dotenv file, without overwriting what the shell
// already set.
//
// ---------------------------------------------------------------------------
// WHY THE SCRIPTS DO NOT JUST READ process.env
//
// On Windows the way to export a variable differs between PowerShell
// (`$env:X="..."`), cmd (`set X=...`) and Git Bash (`export X=...`), and using
// the wrong one for the shell you are actually in leaves it silently unset.
// The script then reports "DATABASE_URL is required" while the operator is
// looking at the line where they set it.
//
// Reading a file removes the shell from the question entirely.
//
// The shell still WINS where it is set: a value exported deliberately for one
// run must not be overridden by a stale file.
// ============================================================================

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * `.env.migrate` first.
 *
 * It is the file that holds a database password with DDL rights over every
 * table — a different secret from an anon key, and one that should not live in
 * a file shared with the application. It is gitignored.
 */
const FILES = ['.env.migrate', '.env.local']

/**
 * Read a dotenv file whatever Windows wrote it as.
 *
 * PowerShell's `>` redirection writes UTF-16 LE, and several Windows editors
 * add a UTF-8 BOM. Decoded as plain UTF-8 those produce key names full of NUL
 * bytes — so the file parses, the loader reports variables were loaded, and
 * the names never match. That is the worst possible failure: it looks like the
 * file was read and ignored.
 */
function readTextFile(path) {
  const buffer = readFileSync(path)

  // UTF-16 LE / BE byte-order marks.
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.toString('utf16le').slice(1)
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return buffer.swap16().toString('utf16le').slice(1)

  // UTF-16 LE with no BOM: ASCII text leaves a NUL in every second byte.
  if (buffer.length > 1 && buffer[1] === 0x00 && buffer[3] === 0x00) {
    return buffer.toString('utf16le')
  }

  // UTF-8. A byte-order mark is stripped by CODE POINT, not by a literal
  // character in the pattern: a BOM written into source is invisible, and
  // eslint rejects it as irregular whitespace — which is how a fix for
  // unreadable files became an unreadable file.
  const text = buffer.toString('utf8')
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function loadEnv() {
  const loaded = []

  for (const file of FILES) {
    const path = join(ROOT, file)
    if (!existsSync(path)) continue

    const names = []
    let count = 0

    for (const rawLine of readTextFile(path).split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const separator = line.indexOf('=')
      if (separator < 1) continue

      const key = line.slice(0, separator).trim()
      // Strip surrounding quotes; a pasted connection string often carries
      // them, and a quoted password fails authentication in a way that reads
      // like a wrong password.
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/^["']|["']$/g, '')

      if (!key || !value) continue
      if (process.env[key]) continue

      process.env[key] = value
      names.push(key)
      count += 1
    }

    // The NAMES, never the values.
    //
    // A count alone is what made an encoding problem unreadable: it said two
    // variables were loaded while both names were mangled, so the file looked
    // read and ignored. Printing the names makes a wrong name obvious in the
    // one place somebody is already looking.
    if (count > 0) loaded.push(`${file}: ${names.join(', ')}`)
  }

  if (loaded.length > 0) {
    for (const line of loaded) console.log(`Loaded ${line}`)
  }

  return loaded
}

/**
 * Report every missing variable at once, with where to put it.
 *
 * One at a time means the operator edits a file, re-runs, and is told about
 * the next one — four round trips to learn what could have been one message.
 */
export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name])
  if (missing.length === 0) return true

  console.error(`\nMissing: ${missing.join(', ')}\n`)
  console.error('Put them in `.env.migrate` in the repository root, one per line:\n')
  for (const name of missing) console.error(`  ${name}=...`)
  console.error('\nThat file is gitignored. See the header of this script for where')
  console.error('each value comes from in the Supabase dashboard.\n')

  return false
}
