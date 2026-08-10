// ============================================
// The navigation + command contract is shared by the web dashboard layout and
// the desktop sidebar/palette. These tests pin the properties both renderers
// rely on, so a change here cannot silently produce a dead link on one platform
// or two different words for the same destination.
// ============================================

import { describe, expect, it } from 'vitest'

import { COMMAND_ITEMS, MORE_GROUPS, NAV_ITEMS, PRIMARY_ITEMS } from '../nav-items'
import faMessages from '../../../../../i18n/messages/fa/common.json'
import afMessages from '../../../../../i18n/messages/af/common.json'
import enMessages from '../../../../../i18n/messages/en/common.json'

type Catalog = Record<string, unknown>

function resolve(catalog: Catalog, key: string): string | undefined {
  let node: unknown = catalog
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  return typeof node === 'string' ? node : undefined
}

const CATALOGS: ReadonlyArray<readonly [string, Catalog]> = [
  ['fa', faMessages as Catalog],
  ['af', afMessages as Catalog],
  ['en', enMessages as Catalog],
]

describe('navigation contract', () => {
  it('every nav item has a unique id and a unique path', () => {
    const ids = NAV_ITEMS.map((i) => i.id)
    const paths = NAV_ITEMS.map((i) => i.path)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('every path is absolute — desktop resolves these against a hash router', () => {
    for (const item of NAV_ITEMS) {
      expect(item.path.startsWith('/')).toBe(true)
    }
  })

  it('primary and grouped items together cover every nav item exactly once', () => {
    const grouped = [...PRIMARY_ITEMS, ...MORE_GROUPS.flatMap((g) => g.items)]

    expect(grouped).toHaveLength(NAV_ITEMS.length)
    expect(new Set(grouped.map((i) => i.id)).size).toBe(NAV_ITEMS.length)
  })
})

describe('command palette contract', () => {
  it('has no duplicate command ids', () => {
    const ids = COMMAND_ITEMS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // The product brief names these verbs explicitly. Each must resolve to a real
  // route, not a placeholder.
  it.each([
    ['record-sale', '/quick-invoice?type=sale'],
    ['record-purchase', '/quick-invoice?type=purchase'],
    ['add-buyer', '/customers?add=true'],
    ['add-product', '/warehouse?add=true'],
    ['search-customer', '/customers?q='],
    ['search-product', '/warehouse?q='],
    ['get-paid', '/invoices'],
    ['stock', '/warehouse'],
  ])('exposes %s pointing at %s', (id, path) => {
    const command = COMMAND_ITEMS.find((c) => c.id === id)
    expect(command).toBeDefined()
    expect(command?.path).toBe(path)
  })

  it('every command targets a route the app actually serves', () => {
    // Query strings carry intent (`?add=true`, `?type=purchase`); the pathname
    // is what has to exist.
    const navPaths = new Set(NAV_ITEMS.map((i) => i.path))

    for (const command of COMMAND_ITEMS) {
      const pathname = command.path.split('?')[0]
      expect(navPaths.has(pathname as string)).toBe(true)
    }
  })

  it('sale and purchase are distinct commands, not one hardcoded to sale', () => {
    const sale = COMMAND_ITEMS.find((c) => c.id === 'record-sale')
    const purchase = COMMAND_ITEMS.find((c) => c.id === 'record-purchase')

    expect(sale?.path).toContain('type=sale')
    expect(purchase?.path).toContain('type=purchase')
    expect(sale?.labelKey).not.toBe(purchase?.labelKey)
  })
})

describe('navigation i18n coverage', () => {
  it.each(CATALOGS)('resolves every nav label and description in %s', (_locale, catalog) => {
    for (const item of NAV_ITEMS) {
      expect(resolve(catalog, item.labelKey)).toBeTruthy()
      expect(resolve(catalog, item.descriptionKey)).toBeTruthy()
    }
  })

  it.each(CATALOGS)('resolves every command label and description in %s', (_locale, catalog) => {
    for (const command of COMMAND_ITEMS) {
      expect(resolve(catalog, command.labelKey)).toBeTruthy()
      expect(resolve(catalog, command.descriptionKey)).toBeTruthy()
    }
  })
})
