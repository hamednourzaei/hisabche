'use client'

// ============================================
// packages/ui/src/components/ui/entity/entity-360.tsx
//
// PHASE 6 — the shape every detail page shares.
//
// ---------------------------------------------------------------------------
// THE ORDER IS THE PRODUCT
//
// §9 gives one section order for every entity: overview, then lines, then
// money, then relations, documents, activity, audit. It is the same order on a
// customer and on an invoice, not because the content is alike but because
// somebody who learns where "activity" sits on one page has then learned it on
// all of them.
//
// This component owns that order. A caller supplies CONTENT per section and
// cannot supply a sequence — passing an object rather than an array is what
// makes the ordering unforgeable.
//
// ---------------------------------------------------------------------------
// A SECTION WITH NOTHING IN IT IS NOT RENDERED
//
// An empty tab costs a click and teaches the reader that the app is
// unfinished. A section the caller passes no content for simply does not
// exist on that page — and one the actor lacks the capability for is filtered
// out by the contract before it reaches here.
// ============================================

import { memo, useState, type ReactNode } from 'react'
import {
  sectionsFor,
  visibleSections,
  type DetailSection,
  type EntityKind,
} from '@hisabche/ui-contract'

import { Card, CardContent, CardHeader, CardTitle } from '../card'
import { cn } from '../../../lib/utils'

export interface Entity360Props {
  t: (key: string, fallback?: string) => string
  entity: EntityKind
  /** Rendered above the sections: name, status, the actions that matter. */
  header: ReactNode
  /**
   * Content per section. A section absent from this object is absent from the
   * page — that is how an entity opts out without a flag.
   */
  sections: Partial<Record<DetailSection, ReactNode>>
  /**
   * Capabilities the SERVER granted. Sections gated behind one the actor does
   * not hold are dropped.
   *
   * ⚠️ Not authorization. The endpoints behind each section enforce the same
   * capability themselves; this only avoids requesting data the actor cannot
   * have and showing an error where a missing section is the honest answer.
   */
  capabilities?: readonly string[]
}

const SECTION_LABEL: Record<DetailSection, string> = {
  overview: 'entity.overview',
  lines: 'entity.lines',
  financial: 'entity.financial',
  relations: 'entity.relations',
  documents: 'entity.documents',
  activity: 'entity.activity',
  audit: 'entity.audit',
}

export const Entity360 = memo(function Entity360({
  t,
  entity,
  header,
  sections,
  capabilities,
}: Entity360Props) {
  // The contract decides both which sections this entity has and which of
  // those this actor may see. Neither is decided here.
  const permitted =
    capabilities === undefined ? sectionsFor(entity) : visibleSections(entity, capabilities)

  const present = permitted.filter((section) => sections[section] !== undefined)

  const [active, setActive] = useState<DetailSection | null>(present[0] ?? null)
  const current = active && present.includes(active) ? active : (present[0] ?? null)

  if (present.length === 0) return <>{header}</>

  return (
    <div className="space-y-4">
      {header}

      {/* One section is not a tab strip. Rendering a single tab is a control
          that cannot be used, which reads as a broken interface. */}
      {present.length > 1 ? (
        <div
          role="tablist"
          aria-label={t('entity.sections', 'بخش‌ها')}
          className="flex flex-wrap gap-1 border-b border-[hsl(var(--border-default))]"
        >
          {present.map((section) => {
            const isActive = section === current
            return (
              <button
                key={section}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(section)}
                className={cn(
                  'rounded-t-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'border-b-2 border-[hsl(var(--color-primary))] font-semibold text-[hsl(var(--color-primary))]'
                    : 'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
                )}
              >
                {t(SECTION_LABEL[section])}
              </button>
            )
          })}
        </div>
      ) : null}

      {current ? (
        <Card>
          {present.length === 1 ? (
            <CardHeader>
              <CardTitle>{t(SECTION_LABEL[current])}</CardTitle>
            </CardHeader>
          ) : null}
          <CardContent role="tabpanel" className="pt-4">
            {sections[current]}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
})

Entity360.displayName = 'Entity360'
