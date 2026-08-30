// ============================================
// backend/src/services/mdm/mdm.domain.ts
//
// Finding the same customer, supplier or product entered twice — and deciding
// which record survives.
//
// ---------------------------------------------------------------------------
// WHY THIS IS HARDER THAN IT LOOKS IN A SHOP
//
// "احمد محمدی" and "احمد محمّدي" are the same person. So are "0700 123 456"
// and "+93700123456". A shop with three staff entering customers by hand will
// have both spellings within a week, and the second one is where the debt
// quietly starts accumulating in parallel.
//
// So matching normalises Persian/Dari orthography (ي/ی, ك/ک, ة/ه), Arabic and
// Persian digits, and phone formatting BEFORE comparing anything.
//
// ---------------------------------------------------------------------------
// A MERGE IS NEVER AUTOMATIC
//
// This file SCORES and PROPOSES. Merging two customers moves invoices, debts
// and payment history from one identity to another, and a wrong merge is
// extremely expensive to undo — so a person confirms every one, and the
// service records what was merged into what.
//
// The one exception is scoring 1.0 on an exact, unambiguous key (the same
// national id, the same barcode), and even that is only ever a `certain`
// SUGGESTION, not an action.
// ============================================

export type MdmEntity = 'customer' | 'supplier' | 'product'

export interface MdmRecord {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  /** National id, tax number, barcode or SKU — whatever uniquely identifies. */
  identifier?: string | null
  createdAt?: string
  /** How much history hangs off this record. Used to pick the survivor. */
  activityCount?: number
}

// ─── Normalisation ───────────────────────────────────────────────────────────

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Persian and Arabic digits to ASCII, so "۰۷۰۰" and "0700" compare equal. */
export function normaliseDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const persian = PERSIAN_DIGITS.indexOf(char)
    if (persian >= 0) return String(persian)
    return String(ARABIC_DIGITS.indexOf(char))
  })
}

/**
 * One spelling of a name.
 *
 * Arabic ي and ك are folded to Persian ی and ک, ة to ه, diacritics removed,
 * ZWNJ treated as a space. Without this "محمّدي" and "محمدی" are two
 * customers with two separate balances.
 */
export function normaliseName(value: string): string {
  return normaliseDigits(value)
    .toLowerCase()
    .replace(/[يى]/g, 'ی') // ي, ى → ی
    .replace(/ك/g, 'ک') // ك → ک
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/[ً-ْٰ]/g, '') // harakat
    .replace(/‌/g, ' ') // ZWNJ
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A phone number reduced to what actually identifies it.
 *
 * Afghan numbers are written as 0700123456, +93700123456 and 93 700 123 456
 * by three different people entering the same customer. Comparing the last
 * nine digits makes all three equal without needing to know the country.
 */
export function normalisePhone(value: string): string {
  const digits = normaliseDigits(value).replace(/\D/g, '')
  return digits.length > 9 ? digits.slice(-9) : digits
}

export function normaliseIdentifier(value: string): string {
  return normaliseDigits(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

// ─── Similarity ──────────────────────────────────────────────────────────────

/** Levenshtein, capped: beyond a few edits the pair is not a typo anyway. */
export function editDistance(a: string, b: string, cap = 4): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > cap) return cap + 1

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = i

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost)
      current.push(value)
      if (value < rowMin) rowMin = value
    }

    // Every path through this row already exceeds the cap.
    if (rowMin > cap) return cap + 1
    previous = current
  }

  return previous[b.length]!
}

/** 0–1 over normalised names. Word order is ignored: people swap it. */
export function nameSimilarity(left: string, right: string): number {
  const a = normaliseName(left)
  const b = normaliseName(right)

  if (!a || !b) return 0
  if (a === b) return 1

  const aWords = [...new Set(a.split(' '))].sort()
  const bWords = [...new Set(b.split(' '))].sort()
  if (aWords.join(' ') === bWords.join(' ')) return 0.97

  const shared = aWords.filter((word) => bWords.includes(word)).length
  const overlap = shared / Math.max(aWords.length, bWords.length)

  const distance = editDistance(a, b)
  const typo = distance > 4 ? 0 : 1 - distance / Math.max(a.length, b.length)

  return Math.max(overlap, typo)
}

export type MatchReason = 'identifier' | 'phone' | 'email' | 'name'

export interface DuplicateCandidate {
  leftId: string
  rightId: string
  /** 0–1. 1 means an exact match on something that uniquely identifies. */
  score: number
  reasons: MatchReason[]
  confidence: 'certain' | 'likely' | 'possible'
}

/**
 * Score one pair.
 *
 * An exact identifier is decisive on its own — two records with the same
 * national id or the same barcode ARE the same thing. Everything else is
 * corroboration: a shared phone plus a similar name is a strong signal, a
 * similar name alone is a question for a person.
 */
export function scorePair(left: MdmRecord, right: MdmRecord): DuplicateCandidate | null {
  if (left.id === right.id) return null

  const reasons: MatchReason[] = []
  let score = 0

  if (left.identifier && right.identifier) {
    if (normaliseIdentifier(left.identifier) === normaliseIdentifier(right.identifier)) {
      return {
        leftId: left.id,
        rightId: right.id,
        score: 1,
        reasons: ['identifier'],
        confidence: 'certain',
      }
    }
    // Different identifiers are evidence AGAINST, not neutral: two records
    // with two different national ids are two people, whatever the names say.
    return null
  }

  if (left.phone && right.phone) {
    const a = normalisePhone(left.phone)
    const b = normalisePhone(right.phone)
    if (a && a === b) {
      score += 0.6
      reasons.push('phone')
    }
  }

  if (left.email && right.email) {
    if (left.email.trim().toLowerCase() === right.email.trim().toLowerCase()) {
      score += 0.5
      reasons.push('email')
    }
  }

  const similarity = nameSimilarity(left.name, right.name)
  if (similarity >= 0.8) {
    score += similarity * 0.5
    reasons.push('name')
  }

  if (reasons.length === 0) return null

  score = Math.min(score, 0.99)

  const confidence: DuplicateCandidate['confidence'] =
    score >= 0.85 ? 'certain' : score >= 0.6 ? 'likely' : 'possible'

  // A name resemblance on its own is a question, never a conclusion. Two
  // different people called محمد احمدی are not a duplicate.
  if (reasons.length === 1 && reasons[0] === 'name' && similarity < 1) {
    return {
      leftId: left.id,
      rightId: right.id,
      score: Math.min(score, 0.55),
      reasons,
      confidence: 'possible',
    }
  }

  return { leftId: left.id, rightId: right.id, score, reasons, confidence }
}

/** Every candidate pair in a set, strongest first. */
export function findDuplicates(records: MdmRecord[], minScore = 0.5): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = []

  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const candidate = scorePair(records[i]!, records[j]!)
      if (candidate && candidate.score >= minScore) candidates.push(candidate)
    }
  }

  return candidates.sort((a, b) => b.score - a.score)
}

// ─── Merging ─────────────────────────────────────────────────────────────────

export type MergeRuleCode =
  | 'MERGE_SAME_RECORD'
  | 'MERGE_REASON_REQUIRED'
  | 'MERGE_SURVIVOR_UNKNOWN'
  | 'MERGE_ABSORBED_UNKNOWN'

export function validateMerge(
  survivorId: string,
  absorbedId: string,
  reason: string | undefined,
  known: Set<string>,
): MergeRuleCode[] {
  const problems: MergeRuleCode[] = []

  if (survivorId === absorbedId) problems.push('MERGE_SAME_RECORD')
  if (!known.has(survivorId)) problems.push('MERGE_SURVIVOR_UNKNOWN')
  if (!known.has(absorbedId)) problems.push('MERGE_ABSORBED_UNKNOWN')

  // A merge moves invoices, debts and payment history between identities and
  // is expensive to undo. Six months later, "why are these one customer" must
  // have an answer.
  if (!reason || reason.trim().length === 0) problems.push('MERGE_REASON_REQUIRED')

  return [...new Set(problems)]
}

/**
 * Which record should survive a merge.
 *
 * The one with more history, because moving fewer rows is both faster and less
 * likely to go wrong halfway. Ties go to the older record: it is the one other
 * people's memories and paper records refer to.
 */
export function pickSurvivor(left: MdmRecord, right: MdmRecord): MdmRecord {
  const leftActivity = left.activityCount ?? 0
  const rightActivity = right.activityCount ?? 0

  if (leftActivity !== rightActivity) return leftActivity > rightActivity ? left : right

  const leftDate = left.createdAt ?? ''
  const rightDate = right.createdAt ?? ''
  if (leftDate && rightDate) return leftDate <= rightDate ? left : right

  return left
}

/**
 * The golden record: the survivor, filled in from the absorbed one.
 *
 * Only fields the survivor LACKS are taken. A merge must never overwrite a
 * value somebody deliberately entered on the record being kept — the absorbed
 * record is a source of missing detail, not a newer truth.
 */
export function goldenRecord(survivor: MdmRecord, absorbed: MdmRecord): MdmRecord {
  const takeIfMissing = (own: string | null | undefined, other: string | null | undefined) =>
    own && own.trim() ? own : (other ?? null)

  return {
    ...survivor,
    phone: takeIfMissing(survivor.phone, absorbed.phone),
    email: takeIfMissing(survivor.email, absorbed.email),
    identifier: takeIfMissing(survivor.identifier, absorbed.identifier),
  }
}
