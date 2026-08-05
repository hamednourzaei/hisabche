import {
  dbEnqueueSchema,
  dbQuerySchema,
  exportFileSchema,
  secureKeySchema,
  windowControlSchema,
} from '../ipc-contract'

describe('IPC payload validation', () => {
  it('rejects an unknown table', () => {
    expect(dbQuerySchema.safeParse({ table: 'secrets' }).success).toBe(false)
  })

  it('accepts a known table and applies defaults', () => {
    const parsed = dbQuerySchema.parse({ table: 'product' })
    expect(parsed.limit).toBe(100)
    expect(parsed.direction).toBe('desc')
  })

  it('caps the page size so a renderer cannot exhaust memory', () => {
    expect(dbQuerySchema.safeParse({ table: 'product', limit: 100_000 }).success).toBe(false)
  })

  it('rejects a storage key with path characters', () => {
    expect(secureKeySchema.safeParse({ key: '../../etc/passwd' }).success).toBe(false)
    expect(secureKeySchema.safeParse({ key: 'hisabche.session' }).success).toBe(true)
  })

  it('rejects an unknown window action', () => {
    expect(windowControlSchema.safeParse({ action: 'openDevTools' }).success).toBe(false)
    expect(windowControlSchema.safeParse({ action: 'minimize' }).success).toBe(true)
  })

  it('requires a queue operation from the known set', () => {
    const base = { entity: 'invoice', clientId: 'c1', payload: {} }
    expect(dbEnqueueSchema.safeParse({ ...base, operation: 'drop' }).success).toBe(false)
    expect(dbEnqueueSchema.safeParse({ ...base, operation: 'create' }).success).toBe(true)
  })

  it('defaults export encoding to utf8', () => {
    const parsed = exportFileSchema.parse({ suggestedName: 'a.csv', content: 'x' })
    expect(parsed.encoding).toBe('utf8')
  })
})
