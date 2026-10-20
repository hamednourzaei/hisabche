// ============================================
// packages/local-engine/src/export/types.ts
//
// Types for the Offline -> Cloud Safe Migration package and preview.
// ============================================

export interface ExportMetadata {
  formatVersion: 1
  schemaVersion: number
  deviceId: string
  licenceId: string
  workspaceId: string
  createdAt: string
}

export interface ExportSection<T = Record<string, unknown>> {
  name: string
  rowCount: number
  rows: T[]
  checksum: string
}

export interface ExportPackage {
  metadata: ExportMetadata
  sections: Record<string, ExportSection>
  packageChecksum: string
}

export interface CurrencyTotal {
  subtotal: number
  total: number
  paidAmount: number
}

export interface StockPosition {
  productId: string
  warehouseId: string
  quantity: number
}

export interface TrialBalancePosition {
  totalDebit: number
  totalCredit: number
  balanced: boolean
}

export type CostStatus = 'known' | 'estimated' | 'partial' | 'unknown'

export interface InvoiceProfitPosition {
  invoiceId: string
  invoiceNumber: string | null
  currency: string
  revenue: number
  cost: number | null
  profit: number | null
  costStatus: CostStatus
}

export interface MigrationPreview {
  workspaceId: string
  baseCurrency: string
  counts: {
    workspaces: number
    warehouses: number
    shelves: number
    products: number
    customers: number
    invoices: number
    payments: number
    journalEntries: number
    journalLines: number
    costLayers: number
    transfers: number
  }
  totalsByCurrency: Record<string, CurrencyTotal>
  receivablesPerCurrency: Record<string, number>
  payablesPerCurrency: Record<string, number>
  stockByProductWarehouse: StockPosition[]
  trialBalance: TrialBalancePosition
  profitByInvoice: InvoiceProfitPosition[]
}
