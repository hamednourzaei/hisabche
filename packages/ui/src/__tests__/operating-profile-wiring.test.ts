// V54 5.3 / 5.8 (8 Nov 2026) — one question component, two places, one writer.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const UI = join(__dirname, '..', 'components', 'ui')
const flat = (rel: string) =>
  readFileSync(join(UI, rel), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .split(/\s+/)
    .join(' ')
const MESSAGES = join(__dirname, '..', '..', '..', 'i18n', 'messages')

describe('adaptive questions are wired', () => {
  it('the wizard asks them as step 4 and infers the DNA from every selected trade', () => {
    const page = flat('onboarding/onboarding-page.tsx')
    expect(page).toContain('{step === 4 && ( <OperatingStep')
    expect(page).toContain('{step === 5 && ( <CompleteStep')
    const container = flat('onboarding/containers/onboarding-container.tsx')
    // V55 defect A: the trade handed to the DNA is the ONE canonical primary
    // (registry order, explicit primary wins) — never `selected[0]`, which made
    // selection order an accidental primary-industry rule.
    expect(container).toContain('primaryTrade = primaryIndustryKeyOf(businessType) ?? undefined')
    // V65 · V64 §5: every selected activity reaches the inference, and the
    // primary only names the vocabulary. A call without `tradeKeys` collapses a
    // shop-that-also-repairs into a shop.
    expect(container).toContain(
      'inferOperationalDna({ tradeKey: primaryTrade, tradeKeys: selectedTrades, primaryTradeKey: primaryTrade, ...operatingAnswers, })',
    )
    expect(container).not.toContain('selected[0]')
    expect(container).toContain('operating: ownAnswers')
  })

  it('the pre-fill is composed from every trade, not the primary alone', () => {
    // `suggestedOperatingAnswers(trade)` is the single-trade function; calling
    // it with one key is what hid the second activity's questions.
    for (const file of [
      'onboarding/containers/onboarding-container.tsx',
      'settings/operating-profile-settings.tsx',
    ]) {
      const source = flat(file)
      expect(source, file).toContain('suggestedOperatingAnswersFor(')
      expect(source, file).not.toContain('suggestedOperatingAnswers(')
    }
  })

  it('settings reuses the same component and the one versioned writer', () => {
    const settings = flat('settings/operating-profile-settings.tsx')
    expect(settings).toContain('<OperatingQuestions')
    expect(settings).toContain('await saveDna(dna, view.version)')
    expect(flat('settings/settings-page.tsx')).toContain('<OperatingProfileSettings />')
    // V65: saving this screen must not recompute the profile from one trade —
    // that silently dropped the other activities' axes on the first save.
    expect(settings).toContain('tradeKeys: trades')
    expect(settings).toContain('primaryTradeKey: trade')
  })
})

describe('every key exists in fa, af and en', () => {
  const QUESTIONS = [
    'takesAppointments',
    'deliversCoursesOrPackages',
    'takesJobTicketsOrRepairs',
    'holdsStock',
    'producesGoods',
    'hasPointOfSale',
    'sellsOnCredit',
    'hasStaff',
    'locations',
    // V65 · V64 §6.2: a branch and a warehouse are two questions, and a
    // warehouse can answer «none».
    'branches',
    'warehouses',
  ]
  const SETTINGS = [
    'title',
    'description',
    'save',
    'saving',
    'saved',
    'failed',
    'changedElsewhere',
    'notConfigured',
    'unread',
    'noAccess',
    'nothingRewritten',
  ]
  it.each(['fa', 'af', 'en'])('%s', (lang) => {
    const j = JSON.parse(readFileSync(join(MESSAGES, lang, 'common.json'), 'utf8'))
    expect(typeof j.businessType.beautySalon).toBe('string')
    for (const q of QUESTIONS) expect(typeof j.onboarding.operating.questions[q], q).toBe('string')
    for (const a of ['yes', 'no', 'unknown', 'single', 'multiple'])
      expect(typeof j.onboarding.operating.answers[a], a).toBe('string')
    // The two separate questions need their own answer words in all three
    // languages, or the SegmentedControl renders a raw key.
    for (const a of ['branch_single', 'branch_multiple', 'branch_unknown'])
      expect(typeof j.onboarding.operating.answers[a], a).toBe('string')
    for (const a of [
      'warehouse_none',
      'warehouse_single',
      'warehouse_multiple',
      'warehouse_unknown',
    ])
      expect(typeof j.onboarding.operating.answers[a], a).toBe('string')
    for (const k of SETTINGS) expect(typeof j.settings.operatingProfile[k], k).toBe('string')
  })
})
