// packages/ui/src/lib/warehouse/delete-refusal.ts
//
// Why a product delete was refused, in words. The server answers 409 with
// PRODUCT_HAS_INVOICE_ITEMS / PRODUCT_HAS_STOCK_MOVEMENTS when the product has
// sales or stock history (BUG-001); anything else is a plain failure.

/** True when the delete was refused because the product has history — it can be deactivated instead. */
export function isProductInUse(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === 'PRODUCT_HAS_INVOICE_ITEMS' || code === 'PRODUCT_HAS_STOCK_MOVEMENTS'
}

export function productDeleteRefusal(error: unknown, t: (key: string) => string): string {
  const code = (error as { code?: string } | null)?.code
  if (code === 'PRODUCT_HAS_INVOICE_ITEMS') return t('warehouse.deleteHasSales')
  if (code === 'PRODUCT_HAS_STOCK_MOVEMENTS') return t('warehouse.deleteHasStockHistory')
  return t('warehouse.deleteFailed')
}
