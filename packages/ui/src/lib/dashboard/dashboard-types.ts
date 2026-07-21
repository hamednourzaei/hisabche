// packages/ui/src/lib/dashboard/dashboard-types.ts
export interface RawInvoice {
  id?: string;
  total?: number | string;
  paid_amount?: number | string;
  paidAmount?: number | string;
  customer_name?: string;
  customerName?: string;
  date?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface InvoicesResponse {
  invoices?: RawInvoice[];
  summary?: {
    todaySales?: number;
    totalDebt?: number;
    lowStockCount?: number;
    pendingCount?: number;
    customerCount?: number;
    monthlyRevenue?: number;
    todayCount?: number;
  };
}

// ✅ اضافه کردن ProductsResponse
export interface ProductsResponse {
  products?: Array<{
    id?: string;
    name: string;
    quantity: number;
    reorderPoint?: number;
    [key: string]: unknown;
  }>;
  summary?: {
    lowStockCount?: number;
    lowStockItems?: Array<{
      id: string;
      name: string;
      quantity: number;
      reorderPoint: number;
    }>;
  };
}