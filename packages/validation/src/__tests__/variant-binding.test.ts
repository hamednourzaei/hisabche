import { describe, expect, it } from 'vitest'

import {
  checkVariantBinding,
  type VariantBindingRow,
} from '../schemas/universal-core/variants.domain'

const WS = 'ws-1'
const row = (over: Partial<VariantBindingRow> = {}): VariantBindingRow => ({
  id: 'v-1',
  workspaceId: WS,
  templateProductId: 'p-1',
  isActive: true,
  ...over,
})
const check = (variantId: string | null, variants: VariantBindingRow[], productId = 'p-1') =>
  checkVariantBinding({ workspaceId: WS, productId, variantId, variantsOfProduct: variants })

describe('checkVariantBinding', () => {
  it('a product with no variants is sold as itself (legacy and plain products)', () => {
    expect(check(null, [])).toEqual({ ok: true, variantId: null })
  })

  it('a product with active variants cannot be sold as the parent alone', () => {
    expect(check(null, [row()])).toEqual({ ok: false, code: 'VARIANT_REQUIRED' })
  })

  it('a product whose variants are all inactive is not forced to name one', () => {
    expect(check(null, [row({ isActive: false })])).toEqual({ ok: true, variantId: null })
  })

  it('a valid active variant of this product and workspace is accepted', () => {
    expect(check('v-1', [row()])).toEqual({ ok: true, variantId: 'v-1' })
  })

  it('an inactive variant cannot be newly selected, and is named as inactive, not as missing', () => {
    expect(check('v-1', [row({ isActive: false })])).toEqual({
      ok: false,
      code: 'VARIANT_INACTIVE',
    })
  })

  it('a variant of another product is refused', () => {
    expect(
      checkVariantBinding({
        workspaceId: WS,
        productId: 'p-1',
        variantId: 'v-9',
        variantsOfProduct: [row()],
        requestedVariant: row({ id: 'v-9', templateProductId: 'p-2' }),
      }),
    ).toEqual({ ok: false, code: 'VARIANT_WRONG_PRODUCT' })
  })

  it('a variant of another workspace is refused', () => {
    expect(
      checkVariantBinding({
        workspaceId: WS,
        productId: 'p-1',
        variantId: 'v-9',
        variantsOfProduct: [],
        requestedVariant: row({ id: 'v-9', workspaceId: 'ws-2' }),
      }),
    ).toEqual({ ok: false, code: 'VARIANT_WRONG_WORKSPACE' })
  })

  it('an unknown variant id is refused, never ignored', () => {
    expect(check('v-404', [row()])).toEqual({ ok: false, code: 'VARIANT_NOT_FOUND' })
    expect(check('v-404', [])).toEqual({ ok: false, code: 'VARIANT_NOT_FOUND' })
  })
})
