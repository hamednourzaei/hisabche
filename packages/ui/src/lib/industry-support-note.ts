// ============================================
// packages/ui/src/lib/industry-support-note.ts
//
// The honest sentence under an industry choice.
//
// Selecting a business type used to look like switching on a package. For most
// trades nothing specialised exists yet — the profile is the generic one — and
// the screen said nothing, so the user could reasonably expect a trade-specific
// workflow that is not there.
//
// This is derived from the SAME resolver every other screen uses, never from a
// list kept here: when a trade gains a real capability its profile stops being
// generic and the note disappears with no edit to this file.
// ============================================

import { resolveBusinessProfile } from '@hisabche/validation'

/** i18n key of the note, or null when there is nothing to say. */
export const INDUSTRY_NOTE_GENERIC_KEY = 'industry.supportNote.generic'

/**
 * `null` when nothing was chosen (an empty selection is not a decision to
 * annotate) or when the resolved profile really is specialised.
 */
export function industrySupportNoteKey(
  types: readonly string[] | string | null | undefined,
): string | null {
  const selected = Array.isArray(types) ? types : typeof types === 'string' ? types.split(',') : []
  if (selected.every((value) => typeof value !== 'string' || value.trim() === '')) return null

  return resolveBusinessProfile(types).isGeneric ? INDUSTRY_NOTE_GENERIC_KEY : null
}
