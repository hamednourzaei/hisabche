// ============================================
// packages/api/src/lib/response-body.ts
//
// What a route answered, from what `apiClient` returns.
//
// ⚠️ TWO LAYERS, NOT ONE. The response interceptor passes the AXIOS RESPONSE
// through (`client.ts`), so the route's body is `response.data` — and most
// routes wrap their payload once more as `{ data: … }`. A helper that unwraps
// one layer hands `{ data: rows }` to the screen: `asList` turns it into an
// empty list (the expense-claims screen was always empty), and a hook typed as
// an array crashes on `.map` (the cheque register). V61 audit, 12 Nov 2026.
//
// A route that answers a bare array or a bare object is read as-is.
// ============================================

export function responseBody<T>(response: unknown): T {
  const body =
    response && typeof response === 'object' && 'data' in response
      ? (response as { data: unknown }).data
      : response
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return (body as { data: T }).data
  }
  return body as T
}
