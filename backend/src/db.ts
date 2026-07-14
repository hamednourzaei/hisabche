// ============================================
// backend/src/db.ts — Optimized v2.0
// ============================================

import { createClient, SupabaseClientOptions } from '@supabase/supabase-js'

const isLocal = !process.env.RENDER

let clientOptions: SupabaseClientOptions<'public'> = {
  auth: { persistSession: false },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-hisabche-version': '2.0',
    },
  },
}

if (isLocal) {
  const { ProxyAgent, fetch: undiciFetch } = require('undici')
  const proxyAgent = new ProxyAgent('http://127.0.0.1:10808')
  clientOptions.global = {
    ...clientOptions.global,
    fetch: (input: any, init?: any) => undiciFetch(input, { ...init, dispatcher: proxyAgent }),
  }
}

export const supabase = createClient(
  process.env.SUPABASE_URL || 'https://quxpxatopmquheoazzlj.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'sb_secret_OPjGqLO0yOI5tROyEQxGxw_xRax46Kh',
  clientOptions
)

// ✅ Health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('products').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}