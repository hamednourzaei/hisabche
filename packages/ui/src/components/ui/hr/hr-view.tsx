// packages/ui/src/components/ui/hr/hr-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { Plus, Search, Trash2, Eye, Users } from "lucide-react";
import { useState } from "react";

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  phone?: string;
  department?: { name: string } | null;
  position?: string;
  status: string;
  hire_date: string;
}

interface HrViewProps {
  t: (key: string, fallback?: string) => string;
  employees: Employee[];
  total: number;
  page: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  onCreate: (values: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onView: (id: string) => void;
}

export function HrView({
  t, employees, total, page, isLoading,
  onPageChange, onSearch, onCreate, onDelete, onView,
}: HrViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", employeeCode: "", phone: "", position: "", hireDate: "" });

  const handleSubmit = async () => {
    await onCreate({
      firstName: form.firstName,
      lastName: form.lastName,
      employeeCode: form.employeeCode,
      phone: form.phone || undefined,
      position: form.position || undefined,
      hireDate: form.hireDate 
  ? `${form.hireDate}T00:00:00Z` 
  : new Date().toISOString(),
      employmentType: "full_time",
      salary: 0,
      salaryCurrency: "AFN",
    });
    setShowForm(false);
    setForm({ firstName: "", lastName: "", employeeCode: "", phone: "", position: "", hireDate: "" });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]",
      inactive: "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]",
      terminated: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]",
      on_leave: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]",
    };
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", map[status] || map.active)}>
        {t(`hr.${status}`, status)}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t("hr.title", "منابع انسانی")}</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold",
            "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]",
            "hover:brightness-110 transition",
          )}
        >
          <Plus className="size-4" />
          {t("hr.addEmployee", "کارمند جدید")}
        </button>
      </div>

      {/* Quick Add Form */}
      {showForm && (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              placeholder={t("hr.firstName", "نام")}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm"
            />
            <input
              placeholder={t("hr.lastName", "تخلص")}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm"
            />
            <input
              placeholder={t("hr.employeeCode", "کد کارمند")}
              value={form.employeeCode}
              onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm"
            />
            <input
              placeholder={t("hr.phone", "شماره تماس")}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm"
            />
            <input
              placeholder={t("hr.position", "وظیفه")}
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm"
            />
            <input
              type="date"
              value={form.hireDate}
              onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} className="rounded-full bg-[hsl(var(--color-primary))] text-white px-6 py-2.5 text-sm font-bold">
              {t("action.save", "ذخیره")}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-full border border-[hsl(var(--border-default))] px-6 py-2.5 text-sm">
              {t("action.cancel", "لغو")}
            </button>
          </div>
        </div>
      )}

      {/* Employees Table */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
            <p className="text-[hsl(var(--fg-secondary))]">{t("hr.noEmployees", "هیچ کارمندی ثبت نشده")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                <th className="px-4 py-3 text-start font-medium">{t("hr.employeeCode", "کد")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("hr.firstName", "نام")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("hr.department", "دپارتمان")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("hr.position", "وظیفه")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("hr.status", "وضعیت")}</th>
                <th className="px-4 py-3 text-center font-medium w-20">...</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{emp.employee_code}</td>
                  <td className="px-4 py-3 font-medium">{emp.first_name} {emp.last_name}</td>
                  <td className="px-4 py-3 text-[hsl(var(--fg-secondary))]">{emp.department?.name || "-"}</td>
                  <td className="px-4 py-3 text-[hsl(var(--fg-secondary))]">{emp.position || "-"}</td>
                  <td className="px-4 py-3">{statusBadge(emp.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onView(emp.id)} className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))]">
                        <Eye className="size-4" />
                      </button>
                      <button onClick={() => onDelete(emp.id)} className="p-1.5 rounded-lg hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="rounded-full px-4 py-2 text-sm border border-[hsl(var(--border-default))] disabled:opacity-40"
          >
            {t("action.previous", "قبلی")}
          </button>
          <span className="text-sm text-[hsl(var(--fg-secondary))]">{page} / {Math.ceil(total / 20)}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="rounded-full px-4 py-2 text-sm border border-[hsl(var(--border-default))] disabled:opacity-40"
          >
            {t("action.next", "بعدی")}
          </button>
        </div>
      )}
    </div>
  );
}