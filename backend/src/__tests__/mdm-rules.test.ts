// ============================================
// Duplicate detection and merging.
//
// The cases that matter are the Persian/Dari ones. "احمد محمدی" typed by two
// staff members with two keyboards is one customer with two balances, and no
// amount of exact matching will ever find it.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  editDistance,
  findDuplicates,
  goldenRecord,
  nameSimilarity,
  normaliseDigits,
  normaliseIdentifier,
  normaliseName,
  normalisePhone,
  pickSurvivor,
  scorePair,
  validateMerge,
  type MdmRecord,
} from '../services/mdm'

const record = (over: Partial<MdmRecord> & { id: string; name: string }): MdmRecord => ({
  phone: null,
  email: null,
  identifier: null,
  ...over,
})

describe('normalising Persian and Dari text', () => {
  it('folds Arabic ي and ك to Persian ی and ک', () => {
    // Two keyboards, one person, two customer records with two balances.
    expect(normaliseName('محمّدي')).toBe(normaliseName('محمدی'))
    expect(normaliseName('كابل')).toBe(normaliseName('کابل'))
  })

  it('folds ة to ه', () => {
    expect(normaliseName('فاطمة')).toBe(normaliseName('فاطمه'))
  })

  it('converts Persian and Arabic digits to ASCII', () => {
    expect(normaliseDigits('۰۷۰۰۱۲۳۴۵۶')).toBe('0700123456')
    expect(normaliseDigits('٠٧٠٠')).toBe('0700')
  })

  it('ignores case and punctuation', () => {
    expect(normaliseName('Ahmad  Mohammadi!')).toBe('ahmad mohammadi')
  })
})

describe('normalising a phone number', () => {
  it('makes three ways of writing one Afghan number equal', () => {
    expect(normalisePhone('0700123456')).toBe(normalisePhone('+93700123456'))
    expect(normalisePhone('93 700 123 456')).toBe(normalisePhone('0700123456'))
  })

  it('handles Persian digits in a phone number', () => {
    expect(normalisePhone('۰۷۰۰۱۲۳۴۵۶')).toBe(normalisePhone('0700123456'))
  })

  it('leaves a short number alone rather than truncating it into a match', () => {
    expect(normalisePhone('12345')).toBe('12345')
  })
})

describe('similarity', () => {
  it('scores identical normalised names as 1', () => {
    expect(nameSimilarity('احمد محمدی', 'احمد محمّدي')).toBe(1)
  })

  it('scores a swapped word order as almost identical', () => {
    expect(nameSimilarity('احمد محمدی', 'محمدی احمد')).toBeGreaterThan(0.9)
  })

  it('scores a one-letter typo highly', () => {
    expect(nameSimilarity('Ahmad Mohammadi', 'Ahmad Mohamadi')).toBeGreaterThan(0.85)
  })

  it('scores unrelated names low', () => {
    expect(nameSimilarity('احمد محمدی', 'زهرا رضایی')).toBeLessThan(0.5)
  })

  it('caps the edit distance instead of scanning long strings', () => {
    expect(editDistance('a'.repeat(50), 'b'.repeat(50), 4)).toBe(5)
  })
})

describe('scoring a pair', () => {
  it('calls two records with the same identifier certain', () => {
    const left = record({ id: '1', name: 'دکان الف', identifier: '1234567890' })
    const right = record({ id: '2', name: 'مغازه ب', identifier: '123 456 7890' })

    const candidate = scorePair(left, right)
    expect(candidate?.score).toBe(1)
    expect(candidate?.confidence).toBe('certain')
  })

  it('RULES OUT two records with DIFFERENT identifiers, however alike the names', () => {
    // Two people with the same name and two different national ids are two
    // people. A different identifier is evidence against, not neutral.
    const left = record({ id: '1', name: 'احمد محمدی', identifier: '111' })
    const right = record({ id: '2', name: 'احمد محمدی', identifier: '222' })

    expect(scorePair(left, right)).toBeNull()
  })

  it('treats a shared phone plus a similar name as strong', () => {
    const left = record({ id: '1', name: 'احمد محمدی', phone: '0700123456' })
    const right = record({ id: '2', name: 'احمد محمّدي', phone: '+93700123456' })

    const candidate = scorePair(left, right)
    expect(candidate?.reasons).toEqual(expect.arrayContaining(['phone', 'name']))
    expect(candidate?.confidence).toBe('certain')
  })

  it('treats a similar name ALONE as only a question', () => {
    // Two different people called محمد احمدی are not a duplicate.
    const left = record({ id: '1', name: 'محمد احمدی' })
    const right = record({ id: '2', name: 'محمود احمدی' })

    const candidate = scorePair(left, right)
    if (candidate) expect(candidate.confidence).toBe('possible')
  })

  it('never matches a record with itself', () => {
    const same = record({ id: '1', name: 'x', phone: '0700123456' })
    expect(scorePair(same, same)).toBeNull()
  })

  it('finds nothing between unrelated records', () => {
    const left = record({ id: '1', name: 'احمد محمدی', phone: '0700111111' })
    const right = record({ id: '2', name: 'زهرا رضایی', phone: '0700222222' })
    expect(scorePair(left, right)).toBeNull()
  })
})

describe('scanning a set', () => {
  const records = [
    record({ id: '1', name: 'احمد محمدی', phone: '0700123456' }),
    record({ id: '2', name: 'احمد محمّدي', phone: '+93700123456' }),
    record({ id: '3', name: 'زهرا رضایی', phone: '0700999999' }),
  ]

  it('finds the duplicate pair and nothing else', () => {
    const candidates = findDuplicates(records)
    expect(candidates).toHaveLength(1)
    expect([candidates[0]!.leftId, candidates[0]!.rightId].sort()).toEqual(['1', '2'])
  })

  it('returns the strongest candidate first', () => {
    const many = [...records, record({ id: '4', name: 'احمد محمدی زاده' })]
    const candidates = findDuplicates(many)
    expect(candidates[0]!.score).toBeGreaterThanOrEqual(candidates[candidates.length - 1]!.score)
  })
})

describe('choosing which record survives', () => {
  it('keeps the one with more history', () => {
    // Moving fewer rows is faster and less likely to go wrong halfway.
    const busy = record({ id: '1', name: 'x', activityCount: 40 })
    const quiet = record({ id: '2', name: 'x', activityCount: 2 })
    expect(pickSurvivor(quiet, busy).id).toBe('1')
  })

  it('breaks a tie in favour of the older record', () => {
    const older = record({ id: '1', name: 'x', createdAt: '2024-01-01' })
    const newer = record({ id: '2', name: 'x', createdAt: '2026-01-01' })
    expect(pickSurvivor(newer, older).id).toBe('1')
  })
})

describe('the golden record', () => {
  it('fills in only what the survivor lacks', () => {
    const survivor = record({ id: '1', name: 'احمد', phone: '0700111111' })
    const absorbed = record({ id: '2', name: 'احمد', phone: '0700222222', email: 'a@b.c' })

    const golden = goldenRecord(survivor, absorbed)
    expect(golden.phone).toBe('0700111111')
    expect(golden.email).toBe('a@b.c')
  })

  it('NEVER overwrites a value somebody entered on the surviving record', () => {
    const survivor = record({ id: '1', name: 'احمد', phone: '0700111111' })
    const absorbed = record({ id: '2', name: 'احمد', phone: '0700222222' })
    expect(goldenRecord(survivor, absorbed).phone).toBe('0700111111')
  })
})

describe('merge validation', () => {
  const known = new Set(['1', '2'])

  it('refuses a merge with no stated reason', () => {
    // Six months later, "why are these one customer" must have an answer.
    expect(validateMerge('1', '2', '', known)).toContain('MERGE_REASON_REQUIRED')
  })

  it('refuses merging a record into itself', () => {
    expect(validateMerge('1', '1', 'same person', known)).toContain('MERGE_SAME_RECORD')
  })

  it('refuses a record from outside the loaded set', () => {
    expect(validateMerge('1', '9', 'same person', known)).toContain('MERGE_ABSORBED_UNKNOWN')
  })

  it('accepts a reasoned merge of two known records', () => {
    expect(validateMerge('1', '2', 'same customer, two spellings', known)).toEqual([])
  })
})

describe('identifiers', () => {
  it('ignores formatting', () => {
    expect(normaliseIdentifier('abc-123 456')).toBe('ABC123456')
  })
})
