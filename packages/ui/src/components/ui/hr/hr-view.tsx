// packages/ui/src/components/ui/hr/hr-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { Plus, Trash2, Eye, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ─── Schema ──────────────────────────────────────────────────
const employeeSchema = z.object({
  firstName: z.string().min(1, "نام الزامی است"),
  lastName: z.string().min(1, "تخلص الزامی است"),
  fatherName: z.string().optional(),
  employeeCode: z.string().min(1, "کد کارمند الزامی است"),
  nationalId: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("ایمیل معتبر نیست").optional().or(z.literal("")),
  address: z.string().optional(),
  position: z.string().optional(),
  hireDate: z.string().min(1, "تاریخ استخدام الزامی است"),
  salary: z.string().optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

// ─── Types ───────────────────────────────────────────────────
interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  father_name?: string;
  national_id?: string;
  phone?: string;
  email?: string;
  department?: { name: string } | null;
  position?: string;
  status: string;
  hire_date: string;
  salary?: number;
}

interface HrViewProps {
  t: (key: string, fallback?: string) => string;
  employees: Employee[];
  total: number;
  page: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  onCreate: (values: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onView: (id: string) => void;
}

// ─── Component ───────────────────────────────────────────────
export function HrView({
  t, employees, total, page, isLoading,
  onPageChange, onSearch, onCreate, onDelete, onView,
}: HrViewProps) {
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: "", lastName: "", fatherName: "", employeeCode: "",
      nationalId: "", dateOfBirth: "", gender: "", phone: "",
      email: "", address: "", position: "", hireDate: "", salary: "",
    },
  });

  const onSubmit = async (data: EmployeeForm) => {
    await onCreate({
      firstName: data.firstName,
      lastName: data.lastName,
      fatherName: data.fatherName || undefined,
      employeeCode: data.employeeCode,
      nationalId: data.nationalId || undefined,
      dateOfBirth: data.dateOfBirth || undefined,
      gender: data.gender || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      position: data.position || undefined,
      hireDate: data.hireDate ? `${data.hireDate}T00:00:00Z` : new Date().toISOString(),
      salary: data.salary ? Number(data.salary) : 0,
      employmentType: "full_time",
      salaryCurrency: "AFN",
    });
    setShowForm(false);
    reset();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]",
      inactive: "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]",
      terminated: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]",
      on_leave: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]",
    };
    return <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", map[status] || map.active)}>{t(`hr.${status}`, status)}</span>;
  };

  const inputClass = "rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]";
  const errorClass = "border-[hsl(var(--color-destructive))] focus:border-[hsl(var(--color-destructive))]";

  const Field = ({ name, label, type = "text", placeholder }: { name: keyof EmployeeForm; label: string; type?: string; placeholder?: string }) => {
    const err = errors[name];
    return (
      <div>
        <input
          {...register(name)}
          type={type}
          placeholder={placeholder || label}
          className={cn(inputClass, "w-full", err && errorClass)}
        />
        {err && <p className="text-xs text-[hsl(var(--color-destructive))] mt-1 px-1">{err.message}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t("hr.title", "منابع انسانی")}</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold", "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]", "hover:brightness-110 transition")}>
          <Plus className="size-4" />{t("hr.addEmployee", "کارمند جدید")}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field name="firstName" label={t("hr.firstName", "نام *")} />
            <Field name="lastName" label={t("hr.lastName", "تخلص *")} />
            <Field name="fatherName" label={t("hr.fatherName", "نام پدر")} />
            <Field name="employeeCode" label={t("hr.employeeCode", "کد کارمند *")} />
            <Field name="nationalId" label={t("hr.nationalId", "تذکره")} />
            <Field name="dateOfBirth" type="date" label={t("hr.dateOfBirth", "تاریخ تولد")} />
            <select {...register("gender")} className={cn(inputClass, "appearance-none w-full")}>
              <option value="">{t("hr.gender", "جنسیت")}</option>
              <option value="male">{t("hr.male", "مرد")}</option>
              <option value="female">{t("hr.female", "زن")}</option>
            </select>
            <Field name="phone" label={t("hr.phone", "شماره تماس")} />
            <Field name="email" type="email" label={t("hr.email", "ایمیل")} />
            <Field name="address" label={t("hr.address", "آدرس")} />
            <Field name="position" label={t("hr.position", "وظیفه")} />
            <Field name="hireDate" type="date" label={t("hr.hireDate", "تاریخ استخدام *")} />
            <Field name="salary" type="number" label={t("hr.salary", "معاش")} />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className="rounded-full bg-[hsl(var(--color-primary))] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50">
              {isSubmitting ? "..." : t("action.save", "ذخیره")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-[hsl(var(--border-default))] px-6 py-2.5 text-sm">
              {t("action.cancel", "لغو")}
            </button>
          </div>
        </form>
      )}

      {/* Table — unchanged */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">{[1,2,3,4,5].map((i) => (<div key={i} className="h-12 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />))}</div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center"><Users className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" /><p className="text-[hsl(var(--fg-secondary))]">{t("hr.noEmployees", "هیچ کارمندی ثبت نشده")}</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
              <th className="px-4 py-3 text-start font-medium">{t("hr.employeeCode", "کد")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("hr.firstName", "نام")}</th>
              <th className="px-4 py-3 text-start font-medium hidden sm:table-cell">{t("hr.nationalId", "تذکره")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("hr.phone", "تلفن")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("hr.status", "وضعیت")}</th>
              <th className="px-4 py-3 text-center font-medium w-20">...</th>
            </tr></thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{emp.employee_code}</td>
                  <td className="px-4 py-3 font-medium">{emp.first_name} {emp.last_name}</td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] hidden sm:table-cell">{emp.national_id || "-"}</td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">{emp.phone || "-"}</td>
                  <td className="px-4 py-3">{statusBadge(emp.status)}</td>
                  <td className="px-4 py-3"><div className="flex items-center justify-center gap-1">
                    <button onClick={() => onView(emp.id)} className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))]"><Eye className="size-4" /></button>
                    <button onClick={() => onDelete(emp.id)} className="p-1.5 rounded-lg hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]"><Trash2 className="size-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="rounded-full px-4 py-2 text-sm border border-[hsl(var(--border-default))] disabled:opacity-40">{t("action.previous", "قبلی")}</button>
          <span className="text-sm text-[hsl(var(--fg-secondary))]">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= Math.ceil(total / 20)} className="rounded-full px-4 py-2 text-sm border border-[hsl(var(--border-default))] disabled:opacity-40">{t("action.next", "بعدی")}</button>
        </div>
      )}
    </div>
  );
}