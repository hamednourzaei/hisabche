// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useDashboardKPIs, useAIInsights, useDashboardSales, useInvoices, useRealtime } from "@hisabche/api";
import { DashboardView } from "../dashboard-view";
import { fmt } from "../../../../lib/dashboard/dashboard-format";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DateRange, PresetKey } from "../date-range-picker";

interface RecentInvoice {
  id: string;
  customer: string;
  total: number;
  date: string;
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function DashboardContainer() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { from: weekAgo, to: today };
  });

  const kpiResult = useDashboardKPIs();
  const { data: kpis, isLoading: kpiLoading, refetch: refetchKpis } = kpiResult;

  const insightsResult = useAIInsights();
  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = insightsResult;

  const fromDate = dateRange.from ? dateRange.from.toISOString().slice(0, 10) : getDaysAgo(30);
  const toDate = dateRange.to ? dateRange.to.toISOString().slice(0, 10) : getTodayDate();

  const salesResult = useDashboardSales({
    from: fromDate,
    to: toDate,
  });
  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = salesResult;

  const invoicesResult = useInvoices({
    page: 1,
    limit: 5,
    sortDirection: "desc",
  });
  const { data: invoicesData, isLoading: invoicesLoading, refetch: refetchInvoices } = invoicesResult;

  // ✅ Real-time subscription for invoices
  useRealtime({ 
    table: "invoices", 
    queryKey: ["invoices"] 
  });

  // ✅ Real-time subscription for dashboard data
  useRealtime({ 
    table: "invoices", 
    queryKey: ["dashboard"] 
  });

  // ✅ Polling with shorter intervals
  useEffect(() => {
    const interval1 = setInterval(() => refetchKpis(), 10000); // 10 seconds
    const interval2 = setInterval(() => refetchInsights(), 30000); // 30 seconds
    const interval3 = setInterval(() => refetchSales(), 10000); // 10 seconds
    const interval4 = setInterval(() => refetchInvoices(), 10000); // 10 seconds

    return () => {
      clearInterval(interval1);
      clearInterval(interval2);
      clearInterval(interval3);
      clearInterval(interval4);
    };
  }, [refetchKpis, refetchInsights, refetchSales, refetchInvoices]);

  const handleDateRangeChange = useCallback((range: DateRange, _preset: PresetKey) => {
    setDateRange(range);
  }, []);

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key);
      return v !== key ? v : (fallback ?? key);
    },
    [t]
  );

  const handleAction = useCallback(
    (action: string) => {
      router.push(action);
    },
    [router]
  );

  const recentInvoices: RecentInvoice[] = useMemo(() => {
    const invoices = invoicesData?.invoices || [];
    
    return invoices.slice(0, 5).map((inv: any) => {
      let customerName = "مشتری";
      
      if (inv.customerName) {
        customerName = inv.customerName;
      } else if (inv.customer?.name) {
        customerName = inv.customer.name;
      } else if (inv.customer_id && inv.customers) {
        customerName = inv.customers?.name || inv.customers?.full_name || "مشتری";
      } else if (inv.customer?.full_name) {
        customerName = inv.customer.full_name;
      }
      
      return {
        id: inv.id,
        customer: customerName,
        total: inv.total || 0,
        date: inv.date ? new Date(inv.date).toLocaleDateString("fa-IR") : "-",
      };
    });
  }, [invoicesData]);

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

  return (
    <DashboardView
      t={safeT}
      fmt={fmt}
      todaySales={kpis?.todaySales ?? 0}
      todayInvoices={kpis?.todayInvoices ?? 0}
      monthlyRevenue={kpis?.monthlyRevenue ?? 0}
      monthlyGrowth={kpis?.monthlyGrowth ?? 0}
      pendingPayments={kpis?.pendingPayments ?? 0}
      activeCustomers={kpis?.activeCustomers ?? 0}
      lowStockAlerts={kpis?.lowStockAlerts ?? 0}
      insights={insights ?? []}
      insightsLoading={insightsLoading}
      kpiLoading={kpiLoading}
      salesChartData={salesChartData}
      chartLoading={salesLoading}
      dateRange={dateRange}
      totalDebt={kpis?.pendingPayments ?? 0}
      invLoading={invoicesLoading}
      prodLoading={false}
      recentInvoices={recentInvoices}
      onNavigate={(route) => router.push(route)}
      onNavigatewarehouse={() => router.push("/warehouse")}
      onNavigatecustomers={() => router.push("/customers")}
      onNavigateQuickInvoice={() => router.push("/quick-invoice")}
      onNavigateInvoice={(id) => router.push(`/invoices/${id}`)}
      onViewAllInvoices={() => router.push("/invoices")}
      onInsightAction={handleAction}
      onDateRangeChange={handleDateRangeChange}
    />
  );
}