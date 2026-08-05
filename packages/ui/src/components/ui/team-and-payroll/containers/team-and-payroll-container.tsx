"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TeamAndPayrollView } from "../team-and-payroll-view";
import { useEmployees, useCreateEmployee, useDeleteEmployee } from "@hisabche/api";
import { usePayrolls } from "@hisabche/api";

export function TeamAndPayrollContainer() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };
  const router = useRouter();
  const [status, setStatus] = useState<"employees" | "payroll">("employees");

  const { data: employeesData, isLoading: isLoadingEmployees, refetch: refetchEmployees } = useEmployees({ page: 1, limit: 20 });
  const { data: payrollData, isLoading: isLoadingPayroll, refetch: refetchPayroll } = usePayrolls();

  const employees = employeesData?.employees ?? [];
  const totalEmployees = employeesData?.total ?? 0;

  const payrollRecords = payrollData?.payrolls ?? [];
  const totalPayroll = payrollData?.total ?? 0;

  const handleCreateEmployee = async (values: Record<string, unknown>) => {
    await useCreateEmployee().mutateAsync(values);
    refetchEmployees();
  };

  const handleDeleteEmployee = async (id: string) => {
    await useDeleteEmployee().mutateAsync(id);
    refetchEmployees();
  };

  const handleViewEmployee = (id: string) => {
    router.push(`/team-and-payroll/employee/${id}`);
  };

  const handleViewPayroll = (id: string) => {
    router.push(`/team-and-payroll/payroll/${id}`);
  };

  return (
    <TeamAndPayrollView
      t={t}
      employees={employees}
      payrollRecords={payrollRecords}
      totalEmployees={totalEmployees}
      totalPayroll={totalPayroll}
      isLoadingEmployees={isLoadingEmployees}
      isLoadingPayroll={isLoadingPayroll}
      statusFilter={status}
      onStatusChange={setStatus}
      onViewEmployee={handleViewEmployee}
      onViewPayroll={handleViewPayroll}
      onCreateEmployee={handleCreateEmployee}
      onDeleteEmployee={handleDeleteEmployee}
    />
  );
}