// packages/ui/src/hooks/dashboard/use-dashboard-data.ts
"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  useDashboardKPIs,
  useAIInsights,
  useDashboardSales,
  useInvoices,
  useRealtime,
  useProducts,
} from "@hisabche/api";
import { mapRecentInvoices, mapLowStockItems } from "../../lib/dashboard/dashboard-mappers";
import { getTodayDate, getDaysAgo } from "../../lib/dashboard/dashboard-utils";
import type { DateRange } from "../../components/ui/dashboard/date-range-picker";
import type { ProductsResponse, RawInvoice } from "../../lib/dashboard/dashboard-types";

// ─── Types ─────────────────────────────────────────────────────────────────

interface RecentInvoice {
  id: string;
  customer: string;
  total: number;
  date: string;
}

// ─── Main Hook ────────────────────────────────────────────────────────────

export function useDashboardData(dateRange: DateRange) {
  const t = useTranslations();

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const {
    data: kpis,
    isLoading: kpiLoading,
    refetch: refetchKpis,
  } = useDashboardKPIs();

  const {
    data: insights,
    isLoading: insightsLoading,
    refetch: refetchInsights,
  } = useAIInsights();

  // ✅ اصلاح: استفاده از تاریخ محلی
  const fromDate = dateRange.from ? dateRange.from.toISOString().slice(0, 10) : getDaysAgo(30);
  const toDate = dateRange.to ? dateRange.to.toISOString().slice(0, 10) : getTodayDate();

  const {
    data: salesData,
    isLoading: salesLoading,
    refetch: refetchSales,
  } = useDashboardSales({
    from: fromDate,
    to: toDate,
  });

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useInvoices({
    page: 1,
    limit: 5,
    sortDirection: "desc",
  });

  const {
    data: productsData,
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = useProducts({
    page: 1,
    limit: 100,
    sortDirection: "desc",
  });

  // ─── Realtime Subscriptions ─────────────────────────────────────────────

  useRealtime({
    table: "invoices",
    queryKey: ["invoices"],
  });

  useRealtime({
    table: "invoices",
    queryKey: ["dashboard"],
  });

  // ─── Data Transformations ──────────────────────────────────────────────

  const recentInvoices: RecentInvoice[] = useMemo(() => {
    const invoices = (invoicesData?.invoices || []) as unknown as RawInvoice[];
    return mapRecentInvoices(invoices, (key) => t(key));
  }, [invoicesData, t]);

  const salesChartData = useMemo(() => {
    if (salesData?.chartData && Array.isArray(salesData.chartData) && salesData.chartData.length > 0) {
      return salesData.chartData;
    }
    if (salesData?.data && Array.isArray(salesData.data) && salesData.data.length > 0) {
      return salesData.data;
    }
    if (Array.isArray(salesData)) {
      return salesData;
    }
    return [];
  }, [salesData]);

  const lowStockItems = useMemo(() => {
    const products = (productsData as ProductsResponse)?.products;
    return mapLowStockItems(products);
  }, [productsData]);

  const pendingPaymentsCount = useMemo(() => {
    return kpis?.pendingPaymentsCount ?? 0;
  }, [kpis]);

  const customerGrowth = useMemo(() => {
    return kpis?.customerGrowth ?? 0;
  }, [kpis]);

  const lowStockAlerts = useMemo(() => {
    return kpis?.lowStockAlerts ?? 0;
  }, [kpis]);

  // ─── Return ────────────────────────────────────────────────────────────

  return {
    kpis,
    insights,
    salesChartData,
    recentInvoices,
    lowStockItems,
    pendingPaymentsCount,
    customerGrowth,
    lowStockAlerts,
    isLoading: kpiLoading || salesLoading || invoicesLoading || productsLoading,
    kpiLoading,
    insightsLoading,
    chartLoading: salesLoading,
    invLoading: invoicesLoading,
    prodLoading: productsLoading,
    refetchKpis,
    refetchInsights,
    refetchSales,
    refetchInvoices,
    refetchProducts,
  };
}