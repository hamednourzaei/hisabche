// ============================================
// packages/validation/src/schemas/operational-dna.ts
//
// V54.0 Phase 5.2 — Universal Operational DNA & 8-Axis Schema
//
// Models business operations across 8 composable orthogonal axes
// without hardcoding industry-specific conditionals in domain cores.
// ============================================

import { z } from 'zod'
import {
  type CapabilityKey,
  resolveCapabilities as resolveCoreCapabilities,
  type CapabilityResolution,
} from './business-capabilities'

// ─── AXIS 1: Offering Model ──────────────────────────────────────────
export const offeringModelEnum = z.enum([
  'PHYSICAL_GOODS',
  'TIME_SERVICE',
  'PACKAGE_SESSION',
  'DELIVERABLE_SERVICE',
  'MIXED_OFFERING',
])
export type OfferingModel = z.infer<typeof offeringModelEnum>

// ─── AXIS 2: Intake & Delivery ───────────────────────────────────────
export const intakeDeliveryEnum = z.enum([
  'COUNTER_POS',
  'APPOINTMENT_BOOKING',
  'CLASS_ATTENDANCE',
  'JOB_TICKET',
  'PROJECT_DELIVERY',
  'WALK_IN',
  'MIXED_INTAKE',
])
export type IntakeDelivery = z.infer<typeof intakeDeliveryEnum>

// ─── AXIS 3: Inventory Behavior ──────────────────────────────────────
export const inventoryBehaviorEnum = z.enum([
  'NONE',
  'RETAIL_STOCK',
  'SERVICE_CONSUMABLES',
  'SPARE_PARTS',
  'RAW_MATERIALS',
  'FINISHED_GOODS',
  'HYBRID_INVENTORY',
])
export type InventoryBehavior = z.infer<typeof inventoryBehaviorEnum>

// ─── AXIS 4: Billing & Settlement ────────────────────────────────────
export const billingSettlementEnum = z.enum([
  'IMMEDIATE_SETTLEMENT',
  'DEPOSIT_PREPAYMENT',
  'PACKAGE_CREDITS',
  'INSTALLMENT_RECEIVABLES',
  'CUSTOMER_CREDIT',
  'SUBSCRIPTION_BILLING',
  'MIXED_SETTLEMENT',
])
export type BillingSettlement = z.infer<typeof billingSettlementEnum>

// ─── AXIS 5: Workforce Model ─────────────────────────────────────────
export const workforceModelEnum = z.enum([
  'SOLO_OWNER',
  'COMMISSION_PROVIDERS',
  'HOURLY_STAFF',
  'SALARIED_STAFF',
  'SHIFT_BASED_STAFF',
  'MIXED_WORKFORCE',
])
export type WorkforceModel = z.infer<typeof workforceModelEnum>

// ─── AXIS 6: Customer / Party Profile ────────────────────────────────
export const customerProfileEnum = z.enum([
  'STANDARD_PARTY',
  'CLIENT_CARE_PROFILE',
  'STUDENT_PROFILE',
  'BUSINESS_ACCOUNT',
  'SERVICE_ASSET_PROFILE',
  'MIXED_PROFILE',
])
export type CustomerProfile = z.infer<typeof customerProfileEnum>

// ─── AXIS 7: Operational Topology ────────────────────────────────────
export const operationalTopologyEnum = z.enum([
  'SINGLE_LOCATION',
  'MULTI_BRANCH',
  'MOBILE_SERVICE',
  'RESOURCE_CAPACITY',
  'SEAT_OR_ROOM_BASED',
  'WAREHOUSE_NETWORK',
])
export type OperationalTopology = z.infer<typeof operationalTopologyEnum>

// ─── AXIS 8: Terminology & Presentation Profile ──────────────────────
export const terminologyProfileSchema = z.object({
  partyLabelKey: z.string().default('common.customer'),
  itemLabelKey: z.string().default('common.product'),
  transactionLabelKey: z.string().default('common.sale'),
  inventoryLabelKey: z.string().default('common.stock'),
})
export type TerminologyProfile = z.infer<typeof terminologyProfileSchema>

// ─── Canonical Operational DNA ────────────────────────────────────────
export const operationalDnaSchema = z.object({
  version: z.number().int().positive().default(1),
  offering: z.array(offeringModelEnum).min(1),
  intake: z.array(intakeDeliveryEnum).min(1),
  inventory: z.array(inventoryBehaviorEnum).min(1),
  settlement: z.array(billingSettlementEnum).min(1),
  workforce: z.array(workforceModelEnum).min(1),
  customer: z.array(customerProfileEnum).min(1),
  topology: z.array(operationalTopologyEnum).min(1),
  terminology: terminologyProfileSchema.optional(),
  archetypeHint: z.string().optional(),
})

export type OperationalDna = z.infer<typeof operationalDnaSchema>

// ─── Canonical Archetype Presets ──────────────────────────────────────
export const ARCHETYPE_PRESETS: Record<string, OperationalDna> = {
  RETAIL_STORE: {
    version: 1,
    offering: ['PHYSICAL_GOODS'],
    intake: ['COUNTER_POS', 'WALK_IN'],
    inventory: ['RETAIL_STOCK'],
    settlement: ['IMMEDIATE_SETTLEMENT', 'CUSTOMER_CREDIT'],
    workforce: ['SOLO_OWNER'],
    customer: ['STANDARD_PARTY'],
    topology: ['SINGLE_LOCATION'],
    archetypeHint: 'RETAIL_STORE',
    terminology: {
      partyLabelKey: 'common.customer',
      itemLabelKey: 'common.product',
      transactionLabelKey: 'common.sale',
      inventoryLabelKey: 'common.stock',
    },
  },
  NAIL_TECH_BEAUTY: {
    version: 1,
    offering: ['TIME_SERVICE', 'PHYSICAL_GOODS'],
    intake: ['APPOINTMENT_BOOKING', 'WALK_IN'],
    inventory: ['SERVICE_CONSUMABLES', 'RETAIL_STOCK'],
    settlement: ['DEPOSIT_PREPAYMENT', 'IMMEDIATE_SETTLEMENT'],
    workforce: ['SOLO_OWNER'],
    customer: ['CLIENT_CARE_PROFILE'],
    topology: ['RESOURCE_CAPACITY'],
    archetypeHint: 'NAIL_TECH_BEAUTY',
    terminology: {
      partyLabelKey: 'common.client',
      itemLabelKey: 'common.service',
      transactionLabelKey: 'common.appointment',
      inventoryLabelKey: 'common.consumables',
    },
  },
  LANGUAGE_TEACHER: {
    version: 1,
    offering: ['PACKAGE_SESSION'],
    intake: ['CLASS_ATTENDANCE'],
    inventory: ['NONE'],
    settlement: ['PACKAGE_CREDITS', 'DEPOSIT_PREPAYMENT'],
    workforce: ['SOLO_OWNER'],
    customer: ['STUDENT_PROFILE'],
    topology: ['SEAT_OR_ROOM_BASED'],
    archetypeHint: 'LANGUAGE_TEACHER',
    terminology: {
      partyLabelKey: 'common.student',
      itemLabelKey: 'common.session',
      transactionLabelKey: 'common.class',
      inventoryLabelKey: 'common.resources',
    },
  },
  SERVICE_REPAIR: {
    version: 1,
    offering: ['DELIVERABLE_SERVICE', 'PHYSICAL_GOODS'],
    intake: ['JOB_TICKET'],
    inventory: ['SPARE_PARTS'],
    settlement: ['DEPOSIT_PREPAYMENT', 'IMMEDIATE_SETTLEMENT'],
    workforce: ['HOURLY_STAFF'],
    customer: ['SERVICE_ASSET_PROFILE'],
    topology: ['SINGLE_LOCATION'],
    archetypeHint: 'SERVICE_REPAIR',
    terminology: {
      partyLabelKey: 'common.customer',
      itemLabelKey: 'common.repair_job',
      transactionLabelKey: 'common.repair_order',
      inventoryLabelKey: 'common.spare_parts',
    },
  },
}

// ─── DNA-to-Capability Resolver ───────────────────────────────────────
export interface ResolvedBusinessConfiguration {
  dna: OperationalDna
  capabilities: CapabilityResolution
  activeModules: readonly string[]
  terminology: TerminologyProfile
}

/**
 * Deterministically maps an 8-axis Operational DNA into enabled capabilities and active UI modules.
 */
export function resolveDnaCapabilities(dna: OperationalDna): ResolvedBusinessConfiguration {
  const requestedCapabilities: CapabilityKey[] = []
  const activeModules = new Set<string>()

  // Core base modules always active
  activeModules.add('accounting')
  activeModules.add('invoices')
  activeModules.add('customers')

  // Axis 1: Offering
  if (dna.offering.includes('PHYSICAL_GOODS') || dna.offering.includes('MIXED_OFFERING')) {
    activeModules.add('products')
    requestedCapabilities.push('measurement', 'multi_unit')
  }
  if (dna.offering.includes('TIME_SERVICE') || dna.offering.includes('PACKAGE_SESSION')) {
    activeModules.add('services')
  }

  // Axis 2: Intake
  if (dna.intake.includes('COUNTER_POS')) {
    activeModules.add('pos')
  }
  if (dna.intake.includes('APPOINTMENT_BOOKING')) {
    activeModules.add('appointments')
  }
  if (dna.intake.includes('CLASS_ATTENDANCE')) {
    activeModules.add('attendance')
  }
  if (dna.intake.includes('JOB_TICKET')) {
    activeModules.add('job_tickets')
    requestedCapabilities.push('auto_fitments', 'serialized_items')
  }

  // Axis 3: Inventory
  if (
    dna.inventory.includes('RETAIL_STOCK') ||
    dna.inventory.includes('SPARE_PARTS') ||
    dna.inventory.includes('RAW_MATERIALS') ||
    dna.inventory.includes('FINISHED_GOODS') ||
    dna.inventory.includes('HYBRID_INVENTORY')
  ) {
    activeModules.add('inventory')
    activeModules.add('warehouse')
    requestedCapabilities.push('variants')
  }
  if (dna.inventory.includes('RAW_MATERIALS')) {
    requestedCapabilities.push('recipe_bom', 'batch_expiry')
  }
  if (dna.inventory.includes('SERVICE_CONSUMABLES')) {
    activeModules.add('consumables')
  }

  // Axis 4: Settlement
  if (dna.settlement.includes('DEPOSIT_PREPAYMENT')) {
    activeModules.add('order_deposits')
  }
  if (dna.settlement.includes('PACKAGE_CREDITS')) {
    activeModules.add('package_credits')
  }

  // Axis 5: Workforce
  if (!dna.workforce.includes('SOLO_OWNER')) {
    activeModules.add('team')
    activeModules.add('payroll')
  }

  // Axis 7: Topology
  if (dna.topology.includes('MULTI_BRANCH') || dna.topology.includes('WAREHOUSE_NETWORK')) {
    activeModules.add('branches')
  }

  const capabilities = resolveCoreCapabilities(requestedCapabilities)

  const defaultTerminology: TerminologyProfile = {
    partyLabelKey: 'common.customer',
    itemLabelKey: 'common.product',
    transactionLabelKey: 'common.sale',
    inventoryLabelKey: 'common.stock',
  }

  return {
    dna,
    capabilities,
    activeModules: Array.from(activeModules),
    terminology: dna.terminology ?? defaultTerminology,
  }
}

// ─── Operating Characteristics to DNA Resolver ───────────────────────
export interface OperationalInferenceInput {
  readonly tradeKey?: string | undefined
  readonly holdsStock?: 'yes' | 'no' | 'unknown' | undefined
  readonly producesGoods?: 'yes' | 'no' | 'unknown' | undefined
  readonly sellsOnCredit?: 'yes' | 'no' | 'unknown' | undefined
  readonly hasPointOfSale?: 'yes' | 'no' | 'unknown' | undefined
  readonly hasStaff?: 'yes' | 'no' | 'unknown' | undefined
  readonly locations?: 'single' | 'multiple' | 'unknown' | undefined
  readonly takesAppointments?: 'yes' | 'no' | 'unknown' | undefined
  readonly deliversCoursesOrPackages?: 'yes' | 'no' | 'unknown' | undefined
  readonly takesJobTicketsOrRepairs?: 'yes' | 'no' | 'unknown' | undefined
}

/**
 * Derives an 8-axis Operational DNA from actual operational characteristics
 * rather than guessing or defaulting blindly to RETAIL_STORE.
 *
 * If characteristics are unknown or purely generic, it produces a safe GENERIC profile
 * without forcing inventory or appointments.
 */
export function inferOperationalDna(input: OperationalInferenceInput): OperationalDna {
  const isAppointmentDriven =
    input.takesAppointments === 'yes' || input.tradeKey === 'barber' || input.tradeKey === 'clinic'
  const isPackageDriven =
    input.deliversCoursesOrPackages === 'yes' || input.tradeKey === 'education'
  const isRepairDriven =
    input.takesJobTicketsOrRepairs === 'yes' ||
    input.tradeKey === 'repairs' ||
    input.tradeKey === 'mechanic'
  const isProducer =
    input.producesGoods === 'yes' ||
    input.tradeKey === 'manufacturing' ||
    input.tradeKey === 'bakery'
  const isRetailTrade =
    input.tradeKey === 'retail' || input.tradeKey === 'grocery' || input.hasPointOfSale === 'yes'

  // 1. Offering
  const offering: OfferingModel[] = []
  if (isPackageDriven) {
    offering.push('PACKAGE_SESSION')
  } else if (isAppointmentDriven) {
    offering.push('TIME_SERVICE')
    if (input.holdsStock === 'yes') offering.push('PHYSICAL_GOODS')
  } else if (isRepairDriven) {
    offering.push('DELIVERABLE_SERVICE')
    if (input.holdsStock !== 'no') offering.push('PHYSICAL_GOODS')
  } else if (input.holdsStock === 'no') {
    offering.push('DELIVERABLE_SERVICE')
  } else {
    offering.push('PHYSICAL_GOODS')
  }

  // 2. Intake
  const intake: IntakeDelivery[] = []
  if (isAppointmentDriven) intake.push('APPOINTMENT_BOOKING')
  if (isPackageDriven) intake.push('CLASS_ATTENDANCE')
  if (isRepairDriven) intake.push('JOB_TICKET')
  if (input.hasPointOfSale === 'yes' || isRetailTrade) intake.push('COUNTER_POS')
  if (intake.length === 0) intake.push('WALK_IN')

  // 3. Inventory
  const inventory: InventoryBehavior[] = []
  if (isProducer) {
    inventory.push('RAW_MATERIALS', 'FINISHED_GOODS')
  } else if (isRepairDriven) {
    inventory.push('SPARE_PARTS')
  } else if (isAppointmentDriven) {
    inventory.push('SERVICE_CONSUMABLES')
    if (input.holdsStock === 'yes') inventory.push('RETAIL_STOCK')
  } else if (input.holdsStock === 'no') {
    inventory.push('NONE')
  } else {
    inventory.push('RETAIL_STOCK')
  }

  // 4. Settlement
  const settlement: BillingSettlement[] = []
  if (isPackageDriven) {
    settlement.push('PACKAGE_CREDITS', 'DEPOSIT_PREPAYMENT')
  } else if (isAppointmentDriven || isRepairDriven) {
    settlement.push('DEPOSIT_PREPAYMENT', 'IMMEDIATE_SETTLEMENT')
  } else {
    settlement.push('IMMEDIATE_SETTLEMENT')
  }
  if (input.sellsOnCredit === 'yes') {
    settlement.push('CUSTOMER_CREDIT')
  }

  // 5. Workforce
  const workforce: WorkforceModel[] = []
  if (input.hasStaff === 'yes') {
    workforce.push('HOURLY_STAFF')
  } else {
    workforce.push('SOLO_OWNER')
  }

  // 6. Customer
  const customer: CustomerProfile[] = []
  if (isAppointmentDriven) customer.push('CLIENT_CARE_PROFILE')
  else if (isPackageDriven) customer.push('STUDENT_PROFILE')
  else if (isRepairDriven) customer.push('SERVICE_ASSET_PROFILE')
  else customer.push('STANDARD_PARTY')

  // 7. Topology
  const topology: OperationalTopology[] = []
  if (input.locations === 'multiple') {
    topology.push('MULTI_BRANCH')
  } else if (isAppointmentDriven) {
    topology.push('RESOURCE_CAPACITY')
  } else if (isPackageDriven) {
    topology.push('SEAT_OR_ROOM_BASED')
  } else {
    topology.push('SINGLE_LOCATION')
  }

  // 8. Terminology
  const terminology: TerminologyProfile = {
    partyLabelKey: isAppointmentDriven
      ? 'common.client'
      : isPackageDriven
        ? 'common.student'
        : 'common.customer',
    itemLabelKey: isAppointmentDriven
      ? 'common.service'
      : isPackageDriven
        ? 'common.session'
        : isRepairDriven
          ? 'common.repair_job'
          : 'common.product',
    transactionLabelKey: isAppointmentDriven
      ? 'common.appointment'
      : isPackageDriven
        ? 'common.class'
        : isRepairDriven
          ? 'common.repair_order'
          : 'common.sale',
    inventoryLabelKey: isAppointmentDriven
      ? 'common.consumables'
      : isRepairDriven
        ? 'common.spare_parts'
        : 'common.stock',
  }

  return {
    version: 1,
    offering,
    intake,
    inventory,
    settlement,
    workforce,
    customer,
    topology,
    terminology,
    archetypeHint: isAppointmentDriven
      ? 'NAIL_TECH_BEAUTY'
      : isPackageDriven
        ? 'LANGUAGE_TEACHER'
        : isRepairDriven
          ? 'SERVICE_REPAIR'
          : isRetailTrade
            ? 'RETAIL_STORE'
            : 'GENERIC_BUSINESS',
  }
}
