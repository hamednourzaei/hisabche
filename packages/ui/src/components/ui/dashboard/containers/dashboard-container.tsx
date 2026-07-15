// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useDashboardKPIs, useAIInsights, useDashboardSales, useInvoices } from "@hisabche/api";
import { DashboardView } from "../dashboard-view";
import { fmt } from "../../../../lib/dashboard/dashboard-format";
import { useState, useCallback, useMemo, useEffect } from "react";
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

// ✅ هوک wrapper برای اضافه کردن refetchInterval
function usePollingQuery<T>(hook: () => { data: T; isLoading: boolean; refetch: () => void }, interval: number) {
  const result = hook();
  const { refetch } = result;

  useEffect(() => {
    const timer = setInterval(() => {
      refetch();
    }, interval);

    return () => clearInterval(timer);
  }, [refetch, interval]);

  return result;
}

export function DashboardContainer() {
  const { t } = useTranslation();
  const router = useRouter();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { from: weekAgo, to: today };
  });

  // ✅ KPI با آپدیت هر ۳۰ ثانیه
  const kpiResult = useDashboardKPIs();
  const { data: kpis, isLoading: kpiLoading, refetch: refetchKpis } = kpiResult;

  // ✅ AI Insights با آپدیت هر ۶۰ ثانیه
  const insightsResult = useAIInsights();
  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = insightsResult;

  const fromDate = dateRange.from ? dateRange.from.toISOString().slice(0, 10) : getDaysAgo(30);
  const toDate = dateRange.to ? dateRange.to.toISOString().slice(0, 10) : getTodayDate();

  // ✅ Sales Chart با آپدیت هر ۳۰ ثانیه
  const salesResult = useDashboardSales({
    from: fromDate,
    to: toDate,
  });
  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = salesResult;

  // ✅ دریافت فاکتورهای اخیر با آپدیت هر ۳۰ ثانیه
  const invoicesResult = useInvoices({
    page: 1,
    limit: 5,
    sortDirection: "desc",
  });
  const { data: invoicesData, isLoading: invoicesLoading, refetch: refetchInvoices } = invoicesResult;

  // ✅ Polling با setInterval
  useEffect(() => {
    const interval1 = setInterval(() => refetchKpis(), 30000);
    const interval2 = setInterval(() => refetchInsights(), 60000);
    const interval3 = setInterval(() => refetchSales(), 30000);
    const interval4 = setInterval(() => refetchInvoices(), 30000);

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
    return invoices.slice(0, 5).map((inv: any) => ({
      id: inv.id,
      customer: inv.customerName || inv.customer?.name || "مشتری",
      total: inv.total || 0,
      date: inv.date ? new Date(inv.date).toLocaleDateString("fa-IR") : "-",
    }));
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

    const days = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
    const today = new Date();
    return days.map((label, i) => {
      const d = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      return {
        label,
        value: 0,
        date: d.toISOString().slice(0, 10),
      };
    });
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