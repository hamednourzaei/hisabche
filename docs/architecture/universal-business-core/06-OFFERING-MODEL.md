# 06 — OFFERING & CATALOG MODEL SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/06-OFFERING-MODEL.md`

---

## 1. Unified Offering Archetype

In the Universal Business Core, the legacy concept of a purely physical `Product` is generalized into a polymorphic **Offering**. An offering represents any commercial deliverable a business sells or purchases.

```typescript
export type OfferingType = 'goods' | 'service' | 'package' | 'subscription'

export interface UniversalOffering {
  readonly id: string
  readonly workspaceId: string
  readonly type: OfferingType
  readonly code: string // Barcode, SKU, or Service Code
  readonly title: string
  readonly description?: string | undefined
  readonly categoryId?: string | undefined
  readonly pricing: OfferingPricing
  readonly taxProfileId?: string | undefined

  // Tangible Goods Specification (Present only when type === 'goods')
  readonly physicalSpecs?: PhysicalGoodsSpecs | undefined

  // Billable Service Specification (Present only when type === 'service')
  readonly serviceSpecs?: ServiceDeliverableSpecs | undefined

  // Prepaid Package Specification (Present only when type === 'package')
  readonly packageSpecs?: PrepaidPackageSpecs | undefined

  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface OfferingPricing {
  readonly currency: string
  readonly defaultPriceMinor: number // Integer minor units
  readonly minPriceMinor?: number | undefined
  readonly wholesalePriceMinor?: number | undefined
  readonly pricingUnit: string // 'piece', 'hour', 'session', 'month'
}

export interface PhysicalGoodsSpecs {
  readonly trackInventory: boolean
  readonly minStockLevel: number
  readonly weightGrams?: number | undefined
  readonly barcode?: string | undefined
  readonly autoFitments?: readonly string[] | undefined
  readonly metalKarat?: number | undefined
}

export interface ServiceDeliverableSpecs {
  readonly durationMinutes?: number | undefined
  readonly requiresPractitioner: boolean
  readonly defaultPractitionerId?: string | undefined
  readonly deliveryLocationType: 'onsite' | 'client_location' | 'remote'
}

export interface PrepaidPackageSpecs {
  readonly totalCredits: number // e.g. 10 sessions or 20 hours
  readonly creditUnit: 'session' | 'hour' | 'point'
  readonly validForDays: number // Expiration period (e.g. 90 days)
  readonly targetOfferingId?: string | undefined // Specific service this redeems for
}
```

---

## 2. Inventory vs. Non-Inventory Lifecycle

| Attribute / Action            | Physical Goods (`type: 'goods'`)                    | Service (`type: 'service'`)                                    | Package (`type: 'package'`)                          |
| :---------------------------- | :-------------------------------------------------- | :------------------------------------------------------------- | :--------------------------------------------------- |
| **Stock Deduction**           | Yes (depletes warehouse units via FIFO/AVCO layers) | None (zero warehouse movements)                                | None (creates Package Credit record upon purchase)   |
| **Cost of Goods Sold (COGS)** | Layer buy price restored/debited on sale            | Zero inventory cost; linked to payroll/practitioner commission | Zero at purchase; recognized upon session redemption |
| **Delivery Mechanism**        | Warehouse packing, shipping, physical handover      | Service Delivery Session recorded                              | Package Credit Ledger initialized                    |
| **Return / Reversal**         | Restock to warehouse or scrap                       | Service cancellation credit                                    | Revocation of unredeemed credits                     |
