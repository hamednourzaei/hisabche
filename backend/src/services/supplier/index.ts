// ============================================
// backend/src/services/supplier/index.ts
//
// The Supplier core's public surface.
//
// It owns supplier master data and assembles the 360 view. It does NOT own
// what is owed to a supplier — that belongs to the payments core and is asked
// for, never recomputed here.
// ============================================

export { SupplierService } from './supplier.service'
export type { Supplier } from './supplier.service'

import { SupplierService } from './supplier.service'

export const suppliers = new SupplierService()
