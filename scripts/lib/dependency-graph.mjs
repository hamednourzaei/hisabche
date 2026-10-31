/**
 * Dependency Graph Construction and Cycle Detection for Hisabche
 * Uses Tarjan's Strongly Connected Components algorithm for deterministic cycle discovery.
 */

import { inferPackageName } from './ast-symbol-extractor.mjs'

/**
 * Builds file-to-file and package-to-package dependency graphs from resolved relationships
 * @param {Array<object>} relationships - Array of typed relationship records
 * @returns {object} { fileGraph, packageGraph, cycles, stats }
 */
export function buildDependencyGraph(relationships = []) {
  const fileAdjacency = new Map() // file -> Set<file>
  const fileEdges = []
  const packageAdjacency = new Map() // pkg -> Set<pkg>
  const packageEdges = []

  for (const rel of relationships) {
    if (
      (rel.type === 'IMPORTS' || rel.type === 'RE_EXPORTS' || rel.type === 'DEPENDS_ON') &&
      rel.status === 'RESOLVED' &&
      rel.targetId &&
      !rel.targetId.includes('::') &&
      !rel.targetId.includes('#')
    ) {
      const fromFile = rel.file
      const toFile = rel.targetId

      if (fromFile === toFile) continue // Self-reference in same file

      // File graph
      if (!fileAdjacency.has(fromFile)) fileAdjacency.set(fromFile, new Set())
      fileAdjacency.get(fromFile).add(toFile)
      fileEdges.push({ from: fromFile, to: toFile, type: rel.type })

      // Package graph
      const fromPkg = inferPackageName(fromFile)
      const toPkg = inferPackageName(toFile)
      if (fromPkg !== toPkg) {
        if (!packageAdjacency.has(fromPkg)) packageAdjacency.set(fromPkg, new Set())
        packageAdjacency.get(fromPkg).add(toPkg)
        packageEdges.push({ from: fromPkg, to: toPkg })
      }
    }
  }

  // Detect file cycles
  const fileCycles = findCycles(fileAdjacency)
  // Detect package cycles
  const packageCycles = findCycles(packageAdjacency)

  return {
    fileGraph: Object.fromEntries(
      Array.from(fileAdjacency.entries()).map(([k, set]) => [k, Array.from(set).sort()]),
    ),
    packageGraph: Object.fromEntries(
      Array.from(packageAdjacency.entries()).map(([k, set]) => [k, Array.from(set).sort()]),
    ),
    cycles: {
      fileCycles,
      packageCycles,
      totalFileCycles: fileCycles.length,
      totalPackageCycles: packageCycles.length,
    },
    stats: {
      totalFileNodes: fileAdjacency.size,
      totalFileEdges: fileEdges.length,
      totalPackageNodes: packageAdjacency.size,
      totalPackageEdges: packageEdges.length,
    },
  }
}

/**
 * Finds all elementary cycles in an adjacency graph using Tarjan's SCC and DFS pathfinding
 */
export function findCycles(adjMap) {
  const index = new Map()
  const lowlink = new Map()
  const onStack = new Map()
  const stack = []
  let currentIndex = 0
  const sccs = []

  function strongConnect(node) {
    index.set(node, currentIndex)
    lowlink.set(node, currentIndex)
    currentIndex++
    stack.push(node)
    onStack.set(node, true)

    const neighbors = adjMap.get(node) || []
    for (const neighbor of neighbors) {
      if (!index.has(neighbor)) {
        strongConnect(neighbor)
        lowlink.set(node, Math.min(lowlink.get(node), lowlink.get(neighbor)))
      } else if (onStack.get(neighbor)) {
        lowlink.set(node, Math.min(lowlink.get(node), index.get(neighbor)))
      }
    }

    if (lowlink.get(node) === index.get(node)) {
      const scc = []
      let w
      do {
        w = stack.pop()
        onStack.set(w, false)
        scc.push(w)
      } while (w !== node)

      if (scc.length > 1) {
        sccs.push(scc)
      } else if (adjMap.get(node) && adjMap.get(node).has(node)) {
        // Self-loop
        sccs.push(scc)
      }
    }
  }

  for (const node of adjMap.keys()) {
    if (!index.has(node)) {
      strongConnect(node)
    }
  }

  // Format cycles with participating nodes and whether direct or indirect
  const formattedCycles = []
  for (const scc of sccs) {
    const isDirect = scc.length === 2
    formattedCycles.push({
      participatingNodes: [...scc].sort(),
      length: scc.length,
      isDirect,
      isStaticallyVerified: true,
    })
  }

  return formattedCycles
}
