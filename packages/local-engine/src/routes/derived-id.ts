// ============================================
// packages/local-engine/src/routes/derived-id.ts
//
// A stable UUID for (workspace, kind, …parts): the SAME request always maps to
// the SAME id, so a retried write finds the row the first attempt made instead
// of making a second. The server derives it with SHA-256 (backend
// utils/deterministic-id); the device has no node:crypto, so this is a pure
// 128-bit hash of the same inputs. The two never meet — an id is only ever
// compared with ids made by the SAME runtime.
// ============================================

function hash32(text: string, seed: number): number {
  let h = seed >>> 0
  for (let index = 0; index < text.length; index += 1) {
    h = Math.imul(h ^ text.charCodeAt(index), 0x01000193) >>> 0
    h = (h ^ (h >>> 15)) >>> 0
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/** RFC 4122 shape, version nibble 5, from a 128-bit hash. Parts are NUL-separated. */
export function derivedId(workspaceId: string, kind: string, ...parts: string[]): string {
  const text = [workspaceId, kind, ...parts].join('\u0000')
  const hex = [0x811c9dc5, 0x9747b28c, 0xc2b2ae3d, 0x27d4eb2f]
    .map((seed) => hash32(text, seed).toString(16).padStart(8, '0'))
    .join('')
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
