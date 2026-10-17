// ============================================
// packages/validation/src/schemas/storage-location.schema.ts
//
// A place inside a warehouse — «منطقه A › قفسه ۳ › طبقه ۲» — and what a person
// recorded as sitting in it.
//
// The names and the bounds live here because BOTH sides need them: the server
// refuses a write outside them, and the form marks the field before sending.
// ⚠️ A form is not a server check. The route parses with these schemas too.
// ============================================

import { z } from 'zod'
import { nonNegativeNumberSchema, uuidSchema } from './common.schema'

/**
 * The five levels, from a whole area of the building down to one place on a
 * shelf. `docs/warehouse-map-01-migration.sql` holds the same five in a CHECK
 * constraint; the migration and this list are changed together.
 */
export const STORAGE_LOCATION_KINDS = ['zone', 'aisle', 'rack', 'shelf', 'bin'] as const
export type StorageLocationKind = (typeof STORAGE_LOCATION_KINDS)[number]

export const storageLocationKindSchema = z.enum(STORAGE_LOCATION_KINDS)

/**
 * The code a person writes on the label — `A-03`, `R02-S04`. Free text on
 * purpose: every business labels its own shelves, and a format invented here
 * would have to be re-learned by the person standing in front of them.
 * `UNIQUE (warehouse_id, code)` is what makes it usable, not a pattern.
 */
export const storageLocationCodeSchema = z.string().trim().min(1).max(40)

/** What the label says beside the code. Optional. */
export const storageLocationNameSchema = z.string().trim().max(80)

/**
 * A rectangle on a grid — whole cells, 0–500. NOT metres and not a drawing:
 * two people typing the same numbers must get the same picture.
 */
export const gridCellSchema = z.number().int().min(0).max(500)
export const gridSizeSchema = z.number().int().min(1).max(500)

export const createStorageLocationSchema = z
  .object({
    parentId: uuidSchema.nullable().optional(),
    code: storageLocationCodeSchema,
    name: storageLocationNameSchema.optional(),
    kind: storageLocationKindSchema.default('bin'),
    x: gridCellSchema.default(0),
    y: gridCellSchema.default(0),
    width: gridSizeSchema.default(1),
    height: gridSizeSchema.default(1),
    /**
     * How much fits here. `null` = not recorded, which is not 0 and not
     * «unlimited» — the screen says utilisation cannot be calculated.
     */
    capacity: z.number().positive().nullable().optional(),
  })
  .strict()

export type CreateStorageLocation = z.infer<typeof createStorageLocationSchema>

export const updateStorageLocationSchema = z
  .object({
    code: storageLocationCodeSchema.optional(),
    name: storageLocationNameSchema.optional(),
    kind: storageLocationKindSchema.optional(),
    x: gridCellSchema.optional(),
    y: gridCellSchema.optional(),
    width: gridSizeSchema.optional(),
    height: gridSizeSchema.optional(),
    capacity: z.number().positive().nullable().optional(),
    /** Retirement, not deletion. A retired location keeps its history. */
    isActive: z.boolean().optional(),
  })
  .strict()

export type UpdateStorageLocation = z.infer<typeof updateStorageLocationSchema>

/**
 * What is recorded as sitting in a location.
 *
 * ⚠️ Zero is allowed and means «no longer recorded here» — the row stays. The
 * server caps the rest: a placement may never claim more units than its
 * warehouse holds (see `storage_place_stock`).
 */
export const placeStorageLocationSchema = z
  .object({
    productId: uuidSchema,
    quantity: nonNegativeNumberSchema,
  })
  .strict()

export type PlaceStorageLocation = z.infer<typeof placeStorageLocationSchema>
