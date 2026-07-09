// packages/ui/src/components/ui/human-resources/containers/hr-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useEmployees, useCreateEmployee, useDeleteEmployee } from "@hisabche/api";
import { HumanResourcesView } from "../hr-view";
import { useState } from "react";

export function HumanResourcesContainer() {
  const { t } = useTranslation();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useEmployees({ page, limit: 20 });
  const createEmployee = useCreateEmployee();
  const deleteEmployee = useDeleteEmployee();

  // Wrapper برای سازگاری با exactOptionalPropertyTypes
  const safeT = (key: string, fallback?: string) => {
    const result = t(key);
    return result !== key ? result : (fallback ?? key);
  };

  const handleCreate = async (values: any) => {
    await createEmployee.mutateAsync(values);
  };

  const handleDelete = async (id: string) => {
    await deleteEmployee.mutateAsync(id);
  };

  return (
    <HumanResourcesView
      t={safeT}
      employees={data?.employees ?? []}
      total={data?.total ?? 0}
      page={page}
      isLoading={isLoading}
      onPageChange={setPage}
      onSearch={setSearch}
      onCreate={handleCreate}
      onDelete={handleDelete}
      onView={(id) => router.push(`/human-resources/${id}`)}
    />
  );
}