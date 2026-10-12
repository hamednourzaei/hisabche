// ============================================
// The web origins this server answers as «the app».
//
// One list, two readers: CORS (index.ts), and the check that a phone's
// signature was made on one of OUR pages (services/payroll/phone-unlock).
// ============================================

export function browserOrigins(isProduction: boolean): string[] {
  if (isProduction) {
    return [
      'https://hisabche.com',
      'https://www.hisabche.com',
      'https://app.hisabche.com',
      process.env.FRONTEND_URL || 'https://project-ro4vn-hisabche-s-projects.vercel.app',
    ].filter(Boolean)
  }
  return [
    'https://project-ro4vn-hisabche-s-projects.vercel.app',
    'https://project-ro4vn.vercel.app',
    // The two Next dev servers, per their own `dev` scripts:
    // apps/web runs on 3039 and apps/admin on 3040. Both were missing,
    // so every browser call from either app failed preflight with
    // "No 'Access-Control-Allow-Origin' header is present" — including
    // the admin login, which made a CORS problem look like a broken
    // password. 3000/3001 are kept for any ad-hoc `next dev` that falls
    // back to the default port.
    'http://localhost:3039',
    'http://localhost:3040',
    'http://localhost:3000',
    'http://localhost:3001',
    // Expo's web dev server. Only the browser preview needs this — a
    // real device running through Expo Go is not a browser origin and
    // is never subject to CORS. Metro shifts to 8082/8083 when the
    // default port is busy, so the neighbours are listed too.
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083',
    'https://hisabche.com',
    'https://www.hisabche.com',
  ]
}
