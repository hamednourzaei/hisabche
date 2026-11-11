// ============================================
// packages/validation/src/schemas/business-problems.ts
//
// V60 Slice 4 — Problem Profile (P1–P10) and deterministic composition pipeline:
//   answers -> inferOperationalDna -> problemsOf(dna) -> requirementsOf(dna)
//   -> resolveCapabilityPlan(...) -> resolvePresentationProfile(dna)
//   -> CompositionPlan
//
// Pure functions only. Zero I/O, zero fake capabilities, zero retail fallback.
// ============================================

import {
  CAPABILITIES,
  CAPABILITY_KEYS,
  resolveCapabilityPlan,
  type CapabilityKey,
  type CapabilityStatus,
  type UnifiedCapabilityPlan,
} from './business-capabilities'
import {
  effectiveDnaAxes,
  inferOperationalDna,
  operatingQuestionsFor,
  resolvePresentationProfile,
  setupGapsOf,
  type DnaSetupGap,
  type OperatingAnswers,
  type OperatingQuestion,
  type OperationalDna,
  type OperationalInferenceInput,
  type PresentationProfile,
} from './operational-dna'

export const BUSINESS_PROBLEMS = [
  'P1_customer_revenue_visibility',
  'P2_pricing_and_true_cost',
  'P3_order_queue_and_capacity',
  'P4_stock_and_resource_location',
  'P5_procurement',
  'P6_workforce_productivity',
  'P7_cash_debt_settlement',
  'P8_true_profit',
  'P9_quality_warranty_obligations',
  'P10_owner_control',
] as const

export type BusinessProblem = (typeof BUSINESS_PROBLEMS)[number]

export type ProblemApplicability = 'applies' | 'not_applicable' | 'unknown'

export interface ProblemRule {
  readonly problem: BusinessProblem
  readonly appliesWhen: (dna: OperationalDna) => boolean | 'unknown'
  readonly needs: (dna: OperationalDna) => readonly CapabilityKey[]
  readonly reasonKeys: (dna: OperationalDna) => readonly string[]
  readonly unknownQuestions?: readonly OperatingQuestion[]
}

export interface ProblemMatch {
  readonly problem: BusinessProblem
  readonly status: ProblemApplicability
  readonly reasons: readonly string[]
  readonly followUpQuestions: readonly OperatingQuestion[]
}

export interface ProblemRequirement {
  readonly capability: CapabilityKey
  readonly reasons: readonly string[]
  readonly problems: readonly BusinessProblem[]
}

export type ComposedRequirementStatus = CapabilityStatus | 'unsupported'

export interface RequirementStatusEntry {
  readonly capability: CapabilityKey
  readonly status: ComposedRequirementStatus
  readonly limitations: readonly string[]
  readonly problems: readonly BusinessProblem[]
  readonly reasons: readonly string[]
}

export interface CompositionPlan {
  readonly dna: OperationalDna
  readonly problems: readonly ProblemMatch[]
  readonly requirements: readonly ProblemRequirement[]
  readonly plan: UnifiedCapabilityPlan & {
    readonly statuses: readonly RequirementStatusEntry[]
  }
  readonly gaps: readonly DnaSetupGap[]
  readonly nextQuestions: readonly OperatingQuestion[]
  readonly presentation: PresentationProfile
}

const hasPhysicalStock = (dna: OperationalDna): boolean =>
  dna.inventory.some((item) => item !== 'NONE' && item !== 'UNRESOLVED')

const needsQueueOrCapacity = (dna: OperationalDna): boolean =>
  dna.intake.some(
    (item) =>
      item === 'APPOINTMENT_BOOKING' ||
      item === 'CLASS_ATTENDANCE' ||
      item === 'JOB_TICKET' ||
      item === 'PROJECT_DELIVERY',
  ) || dna.assetCustody === 'RENTED_OUT_ASSET'

export const PROBLEM_RULES: Readonly<Record<BusinessProblem, ProblemRule>> = {
  P1_customer_revenue_visibility: {
    problem: 'P1_customer_revenue_visibility',
    appliesWhen: () => true,
    needs: (dna) => {
      const reqs: CapabilityKey[] = []
      if (dna.settlement.includes('DEPOSIT_PREPAYMENT')) reqs.push('deposits_liability')
      if (dna.settlement.includes('INSTALLMENT_RECEIVABLES')) reqs.push('installments')
      if (dna.settlement.includes('PACKAGE_CREDITS')) reqs.push('package_credits')
      return reqs
    },
    reasonKeys: () => ['P1:every_business_tracks_parties_and_revenue'],
  },

  P2_pricing_and_true_cost: {
    problem: 'P2_pricing_and_true_cost',
    appliesWhen: (dna) => {
      const axes = effectiveDnaAxes(dna)
      if (dna.offering.includes('UNRESOLVED') && axes.pricingBasis.includes('UNRESOLVED')) {
        return 'unknown'
      }
      return true
    },
    needs: (dna) => {
      const reqs: CapabilityKey[] = []
      const pricing = dna.pricingBasis ?? []
      if (dna.offering.includes('PHYSICAL_GOODS') || dna.offering.includes('MIXED_OFFERING')) {
        reqs.push('measurement', 'multi_unit')
      }
      if (pricing.includes('WEIGHT')) reqs.push('weight_pricing')
      if (pricing.includes('LENGTH')) reqs.push('length_pricing')
      if (pricing.includes('AREA')) reqs.push('area_pricing')
      if (pricing.includes('VOLUME')) reqs.push('volume_pricing')
      if (pricing.includes('TIERED')) reqs.push('tiered_pricing')
      if (dna.inventory.includes('RAW_MATERIALS')) reqs.push('recipe_bom')
      return reqs
    },
    reasonKeys: (dna) => {
      const reasons: string[] = []
      for (const basis of dna.pricingBasis ?? []) {
        if (basis !== 'UNRESOLVED') reasons.push(`P2:pricingBasis=${basis}`)
      }
      if (dna.inventory.includes('RAW_MATERIALS')) reasons.push('P2:inventory=RAW_MATERIALS')
      if (reasons.length === 0) reasons.push('P2:standard_line_pricing')
      return reasons
    },
    unknownQuestions: ['holdsStock', 'producesGoods'],
  },

  P3_order_queue_and_capacity: {
    problem: 'P3_order_queue_and_capacity',
    appliesWhen: (dna) => {
      if (needsQueueOrCapacity(dna)) return true
      if (dna.offering.includes('UNRESOLVED') && !dna.assetCustody) return 'unknown'
      return false
    },
    needs: (dna) => {
      const reqs: CapabilityKey[] = []
      if (dna.intake.includes('APPOINTMENT_BOOKING') || dna.intake.includes('CLASS_ATTENDANCE')) {
        reqs.push('resource_capacity')
      }
      if (dna.intake.includes('JOB_TICKET') || dna.assetCustody === 'CUSTOMER_ASSET_IN_CUSTODY') {
        reqs.push('work_queue_sla')
      }
      if (dna.intake.includes('PROJECT_DELIVERY')) {
        reqs.push('project_costing', 'timesheet_billing')
      }
      if (dna.assetCustody === 'RENTED_OUT_ASSET') {
        reqs.push('asset_rental', 'resource_capacity')
      }
      if (dna.settlement.includes('PACKAGE_CREDITS')) {
        reqs.push('package_credits')
      }
      return reqs
    },
    reasonKeys: (dna) => {
      const reasons = dna.intake.map((mode) => `P3:intake=${mode}`)
      if (dna.assetCustody === 'RENTED_OUT_ASSET') reasons.push('P3:assetCustody=RENTED_OUT_ASSET')
      return reasons
    },
    unknownQuestions: ['takesAppointments', 'takesJobTicketsOrRepairs', 'rentsOutAssets'],
  },

  P4_stock_and_resource_location: {
    problem: 'P4_stock_and_resource_location',
    appliesWhen: (dna) => {
      if (dna.inventory.includes('UNRESOLVED')) return 'unknown'
      return (
        hasPhysicalStock(dna) ||
        dna.topology.includes('MULTI_BRANCH') ||
        dna.topology.includes('WAREHOUSE_NETWORK') ||
        dna.executionSite === 'CUSTOMER_SITE' ||
        dna.executionSite === 'MOBILE_ROUTE'
      )
    },
    needs: (dna) => {
      const reqs: CapabilityKey[] = []
      if (hasPhysicalStock(dna)) {
        reqs.push('variants')
      }
      if (
        dna.unitTracking === 'SERIAL_NUMBERS' ||
        dna.unitTracking === 'BOTH' ||
        dna.assetCustody === 'CUSTOMER_ASSET_IN_CUSTODY'
      ) {
        reqs.push('serialized_items')
      }
      if (
        dna.unitTracking === 'EXPIRY_DATES' ||
        dna.unitTracking === 'BOTH' ||
        dna.inventory.includes('RAW_MATERIALS')
      ) {
        reqs.push('batch_expiry')
      }
      if (dna.executionSite === 'CUSTOMER_SITE') {
        reqs.push('delivery_pod')
      } else if (dna.executionSite === 'MOBILE_ROUTE') {
        reqs.push('delivery_pod', 'fleet_dispatch')
      }
      return reqs
    },
    reasonKeys: (dna) => [
      ...dna.inventory.map((inv) => `P4:inventory=${inv}`),
      ...(dna.executionSite && dna.executionSite !== 'UNRESOLVED'
        ? [`P4:executionSite=${dna.executionSite}`]
        : []),
    ],
    unknownQuestions: ['holdsStock', 'tracksSerials', 'hasExpiryDates', 'worksAtCustomerSite'],
  },

  P5_procurement: {
    problem: 'P5_procurement',
    appliesWhen: (dna) => {
      if (dna.inventory.includes('UNRESOLVED')) return 'unknown'
      return (
        dna.inventory.includes('RETAIL_STOCK') ||
        dna.inventory.includes('SPARE_PARTS') ||
        dna.inventory.includes('RAW_MATERIALS') ||
        dna.inventory.includes('FINISHED_GOODS') ||
        dna.inventory.includes('SERVICE_CONSUMABLES') ||
        dna.inventory.includes('HYBRID_INVENTORY')
      )
    },
    needs: (dna) => (hasPhysicalStock(dna) ? ['procurement_planning', 'three_way_match'] : []),
    reasonKeys: (dna) => dna.inventory.map((inv) => `P5:inventory=${inv}`),
    unknownQuestions: ['holdsStock'],
  },

  P6_workforce_productivity: {
    problem: 'P6_workforce_productivity',
    appliesWhen: (dna) => {
      if (dna.workforce.includes('UNRESOLVED')) return 'unknown'
      return !dna.workforce.every((w) => w === 'SOLO_OWNER')
    },
    needs: (dna) =>
      dna.workforce.includes('HOURLY_STAFF') || dna.intake.includes('PROJECT_DELIVERY')
        ? ['timesheet_billing']
        : [],
    reasonKeys: (dna) => dna.workforce.map((w) => `P6:workforce=${w}`),
    unknownQuestions: ['hasStaff', 'staffArrangement'],
  },

  P7_cash_debt_settlement: {
    problem: 'P7_cash_debt_settlement',
    appliesWhen: (dna) => {
      if (dna.offering.includes('UNRESOLVED') && !dna.recurrence) return 'unknown'
      return true
    },
    needs: (dna) => {
      const reqs: CapabilityKey[] = []
      if (dna.settlement.includes('DEPOSIT_PREPAYMENT')) reqs.push('deposits_liability')
      if (dna.settlement.includes('INSTALLMENT_RECEIVABLES')) reqs.push('installments')
      if (dna.settlement.includes('PACKAGE_CREDITS')) reqs.push('package_credits')
      if (
        dna.recurrence === 'RECURRING_SERVICE' ||
        dna.recurrence === 'SUBSCRIPTION' ||
        dna.recurrence === 'LEASE'
      ) {
        reqs.push('contracts_recurring')
      }
      return reqs
    },
    reasonKeys: (dna) => [
      ...dna.settlement.map((s) => `P7:settlement=${s}`),
      ...(dna.recurrence && dna.recurrence !== 'UNRESOLVED'
        ? [`P7:recurrence=${dna.recurrence}`]
        : []),
    ],
    unknownQuestions: ['sellsOnCredit', 'billsRecurring'],
  },

  P8_true_profit: {
    problem: 'P8_true_profit',
    appliesWhen: () => true,
    needs: () => ['cost_allocation'],
    reasonKeys: () => ['P8:gross_and_net_profit_by_cost_object'],
  },

  P9_quality_warranty_obligations: {
    problem: 'P9_quality_warranty_obligations',
    appliesWhen: (dna) => {
      if (
        dna.unitTracking === 'SERIAL_NUMBERS' ||
        dna.unitTracking === 'EXPIRY_DATES' ||
        dna.unitTracking === 'BOTH' ||
        dna.assetCustody === 'CUSTOMER_ASSET_IN_CUSTODY' ||
        dna.inventory.includes('RAW_MATERIALS') ||
        (dna.regulatedDomain !== undefined &&
          dna.regulatedDomain !== 'NONE' &&
          dna.regulatedDomain !== 'UNRESOLVED')
      ) {
        return true
      }
      if (dna.offering.includes('UNRESOLVED') || dna.regulatedDomain === 'UNRESOLVED') {
        return 'unknown'
      }
      return false
    },
    needs: (dna) => {
      const reqs: CapabilityKey[] = []
      if (dna.inventory.includes('RAW_MATERIALS') || dna.regulatedDomain === 'FOOD_SAFETY') {
        reqs.push('quality_inspection')
      }
      if (
        dna.unitTracking === 'SERIAL_NUMBERS' ||
        dna.unitTracking === 'BOTH' ||
        dna.assetCustody === 'CUSTOMER_ASSET_IN_CUSTODY'
      ) {
        reqs.push('warranty_claims')
      }
      // regulatedDomain creates compliance gaps in setupGapsOf, NEVER medical/KYC capabilities.
      return reqs
    },
    reasonKeys: (dna) => {
      const reasons: string[] = []
      if (dna.assetCustody === 'CUSTOMER_ASSET_IN_CUSTODY')
        reasons.push('P9:custody=CUSTOMER_ASSET')
      if (dna.regulatedDomain && dna.regulatedDomain !== 'NONE') {
        reasons.push(`P9:regulatedDomain=${dna.regulatedDomain}`)
      }
      if (dna.inventory.includes('RAW_MATERIALS')) reasons.push('P9:inventory=RAW_MATERIALS')
      if (dna.unitTracking && dna.unitTracking !== 'NONE') {
        reasons.push(`P9:unitTracking=${dna.unitTracking}`)
      }
      return reasons
    },
    unknownQuestions: ['tracksSerials', 'hasExpiryDates', 'holdsCustomerAssets'],
  },

  P10_owner_control: {
    problem: 'P10_owner_control',
    appliesWhen: (dna) => {
      if (dna.approvalDepth === 'UNRESOLVED') return 'unknown'
      return true
    },
    needs: (dna) => {
      const reqs: CapabilityKey[] = ['owner_forecast']
      if (dna.approvalDepth === 'SINGLE' || dna.approvalDepth === 'MULTI_STEP') {
        reqs.push('approval_workflow')
      }
      return reqs
    },
    reasonKeys: (dna) => [
      'P10:owner_cash_and_risk_visibility',
      ...(dna.approvalDepth && dna.approvalDepth !== 'NONE' && dna.approvalDepth !== 'UNRESOLVED'
        ? [`P10:approvalDepth=${dna.approvalDepth}`]
        : []),
    ],
    unknownQuestions: ['needsApprovals'],
  },
}

/** Step 2: Map Operational DNA deterministically into P1–P10 applicability. */
export function problemsOf(dna: OperationalDna): readonly ProblemMatch[] {
  return BUSINESS_PROBLEMS.map((problem) => {
    const rule = PROBLEM_RULES[problem]
    const raw = rule.appliesWhen(dna)
    const status: ProblemApplicability =
      raw === true ? 'applies' : raw === false ? 'not_applicable' : 'unknown'
    return {
      problem,
      status,
      reasons: status === 'not_applicable' ? [] : rule.reasonKeys(dna),
      followUpQuestions: status === 'unknown' ? (rule.unknownQuestions ?? []) : [],
    }
  })
}

/** Step 3: Derive deduplicated capability requirements + reasons from applicable problems. */
export function requirementsOf(
  dna: OperationalDna,
  problems: readonly ProblemMatch[] = problemsOf(dna),
): readonly ProblemRequirement[] {
  const byCapability = new Map<
    CapabilityKey,
    { reasons: Set<string>; problems: Set<BusinessProblem> }
  >()

  for (const match of problems) {
    if (match.status !== 'applies') continue
    const rule = PROBLEM_RULES[match.problem]
    const needed = rule.needs(dna)
    for (const cap of needed) {
      const bucket = byCapability.get(cap) ?? { reasons: new Set(), problems: new Set() }
      bucket.problems.add(match.problem)
      for (const reason of match.reasons) bucket.reasons.add(reason)
      byCapability.set(cap, bucket)
    }
  }

  return CAPABILITY_KEYS.filter((key) => byCapability.has(key)).map((capability) => {
    const bucket = byCapability.get(capability)!
    return {
      capability,
      reasons: [...bucket.reasons],
      problems: BUSINESS_PROBLEMS.filter((p) => bucket.problems.has(p)),
    }
  })
}

function answersFromDnaForQuestions(
  dna: OperationalDna,
  sourceInput?: OperationalInferenceInput,
): OperatingAnswers {
  if (sourceInput) {
    return {
      takesAppointments: sourceInput.takesAppointments,
      deliversCoursesOrPackages: sourceInput.deliversCoursesOrPackages,
      takesJobTicketsOrRepairs: sourceInput.takesJobTicketsOrRepairs,
      holdsStock: sourceInput.holdsStock,
      producesGoods: sourceInput.producesGoods,
      hasPointOfSale: sourceInput.hasPointOfSale,
      tracksSerials: sourceInput.tracksSerials,
      hasExpiryDates: sourceInput.hasExpiryDates,
      holdsCustomerAssets: sourceInput.holdsCustomerAssets,
      rentsOutAssets: sourceInput.rentsOutAssets,
      worksAtCustomerSite: sourceInput.worksAtCustomerSite,
      sellsOnCredit: sourceInput.sellsOnCredit,
      billsRecurring: sourceInput.billsRecurring,
      hasStaff: sourceInput.hasStaff,
      staffArrangement: sourceInput.staffArrangement,
      needsApprovals: sourceInput.needsApprovals,
      locations: sourceInput.locations,
    }
  }
  return {
    holdsStock: dna.inventory.includes('UNRESOLVED')
      ? 'unknown'
      : dna.inventory.every((i) => i === 'NONE')
        ? 'no'
        : 'yes',
    takesAppointments: dna.intake.includes('APPOINTMENT_BOOKING') ? 'yes' : 'unknown',
    takesJobTicketsOrRepairs: dna.intake.includes('JOB_TICKET') ? 'yes' : 'unknown',
    hasStaff: dna.workforce.includes('SOLO_OWNER')
      ? 'no'
      : dna.workforce.includes('UNRESOLVED')
        ? 'unknown'
        : 'yes',
  }
}

/**
 * Full deterministic composition pipeline (Steps 1–6):
 *   answers -> DNA -> P1–P10 problems -> requirements -> resolveCapabilityPlan
 *   -> presentation (planned/unsupported stripped) + setup gaps + nextQuestions
 */
export function composeBusinessSolution(
  input: OperationalInferenceInput | OperationalDna,
  tradeKey?: string | null,
): CompositionPlan {
  const isDna = 'version' in input && Array.isArray(input.offering)
  const rawInput = isDna ? undefined : input
  const dna = isDna ? input : inferOperationalDna({ ...input, ...(tradeKey ? { tradeKey } : {}) })

  const problems = problemsOf(dna)
  const requirements = requirementsOf(dna, problems)
  const requestedKeys = requirements.map((r) => r.capability)

  // Step 4: Delegate capability + module resolution to the ONE resolver.
  const basePlan = resolveCapabilityPlan(
    {
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
    },
    requestedKeys,
  )

  const usableSet = new Set<CapabilityKey>(basePlan.capabilities.capabilities)
  const rejectedSet = new Set<CapabilityKey>(basePlan.capabilities.rejected)

  const statuses: RequirementStatusEntry[] = requirements.map((req) => {
    const def = CAPABILITIES[req.capability]
    const status: ComposedRequirementStatus =
      def.status === 'planned'
        ? 'planned'
        : rejectedSet.has(req.capability)
          ? 'unsupported'
          : def.status
    return {
      capability: req.capability,
      status,
      limitations: def.limitations,
      problems: req.problems,
      reasons: req.reasons,
    }
  })

  // Step 5: Presentation derived from usable capabilities only (never planned/unsupported).
  const inferredTradeKey = rawInput && 'tradeKey' in rawInput ? rawInput.tradeKey : undefined
  const rawPresentation = resolvePresentationProfile(dna, tradeKey ?? inferredTradeKey)
  const plannedOrUnsupported = new Set<CapabilityKey>(
    CAPABILITY_KEYS.filter((k) => CAPABILITIES[k].status === 'planned' || !usableSet.has(k)),
  )
  const presentation: PresentationProfile = {
    ...rawPresentation,
    navigation: {
      ...rawPresentation.navigation,
      pinnedPaths: rawPresentation.navigation.pinnedPaths.filter(
        (p) =>
          !(
            (plannedOrUnsupported.has('room_nights') && p.includes('/hotel')) ||
            (plannedOrUnsupported.has('livestock_register') && p.includes('/livestock')) ||
            (plannedOrUnsupported.has('table_service') && p.includes('/tables'))
          ),
      ),
    },
    quickActions: rawPresentation.quickActions.filter(
      (action) => !plannedOrUnsupported.has(action as CapabilityKey),
    ),
  }

  const gaps = setupGapsOf(dna)
  const adaptive = operatingQuestionsFor(answersFromDnaForQuestions(dna, rawInput))
  const unknownFollowUps = problems.flatMap((p) => p.followUpQuestions)
  const seen = new Set<OperatingQuestion>()
  const nextQuestions: OperatingQuestion[] = []
  for (const q of [...unknownFollowUps, ...adaptive]) {
    if (seen.has(q)) continue
    seen.add(q)
    nextQuestions.push(q)
  }

  return {
    dna,
    problems,
    requirements,
    plan: {
      ...basePlan,
      statuses,
    },
    gaps,
    nextQuestions,
    presentation,
  }
}
