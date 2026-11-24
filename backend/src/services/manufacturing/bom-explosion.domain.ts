// ============================================
// backend/src/services/manufacturing/bom-explosion.domain.ts
//
// Multi-Level BOM Tree Explosion & Cost Rollup Domain Engine
// Pure functional domain calculation:
// 1. Recursive multi-level BOM explosion
// 2. Strict Cycle Detection (preventing recursive dependency deadlocks)
// 3. Leaf raw material requirements aggregation with scrap factor
// 4. Labor and overhead cost rollup in integer minor units (zero floats)
// ============================================

export interface BomComponentItem {
  readonly productId: string
  readonly label: string
  /** Quantity required per 1 unit of parent output. */
  readonly quantity: number
  /** Unit cost in integer minor units. */
  readonly unitCostMinor: number
  /** Scrap/spoilage percentage (e.g. 5 for 5% waste during cutting/machining). */
  readonly scrapPercent?: number | undefined
  readonly unit?: string | undefined
}

export interface BomDefinition {
  readonly productId: string
  readonly label: string
  readonly version: number
  readonly components: readonly BomComponentItem[]
  readonly laborCostMinor?: number | undefined
  readonly otherCostMinor?: number | undefined
}

export interface ExplodedLeafItem {
  readonly productId: string
  readonly label: string
  readonly totalNetQuantity: number
  readonly totalGrossQuantity: number
  readonly unitCostMinor: number
  readonly totalCostMinor: number
  readonly unit?: string | undefined
}

export interface ExplodedTreeNode {
  readonly productId: string
  readonly label: string
  readonly level: number
  readonly quantityPerParent: number
  readonly totalQuantity: number
  readonly unitCostMinor: number
  readonly lineTotalMinor: number
  readonly isLeaf: boolean
  readonly children: readonly ExplodedTreeNode[]
}

export interface BomExplosionResult {
  readonly rootProductId: string
  readonly requestedQuantity: number
  readonly tree: ExplodedTreeNode
  readonly leafMaterials: readonly ExplodedLeafItem[]
  readonly totalComponentsCostMinor: number
  readonly totalLaborCostMinor: number
  readonly totalOtherCostMinor: number
  readonly totalRolledUpCostMinor: number
  readonly unitCostMinor: number
}

export class BomCycleDetectedError extends Error {
  constructor(public readonly cyclePath: readonly string[]) {
    super(`Circular BOM dependency detected: ${cyclePath.join(' -> ')}`)
    this.name = 'BomCycleDetectedError'
  }
}

/**
 * Explodes a multi-level Bill of Materials recursively.
 * Accumulates leaf raw materials and rolls up standard costs into integer minor units.
 */
export function explodeMultiLevelBom(
  rootProductId: string,
  requestedQuantity: number,
  bomRegistry: ReadonlyMap<string, BomDefinition>,
): BomExplosionResult {
  if (requestedQuantity <= 0) {
    throw new Error('Requested production quantity must be greater than zero')
  }

  const rootBom = bomRegistry.get(rootProductId)
  if (!rootBom) {
    throw new Error(`BOM definition not found for root product ${rootProductId}`)
  }

  const leafMap = new Map<
    string,
    {
      productId: string
      label: string
      netQuantity: number
      grossQuantity: number
      unitCostMinor: number
      unit?: string | undefined
    }
  >()

  let totalLaborMinor = 0
  let totalOtherMinor = 0

  function traverse(
    productId: string,
    multiplier: number,
    level: number,
    visitedPath: string[],
  ): ExplodedTreeNode {
    if (visitedPath.includes(productId)) {
      throw new BomCycleDetectedError([...visitedPath, productId])
    }

    const currentPath = [...visitedPath, productId]
    const bom = bomRegistry.get(productId)

    // Leaf component (no sub-BOM exists in registry)
    if (!bom || bom.components.length === 0) {
      return {
        productId,
        label: bom?.label ?? productId,
        level,
        quantityPerParent: multiplier,
        totalQuantity: multiplier,
        unitCostMinor: 0,
        lineTotalMinor: 0,
        isLeaf: true,
        children: [],
      }
    }

    // Accumulate labor and other costs for this manufactured assembly
    const laborForBatch = Math.round((bom.laborCostMinor ?? 0) * multiplier)
    const otherForBatch = Math.round((bom.otherCostMinor ?? 0) * multiplier)
    totalLaborMinor += laborForBatch
    totalOtherMinor += otherForBatch

    const children: ExplodedTreeNode[] = []
    let componentsSubtotalMinor = 0

    for (const comp of bom.components) {
      const netCompQty = comp.quantity * multiplier
      const scrapFactor = 1 + (comp.scrapPercent ?? 0) / 100
      const grossCompQty = netCompQty * scrapFactor

      const subBomExists = bomRegistry.has(comp.productId)

      if (subBomExists) {
        // Recurse into sub-assembly
        const subNode = traverse(comp.productId, grossCompQty, level + 1, currentPath)
        children.push(subNode)
        componentsSubtotalMinor += subNode.lineTotalMinor
      } else {
        // Raw leaf material
        const lineTotal = Math.round(grossCompQty * comp.unitCostMinor)
        componentsSubtotalMinor += lineTotal

        children.push({
          productId: comp.productId,
          label: comp.label,
          level: level + 1,
          quantityPerParent: comp.quantity,
          totalQuantity: grossCompQty,
          unitCostMinor: comp.unitCostMinor,
          lineTotalMinor: lineTotal,
          isLeaf: true,
          children: [],
        })

        // Accumulate in leaf map
        const existing = leafMap.get(comp.productId)
        if (existing) {
          existing.netQuantity += netCompQty
          existing.grossQuantity += grossCompQty
        } else {
          leafMap.set(comp.productId, {
            productId: comp.productId,
            label: comp.label,
            netQuantity: netCompQty,
            grossQuantity: grossCompQty,
            unitCostMinor: comp.unitCostMinor,
            unit: comp.unit,
          })
        }
      }
    }

    const totalNodeCost = componentsSubtotalMinor + laborForBatch + otherForBatch

    return {
      productId,
      label: bom.label,
      level,
      quantityPerParent: multiplier,
      totalQuantity: multiplier,
      unitCostMinor: multiplier > 0 ? Math.round(totalNodeCost / multiplier) : 0,
      lineTotalMinor: totalNodeCost,
      isLeaf: false,
      children,
    }
  }

  const tree = traverse(rootProductId, requestedQuantity, 0, [])

  const leafMaterials: ExplodedLeafItem[] = Array.from(leafMap.values()).map((item) => {
    const totalCostMinor = Math.round(item.grossQuantity * item.unitCostMinor)
    return {
      productId: item.productId,
      label: item.label,
      totalNetQuantity: item.netQuantity,
      totalGrossQuantity: item.grossQuantity,
      unitCostMinor: item.unitCostMinor,
      totalCostMinor,
      unit: item.unit,
    }
  })

  const totalComponentsCostMinor = leafMaterials.reduce((acc, m) => acc + m.totalCostMinor, 0)
  const totalRolledUpCostMinor = totalComponentsCostMinor + totalLaborMinor + totalOtherMinor
  const unitCostMinor = Math.round(totalRolledUpCostMinor / requestedQuantity)

  return {
    rootProductId,
    requestedQuantity,
    tree,
    leafMaterials,
    totalComponentsCostMinor,
    totalLaborCostMinor: totalLaborMinor,
    totalOtherCostMinor: totalOtherMinor,
    totalRolledUpCostMinor,
    unitCostMinor,
  }
}
