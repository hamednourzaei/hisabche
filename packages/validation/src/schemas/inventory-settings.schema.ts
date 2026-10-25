// ============================================
// packages/validation/src/schemas/inventory-settings.schema.ts
//
// What `PUT /inventory/settings` accepts. One schema for the server route and
// the device, so the two cannot disagree about what a valid method is.
// ============================================

import { z } from 'zod'

export const inventorySettingsInputSchema = z.object({
  costingMethod: z.enum(['fifo', 'avco', 'standard']).optional(),
  negativeStock: z.enum(['block', 'allow']).optional(),
})

export type InventorySettingsInput = z.infer<typeof inventorySettingsInputSchema>
