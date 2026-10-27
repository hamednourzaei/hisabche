// ============================================
// backend/src/services/profile-write.ts
//
// Writing the fields a person sent to their `profiles` row.
//
// ⚠️ NOT AN UPSERT. `profiles.full_name` and `profiles.business_types` are
// NOT NULL with no default on the live table (docs/base-schema-migration.sql).
// `INSERT … ON CONFLICT DO UPDATE` checks NOT NULL on the proposed INSERT row
// BEFORE it resolves the conflict, so a partial payload such as
// `{ id, business_types }` failed with 23502 even though the row existed.
// That message contains the word «column», the old fallback read it as «the
// onboarding migration has not run», retried the same partial payload, ignored
// the result and answered 200 — the trades were never stored.
//
// So: UPDATE the existing row with only what was sent; INSERT (with the NOT
// NULL columns given a value) only when the person has no row yet; and fall
// back to the base columns ONLY on the two codes that mean «column missing».
// Every other error is thrown.
// ============================================

import { supabase } from '../db'

/** Columns that exist only after docs/onboarding-server-state-migration.sql. */
const ONBOARDING_COLUMNS = [
  'onboarding_completed_at',
  'business_types',
  'store_size',
  'business_note',
] as const

export type ProfileFields = Record<string, unknown>

export interface ProfileInsertDefaults {
  /** `profiles.full_name` is NOT NULL: a brand-new row needs a value. */
  fullName: string
}

function withoutOnboarding(fields: ProfileFields): ProfileFields {
  const copy: ProfileFields = { ...fields }
  for (const column of ONBOARDING_COLUMNS) delete copy[column]
  return copy
}

/** PostgREST / Postgres «no such column» (migration not applied). */
function isMissingColumn(error: { code?: string | undefined } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

async function writeOnce(
  userId: string,
  fields: ProfileFields,
  defaults: ProfileInsertDefaults,
  includeOnboardingDefaults: boolean,
): Promise<{ error: { code?: string | undefined; message: string } | null }> {
  const updated = await supabase.from('profiles').update(fields).eq('id', userId).select('id')
  if (updated.error) return { error: updated.error }
  if (updated.data && updated.data.length > 0) return { error: null }

  // No row yet: create it with the NOT NULL columns filled.
  const inserted = await supabase.from('profiles').insert({
    id: userId,
    full_name: defaults.fullName,
    ...(includeOnboardingDefaults ? { business_types: [] } : {}),
    ...fields,
  })
  return { error: inserted.error }
}

export async function writeProfile(
  userId: string,
  fields: ProfileFields,
  defaults: ProfileInsertDefaults,
): Promise<{ onboardingColumnsMissing: boolean }> {
  const first = await writeOnce(userId, fields, defaults, true)
  if (!first.error) return { onboardingColumnsMissing: false }

  if (isMissingColumn(first.error)) {
    const second = await writeOnce(userId, withoutOnboarding(fields), defaults, false)
    if (second.error) throw second.error
    return { onboardingColumnsMissing: true }
  }

  throw first.error
}
