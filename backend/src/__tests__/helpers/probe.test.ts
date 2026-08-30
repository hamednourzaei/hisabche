import { describe, expect, it } from 'vitest'
import { FakeDatabase } from './fake-supabase'

describe('fake builder', () => {
  it('inserts and returns a single row', async () => {
    const db = new FakeDatabase()
    const result = await db.from('t').insert({ a: 1 }).select('a').single()
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ a: 1 })
  })

  it('is thenable for a plain select', async () => {
    const db = new FakeDatabase().seed('t', [{ a: 1 }])
    const { data } = await db.from('t').select('*').eq('a', 1)
    expect(data).toHaveLength(1)
  })
})
