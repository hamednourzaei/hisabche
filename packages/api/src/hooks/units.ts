// ============================================
// Units of measure — TanStack Query
//
// ---------------------------------------------------------------------------
// T2 — THE READER THE `units` TABLE NEVER HAD
//
// `phase-l-01` seeded gram, kilogram, TONNE, millilitre and dozen. Every unit
// picker in the product kept its own hardcoded array instead, the widest of
// which had nine entries and the narrowest five. Adding rows to the table
// changed nothing on screen.
//
// ---------------------------------------------------------------------------
// ⚠️ THIS LIST IS GLOBAL, NOT PER-WORKSPACE
//
// A gram is a gram in every workspace, and `units` carries no `workspace_id`
// to scope by. The per-product conversion («1 carton = 24 pieces») is
// workspace-scoped and does NOT come from here.
//
// Consequences, both deliberate:
//   · `staleTime` is long. Reference data does not change during a session.
//   · The query key carries no workspace, so switching workspace does not
//     refetch a list that cannot differ.
// ============================================

import { useQuery } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

export type UnitDimension = 'weight' | 'length' | 'volume' | 'count'

export interface Unit {
  code: string
  name: string
  /** Persian/Dari label. Null on a row seeded before the column existed. */
  nameFa: string | null
  /** 'kg', 'L' … Null for count units, which have no symbol. */
  symbol: string | null
  dimension: UnitDimension
  /**
   * Base units of this dimension per one of these — gram 1, kg 1000, tonne
   * 1 000 000. Count units all carry 1: a box holds whatever the product says.
   */
  conversionFactor: number
  isBase: boolean
}

export interface UnitsResponse {
  units: Unit[]
  /**
   * 'seed' means the server served the migration's list because the table is
   * absent on that environment. Surfaced rather than hidden — a picker quietly
   * showing a built-in list is how the hardcoded arrays survived so long.
   */
  source: 'table' | 'seed'
}

export const unitKeys = {
  all: ['units'] as const,
  list: () => [...unitKeys.all, 'list'] as const,
}

export function useUnits() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: unitKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get('/units')
      return data as UnitsResponse
    },
    enabled: ready,
    // Reference data. Refetching it every thirty seconds costs a request per
    // picker and can never return anything different.
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })
}

/** Units of one dimension, for a picker that must not offer litres for gold. */
export function useUnitsByDimension(dimension: UnitDimension) {
  const query = useUnits()
  return {
    ...query,
    units: (query.data?.units ?? []).filter((u) => u.dimension === dimension),
  }
}
