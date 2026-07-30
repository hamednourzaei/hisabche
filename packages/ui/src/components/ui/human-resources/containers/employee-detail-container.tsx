// packages/ui/src/components/ui/human-resources/containers/employee-detail-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEmployee, useUpdateEmployee, usePayrolls, useCreatePayroll } from "@hisabche/api";
import { EmployeeDetailView } from "../employee-detail-view";

export function EmployeeDetailContainer({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { data: employee, isLoading } = useEmployee(id);
  const { data: payrolls, isLoading: isLoadingPayrolls } = usePayrolls(id);
  const updateEmployee = useUpdateEmployee();
  const createPayroll = useCreatePayroll();

  const safeT = (key: string, fallback?: string) => {
    const result = t(key);
    return result !== key ? result : (fallback ?? key);
  };

  const handleUpdate = async (values: Record<string, unknown>) => {
    await updateEmployee.mutateAsync({ id, ...values });
  };

  const handleAddPayment = async (values: { amount: number; date: string }) => {
    await createPayroll.mutateAsync({
      employeeId: id,
      periodStart: values.date,
      periodEnd: values.date,
      baseSalary: values.amount,
      bonuses: 0,
      deductions: 0,
      overtimeHours: 0,
      overtimeRate: 0,
      taxAmount: 0,
      netSalary: values.amount,
      currency: employee?.salary_currency || "AFN",
      status: "paid",
      paymentDate: values.date,
    });
  };

  return (
    <EmployeeDetailView
      t={safeT}
      employee={employee}
      isLoading={isLoading}
      payrolls={payrolls ?? []}
      isLoadingPayrolls={isLoadingPayrolls}
      onUpdate={handleUpdate}
      onAddPayment={handleAddPayment}
      onBack={() => router.push("/human-resources")}
    />
  );
}