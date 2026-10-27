// ============================================
// packages/validation/src/schemas/industry-profiles.ts
//
// ONE DERIVED PROFILE, NO SECOND SOURCE OF TRUTH.
//
// The workspace already stores the trades chosen during onboarding. A profile
// is a pure function of that list: nothing is persisted beside it, so Online
// and Offline cannot disagree about what an industry means.
//
// THE RULES THIS FILE OWNS
//   · canonicalisation of the stored value (array or comma-separated string)
//   · which industry is PRIMARY (deterministic, never insertion order)
//   · the union of AVAILABLE capabilities across every selected trade
//   · invoice-column / product-unit defaults
//   · a stable dashboard order (existing card ids only)
//
// ⚠️ An industry configures EMPHASIS. It never grants a capability, never
// changes authorisation, never hides a module and never touches money.
// ============================================

import { z } from 'zod'
import type { CapabilityKey } from './business-capabilities'
import { AVAILABLE_CAPABILITIES, CAPABILITIES, CAPABILITY_KEYS } from './business-capabilities'

/**
 * Canonical industry keys.
 *
 * ⚠️ KEPT IN STEP WITH THE ONBOARDING CATALOGUE.
 * `packages/ui/src/__tests__/industry-profile-registry.test.ts` compares this
 * list with `BUSINESS_TYPES` / `BUSINESS_MODELS` in `@hisabche/ui-contract`.
 * The label catalogue stays there because ui-contract cannot import this
 * package (no dependency edge), so the parity guard — not a duplicated runtime
 * lookup — is what keeps the two honest.
 */
export const INDUSTRY_KEYS = [
  // sales models (onboarding cards, not trades)
  'retail',
  'wholesale',
  // trades
  'grocery',
  'bakery',
  'butcher',
  'restaurant',
  'cafe',
  'fruitVegetable',
  'dairy',
  'nuts',
  'spices',
  'jewellery',
  'watches',
  'currencyExchange',
  'clothing',
  'fabric',
  'fabricRoll',
  'shoes',
  'carpet',
  'tailoring',
  'mobilePhones',
  'computers',
  'computerComponents',
  'electronics',
  'itServices',
  'hardware',
  'buildingMaterials',
  'paint',
  'timber',
  'glass',
  'construction',
  'manufacturing',
  'autoParts',
  'carDealer',
  'mechanic',
  'fuel',
  'furniture',
  'kitchenware',
  'homeAppliances',
  'stationery',
  'toys',
  'giftShop',
  'pharmacy',
  'cosmetics',
  'clinic',
  'barber',
  'optician',
  'agriculture',
  'livestock',
  'seedsFertilizer',
  'flowers',
  'transport',
  'freightTransport',
  'passengerTransport',
  'courier',
  'travelAgency',
  'realEstate',
  'printing',
  'photography',
  'education',
  'laundry',
  'repairs',
  'wedding',
  'security',
  'consulting',
  // escape hatch
  'other',
] as const

export type IndustryKey = (typeof INDUSTRY_KEYS)[number]

/** The two onboarding cards that describe HOW a business sells. */
export const SALES_MODEL_KEYS: readonly IndustryKey[] = ['retail', 'wholesale']

/**
 * Values written by the previous onboarding wizard. Kept so an existing
 * workspace is recognised as legacy rather than treated as unknown — but they
 * never authorise a specialised profile.
 */
export const LEGACY_INDUSTRY_KEYS = ['service'] as const

export type LegacyIndustryKey = (typeof LEGACY_INDUSTRY_KEYS)[number]

/** Dashboard parts that already exist and already have a data provider. */
export const DASHBOARD_PART_IDS = [
  'workQueue',
  'kpis',
  'chart',
  'insights',
  'activities',
  'manufacturing',
] as const

export type DashboardPartId = (typeof DASHBOARD_PART_IDS)[number]

export interface InvoiceDefaults {
  /** Extra built-in columns that start visible. Order is the core order. */
  readonly extraVisibleColumns: readonly string[]
  /** A money column's multiplier source, only when the column exists. */
  readonly priceMultiplierSource?: string
}

export interface ProductDefaults {
  /** The unit a NEW product is created with. Never rewrites a saved product. */
  readonly unit: string
  /** Fields the product form may put first. Never removes anything. */
  readonly emphasizedFields: readonly string[]
}

export interface Vocabulary {
  /** i18n key for the noun a profile prefers, when one exists. */
  readonly productKey?: string
  readonly customerKey?: string
}

export interface ProfileDefinition {
  readonly key: IndustryKey
  /** `specialized` only when at least one real capability is on. */
  readonly kind: 'specialized' | 'generic'
  readonly capabilities: readonly CapabilityKey[]
  readonly invoiceDefaults: InvoiceDefaults
  readonly productDefaults: ProductDefaults
  readonly dashboard: readonly DashboardPartId[]
  readonly vocabulary: Vocabulary
}

/** The order every untreated trade gets. Explicit, never incidental. */
const GENERIC_DASHBOARD: readonly DashboardPartId[] = [
  'kpis',
  'workQueue',
  'chart',
  'insights',
  'activities',
  'manufacturing',
]

const GENERIC_INVOICE: InvoiceDefaults = { extraVisibleColumns: [] }

const GENERIC_PRODUCT: ProductDefaults = { unit: 'piece', emphasizedFields: [] }

const GENERIC: Omit<ProfileDefinition, 'key'> = {
  kind: 'generic',
  capabilities: [],
  invoiceDefaults: GENERIC_INVOICE,
  productDefaults: GENERIC_PRODUCT,
  dashboard: GENERIC_DASHBOARD,
  vocabulary: {},
}

interface ProfileOverride {
  readonly capabilities?: readonly CapabilityKey[]
  readonly extraVisibleColumns?: readonly string[]
  readonly priceMultiplierSource?: string
  readonly unit?: string
  readonly emphasizedFields?: readonly string[]
  readonly dashboard?: readonly DashboardPartId[]
  readonly vocabulary?: Vocabulary
}

/**
 * The trades whose experience differs today. Every other key inherits the
 * generic profile — selectable, honest and never promised a package it lacks.
 */
const OVERRIDES: Partial<Record<IndustryKey, ProfileOverride>> = {
  jewellery: {
    capabilities: ['measurement', 'weight_pricing', 'multi_unit'],
    extraVisibleColumns: ['weightGrams'],
    unit: 'gram',
    emphasizedFields: ['unit', 'sellPrice', 'quantity'],
    dashboard: ['kpis', 'workQueue', 'chart', 'activities', 'insights', 'manufacturing'],
    vocabulary: { productKey: 'industry.vocabulary.piece' },
  },
  watches: {
    capabilities: ['measurement', 'multi_unit'],
    unit: 'piece',
    emphasizedFields: ['unit', 'sellPrice'],
  },
  fabric: {
    capabilities: ['measurement', 'multi_unit'],
    unit: 'meter',
    emphasizedFields: ['unit', 'sellPrice', 'quantity'],
  },
  hardware: {
    capabilities: ['measurement', 'multi_unit'],
    unit: 'kg',
    emphasizedFields: ['unit', 'quantity'],
  },
  buildingMaterials: {
    capabilities: ['measurement', 'multi_unit'],
    unit: 'kg',
    emphasizedFields: ['unit', 'quantity'],
  },
  timber: {
    capabilities: ['measurement', 'multi_unit'],
    unit: 'meter',
    emphasizedFields: ['unit', 'quantity'],
  },
  fuel: {
    capabilities: ['measurement', 'multi_unit'],
    unit: 'liter',
    emphasizedFields: ['unit', 'quantity'],
  },
  spices: {
    capabilities: ['measurement', 'multi_unit'],
    unit: 'gram',
    emphasizedFields: ['unit', 'quantity'],
  },
  grocery: {
    capabilities: ['multi_unit'],
    unit: 'piece',
    emphasizedFields: ['unit', 'quantity'],
  },
  pharmacy: {
    capabilities: ['batch_expiry', 'multi_unit'],
    unit: 'piece',
    emphasizedFields: ['unit', 'sellPrice', 'quantity'],
  },
  clothing: {
    capabilities: ['variants'],
    unit: 'piece',
    emphasizedFields: ['name', 'sellPrice'],
  },
  shoes: {
    capabilities: ['variants'],
    unit: 'piece',
    emphasizedFields: ['name', 'sellPrice'],
  },
  electronics: {
    capabilities: ['serialized_items', 'variants'],
    unit: 'piece',
    emphasizedFields: ['name', 'sellPrice'],
  },
  computers: {
    capabilities: ['serialized_items', 'variants'],
    unit: 'piece',
    emphasizedFields: ['name', 'sellPrice'],
  },
  mobilePhones: {
    capabilities: ['serialized_items', 'variants'],
    unit: 'piece',
    emphasizedFields: ['name', 'sellPrice'],
  },
  computerComponents: {
    capabilities: ['serialized_items', 'variants'],
    unit: 'piece',
    emphasizedFields: ['name', 'sellPrice'],
  },
  autoParts: {
    capabilities: ['auto_fitments'],
    unit: 'piece',
    emphasizedFields: ['name', 'sellPrice'],
  },
  carDealer: {
    capabilities: ['serialized_items', 'auto_fitments'],
    unit: 'piece',
    emphasizedFields: ['name', 'sellPrice'],
  },
  restaurant: {
    capabilities: [],
    unit: 'piece',
    emphasizedFields: ['name', 'sellPrice'],
    dashboard: ['workQueue', 'kpis', 'chart', 'activities', 'insights', 'manufacturing'],
    vocabulary: { productKey: 'industry.vocabulary.dish' },
  },
  cafe: {
    capabilities: [],
    unit: 'piece',
    emphasizedFields: ['name', 'sellPrice'],
    dashboard: ['workQueue', 'kpis', 'chart', 'activities', 'insights', 'manufacturing'],
    vocabulary: { productKey: 'industry.vocabulary.drink' },
  },
  fabricRoll: {
    capabilities: ['measurement', 'multi_unit'],
    unit: 'meter',
    emphasizedFields: ['unit', 'sellPrice', 'quantity'],
  },
  tailoring: {
    capabilities: ['measurement'],
    unit: 'meter',
    emphasizedFields: ['unit', 'quantity'],
  },
  manufacturing: {
    capabilities: ['multi_unit'],
    unit: 'piece',
    emphasizedFields: ['unit', 'quantity'],
    dashboard: ['manufacturing', 'workQueue', 'kpis', 'chart', 'insights', 'activities'],
  },
}

function build(key: IndustryKey): ProfileDefinition {
  const override = OVERRIDES[key]
  if (!override) return { ...GENERIC, key }

  const capabilities = (override.capabilities ?? []).filter((capability) =>
    AVAILABLE_CAPABILITIES.includes(capability),
  )
  const dashboard = override.dashboard ?? GENERIC_DASHBOARD

  return {
    key,
    kind: capabilities.length > 0 || Boolean(override.vocabulary) ? 'specialized' : 'generic',
    capabilities,
    invoiceDefaults: {
      extraVisibleColumns: override.extraVisibleColumns ?? [],
      ...(override.priceMultiplierSource
        ? { priceMultiplierSource: override.priceMultiplierSource }
        : {}),
    },
    productDefaults: {
      unit: override.unit ?? GENERIC_PRODUCT.unit,
      emphasizedFields: override.emphasizedFields ?? [],
    },
    dashboard,
    vocabulary: override.vocabulary ?? {},
  }
}

export const PROFILES: Readonly<Record<IndustryKey, ProfileDefinition>> = Object.fromEntries(
  INDUSTRY_KEYS.map((key) => [key, build(key)]),
) as Readonly<Record<IndustryKey, ProfileDefinition>>

/** Lower-case lookup that tolerates the casing a legacy row may carry. */
const KEY_BY_LOWER = new Map<string, IndustryKey>(
  INDUSTRY_KEYS.map((key) => [key.toLowerCase(), key]),
)

const LEGACY = new Set<string>(LEGACY_INDUSTRY_KEYS)

export interface CanonicalIndustryInput {
  /** Registry-recognised keys, in registry order. */
  readonly known: readonly IndustryKey[]
  /** Legacy values that are recognised but have no specialised profile. */
  readonly legacy: readonly string[]
  /** Values that matched nothing at all. */
  readonly unknown: readonly string[]
}

/**
 * ONE canonicaliser for both stored shapes.
 *
 * The profile row stores `text[]`; the onboarding draft stores the same ids
 * comma-separated. Both arrive here. Empty segments are dropped, duplicates
 * are removed, casing is folded and the result is put in registry order so the
 * output cannot depend on how the values were typed.
 */
export function canonicalIndustryTypes(
  input: readonly string[] | string | null | undefined,
): CanonicalIndustryInput {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : []

  const known = new Set<IndustryKey>()
  const legacy = new Set<string>()
  const unknown = new Set<string>()

  for (const segment of raw) {
    if (typeof segment !== 'string') continue
    const value = segment.trim()
    if (!value) continue
    const canonical = KEY_BY_LOWER.get(value.toLowerCase())
    if (canonical) known.add(canonical)
    else if (LEGACY.has(value.toLowerCase())) legacy.add(value.toLowerCase())
    else unknown.add(value.toLowerCase())
  }

  const ordered = INDUSTRY_KEYS.filter((key) => known.has(key))

  return {
    known: ordered,
    legacy: [...legacy].sort(),
    unknown: [...unknown].sort(),
  }
}

export const operatingCharacteristicsSchema = z
  .object({
    holdsStock: z.enum(['yes', 'no', 'unknown']).default('unknown'),
    locations: z.enum(['single', 'multiple', 'unknown']).default('unknown'),
    producesGoods: z.enum(['yes', 'no', 'unknown']).default('unknown'),
    sellsOnCredit: z.enum(['yes', 'no', 'unknown']).default('unknown'),
    hasPointOfSale: z.enum(['yes', 'no', 'unknown']).default('unknown'),
    hasStaff: z.enum(['yes', 'no', 'unknown']).default('unknown'),
  })
  .strict()
  .refine((data) => !(data.holdsStock === 'no' && data.producesGoods === 'yes'), {
    message: 'CANNOT_PRODUCE_WITHOUT_STOCK',
    path: ['producesGoods'],
  })

export type OperatingCharacteristics = z.infer<typeof operatingCharacteristicsSchema>

export const DEFAULT_OPERATING_CHARACTERISTICS: OperatingCharacteristics = {
  holdsStock: 'unknown',
  locations: 'unknown',
  producesGoods: 'unknown',
  sellsOnCredit: 'unknown',
  hasPointOfSale: 'unknown',
  hasStaff: 'unknown',
}

export interface BusinessProfile {
  /** Null only when nothing recognisable was selected. */
  readonly primary: IndustryKey | null
  readonly primaryDefinition: ProfileDefinition
  /** Union of AVAILABLE capabilities, in registry order. */
  readonly capabilities: readonly CapabilityKey[]
  readonly invoiceDefaults: InvoiceDefaults
  readonly productDefaults: ProductDefaults
  readonly dashboard: readonly DashboardPartId[]
  readonly vocabulary: Vocabulary
  readonly unknownTypes: readonly string[]
  readonly legacyTypes: readonly string[]
  readonly isGeneric: boolean
  readonly characteristics: OperatingCharacteristics
  readonly recommendedModules: readonly string[]
  readonly inventoryRelevant: boolean | 'unknown'
  readonly notes: readonly string[]
  readonly unsupported: readonly CapabilityKey[]
}

function dashboardUnion(definitions: readonly ProfileDefinition[]): DashboardPartId[] {
  const chosen = new Set<DashboardPartId>()
  const ordered: DashboardPartId[] = []
  for (const definition of definitions) {
    for (const part of definition.dashboard) {
      if (chosen.has(part)) continue
      chosen.add(part)
      ordered.push(part)
    }
  }
  // A profile may name a subset. Every remaining part is appended in the
  // generic order so no capability disappears because of an omission.
  for (const part of GENERIC_DASHBOARD) {
    if (!chosen.has(part)) {
      chosen.add(part)
      ordered.push(part)
    }
  }
  return ordered
}

/**
 * DERIVE the profile. Pure, deterministic and free of I/O.
 *
 * PRIMARY RULE (ADR — docs/architecture/industry/ADR-001-primary-industry.md):
 *   1. If the caller passes an explicit primary, it wins.
 *   2. Otherwise the first selected TRADE in registry order is primary.
 *   3. If only sales models were selected, the first model is primary.
 *   4. Nothing recognisable → the generic profile (primary null).
 *
 * Insertion order is deliberately ignored. Two users who selected the same
 * trades must get the same experience, however they clicked them.
 */
export function resolveBusinessProfile(
  types: readonly string[] | string | null | undefined,
  explicitPrimary?: string | null,
  characteristics?: Partial<OperatingCharacteristics> | null,
): BusinessProfile {
  const canonical = canonicalIndustryTypes(types)
  const explicit = explicitPrimary ? canonicalIndustryTypes([explicitPrimary]).known[0] : undefined

  const tradeKeys = canonical.known.filter((key) => !SALES_MODEL_KEYS.includes(key))
  const primary = explicit ?? tradeKeys[0] ?? canonical.known[0] ?? null

  const selectedDefinitions = canonical.known.map((key) => PROFILES[key])
  const primaryDefinition = primary
    ? PROFILES[primary]
    : { ...GENERIC, key: 'other' as IndustryKey }

  const capabilitySet = new Set<CapabilityKey>()
  for (const definition of selectedDefinitions) {
    for (const capability of definition.capabilities) {
      if (CAPABILITIES[capability].status === 'available') capabilitySet.add(capability)
    }
  }
  const capabilities = CAPABILITY_KEYS.filter((key) => capabilitySet.has(key))

  const extraVisibleColumns = [
    ...new Set(selectedDefinitions.flatMap((d) => d.invoiceDefaults.extraVisibleColumns)),
  ]
  const multiplier = selectedDefinitions.find(
    (definition) => definition.invoiceDefaults.priceMultiplierSource !== undefined,
  )

  const parsedChars: OperatingCharacteristics = characteristics
    ? (operatingCharacteristicsSchema.safeParse(characteristics).data ??
      DEFAULT_OPERATING_CHARACTERISTICS)
    : DEFAULT_OPERATING_CHARACTERISTICS

  const inventoryRelevant: boolean | 'unknown' =
    parsedChars.holdsStock === 'no'
      ? false
      : parsedChars.holdsStock === 'yes'
        ? true
        : primaryDefinition.productDefaults.unit === 'service'
          ? false
          : 'unknown'

  // Derive recommended modules in deterministic priority order
  const recommendedModules: string[] = ['today', 'sell']
  if (inventoryRelevant !== false) {
    recommendedModules.push('stock')
  }
  if (parsedChars.hasPointOfSale === 'yes') {
    recommendedModules.push('till')
  }
  recommendedModules.push('get-paid', 'buyers', 'money')
  if (parsedChars.producesGoods === 'yes') {
    recommendedModules.push('production')
  }
  if (parsedChars.hasStaff === 'yes') {
    recommendedModules.push('coworkers')
  }
  recommendedModules.push('settings')

  // Derive unsupported capabilities that chosen profiles want but registry marks planned
  const allNeededCapabilities = new Set<CapabilityKey>()
  for (const def of selectedDefinitions) {
    for (const cap of def.capabilities) {
      allNeededCapabilities.add(cap)
    }
  }
  const unsupported = CAPABILITY_KEYS.filter(
    (key) => allNeededCapabilities.has(key) && CAPABILITIES[key].status === 'planned',
  )

  const notes: string[] = []
  if (
    canonical.known.length > 0 &&
    (primaryDefinition.kind === 'generic' || canonical.known.length === 0)
  ) {
    notes.push('industry.supportNote.generic')
  }

  return {
    primary,
    primaryDefinition,
    capabilities,
    invoiceDefaults: {
      extraVisibleColumns,
      ...(multiplier?.invoiceDefaults.priceMultiplierSource
        ? { priceMultiplierSource: multiplier.invoiceDefaults.priceMultiplierSource }
        : {}),
    },
    productDefaults: primaryDefinition.productDefaults,
    dashboard: dashboardUnion(selectedDefinitions),
    vocabulary: primaryDefinition.vocabulary,
    unknownTypes: canonical.unknown,
    legacyTypes: canonical.legacy,
    isGeneric: canonical.known.length === 0 || primaryDefinition.kind === 'generic',
    characteristics: parsedChars,
    recommendedModules,
    inventoryRelevant,
    notes,
    unsupported,
  }
}

/** Everything an onboarding screen needs, without a second catalogue. */
export function industryKeysWithProfiles(): readonly IndustryKey[] {
  return INDUSTRY_KEYS
}
