// A real recording of the product, played inside a reel — and the checks that make a missing or
// wrong file a hard stop instead of a quiet fallback.
//
// One definition for three callers: the preview server (`vite.config.ts`, serves the bytes), the
// exporter (`export-mp4.mjs`, refuses to start) and the tests. Nothing here draws a user interface:
// a capture is a file somebody recorded from the real app, or the reel does not export.
//
// ⚠️ Captures live OUTSIDE the repository (owner, 24 Oct 2026; CLAUDE.md §14: no recordings in the
// workspace). Default folder: `~/Videos/hisabche-captures`, override with HISABCHE_CAPTURES_DIR.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** What a capture may be. Anything else is refused, never converted or guessed. */
export const CAPTURE_EXTENSIONS = {
  '.mp4': 'video',
  '.webm': 'video',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
}

const MIME = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

export const CAPTURE_PROBLEMS = {
  specInvalid: 'PRODUCT_CAPTURE_SPEC_INVALID',
  nameInvalid: 'PRODUCT_CAPTURE_NAME_INVALID',
  unsupported: 'PRODUCT_CAPTURE_UNSUPPORTED',
  missing: 'PRODUCT_CAPTURE_MISSING',
  empty: 'PRODUCT_CAPTURE_EMPTY',
  unreadable: 'PRODUCT_CAPTURE_UNREADABLE',
}

/** The folder that holds the recordings (outside the repository). */
export function capturesDir(env = process.env) {
  return path.resolve(
    env.HISABCHE_CAPTURES_DIR || path.join(os.homedir(), 'Videos', 'hisabche-captures'),
  )
}

export function mimeOf(name) {
  return MIME[path.extname(String(name)).toLowerCase()] ?? 'application/octet-stream'
}

/** A bare file name: no folder, no `..`, no drive — the scene names a file, not a path. */
export function isBareFileName(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= 120 &&
    !/[\\/:*?"<>|\0]/.test(name) &&
    !name.startsWith('.') &&
    !name.includes('..')
  )
}

/** The first bytes of the file must be what its extension says it is. */
function looksLike(extension, head) {
  const at = (i, text) => head.subarray(i, i + text.length).toString('latin1') === text
  switch (extension) {
    case '.png':
      return head.length >= 4 && head[0] === 0x89 && at(1, 'PNG')
    case '.jpg':
    case '.jpeg':
      return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    case '.webp':
      return at(0, 'RIFF') && at(8, 'WEBP')
    case '.mp4':
      return at(4, 'ftyp')
    case '.webm':
      return (
        head.length >= 4 &&
        head[0] === 0x1a &&
        head[1] === 0x45 &&
        head[2] === 0xdf &&
        head[3] === 0xa3
      )
    default:
      return false
  }
}

/**
 * Looks one capture up. Either `{ ok: true, file, kind, bytes }` or `{ ok: false, code, name, message }`.
 * It never returns a stand-in: no path, no fallback file.
 */
export function resolveCapture(name, dir = capturesDir()) {
  const fail = (code, message) => ({ ok: false, code, name: String(name), message })
  if (!isBareFileName(name)) {
    return fail(
      CAPTURE_PROBLEMS.nameInvalid,
      'the capture must be a bare file name (no folder, no ..)',
    )
  }
  const extension = path.extname(name).toLowerCase()
  const kind = CAPTURE_EXTENSIONS[extension]
  if (!kind) {
    return fail(CAPTURE_PROBLEMS.unsupported, `type ${extension || '(none)'} is not supported`)
  }
  const file = path.resolve(dir, name)
  if (!file.startsWith(path.resolve(dir) + path.sep)) {
    return fail(CAPTURE_PROBLEMS.nameInvalid, 'the capture must stay inside the captures folder')
  }
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    return fail(CAPTURE_PROBLEMS.missing, `not found in ${dir}`)
  }
  if (!stat.isFile()) return fail(CAPTURE_PROBLEMS.missing, 'it is not a file')
  if (stat.size === 0) return fail(CAPTURE_PROBLEMS.empty, 'the file is empty')
  let head
  try {
    const handle = fs.openSync(file, 'r')
    try {
      head = Buffer.alloc(16)
      const read = fs.readSync(handle, head, 0, 16, 0)
      head = head.subarray(0, read)
    } finally {
      fs.closeSync(handle)
    }
  } catch {
    return fail(CAPTURE_PROBLEMS.unreadable, 'the file cannot be read')
  }
  if (!looksLike(extension, head)) {
    return fail(CAPTURE_PROBLEMS.unsupported, `the content is not a real ${extension} file`)
  }
  return { ok: true, file, kind, bytes: stat.size }
}

/** Every product-capture scene of a reel: what it asks for and where it sits on the timeline. */
export function captureScenesOf(reel) {
  const found = []
  for (const scene of reel.scenes ?? []) {
    const spec = scene.spec
    if (!spec) continue
    if (spec.kind === 'product-capture') found.push({ start: scene.start, end: scene.end, spec })
    // A bespoke scene that embeds recordings declares them in `captures`.
    if (spec.kind === 'bespoke' && Array.isArray(spec.captures)) {
      for (const ref of spec.captures)
        found.push({
          start: scene.start,
          end: scene.end,
          spec: { kind: 'product-capture', ...ref },
        })
    }
  }
  return found
}

/**
 * Pre-flight for the exporter. `ok` only when every capture scene has a valid spec and a real file.
 * `problems` names each failure with the scene's second and the product route it was meant to show.
 */
export function checkProductCaptures(reel, dir = capturesDir()) {
  const problems = []
  for (const { start, end, spec } of captureScenesOf(reel)) {
    const where = { at: start, route: spec.route }
    const trimOk =
      spec.trimStart === undefined || (Number.isFinite(spec.trimStart) && spec.trimStart >= 0)
    if (
      typeof spec.route !== 'string' ||
      !spec.route.startsWith('/') ||
      !trimOk ||
      !(end > start)
    ) {
      problems.push({
        ...where,
        code: CAPTURE_PROBLEMS.specInvalid,
        name: String(spec.file),
        message: 'route must start with "/", trimStart must be ≥ 0, the scene must have a duration',
      })
      continue
    }
    const found = resolveCapture(spec.file, dir)
    if (!found.ok)
      problems.push({ ...where, code: found.code, name: found.name, message: found.message })
  }
  return { ok: problems.length === 0, problems }
}

/**
 * Every capture the registered reels ask for, one row each, with what is still missing.
 * `minSeconds` is how much recording the scene consumes (its length plus where it starts in the file).
 */
export function captureManifestOf(reels, dir = capturesDir()) {
  const rows = []
  for (const reel of reels) {
    for (const { start, end, spec } of captureScenesOf(reel)) {
      const found = resolveCapture(spec.file, dir)
      rows.push({
        reel: String(reel.id),
        at: start,
        file: String(spec.file),
        route: String(spec.route),
        minSeconds: Number((end - start + (spec.trimStart ?? 0)).toFixed(2)),
        screenState: spec.screenState ?? null,
        present: found.ok,
        problem: found.ok ? null : found.code,
      })
    }
  }
  return rows
}
