'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/map/location-dialog.tsx
//
// THE LAYOUT FORM — «این قفسه کجاست و چه نام دارد؟»
//
// ---------------------------------------------------------------------------
// ⚠️ IT IS A FORM, NOT A DRAWING BOARD
//
// There is no drag-to-place, no resize handles and no layers panel, on purpose.
// A person standing in front of a new rack knows its code and roughly where it
// is; a full layout editor is a different product (and one that would let a
// typo move a whole aisle without anyone noticing). Four numbers and a label,
// saved one at a time, is a layout that stays true.
//
// ⚠️ OWNER ONLY. The route behind this asks for `inventory.configure` — the
// capability that already guards «what a product's units mean». The caller does
// not render this dialog for anyone else.
// ============================================

import { useEffect, useState } from 'react'
import type { MapLocation } from '@hisabche/api'
import { STORAGE_LOCATION_KINDS } from '@hisabche/validation'

import { SelectField } from '../../select-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../dialog'
import { descendantIds, suggestPosition, type MapTranslator } from './map-filtering'

export interface LocationFormValues {
  parentId: string | null
  code: string
  name?: string
  kind: (typeof STORAGE_LOCATION_KINDS)[number]
  x: number
  y: number
  width: number
  height: number
  capacity?: number | null
  isActive?: boolean
}

export interface LocationDialogProps {
  t: MapTranslator
  open: boolean
  /** Set when editing; absent when adding. */
  editing: MapLocation | null
  /** The plan as it stands — for the parent select and the starting position. */
  locations: MapLocation[]
  isPending: boolean
  error: string | null
  onSubmit: (values: LocationFormValues) => void
  onClose: () => void
}

const NO_PARENT = ''

const input =
  'min-h-10 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))]'
const label = 'block space-y-1 text-sm'
const caption = 'text-[hsl(var(--fg-secondary))]'

/** A number field that never hands `NaN` to the form. */
function toNumber(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function LocationDialog({
  t,
  open,
  editing,
  locations,
  isPending,
  error,
  onSubmit,
  onClose,
}: LocationDialogProps) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<string>('shelf')
  const [parentId, setParentId] = useState<string>(NO_PARENT)
  const [x, setX] = useState('0')
  const [y, setY] = useState('0')
  const [width, setWidth] = useState('1')
  const [height, setHeight] = useState('1')
  const [capacity, setCapacity] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setCode(editing.code)
      setName(editing.name ?? '')
      setKind(editing.kind)
      setParentId(editing.parentId ?? NO_PARENT)
      setX(String(editing.x))
      setY(String(editing.y))
      setWidth(String(editing.width))
      setHeight(String(editing.height))
      setCapacity(editing.capacity === null ? '' : String(editing.capacity))
      setIsActive(editing.isActive)
      return
    }
    const spot = suggestPosition(locations)
    setCode('')
    setName('')
    setKind('shelf')
    setParentId(NO_PARENT)
    setX(String(spot.x))
    setY(String(spot.y))
    setWidth('1')
    setHeight('1')
    setCapacity('')
    setIsActive(true)
  }, [open, editing, locations])

  // A location cannot be moved under itself: the database refuses the cycle,
  // and the select must not offer a choice that will be refused.
  const forbidden = editing ? descendantIds(locations, editing.id) : new Set<string>()
  if (editing) forbidden.add(editing.id)

  const submit = () => {
    const parsedCapacity = capacity.trim() === '' ? null : toNumber(capacity, 0)
    onSubmit({
      parentId: parentId === NO_PARENT ? null : parentId,
      code: code.trim(),
      ...(name.trim() ? { name: name.trim() } : {}),
      kind: kind as LocationFormValues['kind'],
      x: toNumber(x, 0),
      y: toNumber(y, 0),
      width: toNumber(width, 1),
      height: toNumber(height, 1),
      capacity: parsedCapacity !== null && parsedCapacity > 0 ? parsedCapacity : null,
      isActive,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('warehouseMap.dialog.editTitle') : t('warehouseMap.dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>{t('warehouseMap.dialog.hint')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <label className={`${label} col-span-1`}>
            <span className={caption}>{t('warehouseMap.dialog.code')}</span>
            <input
              id="location-code"
              value={code}
              maxLength={40}
              onChange={(event) => setCode(event.target.value)}
              placeholder="A-03"
              className={input}
            />
          </label>
          <label className={`${label} col-span-1`}>
            <span className={caption}>{t('warehouseMap.dialog.name')}</span>
            <input
              id="location-name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              className={input}
            />
          </label>
          <div className={`${label} col-span-1`}>
            <span className={caption}>{t('warehouseMap.dialog.kind')}</span>
            <SelectField
              aria-label={t('warehouseMap.dialog.kind')}
              value={kind}
              onChange={setKind}
              options={STORAGE_LOCATION_KINDS.map((value) => ({
                value,
                label: t(`warehouseMap.kind.${value}`),
              }))}
            />
          </div>
          <div className={`${label} col-span-1`}>
            <span className={caption}>{t('warehouseMap.dialog.parent')}</span>
            <SelectField
              aria-label={t('warehouseMap.dialog.parent')}
              value={parentId}
              onChange={setParentId}
              options={[
                { value: NO_PARENT, label: t('warehouseMap.dialog.noParent') },
                ...locations
                  .filter((location) => !forbidden.has(location.id))
                  .map((location) => ({
                    value: location.id,
                    label: `${location.path}${location.name ? ` — ${location.name}` : ''}`,
                  })),
              ]}
            />
          </div>

          {(
            [
              { key: 'x', value: x, set: setX, min: 0 },
              { key: 'y', value: y, set: setY, min: 0 },
              { key: 'width', value: width, set: setWidth, min: 1 },
              { key: 'height', value: height, set: setHeight, min: 1 },
            ] as const
          ).map((field) => (
            <label key={field.key} className={label}>
              <span className={caption}>{t(`warehouseMap.dialog.${field.key}`)}</span>
              <input
                type="number"
                inputMode="numeric"
                min={field.min}
                max={500}
                value={field.value}
                onChange={(event) => field.set(event.target.value)}
                className={input}
              />
            </label>
          ))}

          <label className={label}>
            <span className={caption}>{t('warehouseMap.dialog.capacity')}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              className={input}
            />
          </label>
        </div>

        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('warehouseMap.dialog.gridHint')}
        </p>

        {editing ? (
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--fg-secondary))]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="size-4"
            />
            {t('warehouseMap.dialog.active')}
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[hsl(var(--border-default))] px-4 text-sm text-[hsl(var(--fg-secondary))]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || code.trim() === ''}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-50"
          >
            {isPending ? t('warehouseMap.dialog.saving') : t('common.save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
