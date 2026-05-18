import { createClient } from '@supabase/supabase-js'
import { ProxyAgent, fetch as undiciFetch } from 'undici'

// ─── Proxy Agent — V2Ray HTTP proxy ──────────────────────
const proxyAgent = new ProxyAgent('http://127.0.0.1:10808')

// ─── Proxy-aware fetch ────────────────────────────────────
const proxiedFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  return undiciFetch(input as string, {
    ...init,
    // @ts-ignore
    dispatcher: proxyAgent,
  } as any) as unknown as Promise<Response>
}

// ─── Supabase Client با proxy ─────────────────────────────
export const supabase = createClient(
  'https://quxpxatopmquheoazzlj.supabase.co',
  'sb_secret_OPjGqLO0yOI5tROyEQxGxw_xRax46Kh',
  {
    auth: { persistSession: false },
    global: {
      fetch: proxiedFetch as any,
    },
  }
)