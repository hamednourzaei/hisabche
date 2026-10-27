// ============================================
// packages/ui/src/__tests__/no-new-ui-primitives.test.ts
//
// UI Architecture Guard:
// 1. Closed snapshot of files directly under `packages/ui/src/components/ui/`.
//    No new top-level UI primitive may be added without review.
// 2. Prohibits raw `<table`, `<select`, `<dialog`, or fixed overlays in section components.
//    All UI must reuse approved components: `DataTable`, `SelectField`, `Dialog`.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const UI_COMPONENTS_DIR = join(__dirname, '..', 'components', 'ui')

const APPROVED_TOP_LEVEL_PRIMITIVES = [
  'accordion.tsx',
  'add-product-modal.tsx',
  'alert-dialog.tsx',
  'badge.tsx',
  'bento-stats.tsx',
  'book-currency-sync.tsx',
  'brand-mark.tsx',
  'breadcrumb.tsx',
  'button.tsx',
  'button-classes.ts',
  'card.tsx',
  'celebration.tsx',
  'chart.tsx',
  'checkbox.tsx',
  'cloud-required-notice.tsx',
  'command.tsx',
  'command-palette.tsx',
  'customer-picker.tsx',
  'custom-fields-panel.tsx',
  'dashboard-header.tsx',
  'dashboard-sidebar.tsx',
  'dialog.tsx',
  'dropdown-menu.tsx',
  'empty-state.tsx',
  'entity-notes.tsx',
  'error-boundary.tsx',
  'fab.tsx',
  'focus-ring.ts',
  'global-page-customizer.tsx',
  'global-search.tsx',
  'hub-branch.tsx',
  'hub-tabs.tsx',
  'input.tsx',
  'invite-modal.tsx',
  'jalali-datepicker.tsx',
  'kpi-card.tsx',
  'label.tsx',
  'landing-preview.tsx',
  'landing-section.tsx',
  'living-background.tsx',
  'loading-screen.tsx',
  'Modal.tsx',
  'money-input.tsx',
  'no-access-notice.tsx',
  'notification-bell.tsx',
  'number-stepper.tsx',
  'offline-banner.tsx',
  'offline-gate.tsx',
  'offline-page-gate.tsx',
  'offline-queue.tsx',
  'offline-refusal-notice.tsx',
  'page-customizer.tsx',
  'page-hub.tsx',
  'page-skeleton.tsx',
  'pagination.tsx',
  'phone-input.tsx',
  'product-picker.tsx',
  'progress.tsx',
  'realtime-indicator.tsx',
  'register-customizer.tsx',
  'route-progress.tsx',
  'save-indicator.tsx',
  'search-input.tsx',
  'segmented-control.tsx',
  'select.tsx',
  'select-field.tsx',
  'sheet.tsx',
  'skeleton.tsx',
  'sonner.tsx',
  'stat-surface.ts',
  'switch.tsx',
  'sync-status.tsx',
  'table.tsx',
  'tabs.tsx',
  'textarea.tsx',
  'toast.tsx',
  'toast-provider.tsx',
  'tooltip.tsx',
  'undo-disclosure.tsx',
].sort()

// Section files introduced for capability extensions
const SECTION_FILES = [
  join(UI_COMPONENTS_DIR, 'warehouse', 'product-variants-section.tsx'),
  join(UI_COMPONENTS_DIR, 'warehouse', 'product-fitments-section.tsx'),
  join(UI_COMPONENTS_DIR, 'invoices', 'warranties-section.tsx'),
  join(UI_COMPONENTS_DIR, 'invoices', 'invoice-returns-dialog.tsx'),
  join(UI_COMPONENTS_DIR, 'settings', 'credit-limit-mode-section.tsx'),
]

describe('UI Primitives & Section Component Guard', () => {
  it('enforces closed snapshot of top-level UI primitives', () => {
    const files = readdirSync(UI_COMPONENTS_DIR)
      .filter((name) => {
        const full = join(UI_COMPONENTS_DIR, name)
        return statSync(full).isFile()
      })
      .sort()

    expect(files).toEqual(APPROVED_TOP_LEVEL_PRIMITIVES)
  })

  it('prohibits raw <table, <select, <dialog, or custom overlays in section components', () => {
    for (const file of SECTION_FILES) {
      const content = readFileSync(file, 'utf8')
      const fileName = file.split(/[\\/]/).pop()

      expect(
        /<table[\s>]/.test(content),
        `Section ${fileName} contains raw <table>. Use DataTable component instead.`,
      ).toBe(false)

      expect(
        /<select[\s>]/.test(content),
        `Section ${fileName} contains raw <select>. Use SelectField or Select component instead.`,
      ).toBe(false)

      expect(
        /<dialog[\s>]/.test(content),
        `Section ${fileName} contains raw <dialog>. Use Dialog from ./dialog instead.`,
      ).toBe(false)

      expect(
        /fixed\s+inset-0/i.test(content) && !content.includes('DialogContent'),
        `Section ${fileName} contains custom fixed overlay. Use Dialog or Sheet instead.`,
      ).toBe(false)
    }
  })
})
