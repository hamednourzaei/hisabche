// BUG-002 — a database failure on a read must not be reported as "not found".
// `.single()` reports "no row" as error PGRST116; only THAT is a 404.
import { describe, expect, it, vi } from 'vitest'

let result: { data: unknown; error: { code: string; message: string } | null } = {
  data: null,
  error: null,
}

vi.mock('../db', () => {
  const q: any = {}
  for (const k of ['select', 'eq', 'order', 'limit', 'in', 'is']) q[k] = () => q
  q.single = async () => result
  q.maybeSingle = async () => result
  const supabase = { from: () => q, rpc: async () => ({ data: null, error: null }) }
  return { supabase, default: supabase }
})
vi.mock('../services/authorization/scope.service', () => ({
  scopes: { assertMay: async () => undefined },
}))

const ctx = { workspaceId: 'ws-bug002', userId: 'u', role: 'owner' } as any

describe('ProductService.getById', () => {
  it('no row (PGRST116) is a 404', async () => {
    const { ProductService } = await import('../services/product.service')
    const { NotFoundError } = await import('../errors/database.error')
    result = { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    await expect(new ProductService().getById('p-none', ctx)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('⚠️ a timeout is a database failure, NOT «product not found»', async () => {
    const { ProductService } = await import('../services/product.service')
    const { DatabaseError } = await import('../errors/database.error')
    result = {
      data: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    }
    await expect(new ProductService().getById('p-timeout', ctx)).rejects.toBeInstanceOf(
      DatabaseError,
    )
  })
})

describe('no service turns a failed read into NotFound', () => {
  it('guard', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const root = join(__dirname, '../services')
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (name.endsWith('.ts')) files.push(full)
      }
    }
    walk(root)
    const offenders = files.filter((file) =>
      /if \(error \|\| !\w+\)\s*(\{\s*)?throw new NotFoundError/.test(
        readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, ''),
      ),
    )
    expect(offenders.map((f) => f.slice(root.length + 1))).toEqual([])
  })
})
