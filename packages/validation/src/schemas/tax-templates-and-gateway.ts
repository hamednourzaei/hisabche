export interface TaxInvoiceTemplateDef {
  id: string
  nameKey: string
  jurisdiction: string | null
  requiresOwnerLegalText: boolean
  fields: readonly string[]
}

export const INVOICE_TEMPLATE_REGISTRY: readonly TaxInvoiceTemplateDef[] = [
  {
    id: 'generic_tax_v1',
    nameKey: 'tax.templates.generic',
    jurisdiction: null,
    requiresOwnerLegalText: false,
    fields: ['tax_registration_id', 'tax_components', 'invoice_tax_lines', 'subtotal', 'total'],
  },
  {
    // NEEDS_OWNER_DECISION: exact Afghan Ministry of Finance legal wording & TIN layout
    id: 'afghanistan_pending_legal_text',
    nameKey: 'tax.templates.afghanistanPending',
    jurisdiction: 'AF',
    requiresOwnerLegalText: true,
    fields: ['tax_registration_id', 'tax_components', 'invoice_tax_lines', 'subtotal', 'total'],
  },
]

export interface TaxReportLineInput {
  direction: 'output' | 'input'
  isReturn: boolean
  currency: string
  componentCode: string
  taxAmountMinor: number
}

export interface TaxReportBucket {
  currency: string
  componentCode: string
  outputTaxMinor: number
  inputTaxMinor: number
  netTaxMinor: number
}

export function aggregateTaxReportByCurrencyAndComponent(
  lines: readonly TaxReportLineInput[],
): TaxReportBucket[] {
  const map = new Map<string, TaxReportBucket>()
  for (const l of lines) {
    const key = `${l.currency}::${l.componentCode}`
    const sign = l.isReturn ? -1 : 1
    let bucket = map.get(key)
    if (!bucket) {
      bucket = {
        currency: l.currency,
        componentCode: l.componentCode,
        outputTaxMinor: 0,
        inputTaxMinor: 0,
        netTaxMinor: 0,
      }
      map.set(key, bucket)
    }
    if (l.direction === 'output') {
      bucket.outputTaxMinor += sign * l.taxAmountMinor
    } else {
      bucket.inputTaxMinor += sign * l.taxAmountMinor
    }
    bucket.netTaxMinor = bucket.outputTaxMinor - bucket.inputTaxMinor
  }
  return Array.from(map.values())
}
