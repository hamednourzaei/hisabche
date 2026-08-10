// ============================================
// Card geometry parity.
//
// A card is the most repeated surface in the mobile app — almost every screen
// is a list of them — so a radius that disagrees with web is the single most
// visible geometry difference in the product. `MobileCard` used `radius.lg`
// (16px) while web's card surface is `rounded-2xl` (24px), which made every
// mobile list read visibly squarer than the same list in a browser.
//
// This pins the scale. The companion assertion that `MobileCard` actually
// reaches for the `2xl` step lives in the mobile app's suite, which has the
// Node types needed to read the source file.
// ============================================

import { radiusPx } from '@hisabche/design-tokens'

import { radius } from '../../tokens/layout'

describe('card radius matches web', () => {
  it('resolves the card step to the canonical 24px', () => {
    // Web's `rounded-2xl` resolves to --radius-2xl = 24px.
    expect(radius['2xl']).toBe(24)
    expect(radius['2xl']).toBe(radiusPx['2xl'])
  })

  it('keeps the whole radius scale equal to the canonical tokens', () => {
    // A card cannot be right if the scale under it has drifted.
    for (const key of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full'] as const) {
      expect(radius[key]).toBe(radiusPx[key])
    }
  })
})
