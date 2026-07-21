// ============================================
// packages/api/src/hooks/dashboard.ts
// ============================================
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/client";
import { useAuthReady } from "./useAuthReady";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DashboardKPIs {
  todaySales: number;
  todayInvoices: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  pendingPayments: number;
  pendingPaymentsCount: number;
  activeCustomers: number;
  customerGrowth: number;
  lowStockAlerts: number;
}

export interface AIInsight {
  type: "warning" | "info" | "success" | "tip";
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
  metric?: number;
  metricLabel?: string;
}

export interface SalesDataPoint {
  label: string;
  value: number;
  date: string;
}

export interface SalesChartData {
  data: SalesDataPoint[];
  chartData?: SalesDataPoint[];
  total: number;
  average: number;
}

export interface InvoicesSummary {
  todaySales?: number;
  todayCount?: number;
  monthlyRevenue?: number;
  totalDebt?: number;
  customerCount?: number;
  pendingCount?: number;
}

export interface ProductsSummary {
  lowStockCount?: number;
  lowStockItems?: Array<{
    id: string;
    name: string;
    quantity: number;
    reorderPoint: number;
  }>;
}

// ─── Keys ────────────────────────────────────────────────────────────────────
export const dashboardKeys = {
  all: ["dashboard"] as const,
  kpis: () => [...dashboardKeys.all, "kpis"] as const,
  insights: () => [...dashboardKeys.all, "insights"] as const,
  sales: (params: Record<string, unknown>) => [...dashboardKeys.all, "sales", params] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

// ✅ گیت شده با authReady: قبل از hydrate شدن session، fire نمی‌شود
export function useDashboardKPIs() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: dashboardKeys.kpis(),
    queryFn: async (): Promise<DashboardKPIs> => {
      const { data } = await apiClient.get("/analytics/dashboard");
      return data;
    },
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ✅ گیت شده با authReady
export function useAIInsights() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: dashboardKeys.insights(),
    queryFn: async (): Promise<AIInsight[]> => {
      const { data } = await apiClient.get("/ai/insights");
      return data;
    },
    enabled: authReady,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getWeekAgoDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function mapToSalesDataPoint(item: { label: string; value: number; date?: string }): SalesDataPoint {
  return {
    label: item.label,
    value: item.value,
    date: item.date ?? getTodayDate(),
  };
}

interface DashboardSalesParams {
  days?: number;
  from?: string;
  to?: string;
}

// ✅ گیت شده با authReady
export function useDashboardSales(params?: DashboardSalesParams) {
  const authReady = useAuthReady();

  const today = getTodayDate();
  const weekAgo = getWeekAgoDate();

  const queryParams: Record<string, string | number> = {
    days: params?.days ?? 30,
    startDate: params?.from ?? weekAgo,
    endDate: params?.to ?? today,
  };

  if (params?.from) {
    queryParams.startDate = params.from;
  }
  if (params?.to) {
    queryParams.endDate = params.to;
  }

  return useQuery({
    queryKey: dashboardKeys.sales(queryParams),
    queryFn: async (): Promise<SalesChartData> => {
      const response = await apiClient.get("/analytics/sales", {
        params: queryParams,
      });

      let data: SalesDataPoint[] = [];
      let total = 0;
      let average = 0;

      // ✅ حالت ۱: response.data.chartData (فرمت جدید Backend)
      if (response.data?.chartData && Array.isArray(response.data.chartData)) {
        data = response.data.chartData.map(mapToSalesDataPoint);
        total = response.data.totalRevenue ?? data.reduce((sum: number, d) => sum + d.value, 0);
        average = data.length > 0 ? total / data.length : 0;
        return { data, chartData: data, total, average };
      }

      // ✅ حالت ۲: response.data.data (فرمت قبلی)
      if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data.map(mapToSalesDataPoint);
        total = response.data.total ?? data.reduce((sum: number, d) => sum + d.value, 0);
        average = response.data.average ?? (data.length > 0 ? total / data.length : 0);
        return { data, chartData: data, total, average };
      }

      // ✅ حالت ۳: response.data خودش آرایه است
      if (Array.isArray(response.data)) {
        data = response.data.map(mapToSalesDataPoint);
        total = data.reduce((sum: number, d) => sum + d.value, 0);
        average = data.length > 0 ? total / data.length : 0;
        return { data, chartData: data, total, average };
      }

      // ❌ حالت ۴: هیچ داده‌ای پیدا نشد
      const todayDate = getTodayDate();
      const fallbackData = [{ label: "امروز", value: 0, date: todayDate }];
      return { data: fallbackData, chartData: fallbackData, total: 0, average: 0 };
    },
    enabled: authReady,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}