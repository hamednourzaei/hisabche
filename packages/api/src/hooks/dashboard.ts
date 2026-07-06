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
  date: string;
}

export interface SalesChartData {
  data: SalesDataPoint[];
  chartData?: SalesDataPoint[]; // ✅ اضافه شد
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

export function useDashboardSales(params?: DashboardSalesParams) {
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
        params: queryParams
      });

      console.log('🔍 useDashboardSales - raw response:', response.data);

      let data: SalesDataPoint[] = [];
      let total = 0;
      let average = 0;

      // ✅ حالت ۱: response.data.chartData (فرمت جدید Backend)
      if (response.data?.chartData && Array.isArray(response.data.chartData)) {
        data = response.data.chartData.map(mapToSalesDataPoint);
        total = response.data.totalRevenue ?? data.reduce((sum, d) => sum + d.value, 0);
        average = data.length > 0 ? total / data.length : 0;
        console.log('✅ استفاده از chartData:', { dataLength: data.length, total });
        return {
          data,
          chartData: data,
          total,
          average,
        };
      }

      // ✅ حالت ۲: response.data.data (فرمت قبلی)
      if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data.map(mapToSalesDataPoint);
        total = response.data.total ?? data.reduce((sum, d) => sum + d.value, 0);
        average = response.data.average ?? (data.length > 0 ? total / data.length : 0);
        console.log('✅ استفاده از data:', { dataLength: data.length, total });
        return {
          data,
          chartData: data,
          total,
          average,
        };
      }

      // ✅ حالت ۳: response.data خودش آرایه است
      if (Array.isArray(response.data)) {
        data = response.data.map(mapToSalesDataPoint);
        total = data.reduce((sum, d) => sum + d.value, 0);
        average = data.length > 0 ? total / data.length : 0;
        console.log('✅ response.data خودش آرایه است:', { dataLength: data.length, total });
        return {
          data,
          chartData: data,
          total,
          average,
        };
      }

      // ❌ حالت ۴: هیچ داده‌ای پیدا نشد
      console.warn('⚠️ هیچ داده‌ای در response پیدا نشد:', response.data);
      const todayDate = getTodayDate();
      const fallbackData = [{ label: 'امروز', value: 0, date: todayDate }];
      return {
        data: fallbackData,
        chartData: fallbackData,
        total: 0,
        average: 0,
      };
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}