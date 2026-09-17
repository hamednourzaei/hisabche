// packages/ui/src/lib/warehouse-types.ts

export interface RawProduct {
  id: string
  name: string
  quantity: number | string
  sell_price?: number | string
  sellPrice?: number | string
  buy_price?: number | string
  buyPrice?: number | string
  min_stock_level?: number | string
  minStockLevel?: number | string
  unit?: string
  category?: string
}

export interface Product {
  id: string
  name: string
  quantity: number
  sellPrice: number
  buyPrice: number
  minStockLevel: number
  unit: string
  category: string
}

export interface Currency {
  code: string
  label: string
  /** AFN-relative rate the user entered; null = not entered yet. */
  rate: number | null
  /** The same rate as the user typed it: AFN per one unit. */
  afnPerUnit: number | null
}
