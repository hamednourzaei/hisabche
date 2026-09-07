// ============================================
// backend/src/services/inventory/product-units.service.ts
//
// T11 / L1 — defining which units a product can be bought and sold in.
//
// ---------------------------------------------------------------------------
// THE GAP THIS CLOSES
//
// `phase-l-02` created `product_units`, `unit-conversion.domain.ts` converts
// by it, and `invoice.service.loadProductUnits` reads it on every invoice.
// Nothing could WRITE it. There was no route, no service, no form — so the
// table was empty in every workspace and multi-unit selling was, in practice,
// unavailable.
//
// ---------------------------------------------------------------------------
// ⚠️ THE SET IS REPLACED AS A WHOLE, NOT EDITED ROW BY ROW
//
// The validity rules are properties of the SET, not of a row: exactly one
// base, the base factor is 1, no duplicate unit, at most one purchase default.
// Adding or removing one row at a time means passing through states that break
// those rules — and the database enforces them with partial unique indexes, so
// «change which unit is the base» would fail at the moment two rows claim it.
//
// So the caller sends the whole set, `validateUnitSet` checks it BEFORE
// anything is written, and the write is delete-then-insert inside one RPC.
//
// ⚠️ THE ROUNDTRIP IS AN RPC BECAUSE supabase-js HAS NO TRANSACTIONS.
// A delete followed by a failed insert would leave the product with NO units
// at all, which is worse than the state before the edit: `loadProductUnits`
// would then treat a multi-unit product as single-unit and read «2 cartons» as
// 2 pieces. See the migration for the function.
// ============================================

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'

import { validateUnitSet, type ProductUnitOption } from './unit-conversion.domain'

const SCHEMA_ABSENT = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])

export interface ProductUnitInput {
  unitId: string
  conversionFactorToBase: number
  isBaseUnit: boolean
  isPurchaseDefault: boolean
  isSaleDefault: boolean
}

export interface ProductUnitRecord extends ProductUnitInput {
  id: string
  unitCode: string
  unitName: string | null
}

interface Row {
  id: string
  unit_id: string
  conversion_factor_to_base: number | string
  is_base_unit: boolean
  is_purchase_default: boolean
  is_sale_default: boolean
  units: { code: string; name: string | null } | null
}

export class ProductUnitsService {
  /**
   * The units defined for a product.
   *
   * An empty array is a real and common answer: `product_units` is OPT-IN, and
   * a product with no rows is single-unit. It is not an error and must not be
   * reported as one.
   */
  async list(ctx: TenancyContext, productId: string): Promise<ProductUnitRecord[]> {
    const { data, error } = await supabase
      .from('product_units')
      .select(
        'id, unit_id, conversion_factor_to_base, is_base_unit, is_purchase_default, is_sale_default, units(code, name)',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('conversion_factor_to_base', { ascending: true })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return []
      throw new DatabaseError('Failed to fetch product units', error)
    }

    return ((data ?? []) as unknown as Row[]).map((row) => ({
      id: row.id,
      unitId: row.unit_id,
      unitCode: row.units?.code ?? '',
      unitName: row.units?.name ?? null,
      // numeric(18,6) arrives as a string from PostgREST.
      conversionFactorToBase: Number(row.conversion_factor_to_base),
      isBaseUnit: row.is_base_unit,
      isPurchaseDefault: row.is_purchase_default,
      isSaleDefault: row.is_sale_default,
    }))
  }

  /**
   * Replace a product's unit set.
   *
   * ⚠️ An EMPTY array is a legitimate request — it means «this product is
   * single-unit again» — and is handled by deleting the rows. It is not
   * rejected, because the alternative is a product that can never go back to
   * being simple once someone has experimented.
   */
  async replace(
    ctx: TenancyContext,
    productId: string,
    units: ProductUnitInput[],
  ): Promise<ProductUnitRecord[]> {
    await this.assertProductInWorkspace(ctx, productId)

    if (units.length > 0) {
      // The unit ids must be real, and their CODES are what the domain
      // validates duplicates on — two rows pointing at the same unit are
      // caught by the database, but a clear refusal is better than a 23505.
      const codes = await this.codesFor(units.map((unit) => unit.unitId))

      const options: ProductUnitOption[] = units.map((unit) => ({
        unitId: unit.unitId,
        unitCode: codes.get(unit.unitId) ?? '',
        conversionFactorToBase: unit.conversionFactorToBase,
        isBaseUnit: unit.isBaseUnit,
        isPurchaseDefault: unit.isPurchaseDefault,
        isSaleDefault: unit.isSaleDefault,
      }))

      if (options.some((option) => option.unitCode === '')) {
        throw new ValidationError('UNIT_SET_UNKNOWN_UNIT')
      }

      // ⚠️ Validated BEFORE the write, and validated as a SET. The database's
      // partial unique indexes would also refuse a second base, but as a
      // 23505 mid-transaction rather than a named reason anyone can act on.
      const problems = validateUnitSet(options)
      if (problems.length > 0) throw new ValidationError(problems.join(', '))

      const purchaseDefaults = units.filter((unit) => unit.isPurchaseDefault).length
      const saleDefaults = units.filter((unit) => unit.isSaleDefault).length
      if (purchaseDefaults > 1) throw new ValidationError('UNIT_SET_MULTIPLE_PURCHASE_DEFAULTS')
      if (saleDefaults > 1) throw new ValidationError('UNIT_SET_MULTIPLE_SALE_DEFAULTS')
    }

    const { error } = await supabase.rpc('product_units_replace', {
      p_workspace_id: ctx.workspaceId,
      p_product_id: productId,
      p_units: units.map((unit) => ({
        unit_id: unit.unitId,
        conversion_factor_to_base: unit.conversionFactorToBase,
        is_base_unit: unit.isBaseUnit,
        is_purchase_default: unit.isPurchaseDefault,
        is_sale_default: unit.isSaleDefault,
      })),
    })

    if (error) {
      const code = /^[A-Z][A-Z_]{6,}/.exec(error.message ?? '')?.[0]
      if (code) throw new ValidationError(code)
      throw new DatabaseError('Failed to save product units', error)
    }

    return this.list(ctx, productId)
  }

  /**
   * The product must be in the caller's workspace.
   *
   * ⚠️ Not optional. `product_units.product_id` has no workspace check of its
   * own in the RPC beyond the one passed in, so without this a client could
   * define units on another shop's product — which would then change how that
   * shop's quantities are read.
   */
  private async assertProductInWorkspace(ctx: TenancyContext, productId: string): Promise<void> {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to verify the product', error)
    if (!data) throw new NotFoundError('Product')
  }

  private async codesFor(unitIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(unitIds)]
    if (unique.length === 0) return new Map()

    const { data, error } = await supabase.from('units').select('id, code').in('id', unique)
    if (error) throw new DatabaseError('Failed to fetch units', error)

    return new Map((data ?? []).map((row: { id: string; code: string }) => [row.id, row.code]))
  }
}
