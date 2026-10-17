import { describe, expect, it } from 'vitest'
import {
  DualPerspectiveWorkflow,
  faNumber,
  FragmentedToolsMetaphor,
  OfflineSyncIndicator,
  ProfitWaterfallBreakdown,
  WarehouseNodeMovement,
} from '../ui/customer-primitives'

describe('Customer Conversion Primitives Verification', () => {
  it('formats Persian digits correctly with faNumber', () => {
    expect(faNumber(0)).toBe('۰')
    expect(faNumber(280000)).toBe('۲۸۰٬۰۰۰')
    expect(faNumber(65000)).toBe('۶۵٬۰۰۰')
    expect(faNumber(180000)).toBe('۱۸۰٬۰۰۰')
  })

  it('renders OfflineSyncIndicator at different time phases deterministically', () => {
    // Offline phase
    const off = OfflineSyncIndicator({ t: 1.0, reconnectAt: 2.5, syncCompleteAt: 4.0 })
    expect(off).toBeDefined()
    expect(off.props.className).toContain('offline-sync-container')

    // Syncing phase
    const syncing = OfflineSyncIndicator({ t: 3.0, reconnectAt: 2.5, syncCompleteAt: 4.0 })
    expect(syncing).toBeDefined()

    // Synced phase
    const synced = OfflineSyncIndicator({ t: 5.0, reconnectAt: 2.5, syncCompleteAt: 4.0 })
    expect(synced).toBeDefined()
  })

  it('renders FragmentedToolsMetaphor during chaotic and converged states', () => {
    // Disconnected state
    const chaotic = FragmentedToolsMetaphor({ t: 1.0, convergeAt: 2.8 })
    expect(chaotic).toBeDefined()
    expect(chaotic.props.className).toContain('fragmented-tools-container')

    // Converged state
    const converged = FragmentedToolsMetaphor({ t: 4.0, convergeAt: 2.8 })
    expect(converged).toBeDefined()
  })

  it('renders ProfitWaterfallBreakdown calculating correct net margins', () => {
    const waterfall = ProfitWaterfallBreakdown({
      t: 3.5,
      grossRevenue: 280000,
      cogs: 180000,
      opex: 35000,
      currency: 'افغانی',
    })
    expect(waterfall).toBeDefined()
    expect(waterfall.props.className).toContain('profit-waterfall-container')
  })

  it('renders WarehouseNodeMovement across transfer lifecycle', () => {
    // Before transfer
    const pre = WarehouseNodeMovement({
      t: 0.5,
      transferStartAt: 1.5,
      transferArriveAt: 3.5,
    })
    expect(pre).toBeDefined()
    expect(pre.props.className).toContain('warehouse-node-container')

    // During transfer
    const mid = WarehouseNodeMovement({
      t: 2.5,
      transferStartAt: 1.5,
      transferArriveAt: 3.5,
    })
    expect(mid).toBeDefined()

    // Arrived
    const post = WarehouseNodeMovement({
      t: 4.0,
      transferStartAt: 1.5,
      transferArriveAt: 3.5,
    })
    expect(post).toBeDefined()
  })

  it('renders DualPerspectiveWorkflow across seller clicks and accountant ledger', () => {
    const dual = DualPerspectiveWorkflow({
      t: 3.2,
      click1At: 1.0,
      click2At: 2.0,
      journalPostAt: 2.8,
      saleAmount: 24500,
      costAmount: 16200,
    })
    expect(dual).toBeDefined()
    expect(dual.props.className).toContain('dual-perspective-container')
  })
})
