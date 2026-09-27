// ============================================
// backend/src/utils/deterministic-id.ts
//
// A stable UUID for (workspace, kind, …parts): the SAME request always maps to
// the SAME id, so a unique index (or a primary key) can refuse the second copy
// of a retried write. Used for a manual journal entry's source, the year-end
// close, and a stock transfer's movement id.
//
// Imports nothing but node:crypto, on purpose: services on both sides of the
// accounting / inventory boundary use it, and a shared helper living inside
// one of those services is how the billing ↔ referral module cycle happened.
// ============================================

import { createHash } from 'node:crypto'

/** RFC 4122 shape, version nibble 5 (name-based, SHA hash). Parts are NUL-separated. */
export function sourceIdOf(workspaceId: string, kind: string, ...parts: string[]): string {
  const hex = createHash('sha256')
    .update([workspaceId, kind, ...parts].join('\u0000'))
    .digest('hex')
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
