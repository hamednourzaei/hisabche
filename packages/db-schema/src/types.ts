// packages/db-schema/src/types.ts
// ============================================
// Shared Types — Safe for Web, Mobile, Backend
// ============================================

export interface Activity {
  id: string;
  actorId: string;
  actorName: string;
  entityType: "invoice" | "customer" | "product" | "payment" | "supplier" | "inventory";
  entityId: string;
  action: "created" | "updated" | "paid" | "approved" | "rejected" | "sent" | "archived" | "cancelled";
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  importance: number;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityGroup {
  entityType: Activity["entityType"];
  entityId: string;
  activities: Activity[];
  unreadCount: number;
  latestAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: "sale" | "purchase";
  customerId?: string;
  supplierId?: string;
  date: string;
  dueDate?: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  category: string;
  quantity: number;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  wholesalePrice?: number;
  minStockLevel: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  openingBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}