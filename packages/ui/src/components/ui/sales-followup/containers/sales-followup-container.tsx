"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import { SalesFollowupView, type FollowUpStatus, type FollowUp } from "../sales-followup-view";
import { useSalesFollowups, useCreateFollowup, useUpdateFollowup, useDeleteFollowup, type FollowUp as ApiFollowUp } from "@hisabche/api";
import { useCustomers } from "@hisabche/api";
import { useEmployees } from "@hisabche/api";

export function SalesFollowupContainer() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<FollowUpStatus | "all">("all");
  const [page, setPage] = useState(1);

  const { data: followupsResponse, isLoading, refetch } = useSalesFollowups(
    statusFilter === "all"
      ? { page, limit: 20 }
      : { status: statusFilter, page, limit: 20 }
  );

  const { data: customersData } = useCustomers();

  const { data: employeesData } = useEmployees();

  const { mutateAsync: createFollowup } = useCreateFollowup();

  const { mutateAsync: updateFollowup } = useUpdateFollowup();

  const { mutateAsync: deleteFollowup } = useDeleteFollowup();

  const followups: FollowUp[] = useMemo(
    () =>
      (followupsResponse?.data ?? []).map((f: ApiFollowUp) => ({
        id: f.id,
        customer: {
          id: f.customer_id,
          name: f.customer_name,
          email: f.customer_email,
          phone: f.customer_phone,
        },
        assignedTo: {
          id: f.assigned_to_id,
          name: f.assigned_to_name,
        },
        type: f.type,
        status: f.status,
        nextActionDate: f.next_action_date,
        notes: f.notes,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
        reminder: f.reminder,
      })),
    [followupsResponse]
  );
  const total = followupsResponse?.total ?? 0;

  const customers = useMemo(
    () =>
      ((customersData?.customers ?? []) as Array<Record<string, unknown>>).map((c) => ({
        id: String(c.id ?? ""),
        name: String(c.name ?? (c.fullName as string) ?? ""),
        email: (c.email as string | undefined) ?? undefined,
        phone: (c.phone as string | undefined) ?? undefined,
      })),
    [customersData]
  );

  const employees = useMemo(
    () =>
      ((employeesData?.employees ?? []) as Array<Record<string, unknown>>).map((e) => ({
        id: String(e.id ?? ""),
        name: [e.first_name, e.last_name].filter(Boolean).join(" ") || String(e.employee_code ?? "") || "",
      })),
    [employeesData]
  );

  const handleCreate = async (values: Record<string, unknown>) => {
    await createFollowup(values as unknown as Parameters<typeof createFollowup>[0]);
    refetch();
  };

  const handleUpdate = async (id: string, values: Partial<FollowUp>) => {
    const { customer, assignedTo, ...rest } = values;
    const payload = {
      id,
      ...rest,
      customer_id: customer?.id,
      assigned_to_id: assignedTo?.id,
      next_action_date: values.nextActionDate,
    };
    await updateFollowup(payload as unknown as Parameters<typeof updateFollowup>[0]);
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteFollowup(id);
    refetch();
  };

  const handleFilter = () => {
    // Filter handled by API params
    refetch();
  };

  return (
    <SalesFollowupView
      t={t}
      followups={followups}
      customers={customers}
      employees={employees}
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