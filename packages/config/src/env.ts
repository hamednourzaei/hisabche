const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'staging'

export const env = {
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'hisabche',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    nodeEnv,
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  posthog: {
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
  },
  sentry: {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
    org: process.env.SENTRY_ORG || '',
    project: process.env.SENTRY_PROJECT || 'web',
  },
  arcjet: {
    key: process.env.ARCJET_KEY || '',
    env: process.env.ARCJET_ENV || 'development',
  },
  db: {
    url: process.env.DATABASE_URL || '',
  },

  isDev: nodeEnv === 'development',
  isStaging: nodeEnv === 'staging',
  isProd: nodeEnv === 'production',
}

export type Env = typeof env