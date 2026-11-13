// ============================================
// packages/validation/src/schemas/operational-dna.ts
//
// V54.0 Phase 5.2 — Universal Operational DNA & 8-Axis Schema
//
// Models business operations across 8 composable orthogonal axes
// without hardcoding industry-specific conditionals in domain cores.
// ============================================

import { z } from 'zod'
import { resolveCapabilityPlan, type CapabilityResolution } from './business-capabilities'

// ─── AXIS 1: Offering Model ──────────────────────────────────────────
export const offeringModelEnum = z.enum([
  'PHYSICAL_GOODS',
  'TIME_SERVICE',
  'PACKAGE_SESSION',
  'DELIVERABLE_SERVICE',
  'MIXED_OFFERING',
  // V55: the axis could not be resolved from the answers. NOT a business model:
  // it activates nothing in `resolveDnaCapabilities` and must never be presented
  // as one. Backward-compatible — consumers match specific values by inclusion.
  'UNRESOLVED',
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
  // V55: stock behaviour is genuinely unknown (no answer, no trade evidence).
  // Activates no inventory module and never becomes a guessed retail shop.
  'UNRESOLVED',
])
export type InventoryBehavior = z.infer<typeof inventoryBehaviorEnum>

// ─── AXIS 9: Unit-level tracking (V55 P1) ─────────────────────────────
//
// «Is one unit distinguishable from the next?» — IMEI/serial numbers
// (phones, electronics, vehicles) and expiry dates (pharmacy, food).
// Optional: every DNA written before V55 has no axis, which reads as NONE —
// nothing activates for it and no historical profile is re-interpreted.
// Requests `serialized_items` / `batch_expiry` in `resolveDnaCapabilities`.
export const unitTrackingEnum = z.enum([
  'NONE',
  'SERIAL_NUMBERS',
  'EXPIRY_DATES',
  'BOTH',
  // V55: neither answer given and the trade suggests nothing — activates nothing.
  'UNRESOLVED',
])
export type UnitTracking = z.infer<typeof unitTrackingEnum>

// ─── AXES 10–15: V60 Deeper Orthogonal Axes (all optional, UNRESOLVED on missing) ──
export const pricingBasisEnum = z.enum([
  'UNIT',
  'WEIGHT',
  'LENGTH',
  'AREA',
  'VOLUME',
  'TIME',
  'RATE_BOARD',
  'CONTRACT',
  'TIERED',
  'UNRESOLVED',
])
export type PricingBasis = z.infer<typeof pricingBasisEnum>

export const assetCustodyEnum = z.enum([
  'OWN_STOCK',
  'CUSTOMER_ASSET_IN_CUSTODY',
  'RENTED_OUT_ASSET',
  'NONE',
  'UNRESOLVED',
])
export type AssetCustody = z.infer<typeof assetCustodyEnum>

export const executionSiteEnum = z.enum([
  'PREMISES',
  'CUSTOMER_SITE',
  'MOBILE_ROUTE',
  'REMOTE',
  'UNRESOLVED',
])
export type ExecutionSite = z.infer<typeof executionSiteEnum>

export const recurrenceEnum = z.enum([
  'ONE_OFF',
  'RECURRING_SERVICE',
  'SUBSCRIPTION',
  'LEASE',
  'UNRESOLVED',
])
export type Recurrence = z.infer<typeof recurrenceEnum>

export const approvalDepthEnum = z.enum(['NONE', 'SINGLE', 'MULTI_STEP', 'UNRESOLVED'])
export type ApprovalDepth = z.infer<typeof approvalDepthEnum>

// Regulated domain creates a compliance gap ONLY — never grants a clinical/KYC capability.
export const regulatedDomainEnum = z.enum([
  'NONE',
  'HEALTH_RECORDS',
  'PRESCRIPTION',
  'FINANCIAL_KYC',
  'FOOD_SAFETY',
  'UNRESOLVED',
])
export type RegulatedDomain = z.infer<typeof regulatedDomainEnum>

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
  'UNRESOLVED',
])
export type WorkforceModel = z.infer<typeof workforceModelEnum>

export const staffArrangementEnum = z.enum([
  'solo',
  'fixed_salary',
  'hourly',
  'commission',
  'shift',
  'mixed',
  'unknown',
])
export type StaffArrangement = z.infer<typeof staffArrangementEnum>

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
// Keys ONLY — never stored localized prose sentences.
export const terminologyProfileSchema = z.object({
  partyLabelKey: z.string().default('common.customer'),
  itemLabelKey: z.string().default('common.product'),
  transactionLabelKey: z.string().default('common.sale'),
  inventoryLabelKey: z.string().default('common.stock'),
  // W1 extended canonical terminology keys (optional so persisted v1 DNAs remain valid)
  documentLabelKey: z.string().optional(),
  storageLabelKey: z.string().optional(),
  operatorLabelKey: z.string().optional(),
  orderLabelKey: z.string().optional(),
  buyPriceLabelKey: z.string().optional(),
  sellPriceLabelKey: z.string().optional(),
  returnLabelKey: z.string().optional(),
  quantityLabelKey: z.string().optional(),
  profitLabelKey: z.string().optional(),
  cashboxLabelKey: z.string().optional(),
  reportLabelKey: z.string().optional(),
  addItemActionKey: z.string().optional(),
  noItemsEmptyKey: z.string().optional(),
  insufficientStockErrorKey: z.string().optional(),
  saveDocumentActionKey: z.string().optional(),
  selectStoragePromptKey: z.string().optional(),
  selectOperatorPromptKey: z.string().optional(),
  todayReportTitleKey: z.string().optional(),
})
export type TerminologyProfile = z.infer<typeof terminologyProfileSchema>

export const presentationProfileSchema = z.object({
  version: z.number().int().positive().default(1),
  vocabulary: terminologyProfileSchema.optional(),
  navigation: z
    .object({
      hiddenPaths: z.array(z.string()).default([]),
      pinnedPaths: z.array(z.string()).default([]),
      groupOrder: z.array(z.string()).default([]),
    })
    .default({}),
  dashboard: z
    .object({
      partOrder: z.array(z.string()).default([]),
      hiddenParts: z.array(z.string()).default([]),
      emphasizedWidgets: z.array(z.string()).default([]),
    })
    .default({}),
  forms: z
    .object({
      emphasizedProductFields: z.array(z.string()).default([]),
      defaultProductUnit: z.string().optional(),
      extraInvoiceColumns: z.array(z.string()).default([]),
    })
    .default({}),
  reports: z
    .object({
      emphasizedReports: z.array(z.string()).default([]),
    })
    .default({}),
  emptyStates: z
    .object({
      catalogKey: z.string().default('terminology.generic.noItems'),
      transactionsKey: z.string().default('terminology.generic.noDocuments'),
      stockKey: z.string().default('terminology.generic.noStock'),
    })
    .default({}),
  quickActions: z.array(z.string()).default([]),
  workflowDefaults: z
    .object({
      defaultSettlementMethod: z.string().optional(),
      defaultUnitTracking: z.string().optional(),
    })
    .default({}),
})
export type PresentationProfile = z.infer<typeof presentationProfileSchema>

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
  // V55 P1: optional — a DNA saved before this axis exists stays valid, and
  // `resolveDnaCapabilities` reads a missing axis as NONE.
  unitTracking: unitTrackingEnum.optional(),
  // V60: Axes 10–15 (optional; missing reads as UNRESOLVED, never a default trade).
  pricingBasis: z.array(pricingBasisEnum).min(1).optional(),
  assetCustody: assetCustodyEnum.optional(),
  executionSite: executionSiteEnum.optional(),
  recurrence: recurrenceEnum.optional(),
  approvalDepth: approvalDepthEnum.optional(),
  regulatedDomain: regulatedDomainEnum.optional(),
  terminology: terminologyProfileSchema.optional(),
  presentation: presentationProfileSchema.optional(),
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
  SALON_MULTI_STAFF: {
    version: 1,
    offering: ['TIME_SERVICE', 'PHYSICAL_GOODS'],
    intake: ['APPOINTMENT_BOOKING', 'WALK_IN'],
    inventory: ['SERVICE_CONSUMABLES', 'RETAIL_STOCK'],
    settlement: ['DEPOSIT_PREPAYMENT', 'IMMEDIATE_SETTLEMENT'],
    workforce: ['MIXED_WORKFORCE'],
    customer: ['CLIENT_CARE_PROFILE'],
    topology: ['RESOURCE_CAPACITY'],
    archetypeHint: 'SALON_MULTI_STAFF',
    terminology: {
      partyLabelKey: 'common.client',
      itemLabelKey: 'common.service',
      transactionLabelKey: 'common.appointment',
      inventoryLabelKey: 'common.consumables',
    },
  },
}

// ─── DNA Setup Gaps & Presentation Resolution (W1 + W2) ─────────────

export type DnaSetupGap =
  | 'OFFERING_UNRESOLVED'
  | 'INVENTORY_UNRESOLVED'
  | 'WORKFORCE_UNRESOLVED'
  | 'UNIT_TRACKING_UNRESOLVED'
  | 'PRICING_BASIS_UNRESOLVED'
  | 'ASSET_CUSTODY_UNRESOLVED'
  | 'EXECUTION_SITE_UNRESOLVED'
  | 'RECURRENCE_UNRESOLVED'
  | 'APPROVAL_DEPTH_UNRESOLVED'
  | 'REGULATED_DOMAIN_UNRESOLVED'
  | 'REGULATED_DOMAIN_COMPLIANCE'

/**
 * The catalog key of a gap's message. The catalogs name gaps in camelCase
 * (`onboarding.operating.gaps.regulatedDomainCompliance`); the first version returned the
 * code itself (`…gaps.REGULATED_DOMAIN_COMPLIANCE`) and onboarding showed the raw key
 * (12 Nov 2026).
 */
export function setupGapMessageKey(gap: DnaSetupGap): string {
  const camel = gap.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
  return `onboarding.operating.gaps.${camel}`
}

/** Reads missing optional axes as UNRESOLVED so legacy DNAs never guess defaults. */
export function effectiveDnaAxes(dna: OperationalDna) {
  return {
    offering: dna.offering,
    intake: dna.intake,
    inventory: dna.inventory,
    settlement: dna.settlement,
    workforce: dna.workforce,
    customer: dna.customer,
    topology: dna.topology,
    unitTracking: dna.unitTracking ?? ('UNRESOLVED' as const),
    pricingBasis: dna.pricingBasis ?? (['UNRESOLVED'] as const),
    assetCustody: dna.assetCustody ?? ('UNRESOLVED' as const),
    executionSite: dna.executionSite ?? ('UNRESOLVED' as const),
    recurrence: dna.recurrence ?? ('UNRESOLVED' as const),
    approvalDepth: dna.approvalDepth ?? ('UNRESOLVED' as const),
    regulatedDomain: dna.regulatedDomain ?? ('UNRESOLVED' as const),
  }
}

export const GENERIC_TERMINOLOGY: TerminologyProfile = {
  partyLabelKey: 'terminology.generic.party',
  itemLabelKey: 'terminology.generic.offering',
  transactionLabelKey: 'terminology.generic.transaction',
  inventoryLabelKey: 'terminology.generic.stock',
  documentLabelKey: 'terminology.generic.document',
  storageLabelKey: 'terminology.generic.storageLocation',
  operatorLabelKey: 'terminology.generic.operator',
  orderLabelKey: 'terminology.generic.order',
  buyPriceLabelKey: 'terminology.generic.buyPrice',
  sellPriceLabelKey: 'terminology.generic.sellPrice',
  returnLabelKey: 'terminology.generic.returnAction',
  quantityLabelKey: 'terminology.generic.quantity',
  profitLabelKey: 'terminology.generic.profit',
  cashboxLabelKey: 'terminology.generic.cashbox',
  reportLabelKey: 'terminology.generic.report',
  addItemActionKey: 'terminology.generic.addItem',
  noItemsEmptyKey: 'terminology.generic.noItems',
  insufficientStockErrorKey: 'terminology.generic.insufficientStock',
  saveDocumentActionKey: 'terminology.generic.saveDocument',
  selectStoragePromptKey: 'terminology.generic.selectStorage',
  selectOperatorPromptKey: 'terminology.generic.selectOperator',
  todayReportTitleKey: 'terminology.generic.todayReport',
}

/**
 * Fallback chain: explicit DNA terminology → specialized trade/archetype keys →
 * generic neutral keys (never retail when unknown).
 */
export function resolveTerminologyProfile(
  dna: OperationalDna,
  tradeKey?: string | null | undefined,
): TerminologyProfile {
  const unresolved = dna.offering.includes('UNRESOLVED') || dna.inventory.includes('UNRESOLVED')
  const tradeNs =
    !unresolved &&
    tradeKey &&
    [
      'clothing',
      'beautySalon',
      'mobilePhones',
      'repairs',
      'jewellery',
      'currencyExchange',
    ].includes(tradeKey)
      ? tradeKey
      : null

  if (unresolved) {
    const pres = dna.presentation?.vocabulary
    return pres
      ? ({
          ...GENERIC_TERMINOLOGY,
          ...Object.fromEntries(
            Object.entries(pres).filter(([, v]) => typeof v === 'string' && v.length > 0),
          ),
        } as TerminologyProfile)
      : GENERIC_TERMINOLOGY
  }

  const base: TerminologyProfile = tradeNs
    ? {
        ...GENERIC_TERMINOLOGY,
        itemLabelKey: `terminology.trades.${tradeNs}.offering`,
        transactionLabelKey: `terminology.trades.${tradeNs}.document`,
        storageLabelKey: `terminology.trades.${tradeNs}.storageLocation`,
        operatorLabelKey: `terminology.trades.${tradeNs}.operator`,
        orderLabelKey: `terminology.trades.${tradeNs}.order`,
      }
    : {
        ...GENERIC_TERMINOLOGY,
        ...(dna.terminology
          ? Object.fromEntries(
              Object.entries(dna.terminology).filter(
                ([, v]) => typeof v === 'string' && v.length > 0,
              ),
            )
          : {}),
      }

  const explicit = dna.presentation?.vocabulary
  if (!explicit) return base
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(explicit).filter(([, v]) => typeof v === 'string' && v.length > 0),
    ),
  } as TerminologyProfile
}

export function resolvePresentationProfile(
  dna: OperationalDna,
  tradeKey?: string | null | undefined,
): PresentationProfile {
  const base = presentationProfileSchema.parse(dna.presentation ?? {})
  return {
    ...base,
    vocabulary: resolveTerminologyProfile(dna, tradeKey),
  }
}

const REGULATED_COMPLIANCE_DOMAINS = new Set<RegulatedDomain>([
  'HEALTH_RECORDS',
  'PRESCRIPTION',
  'FINANCIAL_KYC',
  'FOOD_SAFETY',
])

export function setupGapsOf(dna: OperationalDna): DnaSetupGap[] {
  const gaps: DnaSetupGap[] = []
  if (dna.offering.includes('UNRESOLVED')) gaps.push('OFFERING_UNRESOLVED')
  if (dna.inventory.includes('UNRESOLVED')) gaps.push('INVENTORY_UNRESOLVED')
  if (dna.workforce.includes('UNRESOLVED')) gaps.push('WORKFORCE_UNRESOLVED')
  if (dna.unitTracking === 'UNRESOLVED') gaps.push('UNIT_TRACKING_UNRESOLVED')
  if (dna.pricingBasis?.includes('UNRESOLVED')) gaps.push('PRICING_BASIS_UNRESOLVED')
  if (dna.assetCustody === 'UNRESOLVED') gaps.push('ASSET_CUSTODY_UNRESOLVED')
  if (dna.executionSite === 'UNRESOLVED') gaps.push('EXECUTION_SITE_UNRESOLVED')
  if (dna.recurrence === 'UNRESOLVED') gaps.push('RECURRENCE_UNRESOLVED')
  if (dna.approvalDepth === 'UNRESOLVED') gaps.push('APPROVAL_DEPTH_UNRESOLVED')
  if (dna.regulatedDomain === 'UNRESOLVED') gaps.push('REGULATED_DOMAIN_UNRESOLVED')
  if (dna.regulatedDomain && REGULATED_COMPLIANCE_DOMAINS.has(dna.regulatedDomain)) {
    gaps.push('REGULATED_DOMAIN_COMPLIANCE')
  }
  return gaps
}

// ─── DNA-to-Capability Resolver ───────────────────────────────────────
export interface ResolvedBusinessConfiguration {
  dna: OperationalDna
  capabilities: CapabilityResolution
  activeModules: readonly string[]
  terminology: TerminologyProfile
  presentation: PresentationProfile
  setupGaps: readonly DnaSetupGap[]
  isSetupComplete: boolean
}

/**
 * Deterministically maps an 8-axis Operational DNA into enabled capabilities,
 * active UI modules, presentation profile, and explicit setup gaps.
 * Delegates capability and module activation to the ONE resolver in
 * `business-capabilities.ts` (`resolveCapabilityPlan`).
 */
export function resolveDnaCapabilities(dna: OperationalDna): ResolvedBusinessConfiguration {
  const plan = resolveCapabilityPlan({
    offering: dna.offering,
    intake: dna.intake,
    inventory: dna.inventory,
    settlement: dna.settlement,
    workforce: dna.workforce,
    topology: dna.topology,
    unitTracking: dna.unitTracking,
    pricingBasis: dna.pricingBasis,
    assetCustody: dna.assetCustody,
    executionSite: dna.executionSite,
    recurrence: dna.recurrence,
    approvalDepth: dna.approvalDepth,
    regulatedDomain: dna.regulatedDomain,
  })

  const defaultTerminology: TerminologyProfile = {
    partyLabelKey: 'common.customer',
    itemLabelKey: 'common.product',
    transactionLabelKey: 'common.sale',
    inventoryLabelKey: 'common.stock',
  }

  const setupGaps = setupGapsOf(dna)
  const presentation = resolvePresentationProfile(dna)

  return {
    dna,
    capabilities: plan.capabilities,
    activeModules: plan.activeModules,
    terminology: dna.terminology ?? defaultTerminology,
    presentation,
    setupGaps,
    isSetupComplete: setupGaps.length === 0,
  }
}

// ─── Operating Characteristics to DNA Resolver ───────────────────────
export interface OperationalInferenceInput {
  /** The single activity (the legacy call shape). */
  readonly tradeKey?: string | undefined
  /**
   * EVERY selected activity (V64 §5). When two or more are given, the DNA is
   * composed from all of them: `resolveCapabilityPlan` matches concrete axis
   * values, so dropping an activity would silently switch its modules off.
   * `tradeKey` is ignored when this has two or more entries.
   */
  readonly tradeKeys?: readonly string[] | undefined
  /** Which selected activity controls vocabulary and display order. */
  readonly primaryTradeKey?: string | undefined
  readonly holdsStock?: 'yes' | 'no' | 'unknown' | undefined
  readonly producesGoods?: 'yes' | 'no' | 'unknown' | undefined
  readonly sellsOnCredit?: 'yes' | 'no' | 'unknown' | undefined
  readonly hasPointOfSale?: 'yes' | 'no' | 'unknown' | undefined
  readonly hasStaff?: 'yes' | 'no' | 'unknown' | undefined
  readonly staffArrangement?: StaffArrangement | undefined
  /** How many branches run the business (V65; legacy name: `locations`). */
  readonly branches?: BranchScope | undefined
  /** How many warehouses hold the stock — `none` is a real answer (V65). */
  readonly warehouses?: WarehouseScope | undefined
  readonly locations?: 'single' | 'multiple' | 'unknown' | undefined
  readonly takesAppointments?: 'yes' | 'no' | 'unknown' | undefined
  readonly deliversCoursesOrPackages?: 'yes' | 'no' | 'unknown' | undefined
  readonly takesJobTicketsOrRepairs?: 'yes' | 'no' | 'unknown' | undefined
  readonly tracksSerials?: 'yes' | 'no' | 'unknown' | undefined
  readonly hasExpiryDates?: 'yes' | 'no' | 'unknown' | undefined
  readonly rentsOutAssets?: 'yes' | 'no' | 'unknown' | undefined
  readonly worksAtCustomerSite?: 'yes' | 'no' | 'unknown' | undefined
  readonly billsRecurring?: 'yes' | 'no' | 'unknown' | undefined
  readonly holdsCustomerAssets?: 'yes' | 'no' | 'unknown' | undefined
  readonly needsApprovals?: 'yes' | 'no' | 'unknown' | undefined
  readonly pricingBasis?: readonly PricingBasis[] | undefined
  readonly assetCustody?: AssetCustody | undefined
  readonly executionSite?: ExecutionSite | undefined
  readonly recurrence?: Recurrence | undefined
  readonly approvalDepth?: ApprovalDepth | undefined
  readonly regulatedDomain?: RegulatedDomain | undefined
}

// Trades whose compliance gap the DNA must SHOW. A regulated domain creates a
// setup gap — it never grants a clinical or KYC capability.
const TRADE_REGULATED: Readonly<Record<string, RegulatedDomain>> = {
  pharmacy: 'PRESCRIPTION',
  clinic: 'HEALTH_RECORDS',
  currencyExchange: 'FINANCIAL_KYC',
  restaurant: 'FOOD_SAFETY',
  bakery: 'FOOD_SAFETY',
  cafe: 'FOOD_SAFETY',
  hotel: 'FOOD_SAFETY',
}

// What each trade actually sells ON: weight for gold, length for cloth, area
// for glass. A plain unit price would be wrong for all three.
const TRADE_PRICING: Readonly<Record<string, readonly PricingBasis[]>> = {
  jewellery: ['WEIGHT', 'RATE_BOARD'],
  currencyExchange: ['RATE_BOARD'],
  clothing: ['UNIT', 'LENGTH'],
  hardware: ['UNIT', 'LENGTH', 'AREA'],
}

/**
 * Derives an 8-axis Operational DNA from actual operational characteristics
 * rather than guessing or defaulting blindly to RETAIL_STORE.
 *
 * If characteristics are unknown or purely generic, it produces a safe GENERIC profile
 * without forcing inventory or appointments.
 *
 * ⚠️ ONE ACTIVITY. `inferOperationalDna` is the entry point: when a business
 * runs several, it calls this once per activity and COMPOSES the results.
 */
function inferSingleTradeDna(input: OperationalInferenceInput): OperationalDna {
  // ⚠️ AN ANSWER BEATS THE TRADE. The trade only fills a question the person
  // left unanswered: a barber who says «no appointments» is a walk-in shop.
  // (Until 8 Nov 2026 the trade won, so a «no» could not be given.)
  const trade = suggestedOperatingAnswers(input.tradeKey)
  const said = <K extends YesNoQuestion>(key: K): YesNo =>
    input[key] && input[key] !== 'unknown' ? (input[key] as YesNo) : (trade[key] ?? 'unknown')
  const isAppointmentDriven = said('takesAppointments') === 'yes'
  const isPackageDriven = said('deliversCoursesOrPackages') === 'yes'
  const isRepairDriven = said('takesJobTicketsOrRepairs') === 'yes'
  const isProducer = said('producesGoods') === 'yes'
  const isRetailTrade = said('hasPointOfSale') === 'yes'
  input = {
    ...input,
    holdsStock: said('holdsStock'),
    sellsOnCredit: said('sellsOnCredit'),
    hasPointOfSale: said('hasPointOfSale'),
    hasStaff: said('hasStaff'),
  }

  // 1. Offering — an explicit «no stock» is a service; an UNKNOWN stock answer
  // never fabricates a goods business (V55: was the `else` fall-through that
  // turned every unanswered questionnaire into PHYSICAL_GOODS).
  const offering: OfferingModel[] = []
  if (isPackageDriven) {
    offering.push('PACKAGE_SESSION')
  } else if (isAppointmentDriven) {
    offering.push('TIME_SERVICE')
    if (input.holdsStock === 'yes') offering.push('PHYSICAL_GOODS')
  } else if (isRepairDriven) {
    offering.push('DELIVERABLE_SERVICE')
    // Spare parts ARE physical goods: the repair trade itself carries this
    // suggestion, so an unknown stock answer follows the trade — an explicit
    // «no» still wins.
    if (input.holdsStock !== 'no') offering.push('PHYSICAL_GOODS')
  } else if (input.holdsStock === 'no') {
    offering.push('DELIVERABLE_SERVICE')
  } else if (input.holdsStock === 'unknown') {
    offering.push('UNRESOLVED')
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

  // 3. Inventory — precedence: an explicit «no» beats every trade suggestion;
  // a suggestion only fills a question the person left unanswered; an unknown
  // answer with no trade evidence stays UNRESOLVED (V55: was the `else`
  // fall-through that turned every unanswered questionnaire into RETAIL_STOCK).
  const inventory: InventoryBehavior[] = []
  if (input.holdsStock === 'no') {
    inventory.push('NONE')
  } else if (isProducer) {
    inventory.push('RAW_MATERIALS', 'FINISHED_GOODS')
  } else if (isRepairDriven) {
    inventory.push('SPARE_PARTS')
  } else if (isAppointmentDriven) {
    inventory.push('SERVICE_CONSUMABLES')
    if (input.holdsStock === 'yes') inventory.push('RETAIL_STOCK')
  } else if (input.holdsStock === 'yes') {
    inventory.push('RETAIL_STOCK')
  } else {
    inventory.push('UNRESOLVED')
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

  // 5. Workforce — never guess compensation from hasStaff/headcount (W2).
  const STAFF_MAP: Readonly<Record<StaffArrangement, WorkforceModel>> = {
    solo: 'SOLO_OWNER',
    fixed_salary: 'SALARIED_STAFF',
    hourly: 'HOURLY_STAFF',
    commission: 'COMMISSION_PROVIDERS',
    shift: 'SHIFT_BASED_STAFF',
    mixed: 'MIXED_WORKFORCE',
    unknown: 'UNRESOLVED',
  }
  const workforce: WorkforceModel[] = []
  if (input.staffArrangement) {
    workforce.push(STAFF_MAP[input.staffArrangement])
  } else if (input.hasStaff === 'no') {
    workforce.push('SOLO_OWNER')
  } else if (
    input.hasStaff === 'yes' ||
    input.hasStaff === 'unknown' ||
    input.hasStaff === undefined
  ) {
    workforce.push('UNRESOLVED')
  }

  // 6. Customer
  const customer: CustomerProfile[] = []
  if (isAppointmentDriven) customer.push('CLIENT_CARE_PROFILE')
  else if (isPackageDriven) customer.push('STUDENT_PROFILE')
  else if (isRepairDriven) customer.push('SERVICE_ASSET_PROFILE')
  else customer.push('STANDARD_PARTY')

  // 7. Topology — a branch and a warehouse are DIFFERENT facts (V64 §6.2):
  // two warehouses imply nothing about branches and a second branch implies
  // nothing about warehouses. `branches` is the V65 name for the question;
  // `locations` is the stored answer from before it was asked this way and
  // still counts when the new one was never given.
  const branchScope = input.branches ?? input.locations
  const topology: OperationalTopology[] = []
  if (branchScope === 'multiple') {
    topology.push('MULTI_BRANCH')
  } else if (isAppointmentDriven) {
    topology.push('RESOURCE_CAPACITY')
  } else if (isPackageDriven) {
    topology.push('SEAT_OR_ROOM_BASED')
  } else {
    topology.push('SINGLE_LOCATION')
  }
  if (input.warehouses === 'multiple') topology.push('WAREHOUSE_NETWORK')
  // «one location» cannot stand beside a branch or warehouse network.
  if (topology.length > 1) {
    const withoutSingleLocation = topology.filter((value) => value !== 'SINGLE_LOCATION')
    topology.splice(0, topology.length, ...withoutSingleLocation)
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

  // 9. Unit tracking (V55 P1) — only what a person SAID, or the trade's own
  // suggestion. Left OUT when neither was answered: absent is «no axis was
  // resolved», which activates nothing — never a fabricated tracker.
  const serialAnswer = said('tracksSerials')
  const expiryAnswer = said('hasExpiryDates')
  const unitTracking: UnitTracking | undefined =
    serialAnswer === 'yes' && expiryAnswer === 'yes'
      ? 'BOTH'
      : serialAnswer === 'yes'
        ? 'SERIAL_NUMBERS'
        : expiryAnswer === 'yes'
          ? 'EXPIRY_DATES'
          : serialAnswer === 'no' && expiryAnswer === 'no'
            ? 'NONE'
            : undefined

  // 10–15. V60 orthogonal axes — only populated from explicit answers or trade hints.
  const rentsOut = said('rentsOutAssets')
  const holdsCustomerAsset = said('holdsCustomerAssets')
  const atCustomerSite = said('worksAtCustomerSite')
  const recurring = said('billsRecurring')
  const approvals = said('needsApprovals')

  const derivedPricing: PricingBasis[] = input.pricingBasis
    ? [...input.pricingBasis]
    : [...(input.tradeKey && TRADE_PRICING[input.tradeKey] ? TRADE_PRICING[input.tradeKey]! : [])]
  if (!input.pricingBasis) {
    if (rentsOut === 'yes' || isAppointmentDriven) derivedPricing.push('TIME')
    if (recurring === 'yes') derivedPricing.push('CONTRACT')
  }
  const pricingBasis = derivedPricing.length > 0 ? Array.from(new Set(derivedPricing)) : undefined

  const assetCustody: AssetCustody | undefined =
    input.assetCustody ??
    (holdsCustomerAsset === 'yes' || isRepairDriven
      ? 'CUSTOMER_ASSET_IN_CUSTODY'
      : rentsOut === 'yes'
        ? 'RENTED_OUT_ASSET'
        : input.holdsStock === 'yes'
          ? 'OWN_STOCK'
          : holdsCustomerAsset === 'no' && rentsOut === 'no' && input.holdsStock === 'no'
            ? 'NONE'
            : undefined)

  const executionSite: ExecutionSite | undefined =
    input.executionSite ??
    (input.tradeKey === 'courier' ||
    input.tradeKey === 'transport' ||
    input.tradeKey === 'logistics'
      ? 'MOBILE_ROUTE'
      : atCustomerSite === 'yes'
        ? 'CUSTOMER_SITE'
        : atCustomerSite === 'no'
          ? 'PREMISES'
          : undefined)

  const recurrence: Recurrence | undefined =
    input.recurrence ??
    (recurring === 'yes'
      ? rentsOut === 'yes'
        ? 'LEASE'
        : isPackageDriven
          ? 'SUBSCRIPTION'
          : 'RECURRING_SERVICE'
      : recurring === 'no'
        ? 'ONE_OFF'
        : undefined)

  const approvalDepth: ApprovalDepth | undefined =
    input.approvalDepth ??
    (approvals === 'yes' ? 'SINGLE' : approvals === 'no' ? 'NONE' : undefined)

  const regulatedDomain: RegulatedDomain | undefined =
    input.regulatedDomain ?? (input.tradeKey ? TRADE_REGULATED[input.tradeKey] : undefined)

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
    ...(unitTracking ? { unitTracking } : {}),
    ...(pricingBasis ? { pricingBasis } : {}),
    ...(assetCustody ? { assetCustody } : {}),
    ...(executionSite ? { executionSite } : {}),
    ...(recurrence ? { recurrence } : {}),
    ...(approvalDepth ? { approvalDepth } : {}),
    ...(regulatedDomain ? { regulatedDomain } : {}),
    archetypeHint:
      isAppointmentDriven && workforce.some((w) => w !== 'SOLO_OWNER' && w !== 'UNRESOLVED')
        ? 'SALON_MULTI_STAFF'
        : isAppointmentDriven
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

// ─── Multi-activity composition (V65 · V64 §5) ───────────────────────
//
// A business can run more than one activity. `resolveCapabilityPlan` matches
// CONCRETE axis values (`COUNTER_POS`, `JOB_TICKET`, `SPARE_PARTS`, …), so a
// composed DNA must UNION every activity's axes — collapsing them into a
// combined value would silently switch modules off. The primary activity
// decides vocabulary and display order only; it never erases another one.
//
// Scalar axes (custody, execution site, recurrence, approval depth, regulated
// domain) hold ONE value by schema. The primary activity wins, then the first
// activity that answered. That is the only information the schema can carry;
// a genuine conflict is recorded here rather than guessed into a new enum.

const uniqueInOrder = <T>(values: readonly T[]): T[] => {
  const out: T[] = []
  for (const value of values) if (!out.includes(value)) out.push(value)
  return out
}

/** Drop «could not be resolved» once ANY activity resolved the axis. */
const concreteOr = <T extends string>(values: readonly T[]): T[] => {
  const concrete = values.filter((value) => value !== 'UNRESOLVED')
  return concrete.length > 0 ? concrete : [...values]
}

function composeUnitTracking(parts: readonly OperationalDna[]): UnitTracking | undefined {
  let serial = false
  let expiry = false
  let answered = false
  for (const part of parts) {
    if (part.unitTracking === 'SERIAL_NUMBERS') {
      serial = true
      answered = true
    } else if (part.unitTracking === 'EXPIRY_DATES') {
      expiry = true
      answered = true
    } else if (part.unitTracking === 'BOTH') {
      serial = true
      expiry = true
      answered = true
    } else if (part.unitTracking === 'NONE') {
      answered = true
    }
  }
  if (!answered) return undefined
  if (serial && expiry) return 'BOTH'
  if (serial) return 'SERIAL_NUMBERS'
  if (expiry) return 'EXPIRY_DATES'
  return 'NONE'
}

function composeOperationalDna(parts: readonly OperationalDna[]): OperationalDna {
  const primary = parts[0]
  if (!primary) throw new Error('composeOperationalDna needs at least one activity')

  const union = <T>(read: (dna: OperationalDna) => readonly T[]): T[] =>
    uniqueInOrder(parts.flatMap((part) => [...read(part)]))

  const customerValues = uniqueInOrder(union((dna) => dna.customer))
  const topologyValues = uniqueInOrder(union((dna) => dna.topology))
  const pricingValues = concreteOr(union((dna) => dna.pricingBasis ?? []))
  const unitTracking = composeUnitTracking(parts)

  const assetCustody = parts.map((part) => part.assetCustody).find((value) => value !== undefined)
  const executionSite = parts.map((part) => part.executionSite).find((value) => value !== undefined)
  const recurrence = parts.map((part) => part.recurrence).find((value) => value !== undefined)
  const approvalDepth = parts.map((part) => part.approvalDepth).find((value) => value !== undefined)
  const regulatedDomain = parts
    .map((part) => part.regulatedDomain)
    .find((value) => value !== undefined)

  return {
    version: primary.version,
    offering: concreteOr(union((dna) => dna.offering)),
    intake: union((dna) => dna.intake),
    inventory: concreteOr(union((dna) => dna.inventory)),
    settlement: union((dna) => dna.settlement),
    workforce: concreteOr(union((dna) => dna.workforce)),
    // Two different party kinds are the EXISTING combined value — never the
    // first activity's, which would tell a salon+shop business it has no
    // wholesalers or students.
    customer: customerValues.length > 1 ? ['MIXED_PROFILE'] : customerValues,
    topology:
      topologyValues.length > 1
        ? topologyValues.filter((value) => value !== 'SINGLE_LOCATION')
        : topologyValues,
    ...(primary.terminology ? { terminology: primary.terminology } : {}),
    ...(unitTracking ? { unitTracking } : {}),
    ...(pricingValues.length > 0 ? { pricingBasis: pricingValues } : {}),
    ...(assetCustody ? { assetCustody } : {}),
    ...(executionSite ? { executionSite } : {}),
    ...(recurrence ? { recurrence } : {}),
    ...(approvalDepth ? { approvalDepth } : {}),
    ...(regulatedDomain ? { regulatedDomain } : {}),
    ...(primary.archetypeHint ? { archetypeHint: primary.archetypeHint } : {}),
  }
}

/**
 * THE entry point. One activity behaves exactly as before; two or more are
 * composed so no selected activity disappears from the plan, the menu or the
 * first-value guidance. `primaryTradeKey` (falling back to the first selected)
 * decides vocabulary only, never entitlement.
 */
export function inferOperationalDna(input: OperationalInferenceInput): OperationalDna {
  const selected = uniqueInOrder(
    (input.tradeKeys ?? (input.tradeKey ? [input.tradeKey] : [])).filter((key) => key.length > 0),
  )
  if (selected.length <= 1) {
    return inferSingleTradeDna({
      ...input,
      tradeKey: selected[0],
      tradeKeys: undefined,
      primaryTradeKey: undefined,
    })
  }

  const primaryKey =
    input.primaryTradeKey && selected.includes(input.primaryTradeKey)
      ? input.primaryTradeKey
      : selected[0]!
  const ordered = [primaryKey, ...selected.filter((key) => key !== primaryKey)]

  return composeOperationalDna(
    ordered.map((tradeKey) =>
      inferSingleTradeDna({
        ...input,
        tradeKey,
        tradeKeys: undefined,
        primaryTradeKey: undefined,
      }),
    ),
  )
}

// ─── Adaptive operating questions (V54 5.3) ──────────────────────────
// The few questions that decide the DNA. Every answer is optional: «unknown»
// leaves the trade's own default in place. Which questions are SHOWN depends
// on the answers already given (`operatingQuestionsFor`), so a service that
// keeps no stock is never asked about production or a counter.

export type YesNo = 'yes' | 'no' | 'unknown'

export const YES_NO_QUESTIONS = [
  'takesAppointments',
  'deliversCoursesOrPackages',
  'takesJobTicketsOrRepairs',
  'holdsStock',
  'producesGoods',
  'hasPointOfSale',
  'tracksSerials',
  'hasExpiryDates',
  'holdsCustomerAssets',
  'rentsOutAssets',
  'worksAtCustomerSite',
  'sellsOnCredit',
  'billsRecurring',
  'hasStaff',
  'needsApprovals',
] as const
export type YesNoQuestion = (typeof YES_NO_QUESTIONS)[number]
export type OperatingQuestion =
  | YesNoQuestion
  | 'staffArrangement'
  | 'branches'
  | 'warehouses'
  /** Legacy name for `branches`; still read from answers saved before V65. */
  | 'locations'

export type LocationScope = 'single' | 'multiple' | 'unknown'
export type BranchScope = LocationScope
/** `none` is an ANSWER, not a missing one: a service business has no warehouse. */
export type WarehouseScope = 'none' | 'single' | 'multiple' | 'unknown'

export type OperatingAnswers = {
  readonly [K in YesNoQuestion]?: YesNo | undefined
} & {
  readonly branches?: BranchScope | undefined
  readonly warehouses?: WarehouseScope | undefined
  /** Legacy — read when `branches` was never asked. */
  readonly locations?: LocationScope | undefined
  readonly staffArrangement?: StaffArrangement | undefined
}

export const yesNoSchema = z.enum(['yes', 'no', 'unknown'])
export const locationScopeSchema = z.enum(['single', 'multiple', 'unknown'])
export const warehouseScopeSchema = z.enum(['none', 'single', 'multiple', 'unknown'])

export const operatingAnswersSchema = z
  .object({
    takesAppointments: yesNoSchema.optional(),
    deliversCoursesOrPackages: yesNoSchema.optional(),
    takesJobTicketsOrRepairs: yesNoSchema.optional(),
    holdsStock: yesNoSchema.optional(),
    producesGoods: yesNoSchema.optional(),
    hasPointOfSale: yesNoSchema.optional(),
    tracksSerials: yesNoSchema.optional(),
    hasExpiryDates: yesNoSchema.optional(),
    holdsCustomerAssets: yesNoSchema.optional(),
    rentsOutAssets: yesNoSchema.optional(),
    worksAtCustomerSite: yesNoSchema.optional(),
    sellsOnCredit: yesNoSchema.optional(),
    billsRecurring: yesNoSchema.optional(),
    hasStaff: yesNoSchema.optional(),
    needsApprovals: yesNoSchema.optional(),
    staffArrangement: staffArrangementEnum.optional(),
    branches: locationScopeSchema.optional(),
    warehouses: warehouseScopeSchema.optional(),
    locations: locationScopeSchema.optional(),
  })
  .strict()

/** Trades whose work is booked ahead. Onboarding metadata only — never read by a money rule. */
const APPOINTMENT_TRADES = new Set(['barber', 'beautySalon', 'clinic'])
const PACKAGE_TRADES = new Set(['education'])
const REPAIR_TRADES = new Set(['repairs', 'mechanic'])
const PRODUCER_TRADES = new Set(['manufacturing', 'bakery'])
const COUNTER_TRADES = new Set(['retail', 'grocery'])
// V55 P1: the unit-tracking trades. A phone shop sells THIS unit (IMEI);
// a pharmacy sells the batch that expires first (FEFO).
const SERIAL_TRADES = new Set(['mobilePhones', 'repairs', 'mechanic'])
const EXPIRY_TRADES = new Set(['pharmacy', 'grocery'])
const WHOLESALE_TRADES = new Set(['wholesale'])
const CONSULTING_TRADES = new Set(['consulting', 'itServices'])
const COURIER_TRADES = new Set(['courier'])
const RENTAL_TRADES = new Set(['wedding'])

const DNA_HINT_SETS: readonly ReadonlySet<string>[] = [
  APPOINTMENT_TRADES,
  PACKAGE_TRADES,
  REPAIR_TRADES,
  PRODUCER_TRADES,
  COUNTER_TRADES,
  SERIAL_TRADES,
  EXPIRY_TRADES,
  WHOLESALE_TRADES,
  CONSULTING_TRADES,
  COURIER_TRADES,
  RENTAL_TRADES,
]

/**
 * Every trade the inference engine carries a trade-specific rule for. A rule is
 * a PRE-FILLED DEFAULT, never a support claim — the generated coverage table
 * derives «profiled» from this instead of a hand-written list that could drift.
 */
export function tradesWithDnaHints(): readonly string[] {
  const keys = new Set<string>()
  for (const set of DNA_HINT_SETS) for (const key of set) keys.add(key)
  for (const key of Object.keys(TRADE_REGULATED)) keys.add(key)
  for (const key of Object.keys(TRADE_PRICING)) keys.add(key)
  return [...keys].sort()
}

/**
 * What the trade suggests for each question — the wizard's pre-filled answer.
 * Unknown trades suggest nothing (every question stays open).
 */
export function suggestedOperatingAnswers(tradeKey: string | undefined): OperatingAnswers {
  if (!tradeKey) return {}
  const out: { -readonly [K in YesNoQuestion]?: YesNo } = {}
  if (APPOINTMENT_TRADES.has(tradeKey)) out.takesAppointments = 'yes'
  if (PACKAGE_TRADES.has(tradeKey)) out.deliversCoursesOrPackages = 'yes'
  if (REPAIR_TRADES.has(tradeKey)) out.takesJobTicketsOrRepairs = 'yes'
  if (PRODUCER_TRADES.has(tradeKey)) {
    out.producesGoods = 'yes'
    out.holdsStock = 'yes'
  }
  if (COUNTER_TRADES.has(tradeKey)) {
    out.hasPointOfSale = 'yes'
    out.holdsStock = 'yes'
  }
  if (SERIAL_TRADES.has(tradeKey)) out.tracksSerials = 'yes'
  if (EXPIRY_TRADES.has(tradeKey)) out.hasExpiryDates = 'yes'
  if (WHOLESALE_TRADES.has(tradeKey)) {
    out.holdsStock = 'yes'
    out.sellsOnCredit = 'yes'
  }
  if (CONSULTING_TRADES.has(tradeKey)) {
    out.holdsStock = 'no'
    out.sellsOnCredit = 'yes'
  }
  if (COURIER_TRADES.has(tradeKey)) {
    out.holdsStock = 'no'
    out.worksAtCustomerSite = 'yes'
  }
  if (RENTAL_TRADES.has(tradeKey)) {
    out.rentsOutAssets = 'yes'
  }
  return out
}

/**
 * The pre-filled answers for EVERY selected activity (V64 §5). A «yes» from any
 * activity wins, because pre-filling «no» would hide a module the business
 * actually needs. The person can still answer «no» — and that answer beats
 * every suggestion in `inferOperationalDna`.
 */
export function suggestedOperatingAnswersFor(tradeKeys: readonly string[]): OperatingAnswers {
  const out: { -readonly [K in YesNoQuestion]?: YesNo } = {}
  for (const tradeKey of tradeKeys) {
    const suggestion = suggestedOperatingAnswers(tradeKey)
    for (const question of YES_NO_QUESTIONS) {
      const value = suggestion[question]
      if (value === undefined) continue
      if (value === 'yes' || out[question] === undefined) out[question] = value
    }
  }
  return out
}

/**
 * The questions to SHOW, given the answers so far (the trade's suggestions
 * merged in). Production and the counter only matter to a business that keeps
 * stock; every other question is always asked.
 */
export function operatingQuestionsFor(answers: OperatingAnswers): OperatingQuestion[] {
  const keepsStock = answers.holdsStock !== 'no'
  const isAppointment = answers.takesAppointments === 'yes'
  const isPackage = answers.deliversCoursesOrPackages === 'yes'
  const isRepair = answers.takesJobTicketsOrRepairs === 'yes'
  const isProducer = answers.producesGoods === 'yes'
  const canRentAssets = !isAppointment && !isPackage && !isProducer
  const multipleBranches = (answers.branches ?? answers.locations) === 'multiple'
  const needsControl =
    answers.hasStaff === 'yes' ||
    answers.sellsOnCredit === 'yes' ||
    multipleBranches ||
    answers.warehouses === 'multiple'

  return [
    'takesAppointments',
    'deliversCoursesOrPackages',
    'takesJobTicketsOrRepairs',
    'holdsStock',
    ...(keepsStock
      ? (['producesGoods', 'hasPointOfSale', 'tracksSerials', 'hasExpiryDates'] as const)
      : []),
    ...(isRepair || answers.holdsCustomerAssets !== undefined
      ? (['holdsCustomerAssets'] as const)
      : []),
    ...(canRentAssets || answers.rentsOutAssets !== undefined ? (['rentsOutAssets'] as const) : []),
    ...(!isPackage || answers.worksAtCustomerSite !== undefined
      ? (['worksAtCustomerSite'] as const)
      : []),
    'sellsOnCredit',
    ...(!isAppointment || answers.billsRecurring !== undefined
      ? (['billsRecurring'] as const)
      : []),
    'hasStaff',
    ...(answers.hasStaff === 'yes' ? (['staffArrangement'] as const) : []),
    ...(needsControl || answers.needsApprovals !== undefined ? (['needsApprovals'] as const) : []),
    'branches',
    'warehouses',
  ]
}

// ─── Onboarding progress (V54 5.3) ───────────────────────────────────
// Where the wizard stands, kept on the WORKSPACE so another device or a
// cleared browser resumes instead of starting over. The answers are the
// wizard's own fields only — a closed list, each a short string — so the
// column can never become an unvalidated blob of business truth.
export const ONBOARDING_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'REQUIRES_CONFIGURATION',
  'READY_TO_ACTIVATE',
  'ACTIVE',
  'PAUSED',
] as const
export type OnboardingProgressState = (typeof ONBOARDING_STATES)[number]

export const onboardingProgressSchema = z
  .object({
    state: z.enum(ONBOARDING_STATES),
    step: z.number().int().min(0).max(20),
    answers: z
      .object({
        businessType: z.string().max(400).nullable().optional(),
        storeSize: z.string().max(32).nullable().optional(),
        defaultCurrency: z.string().max(8).nullable().optional(),
        operating: operatingAnswersSchema.optional(),
      })
      .strict(),
  })
  .strict()
export type OnboardingProgress = z.infer<typeof onboardingProgressSchema>
