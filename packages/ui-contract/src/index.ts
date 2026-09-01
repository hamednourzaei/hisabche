// ============================================
// @hisabche/ui-contract — the semantic layer between canonical tokens and
// platform components.
//
//   CANONICAL TOKENS  ->  SEMANTIC CONTRACT  ->  PLATFORM ADAPTER  ->  COMPONENT
//
// Rules this package holds itself to, enforced by src/__tests__:
//   * no colour literals — roles reference canonical token keys, never values
//   * no React, React Native, DOM, Electron or browser globals
//   * no runtime behaviour beyond pure lookups over static data
// ============================================

export {
  SEMANTIC_COLORS,
  SEMANTIC_COLOR_ROLES,
  resolveColor,
  isThemeDependent,
  type SemanticColor,
  type TextRole,
  type SurfaceRole,
  type BorderRole,
  type InteractiveRole,
  type StatusRole,
  type ColorSource,
} from './color-roles'

export {
  EVENT_STORES,
  EVENT_MODEL,
  SEPARATE_BY_DESIGN,
  SINGLE_IMPLEMENTATION,
  isSeparateByDesign,
  type EventStore,
  type EventStoreSpec,
} from './consolidation'

export {
  SUGGESTION_KINDS,
  FORBIDDEN_DECISIONS,
  isPresentable,
  mayAutoApply,
  mayDecide,
  gate,
  type Suggestion,
  type SuggestionKind,
  type ForbiddenDecision,
  type Confidence,
  type IntelligenceRefusal,
} from './intelligence'

export {
  DOMAINS,
  DOMAIN_SPECS,
  breadcrumbsFor,
  domainFor,
  domainOf,
  domainDestinations,
  type Crumb,
  type DomainId,
  type DomainSpec,
} from './shell'

export {
  DENSITIES,
  FILTER_OPERATORS,
  PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  initialListState,
  listReducer,
  toQuery,
  pageCount,
  isPageOutOfRange,
  toSavedView,
  applySavedView,
  isFiltered,
  type ListState,
  type ListAction,
  type ListQuery,
  type FilterClause,
  type FilterOperator,
  type SortDirection,
  type Density,
  type SavedView,
} from './list-engine'

export {
  VIEW_KINDS,
  ENTITY_KINDS,
  ENTITY_VIEWS,
  DETAIL_SECTIONS,
  ENTITY_SECTIONS,
  viewsFor,
  hasView,
  sectionsFor,
  sectionRequiresCapability,
  visibleSections,
  type ViewKind,
  type EntityKind,
  type DetailSection,
} from './entity-views'

export {
  WORK_ITEMS,
  WORK_ITEM_KINDS,
  buildWorkQueue,
  hasWork,
  mostPressing,
  urgencyRank,
  type WorkItem,
  type WorkItemKind,
  type WorkItemSpec,
  type WorkItemUrgency,
  type WorkCounts,
} from './work-queue'

export {
  WORK_STATES,
  WORK_STATE_PRESENTATION,
  resolveWorkState,
  describeWorkState,
  isWorthShowing,
  statePrecedence,
  type WorkState,
  type WorkStateInput,
  type WorkStateTone,
  type WorkStatePresentation,
  type WorkStateMessage,
  type Announcement,
} from './work-state'

export {
  A11Y_CONTRACT,
  type A11yContract,
  type InteractionState,
  type DataState,
  type SubmitState,
  type SyncState,
} from './state'

export {
  TONE_FOREGROUND,
  MOBILE_TONE_ALIAS,
  DESKTOP_TONE_ALIAS,
  MOBILE_TEXT_TONE_ROLE,
  BUTTON_VARIANTS,
  DIALOG_SURFACE,
  type Tone,
  type MobileBadgeTone,
  type DesktopBadgeTone,
  type MobileTextTone,
  type ButtonVariant,
  type ButtonSize,
  type ButtonContract,
  type DialogRole,
} from './component'

export {
  presetRange,
  COMPACT_PRESETS,
  type DateRange,
  type PresetKey,
  type PresetDefinition,
} from './date-range'

export {
  buildInvoiceShareUrl,
  buildInvoiceShareMessage,
  urlLangFromLocale,
  type InvoiceShareSummary,
} from './share-links'

export {
  INVOICE_EXPORT_COLUMNS,
  CUSTOMER_EXPORT_COLUMNS,
  customerDebtLabel,
  invoiceTypeLabelKey,
  resolveExportColumns,
  type ExportColumn,
} from './export-columns'

export {
  NAV_CONTRACT,
  PRIMARY_CONTRACT,
  MORE_GROUPS_CONTRACT,
  MOBILE_TAB_IDS,
  MOBILE_OVERFLOW_PRIMARY,
  COMMAND_CONTRACT,
  SYNC_INTERVAL_MS,
  type NavId,
  type NavGroupId,
  type NavItemContract,
  type NavGroupContract,
  type CommandItemContract,
  visibleNavItems,
  visibleNavGroups,
  splitForBudget,
} from './navigation'

export {
  emptySelection,
  isSelected,
  selectionCount,
  toggleId,
  toggleAll,
  pruneSelection,
  areAllSelected,
  areSomeSelected,
  type SelectionState,
} from './selection'

// ---------- Onboarding: business types ----------
export {
  BUSINESS_MODELS,
  BUSINESS_TYPES,
  BUSINESS_TYPE_OTHER,
  filterBusinessTypes,
  type BusinessTypeOption,
} from './business-types'

// ---------- Onboarding: currencies and metals ----------
export { BILLING_CURRENCY, CURRENCIES, primaryCurrencies, type CurrencyOption } from './currencies'

// ---------- Adaptive runtime: what the client may spend ----------
//
// A device class decides page sizes, prefetching and how much is rendered at
// once. It NEVER decides a permission or a financial figure — see
// `assertPolicyIsPresentationOnly`, which the test suite enforces.
export {
  FINANCIAL_OR_SECURITY_KEYS,
  applyPerformanceMode,
  assertPolicyIsPresentationOnly,
  classifyDevice,
  runtimePolicy,
  sessionCost,
  type DeviceClass,
  type DeviceSignals,
  type NetworkQuality,
  type PerformanceMode,
  type Platform,
  type RuntimePolicy,
} from './runtime-policy'
