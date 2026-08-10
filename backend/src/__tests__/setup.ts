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
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.JWT_SECRET ??= 'test-jwt-secret'
