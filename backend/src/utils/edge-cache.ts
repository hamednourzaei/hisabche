// ============================================
// backend/src/utils/edge-cache.ts
//
// Cache-Control for responses that are IDENTICAL FOR EVERYONE, so Cloudflare
// (docs/CLOUDFLARE-EDGE.md) can answer them without reaching Render.
//
// `max-age=0`       browsers always ask again — an edit shows on reload.
// `s-maxage`        the edge keeps it this long; Render sees one request
//                    per edge location per window instead of one per reader.
// `stale-if-error`  if Render is down or unreachable, the edge keeps serving
//                    the last good copy. The public pages survive an outage.
//
// ⚠️ ONLY on a successful, public response. Never on anything that depends on
// who is asking (a workspace, a session): the edge does not know about
// workspaces, and a cached private answer would be served to the next person.
// ============================================

export const PUBLIC_EDGE_CACHE =
  'public, max-age=0, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400'
