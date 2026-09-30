// ============================================
// Capability #65 — tax return hooks.
//
// ⚠️ WHY THIS FILE EXISTS AT ALL, WHEN THE BACKEND ALREADY HAS THE ENDPOINT.
//
// `GET /api/tax/return` has existed since the tax engine landed, and
// `TaxService.getTaxReturn` behind it does the whole job: every tax line of a
// period, paged to the end, grouped by component and rate, with output tax and
// input tax kept apart and netted.
//
// It had ZERO callers. Which is the same shape as seven other findings in this
// codebase (lesson 84): correct code, complete tests, no consumer — so nobody
// knows the capability exists, and the next person builds it again. A tax return
// is not a nice-to-have; it is the figure a shop files, and the engine was
// already computing it for no one.
//
// ⚠️ THIS IS A REPORT, NOT A FILING.
//
// The hook returns figures and the person files them. Nothing here submits
// anything to any authority, and no jurisdiction's return format is assumed —
// `getTaxReturn` groups by the workspace's OWN components and rates, which is
// what makes it correct for Afghanistan, Iran and Pakistan without this file
// knowing about any of them.
//
// ⚠️ MINOR UNITS THROUGHOUT, and the UI is expected to divide.
//
// `netPayableMinor` is an integer. `FRACTION_DIGITS` in `@hisabche/formatting`
// owns the conversion, and the same rules apply as everywhere else: money is
// never a float in this path, and a type annotation is not a runtime check — so
// the response is typed to the shape the service actually returns rather than to
// what would be convenient.
// ============================================

import { useQuery } from '@tanstack/react-query'
import apiClient from '../lib/client'

/** One component-and-rate row of the return. Output and input are never summed. */
export interface TaxReturnLine {
  componentId: string | null
  /** An i18n key, not display text — the label is the workspace's own. */
  labelKey: string
  treatment: string
  /** Percentage as stored: 10 means 10%, not 0.10. */
  rate: number
  outputBaseMinor: number
  outputTaxMinor: number
  inputBaseMinor: number
  inputTaxMinor: number
}

export interface TaxReturn {
  from: string
  to: string
  lines: TaxReturnLine[]
  /** Tax charged on sales. */
  outputTaxMinor: number
  /** Tax paid on purchases. */
  inputTaxMinor: number
  /** Positive is payable to the authority; negative is reclaimable. */
  netPayableMinor: number
}

/** The path is exact: `/api/tax/return`, with the period as query parameters. */
const TAX_RETURN = '/tax/return'

export interface TaxReturnParams {
  /** ISO day, always Gregorian — `toIsoDay` from `@hisabche/formatting`. */
  from: string
  to: string
}

/**
 * The base-and-tax figures a filing is built from, for a period.
 *
 * ⚠️ DISABLED UNTIL THE PERIOD IS COMPLETE. An empty `from`/`to` would ask the
 * server for a return over an unbounded range, which is both the query the
 * service is least efficient at and a report nobody reads: a tax return for
 * «all time» has no meaning, and a shop that sees one would file it.
 *
 * A query that is disabled and a table that is genuinely empty look identical on
 * screen (§7٫6), so the screen must say which it is — that is the UI's job, not
 * this file's, but the reason the guard exists here is that the guard belongs
 * where the value is produced.
 */
export function useTaxReturn({ from, to }: TaxReturnParams) {
  return useQuery({
    queryKey: ['tax', 'return', from, to],
    enabled: Boolean(from) && Boolean(to),
    queryFn: async (): Promise<TaxReturn> => {
      const { data } = await apiClient.get<TaxReturn>(TAX_RETURN, { params: { from, to } })
      return data
    },
  })
}
