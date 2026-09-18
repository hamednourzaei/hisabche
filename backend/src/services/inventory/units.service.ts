// ============================================
// backend/src/services/inventory/units.service.ts
//
// T2 — the units table finally has a reader.
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS CLOSES
//
// `phase-l-01` created and seeded `units` — gram, kilogram, TONNE, millilitre,
// dozen — and the owner ran it. Nothing read it. The UI kept its own lists:
//
//   packages/validation  unitSchema        9 codes  (no tonne, no mg, no dozen)
//   add-product-modal    UnitType          5 codes
//   warehouse-detail     validUnits        5 codes  + coerced the rest
//
// So a metals trader could not record a tonne — the exact thing L0.2 was
// asked for — and a gram product opened in warehouse-detail came back as
// «عدد», because `toUnitType` mapped every unrecognised code to 'piece'.
//
// This is the T1 pattern one layer down: rows were added to the database and
// changed nothing, because the filter was in the code.
//
// ---------------------------------------------------------------------------
// ⚠️ THE TABLE IS GLOBAL REFERENCE DATA — NO `workspace_id`, AND THAT IS FINE
//
// A gram is a gram in every workspace. There is nothing tenant-specific to
// isolate here, so this service reads the table WITHOUT a workspace filter —
// which is safe only because the table holds no tenant data at all. The
// per-workspace, per-product part («1 carton = 24 pieces») lives in
// `product_units`, which IS workspace-scoped and is not touched here.
//
// ---------------------------------------------------------------------------
// ⚠️ THE FALLBACK IS THE SEED, NOT A GUESS
//
// If the migration has not been applied on a given environment the table is
// missing (42P01 / PGRST205). Rather than fail the product picker, this
// degrades to `SEEDED_UNITS` — which is a transcription of the migration's own
// INSERT, not an invention. Deployments where the migration HAS run are served
// from the table and pick up any row added since.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'

export interface UnitRecord {
  /**
   * ⚠️ Needed by `product_units.unit_id`, which is a FOREIGN KEY to
   * `units(id)`. It was absent at first and the product-units form had no way
   * to name a unit the write endpoint would accept — every save would have
   * been a 400 on a uuid that was actually a code.
   *
   * Null only in the seeded fallback, where no row exists to have an id.
   */
  id: string | null
  code: string
  name: string
  nameFa: string | null
  symbol: string | null
  dimension: 'weight' | 'length' | 'volume' | 'count'
  /** Base units of this dimension per one of these. See the migration. */
  conversionFactor: number
  isBase: boolean
}

/**
 * ⚠️ MUST STAY IDENTICAL TO THE `INSERT INTO units` IN
 * `docs/phase-l-01-units-migration.sql`. A guard test compares them.
 *
 * `custom` is deliberately absent here for the same reason it is absent from
 * the seed: it means «the user typed their own word», it has no dimension and
 * no conversion factor, and giving it one would let L1 convert by it.
 */
export const SEEDED_UNITS: readonly UnitRecord[] = [
  {
    // No id: the seed is a fallback for a database where the table
    // does not exist, so there is no row to have one. `product_units`
    // cannot be written in that state anyway.
    id: null,
    code: 'gram',
    name: 'Gram',
    nameFa: 'گرم',
    symbol: 'g',
    dimension: 'weight',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'kg',
    name: 'Kilogram',
    nameFa: 'کیلوگرم',
    symbol: 'kg',
    dimension: 'weight',
    conversionFactor: 1000,
    isBase: false,
  },
  {
    id: null,
    code: 'ton',
    name: 'Tonne',
    nameFa: 'تن',
    symbol: 't',
    dimension: 'weight',
    conversionFactor: 1000000,
    isBase: false,
  },
  {
    id: null,
    code: 'mg',
    name: 'Milligram',
    nameFa: 'میلی‌گرم',
    symbol: 'mg',
    dimension: 'weight',
    conversionFactor: 0.001,
    isBase: false,
  },

  {
    id: null,
    code: 'meter',
    name: 'Metre',
    nameFa: 'متر',
    symbol: 'm',
    dimension: 'length',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'cm',
    name: 'Centimetre',
    nameFa: 'سانتی‌متر',
    symbol: 'cm',
    dimension: 'length',
    conversionFactor: 0.01,
    isBase: false,
  },
  {
    id: null,
    code: 'km',
    name: 'Kilometre',
    nameFa: 'کیلومتر',
    symbol: 'km',
    dimension: 'length',
    conversionFactor: 1000,
    isBase: false,
  },

  {
    id: null,
    code: 'liter',
    name: 'Litre',
    nameFa: 'لیتر',
    symbol: 'L',
    dimension: 'volume',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'ml',
    name: 'Millilitre',
    nameFa: 'میلی‌لیتر',
    symbol: 'mL',
    dimension: 'volume',
    conversionFactor: 0.001,
    isBase: false,
  },

  {
    id: null,
    code: 'piece',
    name: 'Piece',
    nameFa: 'عدد',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'box',
    name: 'Box',
    nameFa: 'جعبه',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: false,
  },
  {
    id: null,
    code: 'pack',
    name: 'Pack',
    nameFa: 'بسته',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: false,
  },
  {
    id: null,
    code: 'carton',
    name: 'Carton',
    nameFa: 'کارتن',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: false,
  },
  {
    id: null,
    code: 'dozen',
    name: 'Dozen',
    nameFa: 'دوجین',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: false,
  },
]

/** The table is absent, or the column set is older than this code expects. */
const SCHEMA_ABSENT = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])

interface UnitRow {
  id: string
  code: string
  name: string
  name_fa: string | null
  symbol: string | null
  dimension: string
  conversion_factor: number | string
  is_base: boolean
}

function mapUnitRow(row: UnitRow): UnitRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameFa: row.name_fa ?? null,
    symbol: row.symbol ?? null,
    // The column is a free text with a CHECK; anything outside the four known
    // dimensions is treated as 'count' rather than cast blindly.
    dimension: (['weight', 'length', 'volume', 'count'] as const).includes(
      row.dimension as UnitRecord['dimension'],
    )
      ? (row.dimension as UnitRecord['dimension'])
      : 'count',
    conversionFactor: Number(row.conversion_factor) || 1,
    isBase: row.is_base === true,
  }
}

export class UnitsService {
  /**
   * The seeded units plus THIS workspace's own (request #94).
   *
   * `workspaceId` omitted → global only. A workspace's unit is never served to
   * another: the `units` table is shared, so the filter is the whole boundary.
   * Before docs/custom-units-migration.sql the column is absent; the read then
   * falls back to the unfiltered list rather than failing the picker.
   */
  async list(
    workspaceId?: string,
  ): Promise<{ units: readonly UnitRecord[]; source: 'table' | 'seed' }> {
    if (workspaceId) {
      const scoped = await supabase
        .from('units')
        .select('id, code, name, name_fa, symbol, dimension, conversion_factor, is_base')
        .eq('is_active', true)
        .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
        .order('dimension', { ascending: true })
        .order('conversion_factor', { ascending: true })
      if (!scoped.error && scoped.data && scoped.data.length > 0) {
        return { units: (scoped.data as UnitRow[]).map(mapUnitRow), source: 'table' }
      }
      // 42703 / PGRST204: the migration has not run here. Fall through.
      if (scoped.error && !SCHEMA_ABSENT.has(scoped.error.code) && scoped.error.code !== '42703') {
        throw scoped.error
      }
    }

    const { data, error } = await supabase
      .from('units')
      .select('id, code, name, name_fa, symbol, dimension, conversion_factor, is_base')
      .eq('is_active', true)
      // Dimension then factor: within a dimension the list reads smallest to
      // largest (mg · gram · kg · tonne), which is how a person scans it.
      .order('dimension', { ascending: true })
      .order('conversion_factor', { ascending: true })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) {
        return { units: SEEDED_UNITS, source: 'seed' }
      }
      throw error
    }

    // An empty table means the migration ran but the seed did not — serving an
    // empty picker would make every product unrecordable.
    if (!data || data.length === 0) {
      return { units: SEEDED_UNITS, source: 'seed' }
    }

    return {
      units: (data as UnitRow[]).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        nameFa: row.name_fa,
        symbol: row.symbol,
        dimension: row.dimension as UnitRecord['dimension'],
        // numeric(18,6) arrives as a string from PostgREST. Number() on it is
        // exact for every seeded factor; the arithmetic that matters is done
        // in the database, not here.
        conversionFactor: Number(row.conversion_factor),
        isBase: row.is_base,
      })),
      source: 'table',
    }
  }

  /**
   * A unit this workspace invented («طاقه»). Dimension 'count' with factor 1:
   * the app cannot convert a word nobody defined, and pretending it can would
   * make totals wrong rather than missing.
   */
  async create(
    workspaceId: string,
    input: { name: string; symbol?: string | undefined },
  ): Promise<UnitRecord> {
    const name = input.name.trim()
    if (!name) throw new ValidationError('UNIT_NAME_REQUIRED')

    // The code is the app's identifier; the name is what people read. Latin
    // letters only, so a Persian name still yields a usable code.
    const slug = name
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
    const code = `ws-${slug || Math.random().toString(36).slice(2, 8)}`

    const { data, error } = await supabase
      .from('units')
      .insert({
        code,
        name,
        name_fa: name,
        symbol: input.symbol?.trim() || null,
        dimension: 'count',
        conversion_factor: 1,
        is_base: false,
        is_active: true,
        workspace_id: workspaceId,
      })
      .select('id, code, name, name_fa, symbol, dimension, conversion_factor, is_base')
      .single()

    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204') {
        throw new ConflictError('UNIT_CUSTOM_MIGRATION_REQUIRED')
      }
      if (error.code === '23505') throw new ConflictError('UNIT_ALREADY_EXISTS')
      throw new DatabaseError('Failed to create the unit', error)
    }

    return mapUnitRow(data as UnitRow)
  }
}
