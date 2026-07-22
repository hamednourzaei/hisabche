// packages/ui/src/lib/activity/entity-registry.ts
import { FileText, User, Package, DollarSign, Users, PackageOpen } from "lucide-react";

// ─── Status labels/colors used by invoice.statusRenderer ───────────────────
const statusMap: Record<string, string> = {
  pending: "در انتظار",
  paid: "پرداخت شده",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
  partial: "بخشی پرداخت",
  overdue: "سررسید شده",
  draft: "پیش‌نویس",
};

const statusColorMap: Record<string, string> = {
  pending: "amber",
  paid: "emerald",
  completed: "emerald",
  cancelled: "red",
  partial: "blue",
  overdue: "rose",
  draft: "gray",
};

export const entityRegistry = {
  invoice: {
    icon: FileText,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "invoice",
    route: (id: string) => `/invoices/${id}`,
    statusRenderer: (status: string) => ({
      label: statusMap[status] || status,
      color: statusColorMap[status] || "gray",
    }),
    priority: "high",
  },
  customer: {
    icon: Users,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    label: "customer",
    route: (id: string) => `/customers/${id}`,
    priority: "medium",
  },
  product: {
    icon: Package,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    label: "product",
    route: (id: string) => `/warehouse/${id}`,
    priority: "medium",
  },
  payment: {
    icon: DollarSign,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "payment",
    route: (id: string) => `/payments/${id}`,
    priority: "high",
  },
  supplier: {
    icon: Users,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    label: "supplier",
    route: (id: string) => `/suppliers/${id}`,
    priority: "medium",
  },
  inventory: {
    icon: PackageOpen,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    label: "inventory",
    route: (id: string) => `/inventory/${id}`,
    priority: "low",
  },
} as const;

export type EntityType = keyof typeof entityRegistry;