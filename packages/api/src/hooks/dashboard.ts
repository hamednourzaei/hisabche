// ============================================
// packages/api/src/hooks/dashboard.ts
// ============================================
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/client";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DashboardKPIs {
  todaySales: number;
  todayInvoices: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  pendingPayments: number;
  activeCustomers: number;
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
  date: string; // ✅ required, not optional
}

export interface SalesChartData {
  data: SalesDataPoint[];
  total: number;
  average: number;
}

// ─── Keys ────────────────────────────────────────────────────────────────────
export const dashboardKeys = {
  all: ["dashboard"] as const,
  kpis: () => [...dashboardKeys.all, "kpis"] as const,
  insights: () => [...dashboardKeys.all, "insights"] as const,
  sales: (params: Record<string, unknown>) => [...dashboardKeys.all, "sales", params] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────
export function useDashboardKPIs() {
  return useQuery({
    queryKey: dashboardKeys.kpis(),
    queryFn: async (): Promise<DashboardKPIs> => {
      const { data } = await apiClient.get("/analytics/dashboard");
      return data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useAIInsights() {
  return useQuery({
    queryKey: dashboardKeys.insights(),
    queryFn: async (): Promise<AIInsight[]> => {
      const { data } = await apiClient.get("/ai/insights");
      return data;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

// ─── Helper: Get today's date as string (safe, no undefined) ──────────────
function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Helper: Map API response to typed array ──────────────────────────────
function mapToSalesDataPoint(item: { label: string; value: number; date?: string }): SalesDataPoint {
  return {
    label: item.label,
    value: item.value,
    date: item.date ?? getTodayDate(),
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────
interface DashboardSalesParams {
  days?: number;
  from?: string;
  to?: string;
}

export function useDashboardSales(params?: DashboardSalesParams) {
  const queryParams: Record<string, string | number> = {
    days: params?.days ?? 30
  };
  
  if (params?.from) {
    queryParams.from = params.from;
  }
  if (params?.to) {
    queryParams.to = params.to;
  }

  return useQuery({
    queryKey: dashboardKeys.sales(queryParams),
    queryFn: async (): Promise<SalesChartData> => {
      const response = await apiClient.get("/analytics/sales", {
        params: queryParams
      });
      
      let data: SalesDataPoint[] = [];
      
      if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data.map(mapToSalesDataPoint);
        const total = data.reduce((sum, d) => sum + d.value, 0);
        return {
          data,
          total: response.data.total ?? total,
          average: response.data.average ?? (data.length > 0 ? total / data.length : 0),
        };
      }
      
      if (Array.isArray(response.data)) {
        data = response.data.map(mapToSalesDataPoint);
        const total = data.reduce((sum, d) => sum + d.value, 0);
        return {
          data,
          total,
          average: data.length > 0 ? total / data.length : 0,
        };
      }
      
      const today = getTodayDate();
      return {
        data: [
          { label: 'امروز', value: 0, date: today }
        ],
        total: 0,
        average: 0,
      };
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}