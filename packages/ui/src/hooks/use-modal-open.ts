'use client'

// ============================================
// packages/ui/src/hooks/use-modal-open.ts
//
// «Is a dialog open on this page?» — for the first-visit guide, which must wait.
//
// The guide is a layer above everything. A modal dialog (Radix) makes everything
// OUTSIDE itself unclickable. Together they locked a new owner out: «اولین کالا را ثبت کن»
// opens the add-product form, the guide opened on top of it, its backdrop swallowed every
// click on the form and the form's modality swallowed the guide's own close button
// (found by the browser journey, 14 Nov 2026). The guide now steps aside while a dialog is
// open and resumes, at the same step, when it closes.
//
// The guide's own card is a dialog too, so anything inside [data-guide-layer] is ignored.
// ============================================

import { useSyncExternalStore } from 'react'

const DIALOGS = '[role="dialog"], [role="alertdialog"]'

function modalOpenNow(): boolean {
  for (const element of document.querySelectorAll<HTMLElement>(DIALOGS)) {
    if (!element.closest('[data-guide-layer]')) return true
  }
  return false
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['role', 'data-state'],
  })
  return () => observer.disconnect()
}

/** True while a dialog other than the guide's own card is on the page. Server: false. */
export function useModalOpen(): boolean {
  return useSyncExternalStore(subscribe, modalOpenNow, () => false)
}
