import { describe, expect, it } from 'vitest'
import { MIGRATION_PRESETS } from '../services/migration/migration.presets'

describe('Migration Presets for Regional ERPs (Option 44)', () => {
  it('defines presets for Holoo, Sepidar, Tally, and QuickBooks', () => {
    expect(MIGRATION_PRESETS.holoo).toBeDefined()
    expect(MIGRATION_PRESETS.sepidar).toBeDefined()
    expect(MIGRATION_PRESETS.tally).toBeDefined()
    expect(MIGRATION_PRESETS.quickbooks).toBeDefined()
  })

  it('maps Persian header variations in Holoo correctly', () => {
    const holoo = MIGRATION_PRESETS.holoo
    expect(holoo).toBeDefined()
    if (!holoo) return
    expect(holoo.fieldAliases.sku).toContain('کد کالا')
    expect(holoo.fieldAliases.name).toContain('نام کالا')
    expect(holoo.fieldAliases.buy_price).toContain('قیمت خرید')
    expect(holoo.fieldAliases.sale_price).toContain('قیمت فروش')
    expect(holoo.fieldAliases.stock).toContain('موجودی')
  })

  it('maps Sepidar headers correctly', () => {
    const sepidar = MIGRATION_PRESETS.sepidar
    expect(sepidar).toBeDefined()
    if (!sepidar) return
    expect(sepidar.fieldAliases.sku).toContain('کد محصول')
    expect(sepidar.fieldAliases.name).toContain('عنوان محصول')
    expect(sepidar.fieldAliases.stock).toContain('موجودی انبار')
  })
})
