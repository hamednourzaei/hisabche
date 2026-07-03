// ============================================
// packages/api/src/hooks/dashboard.ts
// ============================================
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/client";

// ─── Types ──────────────────────────────────────────────────
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

// ─── Keys ───────────────────────────────────────────────────
export const dashboardKeys = {
  all: ["dashboard"] as const,
  kpis: () => [...dashboardKeys.all, "kpis"] as const,
  insights: () => [...dashboardKeys.all, "insights"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────
export function useDashboardKPIs() {
  return useQuery({
    queryKey: dashboardKeys.kpis(),
    queryFn: async (): Promise<DashboardKPIs> => {
      const { data } = await apiClient.get("/api/analytics/dashboard");
      return data;
    },
    staleTime: 30_000, // ۳۰ ثانیه
    refetchInterval: 60_000, // هر ۱ دقیقه
  });
}

export function useAIInsights() {
  return useQuery({
    queryKey: dashboardKeys.insights(),
    queryFn: async (): Promise<AIInsight[]> => {
      const { data } = await apiClient.get("/api/ai/insights");
      return data;
    },
    staleTime: 60_000,
    refetchInterval: 120_000, // هر ۲ دقیقه
  });
}