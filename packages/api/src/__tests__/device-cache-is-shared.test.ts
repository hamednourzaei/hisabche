// ============================================
// The on-device query cache: one module, every renderer, and never in the
// bundle of a public page.
//
// What can go wrong: a second copy of the module (the web's own); the module
// exported from the package barrel, so the two persister libraries ride along
// on the landing page and its PageSpeed score; the web importing it statically;
// the web wiping the cache on every load because «not hydrated yet» was read as
// «signed out»; a memory cache that forgets a screen after five minutes, so the
// device cache loses it too.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. Flattened: the formatter wraps. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

const SHARED = "'@hisabche/api/src/lib/persisted-query-cache'"

describe('one module', () => {
  it('lives in the shared package and nowhere else', () => {
    expect(
      existsSync(join(ROOT, 'packages', 'api', 'src', 'lib', 'persisted-query-cache.ts')),
    ).toBe(true)
    expect(
      existsSync(join(ROOT, 'packages', 'app-shell', 'src', 'app', 'persisted-query-cache.ts')),
    ).toBe(false)
  })

  it('the Windows/mobile shell and the web both use it', () => {
    expect(code(read('packages', 'app-shell', 'src', 'app', 'providers.tsx'))).toContain(
      `from ${SHARED}`,
    )
    expect(code(read('apps', 'web', 'app', '[lang]', 'heavy-providers.tsx'))).toContain(
      `import(${SHARED})`,
    )
  })

  it('the package that owns it declares the libraries it needs', () => {
    const pkg = JSON.parse(read('packages', 'api', 'package.json')) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies['@tanstack/query-sync-storage-persister']).toEqual(expect.any(String))
    expect(pkg.dependencies['@tanstack/react-query-persist-client']).toEqual(expect.any(String))
  })
})

describe('never on a public page', () => {
  it('the package barrel does not export it', () => {
    expect(code(read('packages', 'api', 'src', 'index.ts'))).not.toContain('persisted-query-cache')
  })

  it('the web loads it on demand — no static import anywhere in the app shell of the site', () => {
    for (const file of ['providers.tsx', 'heavy-providers.tsx', 'layout.tsx']) {
      const source = code(read('apps', 'web', 'app', '[lang]', file))
      expect(source, file).not.toContain(`from ${SHARED}`)
      expect(source, file).not.toContain('@tanstack/react-query-persist-client')
    }
  })

  it('an anonymous visitor never downloads it', () => {
    const web = code(read('apps', 'web', 'app', '[lang]', 'heavy-providers.tsx'))
    expect(web).toContain('if (!userId && !cache.current) return')
  })
})

describe('the owner, and time', () => {
  const web = code(read('apps', 'web', 'app', '[lang]', 'heavy-providers.tsx'))

  it('«not hydrated yet» is not «signed out»', () => {
    expect(web).toContain('if (!hasHydrated) return')
    expect(web.indexOf('if (!hasHydrated) return')).toBeLessThan(web.indexOf(`import(${SHARED})`))
  })

  it('the cache follows the person AND the business', () => {
    expect(web).toContain('persisted.cacheOwner(userId, workspaceId)')
    expect(web).toContain('[client, hasHydrated, userId, workspaceId]')
  })

  it('memory keeps a screen for as long as the device may show it', () => {
    const module = read('packages', 'api', 'src', 'lib', 'persisted-query-cache.ts')
    expect(code(module)).toContain('PERSISTED_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7')
    expect(code(read('apps', 'web', 'app', '[lang]', 'providers.tsx'))).toContain(
      'gcTime: 1000 * 60 * 60 * 24 * 7,',
    )
  })
})

describe('the stock check is never a remembered answer', () => {
  // Two employees, one last unit: the one who sells second must be told.
  const hook = code(read('packages', 'api', 'src', 'hooks', 'products.ts'))
  const check = hook.slice(
    hook.indexOf('export function useProductsByIds('),
    hook.indexOf('export function useCreateProduct('),
  )

  it('has its own key — it does not reuse the product page’s cached detail', () => {
    expect(check).toContain("queryKey: [...productKeys.detail(id), 'on-hand'] as const,")
  })

  it('is stale at once, fetched on every mount, and dropped when the form closes', () => {
    expect(check).toContain('staleTime: 0,')
    expect(check).toContain('gcTime: 0,')
    expect(check).toContain("refetchOnMount: 'always' as const,")
  })

  it('is never written to the device, and still follows other people’s sales live', () => {
    expect(check).toContain('meta: { persist: false },')
    expect(check).toContain("useRealtime({ table: 'products'")
    const module = code(read('packages', 'api', 'src', 'lib', 'persisted-query-cache.ts'))
    expect(module).toContain('query.meta?.persist !== false')
    expect(module).toContain('dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },')
  })

  it('invoice numbers come from the database, not from anything a device holds', () => {
    const service = code(read('backend', 'src', 'services', 'invoice.service.ts'))
    expect(service).toContain("supabase.rpc('get_next_invoice_number')")
    expect(read('docs', 'SETUP-COMPLETE.sql')).toContain("SELECT nextval('invoice_number_seq');")
  })

  it('a sale clears the server’s own remembered quantity for that business', () => {
    const keys = code(read('backend', 'src', 'utils', 'money-cache-keys.ts'))
    for (const prefix of ["'product',", "'products',", "'low-stock',", "'warehouse-stock',"]) {
      expect(keys, prefix).toContain(prefix)
    }
  })
})
