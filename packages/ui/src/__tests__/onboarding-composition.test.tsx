import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CompositionPlanSummary } from '../components/ui/onboarding/composition-plan-summary'

const t = (key: string) => key

describe('V60.1 §3 — Onboarding composition engine UI', () => {
  it('renders base menu + open questions for "other" with all-unknown answers and never falls back to retail', () => {
    const html = renderToStaticMarkup(
      <CompositionPlanSummary
        businessType="other"
        answers={{
          holdsStock: 'unknown',
          producesGoods: 'unknown',
          takesAppointments: 'unknown',
          hasPointOfSale: 'unknown',
        }}
        t={t}
      />,
    )

    expect(html).toContain('data-composition-plan=""')
    expect(html).toContain('data-composition-menu=""')
    expect(html).toContain('data-composition-questions=""')
    expect(html).toContain('data-composition-menu-item="overview"')
    expect(html).not.toContain('data-composition-menu-item="pos"')
    expect(html).not.toContain('data-composition-menu-item="retail"')
  })

  it('renders applicable problems, available, partial limitations and planned items for a business', () => {
    const html = renderToStaticMarkup(
      <CompositionPlanSummary
        businessType="clinic"
        answers={{
          holdsStock: 'no',
          takesAppointments: 'yes',
          producesGoods: 'no',
          worksAtCustomerSite: 'no',
        }}
        t={t}
      />,
    )

    expect(html).toContain('data-composition-problems=""')
    expect(html).toContain('onboarding.composition.problems.P3_order_queue_and_capacity')
    expect(html).toContain('data-composition-partial=""')
    expect(html).toContain('data-composition-planned=""')
    expect(html).toContain('capabilities.resource_capacity.label')
  })
})
