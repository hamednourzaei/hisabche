// 12 Nov 2026 (owner's screenshot of onboarding): the composed plan printed raw keys —
// `capabilities.batch_expiry.label`, `…limitation.0`, `…questions.holdsStock.title`,
// `…gaps.REGULATED_DOMAIN_COMPLIANCE`, `nav.overview` — because the component built keys the
// catalogs never had, and the screen's `t` falls back to the key. This renders the plan for
// several businesses with each real catalog and fails on any key that is not a string.
import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CAPABILITIES, CAPABILITY_KEYS, type OperatingAnswers } from '@hisabche/validation'
import { CompositionPlanSummary } from '../components/ui/onboarding/composition-plan-summary'

type Tree = { [k: string]: string | Tree }
const catalog = (lang: string) =>
  JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', 'i18n', 'messages', lang, 'common.json'),
      'utf8',
    ),
  ) as Tree
const at = (tree: Tree, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree)

const BUSINESSES: Array<{ businessType: string; answers: OperatingAnswers }> = [
  { businessType: 'other', answers: {} },
  {
    businessType: 'clinic',
    answers: { holdsStock: 'no', takesAppointments: 'yes', producesGoods: 'no' },
  },
  {
    businessType: 'retail',
    answers: {
      holdsStock: 'yes',
      hasPointOfSale: 'yes',
      tracksSerials: 'yes',
      hasExpiryDates: 'yes',
      sellsOnCredit: 'yes',
      hasStaff: 'yes',
      needsApprovals: 'yes',
      worksAtCustomerSite: 'yes',
      holdsCustomerAssets: 'yes',
    },
  },
  {
    businessType: 'manufacturing',
    answers: { holdsStock: 'yes', producesGoods: 'yes', hasStaff: 'yes', billsRecurring: 'yes' },
  },
]

describe.each(['fa', 'af', 'en'])('composed plan in %s', (lang) => {
  const messages = catalog(lang)
  const missing = new Set<string>()
  const t = (key: string) => {
    const value = at(messages, key)
    if (typeof value === 'string') return value
    missing.add(key)
    return key
  }

  it.each(BUSINESSES)('$businessType: every text it shows exists', ({ businessType, answers }) => {
    missing.clear()
    renderToStaticMarkup(
      <CompositionPlanSummary businessType={businessType} answers={answers} t={t} />,
    )
    expect([...missing]).toEqual([])
  })

  it('every capability label and limitation code has text', () => {
    const absent = CAPABILITY_KEYS.flatMap((key) => [
      CAPABILITIES[key].labelKey,
      ...CAPABILITIES[key].limitations.map((code) => `capabilities.limitations.${code}`),
    ]).filter((key) => typeof at(messages, key) !== 'string')
    expect(absent).toEqual([])
  })
})

describe('open questions', () => {
  it('a question already answered is not «open»', () => {
    const t = (key: string) => key
    const html = renderToStaticMarkup(
      <CompositionPlanSummary
        businessType="retail"
        answers={{ holdsStock: 'yes', hasPointOfSale: 'yes', takesAppointments: 'unknown' }}
        t={t}
      />,
    )
    expect(html).not.toContain('onboarding.operating.questions.holdsStock<')
    expect(html).not.toContain('onboarding.operating.questions.hasPointOfSale<')
  })
})
