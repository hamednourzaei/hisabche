// ============================================
// backend/src/db.ts — Optimized v2.1
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
      'x-hisabche-version': '2.1',
    },
  },
}

// ✅ تنظیمات Proxy برای محیط محلی (در صورت نیاز)
if (isLocal) {
  try {
    const { ProxyAgent, fetch: undiciFetch } = require('undici')
    const proxyAgent = new ProxyAgent('http://127.0.0.1:10808')
    clientOptions.global = {
      ...clientOptions.global,
      fetch: (input: any, init?: any) => undiciFetch(input, { ...init, dispatcher: proxyAgent }),
    }
  } catch {
    // اگر undici نصب نیست، ignore کن
    console.log('ℹ️ undici not installed, skipping proxy setup')
  }
}

// ✅ ایجاد کلاینت Supabase
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

// ✅ مانیتورینگ Connection (جدید)
let connectionCount = 0
let totalQueries = 0
let slowQueries = 0

export const dbStats = {
  getConnectionCount: () => connectionCount,
  getTotalQueries: () => totalQueries,
  getSlowQueries: () => slowQueries,
  incrementConnection: () => connectionCount++,
  decrementConnection: () => connectionCount--,
  incrementQueries: () => totalQueries++,
  incrementSlowQueries: () => slowQueries++,
  reset: () => {
    connectionCount = 0
    totalQueries = 0
    slowQueries = 0
  },
}

// ✅ Wrapper برای tracking connections و query performance
export const withConnection = async <T>(
  fn: () => Promise<T>,
  queryName?: string
): Promise<T> => {
  const startTime = Date.now()
  dbStats.incrementConnection()
  dbStats.incrementQueries()
  
  try {
    const result = await fn()
    const duration = Date.now() - startTime
    
    // اگر کوئری بیشتر از 500ms طول کشید، به عنوان Slow Query ثبت کن
    if (duration > 500) {
      dbStats.incrementSlowQueries()
      console.warn(`⚠️ Slow query: ${queryName || 'unnamed'} - ${duration}ms`)
    }
    
    return result
  } finally {
    dbStats.decrementConnection()
  }
}

// ✅ تابع کمکی برای لاگ کردن کوئری‌ها (اختیاری)
export const logQuery = (query: string, params?: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 SQL:', query)
    if (params) console.log('📦 Params:', params)
  }
}

export default supabase