export type RfmSegment = 'champions' | 'loyal' | 'at_risk' | 'dormant' | 'no_data'

export interface RfmInvoiceInput {
  customerId: string
  currency: string
  date: string
  totalMinor: number
}

export interface CustomerRfmRow {
  customerId: string
  currency: string
  recencyDays: number | null
  frequency: number
  monetaryMinor: number
  segment: RfmSegment
}

export function computeCustomerRfmByCurrency(
  customerIds: readonly string[],
  invoices: readonly RfmInvoiceInput[],
  asOfDateIso: string,
  defaultCurrency: string,
): CustomerRfmRow[] {
  const asOfMs = Date.parse(`${asOfDateIso.slice(0, 10)}T00:00:00Z`)
  const byCustCurrency = new Map<
    string,
    { customerId: string; currency: string; lastMs: number; count: number; sumMinor: number }
  >()

  for (const inv of invoices) {
    const key = `${inv.customerId}::${inv.currency}`
    const ms = Date.parse(`${inv.date.slice(0, 10)}T00:00:00Z`)
    const cur = byCustCurrency.get(key)
    if (!cur) {
      byCustCurrency.set(key, {
        customerId: inv.customerId,
        currency: inv.currency,
        lastMs: ms,
        count: 1,
        sumMinor: inv.totalMinor,
      })
    } else {
      cur.lastMs = Math.max(cur.lastMs, ms)
      cur.count += 1
      cur.sumMinor += inv.totalMinor
    }
  }

  const rows: CustomerRfmRow[] = []
  const seenCustomers = new Set<string>()
  for (const entry of byCustCurrency.values()) {
    seenCustomers.add(entry.customerId)
    const recencyDays = Math.max(0, Math.floor((asOfMs - entry.lastMs) / 86_400_000))
    let segment: RfmSegment = 'loyal'
    if (recencyDays <= 30 && entry.count >= 3) segment = 'champions'
    else if (recencyDays > 90) segment = 'dormant'
    else if (recencyDays > 45) segment = 'at_risk'

    rows.push({
      customerId: entry.customerId,
      currency: entry.currency,
      recencyDays,
      frequency: entry.count,
      monetaryMinor: entry.sumMinor,
      segment,
    })
  }

  for (const cid of customerIds) {
    if (!seenCustomers.has(cid)) {
      rows.push({
        customerId: cid,
        currency: defaultCurrency,
        recencyDays: null,
        frequency: 0,
        monetaryMinor: 0,
        segment: 'no_data',
      })
    }
  }

  return rows
}
