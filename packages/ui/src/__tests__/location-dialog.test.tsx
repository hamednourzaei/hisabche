// ============================================
// packages/ui/src/__tests__/location-dialog.test.tsx
//
// «افزودن موقعیت» — the form a person fills in front of a new shelf.
//
// ⚠️ THE FORM'S PAYLOAD IS CHECKED WITH THE SERVER'S OWN SCHEMA. The owner
// filled every field, pressed save, and got «unrecognized key(s) in object:
// 'isActive'» (17 Oct): the form sent `isActive` on ADD, and the create schema
// is `.strict()` without it. A test that only looked at the form never saw it.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapLocation } from '@hisabche/api'
import { createStorageLocationSchema, updateStorageLocationSchema } from '@hisabche/validation'

import {
  LocationDialog,
  type LocationFormValues,
} from '../components/ui/warehouse/map/location-dialog'
import { searchKey } from '../components/ui/select-field'
import type { MapTranslator } from '../components/ui/warehouse/map/map-filtering'

afterEach(cleanup)

vi.mock('next-intl', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const catalog = JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', '..', 'packages', 'i18n', 'messages', 'fa', 'common.json'),
      'utf8',
    ),
  ) as Record<string, unknown>
  const read = (key: string): string => {
    let node: unknown = catalog
    for (const part of key.split('.')) {
      if (typeof node !== 'object' || node === null) return key
      node = (node as Record<string, unknown>)[part]
    }
    return typeof node === 'string' ? node : key
  }
  return { useTranslations: () => read, useLocale: () => 'fa' }
})

const ROOT = join(__dirname, '..', '..', '..', '..')
const catalogs = Object.fromEntries(
  (['fa', 'af', 'en'] as const).map((lang) => [
    lang,
    JSON.parse(
      readFileSync(join(ROOT, 'packages', 'i18n', 'messages', lang, 'common.json'), 'utf8'),
    ) as Record<string, unknown>,
  ]),
)

function message(key: string, lang: 'fa' | 'af' | 'en' = 'fa'): string | undefined {
  let node: unknown = catalogs[lang]
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

const t: MapTranslator = (key, values) => {
  const text = message(key) ?? key
  if (!values) return text
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    text,
  )
}

const shelf: MapLocation = {
  id: 'loc-1',
  parentId: null,
  code: 'B-04',
  name: 'قفسه روغن',
  kind: 'shelf',
  path: 'B-04',
  x: 2,
  y: 3,
  width: 1,
  height: 1,
  capacity: null,
  isActive: true,
} as unknown as MapLocation

function open(props: Partial<Parameters<typeof LocationDialog>[0]> = {}) {
  const onSubmit = vi.fn<(values: LocationFormValues) => void>()
  render(
    <LocationDialog
      t={t}
      open
      editing={null}
      locations={[]}
      warehouseProducts={[
        { id: '11111111-1111-4111-8111-111111111111', name: 'روغن آشپزی ۱۶ لیتری', quantity: 20 },
      ]}
      canPlace
      isPending={false}
      error={null}
      onSubmit={onSubmit}
      onClose={() => undefined}
      {...props}
    />,
  )
  return onSubmit
}

describe('add location — what is sent is what the server accepts', () => {
  it('ADD sends no isActive, and the payload passes the strict create schema', () => {
    const onSubmit = open()
    fireEvent.change(screen.getByPlaceholderText(message('warehouseMap.dialog.codePlaceholder')!), {
      target: { value: 'B-04' },
    })
    fireEvent.click(screen.getByText(message('common.save')!))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const sent = onSubmit.mock.calls[0]![0]
    expect('isActive' in sent).toBe(false)
    const { placement, ...layout } = sent
    expect(placement).toBeUndefined()
    expect(createStorageLocationSchema.safeParse(layout).success).toBe(true)
  })

  it('EDIT sends isActive, and the payload passes the strict update schema', () => {
    const onSubmit = open({ editing: shelf, locations: [shelf] })
    fireEvent.click(screen.getByText(message('common.save')!))
    const { parentId: _parent, placement: _placement, ...rest } = onSubmit.mock.calls[0]![0]
    expect(rest.isActive).toBe(true)
    expect(updateStorageLocationSchema.safeParse(rest).success).toBe(true)
  })

  it('every field says what to write: a placeholder example and a line of help', () => {
    open()
    for (const key of ['codePlaceholder', 'namePlaceholder', 'capacityPlaceholder']) {
      expect(screen.getByPlaceholderText(message(`warehouseMap.dialog.${key}`)!)).toBeTruthy()
    }
    for (const key of ['codeHelp', 'nameHelp', 'kindHelp', 'parentHelp', 'capacityHelp']) {
      expect(screen.getByText(message(`warehouseMap.dialog.${key}`)!)).toBeTruthy()
    }
  })

  it('offers «which product is here» on add, says where a missing product comes from', () => {
    open()
    expect(screen.getByText(message('warehouseMap.dialog.placeTitle')!)).toBeTruthy()
    expect(screen.getByText(message('warehouseMap.dialog.notInList')!)).toBeTruthy()
  })

  it('does not offer it without product.write, nor when editing', () => {
    open({ canPlace: false })
    expect(screen.queryByText(message('warehouseMap.dialog.placeTitle')!)).toBeNull()
    cleanup()
    open({ editing: shelf, locations: [shelf] })
    expect(screen.queryByText(message('warehouseMap.dialog.placeTitle')!)).toBeNull()
  })
})

describe('the product choice is searchable', () => {
  it('the dialog uses the ONE select with its search, not a second picker', () => {
    const source = readFileSync(
      join(
        ROOT,
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'warehouse',
        'map',
        'location-dialog.tsx',
      ),
      'utf8',
    )
    expect(source).toContain('searchable')
    expect(source).not.toContain('ProductPicker')
  })

  it('search matches across ی/ي, ک/ك and the zero-width non-joiner', () => {
    const arabicYeh = String.fromCharCode(0x64a)
    const arabicKaf = String.fromCharCode(0x643)
    const zwnj = String.fromCharCode(0x200c)
    expect(searchKey(`${arabicKaf}الا`)).toBe(searchKey('کالا'))
    expect(searchKey(`روغن${arabicYeh}`)).toBe(searchKey('روغنی'))
    expect(searchKey(`می${zwnj}خرم`)).toBe(searchKey('میخرم'))
  })

  it('every new key exists in all three languages', () => {
    const keys = [
      'codePlaceholder',
      'codeHelp',
      'namePlaceholder',
      'nameHelp',
      'kindHelp',
      'parentHelp',
      'gridPlaceholder',
      'capacityPlaceholder',
      'capacityHelp',
      'placeTitle',
      'placeHint',
      'searchPlaceholder',
      'noResults',
      'noProduct',
      'notInList',
      'quantityPlaceholder',
    ]
    for (const lang of ['fa', 'af', 'en'] as const) {
      for (const key of keys)
        expect(message(`warehouseMap.dialog.${key}`, lang), `${lang} ${key}`).toBeTruthy()
    }
  })
})
