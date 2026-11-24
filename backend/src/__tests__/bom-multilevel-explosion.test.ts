// ============================================
// backend/src/__tests__/bom-multilevel-explosion.test.ts
//
// Tests for Multi-level BOM Explosion, Cycle Detection & Cost Rollup
// ============================================

import { describe, it, expect } from 'vitest'
import {
  explodeMultiLevelBom,
  BomCycleDetectedError,
  type BomDefinition,
} from '../services/manufacturing/bom-explosion.domain'

describe('Multi-level BOM Explosion & Cost Rollup', () => {
  it('explodes a 3-level BOM tree with accurate gross quantities and leaf aggregation', () => {
    // Structure:
    // Finished Wooden Chair (P-CHAIR):
    //   - 1x Wooden Frame (P-FRAME) [Sub-assembly]
    //   - 1x Cushion (P-CUSHION) [Sub-assembly]
    //   - 4x Screws (RAW-SCREW) @ 50 minor
    //
    // P-FRAME:
    //   - 4x Wooden Legs (RAW-LEG) @ 500 minor, 5% scrap
    //   - 1x Wooden Seat Base (RAW-BASE) @ 1200 minor
    //   - Labor: 200 minor
    //
    // P-CUSHION:
    //   - 1x Foam (RAW-FOAM) @ 800 minor
    //   - 1x Fabric (RAW-FABRIC) @ 600 minor, 10% scrap
    //   - Labor: 150 minor
    //
    // P-CHAIR Final Assembly:
    //   - Labor: 300 minor
    //   - Overhead/Other: 100 minor

    const registry = new Map<string, BomDefinition>([
      [
        'P-CHAIR',
        {
          productId: 'P-CHAIR',
          label: 'Wooden Chair',
          version: 1,
          laborCostMinor: 300,
          otherCostMinor: 100,
          components: [
            { productId: 'P-FRAME', label: 'Chair Frame', quantity: 1, unitCostMinor: 0 },
            { productId: 'P-CUSHION', label: 'Chair Cushion', quantity: 1, unitCostMinor: 0 },
            { productId: 'RAW-SCREW', label: 'Steel Screw', quantity: 4, unitCostMinor: 50 },
          ],
        },
      ],
      [
        'P-FRAME',
        {
          productId: 'P-FRAME',
          label: 'Chair Frame',
          version: 1,
          laborCostMinor: 200,
          components: [
            {
              productId: 'RAW-LEG',
              label: 'Wooden Leg',
              quantity: 4,
              unitCostMinor: 500,
              scrapPercent: 5,
            },
            { productId: 'RAW-BASE', label: 'Wooden Seat Base', quantity: 1, unitCostMinor: 1200 },
          ],
        },
      ],
      [
        'P-CUSHION',
        {
          productId: 'P-CUSHION',
          label: 'Chair Cushion',
          version: 1,
          laborCostMinor: 150,
          components: [
            { productId: 'RAW-FOAM', label: 'Polyurethane Foam', quantity: 1, unitCostMinor: 800 },
            {
              productId: 'RAW-FABRIC',
              label: 'Upholstery Fabric',
              quantity: 1,
              unitCostMinor: 600,
              scrapPercent: 10,
            },
          ],
        },
      ],
    ])

    const result = explodeMultiLevelBom('P-CHAIR', 10, registry)

    expect(result.rootProductId).toBe('P-CHAIR')
    expect(result.requestedQuantity).toBe(10)

    // Tree structure check
    expect(result.tree.children.length).toBe(3)
    const firstChild = result.tree.children[0]
    expect(firstChild).toBeDefined()
    expect(firstChild?.isLeaf).toBe(false)
    expect(firstChild?.children.length).toBe(2)

    // Leaf components check: RAW-SCREW, RAW-LEG, RAW-BASE, RAW-FOAM, RAW-FABRIC
    expect(result.leafMaterials.length).toBe(5)

    const screws = result.leafMaterials.find((m) => m.productId === 'RAW-SCREW')!
    expect(screws.totalNetQuantity).toBe(40) // 4 * 10
    expect(screws.totalGrossQuantity).toBe(40)
    expect(screws.totalCostMinor).toBe(2000) // 40 * 50

    const legs = result.leafMaterials.find((m) => m.productId === 'RAW-LEG')!
    expect(legs.totalNetQuantity).toBe(40)
    expect(legs.totalGrossQuantity).toBe(42) // 40 * 1.05 = 42

    const fabric = result.leafMaterials.find((m) => m.productId === 'RAW-FABRIC')!
    expect(fabric.totalNetQuantity).toBe(10)
    expect(fabric.totalGrossQuantity).toBe(11) // 10 * 1.10 = 11

    // Rolled up labor:
    // P-CHAIR: 300 * 10 = 3000
    // P-FRAME: 200 * 10 = 2000
    // P-CUSHION: 150 * 10 = 1500
    // Total labor = 6500
    expect(result.totalLaborCostMinor).toBe(6500)

    // Total other: 100 * 10 = 1000
    expect(result.totalOtherCostMinor).toBe(1000)

    expect(result.totalRolledUpCostMinor).toBeGreaterThan(0)
    expect(result.unitCostMinor).toBe(Math.round(result.totalRolledUpCostMinor / 10))
  })

  it('detects circular BOM dependency and throws BomCycleDetectedError', () => {
    // Loop: A -> B -> C -> A
    const registry = new Map<string, BomDefinition>([
      [
        'P-A',
        {
          productId: 'P-A',
          label: 'Part A',
          version: 1,
          components: [{ productId: 'P-B', label: 'Part B', quantity: 1, unitCostMinor: 100 }],
        },
      ],
      [
        'P-B',
        {
          productId: 'P-B',
          label: 'Part B',
          version: 1,
          components: [{ productId: 'P-C', label: 'Part C', quantity: 2, unitCostMinor: 50 }],
        },
      ],
      [
        'P-C',
        {
          productId: 'P-C',
          label: 'Part C',
          version: 1,
          components: [{ productId: 'P-A', label: 'Part A', quantity: 1, unitCostMinor: 200 }],
        },
      ],
    ])

    expect(() => explodeMultiLevelBom('P-A', 1, registry)).toThrowError(BomCycleDetectedError)
  })

  it('detects direct self-referencing cycle (A -> A)', () => {
    const registry = new Map<string, BomDefinition>([
      [
        'P-SELF',
        {
          productId: 'P-SELF',
          label: 'Self loop',
          version: 1,
          components: [{ productId: 'P-SELF', label: 'Self loop', quantity: 1, unitCostMinor: 10 }],
        },
      ],
    ])

    expect(() => explodeMultiLevelBom('P-SELF', 5, registry)).toThrowError(BomCycleDetectedError)
  })

  it('rejects non-positive requested quantities', () => {
    const registry = new Map<string, BomDefinition>()
    expect(() => explodeMultiLevelBom('P-A', 0, registry)).toThrow('greater than zero')
    expect(() => explodeMultiLevelBom('P-A', -5, registry)).toThrow('greater than zero')
  })
})
