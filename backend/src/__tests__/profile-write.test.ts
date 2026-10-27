// PATCH /api/auth/profile stored nothing for `businessTypes` and answered 200.
//
// Cause: it upserted a PARTIAL row into `profiles`, where `full_name` and
// `business_types` are NOT NULL without a default. The INSERT half of
// `INSERT … ON CONFLICT DO UPDATE` is checked first, failed with 23502, the
// message contained «column», the old fallback treated that as «migration not
// run», retried the same partial payload and ignored the result.
//
// The stub below models exactly that table: NOT NULL on the INSERT path, rows
// that exist, and an `upsert` that fails the way Postgres does.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const rows = new Map<string, Row>()
const calls: string[] = []
let missingOnboardingColumns = false

const NOT_NULL = ['full_name', 'business_types'] as const
const ONBOARDING = ['onboarding_completed_at', 'business_types', 'store_size', 'business_note']

function notNullViolation(candidate: Row) {
  for (const column of NOT_NULL) {
    if (candidate[column] === undefined || candidate[column] === null) {
      return {
        code: '23502',
        message: `null value in column "${column}" of relation "profiles" violates not-null constraint`,
      }
    }
  }
  return null
}

function missingColumn(fields: Row) {
  if (!missingOnboardingColumns) return null
  const hit = Object.keys(fields).find((key) => ONBOARDING.includes(key))
  return hit
    ? { code: '42703', message: `column "${hit}" of relation "profiles" does not exist` }
    : null
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`unexpected table ${table}`)
      return {
        update: (fields: Row) => ({
          eq: (_column: string, id: string) => ({
            select: async () => {
              calls.push('update')
              const gone = missingColumn(fields)
              if (gone) return { data: null, error: gone }
              const row = rows.get(id)
              if (!row) return { data: [], error: null }
              rows.set(id, { ...row, ...fields })
              return { data: [{ id }], error: null }
            },
          }),
        }),
        insert: async (fields: Row) => {
          calls.push('insert')
          const gone = missingColumn(fields)
          if (gone) return { error: gone }
          const violation = notNullViolation(fields)
          if (violation) return { error: violation }
          rows.set(String(fields.id), fields)
          return { error: null }
        },
        // What the old route used. It must never be called again.
        upsert: async (fields: Row) => {
          calls.push('upsert')
          return { error: notNullViolation(fields) }
        },
      }
    },
  },
}))

import { writeProfile } from '../services/profile-write'

const USER = '2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e'

beforeEach(() => {
  rows.clear()
  calls.length = 0
  missingOnboardingColumns = false
})

describe('writeProfile', () => {
  it('stores the trades on an existing row without sending the NOT NULL columns', async () => {
    rows.set(USER, { id: USER, full_name: 'haji hamid', business_types: [] })

    await writeProfile(
      USER,
      { updated_at: 'now', business_types: ['jewellery'] },
      { fullName: 'x' },
    )

    expect(rows.get(USER)?.business_types).toEqual(['jewellery'])
    expect(rows.get(USER)?.full_name).toBe('haji hamid')
    expect(calls).toEqual(['update'])
  })

  it('never goes through upsert (the partial INSERT half is what failed)', async () => {
    rows.set(USER, { id: USER, full_name: 'haji hamid', business_types: [] })
    await writeProfile(USER, { business_types: ['jewellery'] }, { fullName: 'x' })
    expect(calls).not.toContain('upsert')
  })

  it('creates the row with the NOT NULL columns filled when the person has none yet', async () => {
    await writeProfile(USER, { business_types: ['jewellery'] }, { fullName: 'haji hamid' })

    expect(rows.get(USER)).toMatchObject({
      id: USER,
      full_name: 'haji hamid',
      business_types: ['jewellery'],
    })
    expect(calls).toEqual(['update', 'insert'])
  })

  it('gives a new row an empty trade list when only a name was sent', async () => {
    await writeProfile(USER, { full_name: 'haji hamid' }, { fullName: 'ignored' })
    expect(rows.get(USER)?.business_types).toEqual([])
  })

  it('falls back to the base columns only when the onboarding columns do not exist', async () => {
    missingOnboardingColumns = true
    rows.set(USER, { id: USER, full_name: 'haji hamid' })

    const result = await writeProfile(
      USER,
      { updated_at: 'now', full_name: 'new name', business_types: ['jewellery'] },
      { fullName: 'x' },
    )

    expect(result.onboardingColumnsMissing).toBe(true)
    expect(rows.get(USER)?.full_name).toBe('new name')
    expect(rows.get(USER)?.business_types).toBeUndefined()
  })

  it('throws any other database error instead of answering success', async () => {
    // A NOT NULL violation whose message contains «column» is NOT «column missing».
    await expect(
      writeProfile(USER, { business_types: ['jewellery'] }, { fullName: '' as unknown as string }),
    ).resolves.toBeDefined()
    rows.clear()
    const failing = writeProfile(USER, { business_types: null }, { fullName: 'x' })
    await expect(failing).rejects.toMatchObject({ code: '23502' })
  })
})
