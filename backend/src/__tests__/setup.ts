// ============================================
// Test environment.
//
// `src/db.ts` throws at import time when Supabase credentials are absent, so
// the suite supplies placeholders. Nothing here grants access to anything: the
// URL points at a reserved-for-documentation host, and suites that would
// otherwise reach the client mock it outright.
// ============================================

process.env.NODE_ENV ??= 'test'

// example.com is IANA-reserved for documentation — if a test ever does escape
// the mock and attempt a real request, it fails fast and obviously rather than
// quietly contacting a real service.
process.env.SUPABASE_URL ??= 'https://test.supabase.example.com'
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.JWT_SECRET ??= 'test-jwt-secret'

// ⚠️ The variable src/db.ts actually reads is SUPABASE_SERVICE_KEY, not
// SUPABASE_SERVICE_ROLE_KEY. Only the latter was set here, so db.ts threw at
// import time and kpi-currency-aggregation.test.ts never ran — it looked like
// a permanent environment failure rather than a one-word mismatch.
//
// Both names are set: the one db.ts reads, and the other so a future rename in
// either direction does not silently disable a suite again.
//
// The value is a syntactically valid JWT whose only claim is
// {"role":"service_role"}, because db.ts base64-decodes the payload to warn
// when an anon key has been supplied by mistake. It is unsigned and points at
// an IANA-reserved documentation host, so it grants access to nothing.
const FAKE_SERVICE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.test-signature-not-valid'

process.env.SUPABASE_SERVICE_KEY ??= FAKE_SERVICE_JWT
process.env.SUPABASE_SERVICE_ROLE_KEY ??= FAKE_SERVICE_JWT
