import { describe, expect, it } from 'vitest'
import { canTransitionCheque } from '@hisabche/validation'

describe('B.2.5 Cheque lifecycle state machine', () => {
  it('allows valid incoming cheque lifecycle received -> deposited -> cleared', () => {
    expect(canTransitionCheque('received', 'deposited', 'in')).toEqual({ ok: true })
    expect(canTransitionCheque('deposited', 'cleared', 'in')).toEqual({ ok: true })
    expect(canTransitionCheque('deposited', 'bounced', 'in')).toEqual({ ok: true })
  })

  it('refuses depositing an already endorsed cheque', () => {
    expect(canTransitionCheque('endorsed', 'deposited', 'in')).toEqual({
      ok: false,
      code: 'CHEQUE_ENDORSED_CANNOT_DEPOSIT',
    })
  })

  it('refuses illegal terminal transitions', () => {
    expect(canTransitionCheque('cleared', 'bounced', 'in')).toEqual({
      ok: false,
      code: 'CHEQUE_ILLEGAL_TRANSITION',
    })
    expect(canTransitionCheque('bounced', 'cleared', 'in')).toEqual({
      ok: false,
      code: 'CHEQUE_ILLEGAL_TRANSITION',
    })
  })
})
