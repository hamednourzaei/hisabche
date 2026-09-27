// ============================================
// backend/src/utils/trusted-proxies.ts
//
// Which hops in front of this process may tell us the client's address.
//
// ⚠️ WHY THIS EXISTS (27 Sep 2026). Fastify ran with no `trustProxy`, so
// `request.ip` was the address of the hop that opened the socket — Render's
// load balancer — for EVERY request. The rate limiter (index.ts) and the
// anonymous refresh key (auth.routes.ts) are keyed by `request.ip`, so every
// logged-out user shared ONE bucket: one attacker hammering /auth/login could
// lock login for everyone. Putting Cloudflare in front adds a second proxy and
// the same mistake would key everyone on a Cloudflare edge address.
//
// ⚠️ NOT `trustProxy: true`. That believes the LEFTMOST X-Forwarded-For
// entry, which the client writes itself: anyone could pick their own IP and
// get a fresh rate-limit bucket per request.
//
// How it resolves: walking X-Forwarded-For from the right, every hop that is a
// trusted proxy is skipped, and the first one that is not is the client. A
// forged entry sits to the LEFT of the real address the proxies appended, so
// it is never reached. Works identically with and without Cloudflare in the
// path — which is what lets traffic fail over to the direct Render address.
//
//   Render only:        socket 10.x (LB) → XFF "client"              → client
//   Cloudflare+Render:  socket 10.x      → XFF "client, cf-edge"     → client
//   Forged header:      socket 10.x      → XFF "fake, attacker"      → attacker
// ============================================

/** Render's load balancer reaches the process from a private address. */
const PRIVATE = ['loopback', 'linklocal', 'uniquelocal']

/**
 * Cloudflare's published edge ranges (https://www.cloudflare.com/ips/).
 * They change rarely; TRUSTED_PROXY_CIDRS adds any new one without a deploy of
 * code. A range missing here fails SAFE: that edge is treated as the client,
 * so a user is rate-limited with others on the same edge — never unlimited.
 */
export const CLOUDFLARE_RANGES: readonly string[] = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
]

/** The value for Fastify's `trustProxy`. */
export function trustedProxies(env: Record<string, string | undefined> = process.env): string[] {
  const extra = (env.TRUSTED_PROXY_CIDRS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...PRIVATE, ...CLOUDFLARE_RANGES, ...extra]
}
