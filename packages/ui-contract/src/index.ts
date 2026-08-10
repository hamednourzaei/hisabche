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

export { buildInvoiceShareUrl, urlLangFromLocale } from './share-links'

export {
  INVOICE_EXPORT_COLUMNS,
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
