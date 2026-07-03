// packages/ui/src/components/ui/hr/containers/employee-detail-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useEmployee, useUpdateEmployee } from "@hisabche/api";
import { EmployeeDetailView } from "../employee-detail-view";

export function EmployeeDetailContainer({ id }: { id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: employee, isLoading } = useEmployee(id);
  const updateEmployee = useUpdateEmployee();

  const safeT = (key: string, fallback?: string) => {
    const result = t(key);
    return result !== key ? result : (fallback ?? key);
  };

  const handleUpdate = async (values: Record<string, unknown>) => {
    await updateEmployee.mutateAsync({ id, ...values });
  };

  return (
    <EmployeeDetailView
      t={safeT}
      employee={employee}
      isLoading={isLoading}
      onUpdate={handleUpdate}
      onBack={() => router.push("/hr")}
    />
  );
}