// packages/ui/src/components/ui/hr/employee-detail-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { ArrowRight, Save, User, Phone, Mail, MapPin, Briefcase, Calendar, Banknote } from "lucide-react";
import { useState, useEffect } from "react";

interface EmployeeData {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  father_name?: string;
  national_id?: string;
  phone?: string;
  email?: string;
  address?: string;
  position?: string;
  department?: { id: string; name: string } | null;
  hire_date: string;
  salary: number;
  salary_currency: string;
  status: string;
  employment_type: string;
}

interface EmployeeDetailViewProps {
  t: (key: string, fallback?: string) => string;
  employee: EmployeeData | null | undefined;
  isLoading: boolean;
  onUpdate: (values: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}

export function EmployeeDetailView({ t, employee, isLoading, onUpdate, onBack }: EmployeeDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<EmployeeData>>({});

  useEffect(() => {
    if (employee) setForm(employee);
  }, [employee]);

  const handleSave = async () => {
    await onUpdate({
      firstName: form.first_name,
      lastName: form.last_name,
      phone: form.phone,
      email: form.email,
      position: form.position,
      salary: form.salary,
    });
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 p-8">
        <div className="h-8 w-48 rounded bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-40 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <User className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
        <p className="text-[hsl(var(--fg-secondary))]">{t("hr.notFound", "کارمند پیدا نشد")}</p>
        <button onClick={onBack} className="mt-4 text-sm text-[hsl(var(--color-primary))]">
          {t("action.back", "برگشت")}
        </button>
      </div>
    );
  }

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

  const Field = ({ icon: Icon, label, value, field, editable }: {
    icon: any; label: string; value: string | number; field?: keyof EmployeeData; editable?: boolean;
  }) => (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]">
      <Icon className="size-5 text-[hsl(var(--fg-tertiary))] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{label}</p>
        {isEditing && editable && field ? (
          <input
            value={form[field] as string || ""}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            className="w-full bg-transparent border-b border-[hsl(var(--border-default))] py-1 text-sm font-medium"
          />
        ) : (
          <p className="font-medium text-[hsl(var(--fg-primary))]">{value || "-"}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]">
          <ArrowRight className="size-4" />
          {t("action.back", "برگشت")}
        </button>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold",
            isEditing
              ? "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]"
              : "border border-[hsl(var(--border-default))]",
          )}
        >
          {isEditing ? <Save className="size-4" /> : null}
          {isEditing ? t("action.save", "ذخیره") : t("action.edit", "ویرایش")}
        </button>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.12)] text-xl font-bold text-[hsl(var(--color-primary))]">
            {employee.first_name?.charAt(0)}{employee.last_name?.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{employee.position || "-"}</p>
          </div>
          <div className="ms-auto">{statusBadge(employee.status)}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field icon={Briefcase} label={t("hr.employeeCode", "کد کارمند")} value={employee.employee_code} />
          <Field icon={Phone} label={t("hr.phone", "شماره تماس")} value={employee.phone || "-"} field="phone" editable />
          <Field icon={Mail} label={t("hr.email", "ایمیل")} value={employee.email || "-"} field="email" editable />
          <Field icon={MapPin} label={t("hr.address", "آدرس")} value={employee.address || "-"} />
          <Field icon={Calendar} label={t("hr.hireDate", "تاریخ استخدام")} value={employee.hire_date || "-"} />
          <Field icon={Banknote} label={t("hr.salary", "معاش")} value={`${employee.salary?.toLocaleString("fa-AF")} ${employee.salary_currency || "AFN"}`} field="salary" editable />
        </div>
      </div>

      {/* Tabs placeholder — فازهای بعد */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6">
        <p className="text-sm text-[hsl(var(--fg-secondary))] text-center">
          {t("app.comingSoon", "بخش‌های حضور‌غیاب، حقوق و مرخصی به زودی...")}
        </p>
      </div>
    </div>
  );
}