import { createClient } from '@supabase/supabase-js'

const isLocal = !process.env.RENDER

let clientOptions: any = { auth: { persistSession: false } }

if (isLocal) {
  const { ProxyAgent, fetch: undiciFetch } = require('undici')
  const proxyAgent = new ProxyAgent('http://127.0.0.1:10808')
  clientOptions.global = {
    fetch: (input: any, init?: any) => undiciFetch(input, { ...init, dispatcher: proxyAgent }),
  }
}

export const supabase = createClient(
  process.env.SUPABASE_URL || 'https://quxpxatopmquheoazzlj.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'sb_secret_OPjGqLO0yOI5tROyEQxGxw_xRax46Kh',
  clientOptions
)