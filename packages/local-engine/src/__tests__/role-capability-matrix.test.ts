import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireRole, requireCapability } from '../auth'
import type { LocalContext } from '../types'

describe('BUG-NEW-006 & 30B: Role and capability matrix in local-engine', () => {
  it('allows matching roles and rejects unauthorized roles', () => {
    const sellerCtx: LocalContext = {
      workspaceId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      role: 'seller',
      baseCurrency: 'AFN',
      timeZone: 'Asia/Kabul',
    }

    // Seller is permitted for cashier/seller
    expect(() => requireRole(sellerCtx, 'cashier', 'seller', 'manager', 'owner')).not.toThrow()

    // Viewer is rejected
    const viewerCtx: LocalContext = {
      ...sellerCtx,
      role: 'viewer',
    }
    expect(() => requireRole(viewerCtx, 'cashier', 'seller', 'manager', 'owner')).toThrow()
  })

  it('enforces capabilities by hierarchy', () => {
    const ownerCtx: LocalContext = {
      workspaceId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      role: 'owner',
      baseCurrency: 'AFN',
      timeZone: 'Asia/Kabul',
    }
    expect(() => requireCapability(ownerCtx, 'ledger.post')).not.toThrow()
    expect(() => requireCapability(ownerCtx, 'warehouse.manage')).not.toThrow()

    const viewerCtx: LocalContext = {
      ...ownerCtx,
      role: 'viewer',
    }
    expect(() => requireCapability(viewerCtx, 'ledger.post')).toThrow()
    expect(() => requireCapability(viewerCtx, 'warehouse.manage')).toThrow()
  })
})
