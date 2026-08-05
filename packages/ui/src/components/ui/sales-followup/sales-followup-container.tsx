"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SalesFollowupView } from "./sales-followup-view";
import { useSalesFollowups, useCreateFollowup, useUpdateFollowup, useDeleteFollowup } from "@hisabche/api";
import { useCustomers } from "@hisabche/api";
import { useEmployees } from "@hisabche/api";

export function SalesFollowupContainer() {
  const t = useTranslations();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<SalesFollowup.FollowUpStatus | "all">("all");
  const [page, setPage] = useState(1);

  const { data: followupsResponse, isLoading, refetch } = useSalesFollowups({
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 20,
  });

  const { data: customersData } = useCustomers();

  const { data: employeesData } = useEmployees();

  const { mutateAsync: createFollowup } = useCreateFollowup();

  const { mutateAsync: updateFollowup } = useUpdateFollowup();

  const { mutateAsync: deleteFollowup } = useDeleteFollowup();

  const followups = followupsResponse?.data ?? [];
  const total = followupsResponse?.total ?? 0;

  const handleCreate = async (values: Record<string, unknown>) => {
    await createFollowup(values);
    refetch();
  };

  const handleUpdate = async (id: string, values: Partial<SalesFollowup.FollowUp>) => {
    await updateFollowup({ id, ...values });
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteFollowup(id);
    refetch();
  };

  const handleFilter = (filter: { customerId?: string; employeeId?: string; type?: SalesFollowup.FollowUp.Type }) => {
    // Filter handled by API params
    refetch();
  };

  return (
    <SalesFollowupView
      t={t}
      followups={followups}
      customers={customersData?.customers ?? []}
      employees={employeesData?.employees ?? []}
      isLoading={isLoading}
      statusFilter={statusFilter}
      onStatusChange={setStatusFilter}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onView={(id) => router.push(`/sales-followup/${id}`)}
      onFilter={handleFilter}
    />
  );
}