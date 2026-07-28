// packages/ui/src/components/ui/human-resources/employee-detail-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { ArrowRight, Save, User, Mail, MapPin, Briefcase, Calendar, Banknote, CreditCard, UserCircle, Hash, Clock, UserPlus, Edit, ShieldX, Pause, UserCheck, Plane, Phone } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { JalaliDatePicker } from "../../ui/jalali-datepicker";
import { PhoneInput } from "../../ui/phone-input";
import { MoneyInput } from "../../ui/money-input";

/* ═══════════════════════════════════════════════════════════════════════════
   EmployeeDetailView v2 — Memoized · Performance Optimized
   ✅ memo · useCallback · useMemo
   ═══════════════════════════════════════════════════════════════════════════ */

interface EmployeeData {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  father_name?: string;
  national_id?: string;
  date_of_birth?: string;
  gender?: string;
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

interface TimelineEvent {
  id: string;
  action: string;
  date: string;
  title: string;
  description?: string;
}

interface EmployeeDetailViewProps {
  t: (key: string, fallback?: string) => string;
  employee: EmployeeData | null | undefined;
  isLoading: boolean;
  onUpdate: (values: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateTimeline(emp: EmployeeData, t: (key: string, fallback?: string) => string): TimelineEvent[] {
  const hireDate = (emp.hire_date || new Date().toISOString().split("T")[0]) as string;
  const today = new Date().toISOString().split("T")[0] as string;
  const lastMonth = new Date(Date.now() - 86400000 * 30).toISOString().split("T")[0] as string;

  const events: TimelineEvent[] = [
    {
      id: "1",
      action: "create",
      date: hireDate,
      title: t("hr.hired", "استخدام شد"),
      description: t("hr.hiredDesc", `به عنوان ${emp.position || "کارمند"} شروع به کار کرد`),
    },
  ];

  if (emp.status === "on_leave") {
    events.unshift({
      id: "2",
      action: "update",
      date: today,
      title: t("hr.onLeaveStatus", "در مرخصی"),
      description: t("hr.onLeaveDesc", "وضعیت به مرخصی تغییر کرد"),
    });
  }

  const salary = emp.salary as number;
  if (salary && salary > 0) {
    events.push({
      id: "3",
      action: "update",
      date: lastMonth,
      title: t("hr.salaryRecorded", "معاش ثبت شد"),
      description: t("hr.salaryAmount", `${salary.toLocaleString("fa-AF")} افغانی`),
    });
  }

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Status Badge ──────────────────────────────────────────────────────────

const statusBadgeMap: Record<string, string> = {
  active: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]",
  inactive: "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]",
  terminated: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]",
  on_leave: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]",
};

function getStatusBadge(status: string, t: (key: string, fallback?: string) => string) {
  const cls = statusBadgeMap[status] || statusBadgeMap.active;
  return <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", cls)}>{t(`hr.${status}`, status)}</span>;
}

// ─── Status Actions ────────────────────────────────────────────────────────

const STATUS_ACTIONS = [
  { status: "active", labelKey: "hr.active", icon: UserCheck, color: "success" },
  { status: "on_leave", labelKey: "hr.on_leave", icon: Plane, color: "warning" },
  { status: "inactive", labelKey: "hr.inactive", icon: Pause, color: "secondary" },
  { status: "terminated", labelKey: "hr.terminated", icon: ShieldX, color: "destructive" },
] as const;

const actionColorMap: Record<string, string> = {
  success: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]",
  warning: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]",
  destructive: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]",
  secondary: "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))] border-[hsl(var(--border-default))]",
};

// ─── Sub-components ────────────────────────────────────────────────────────

const TimelineIcon = memo(function TimelineIcon({ action }: { action: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    create: <UserPlus className="size-4 text-[hsl(var(--color-success))]" />,
    update: <Edit className="size-4 text-[hsl(var(--color-primary))]" />,
  };
  const icon = iconMap[action] || <Clock className="size-4 text-[hsl(var(--fg-tertiary))]" />;
  const bgClass = action === "create"
    ? "border-[hsl(var(--color-success)/0.3)] bg-[hsl(var(--color-success)/0.08)]"
    : "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]";

  return (
    <div className={cn("relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2", bgClass)}>
      {icon}
    </div>
  );
});
TimelineIcon.displayName = "TimelineIcon";

// ─── Field Component ──────────────────────────────────────────────────────

const Field = memo(function Field({
  icon: Icon,
  label,
  value,
  field,
  editable,
  type,
  form,
  setForm,
  isEditing,
  t,
}: {
  icon: any;
  label: string;
  value: string | number;
  field?: keyof EmployeeData;
  editable?: boolean;
  type?: string;
  form?: Partial<EmployeeData>;
  setForm?: (form: Partial<EmployeeData>) => void;
  isEditing?: boolean;
  t?: (key: string, fallback?: string) => string;
}) {
  const isEditable = isEditing && editable && field;

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]">
      <Icon className="size-5 text-[hsl(var(--fg-tertiary))] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{label}</p>
        {isEditable && field === "date_of_birth" ? (
          <JalaliDatePicker
            value={form?.[field] as string || ""}
            onChange={(date) => setForm?.({ ...form, date_of_birth: date })}
            placeholder={label}
          />
        ) : isEditable && field === "phone" ? (
          <PhoneInput
            value={form?.phone || ""}
            onChange={(val) => setForm?.({ ...form, phone: val })}
            placeholder={label}
            defaultCountry="+93"
          />
        ) : isEditable && field === "salary" ? (
          <MoneyInput
            value={form?.salary ?? ""}
            onChange={(raw) => setForm?.({ ...form, salary: Number(raw) || 0 })}
            placeholder={label}
            className="w-full bg-transparent border-b border-[hsl(var(--border-default))] rounded-none px-0 py-1 h-auto text-sm font-medium focus:outline-none focus:ring-0 focus:border-[hsl(var(--color-primary))]"
          />
        ) : isEditable && field ? (
          <input
            type={type || "text"}
            value={(form?.[field] as string) || ""}
            onChange={(e) =>
              setForm?.({
                ...form,
                [field]: type === "number" ? Number(e.target.value) : e.target.value,
              })
            }
            className="w-full bg-transparent border-b border-[hsl(var(--border-default))] py-1 text-sm font-medium focus:outline-none focus:border-[hsl(var(--color-primary))]"
          />
        ) : (
          <p className="font-medium text-[hsl(var(--fg-primary))]">{value || "-"}</p>
        )}
      </div>
    </div>
  );
});
Field.displayName = "Field";

// ─── Main Component ────────────────────────────────────────────────────────

export const EmployeeDetailView = memo(function EmployeeDetailView({
  t,
  employee,
  isLoading,
  onUpdate,
  onBack,
}: EmployeeDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<EmployeeData>>({});

  useEffect(() => {
    if (employee) setForm(employee);
  }, [employee]);

  const handleSave = useCallback(async () => {
    await onUpdate({
      firstName: form.first_name,
      lastName: form.last_name,
      fatherName: form.father_name,
      nationalId: form.national_id,
      dateOfBirth: form.date_of_birth,
      gender: form.gender,
      phone: form.phone,
      email: form.email,
      address: form.address,
      position: form.position,
      salary: form.salary,
    });
    setIsEditing(false);
  }, [form, onUpdate]);

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      handleSave();
    } else {
      setIsEditing(true);
    }
  }, [isEditing, handleSave]);

  const timeline = useMemo(
    () => (employee ? generateTimeline(employee, t) : []),
    [employee, t]
  );

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 p-8">
        <div className="h-8 w-48 rounded bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-60 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <User className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
        <p className="text-[hsl(var(--fg-secondary))]">{t("hr.notFound", "کارمند پیدا نشد")}</p>
        <button onClick={onBack} className="mt-4 text-sm text-[hsl(var(--color-primary))]">
          {t("action.back", "برگشت")}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]"
        >
          <ArrowRight className="size-4" />
          {t("action.back", "برگشت")}
        </button>
        <button
          onClick={handleEditToggle}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold",
            isEditing
              ? "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]"
              : "border border-[hsl(var(--border-default))]"
          )}
        >
          {isEditing ? <Save className="size-4" /> : null}
          {isEditing ? t("action.save", "ذخیره") : t("action.edit", "ویرایش")}
        </button>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.12)] text-xl font-bold text-[hsl(var(--color-primary))]">
            {employee.first_name?.charAt(0)}
            {employee.last_name?.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {employee.father_name ? t("hr.sonOf", `فرزند ${employee.father_name}`) : ""}
            </p>
          </div>
          <div className="ms-auto">{getStatusBadge(employee.status, t)}</div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            icon={Hash}
            label={t("hr.employeeCode", "کد کارمند")}
            value={employee.employee_code}
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={CreditCard}
            label={t("hr.nationalId", "تذکره")}
            value={employee.national_id || "-"}
            field="national_id"
            editable
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={Calendar}
            label={t("hr.dateOfBirth", "تاریخ تولد")}
            value={employee.date_of_birth || "-"}
            field="date_of_birth"
            editable
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={UserCircle}
            label={t("hr.gender", "جنسیت")}
            value={
              employee.gender === "male"
                ? t("hr.male", "مرد")
                : employee.gender === "female"
                ? t("hr.female", "زن")
                : "-"
            }
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            icon={Phone}
            label={t("hr.phone", "شماره تماس")}
            value={employee.phone || "-"}
            field="phone"
            editable
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={Mail}
            label={t("hr.email", "ایمیل")}
            value={employee.email || "-"}
            field="email"
            editable
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <div className="sm:col-span-2">
            <Field
              icon={MapPin}
              label={t("hr.address", "آدرس")}
              value={employee.address || "-"}
              field="address"
              editable
              isEditing={isEditing}
              form={form}
              setForm={setForm}
              t={t}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            icon={Briefcase}
            label={t("hr.position", "وظیفه")}
            value={employee.position || "-"}
            field="position"
            editable
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={Calendar}
            label={t("hr.hireDate", "تاریخ استخدام")}
            value={employee.hire_date || "-"}
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={Banknote}
            label={t("hr.salary", "معاش")}
            value={`${(employee.salary || 0).toLocaleString("fa-AF")} ${employee.salary_currency || "AFN"}`}
            field="salary"
            editable
            type="number"
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={Briefcase}
            label={t("hr.employmentType", "نوع قرارداد")}
            value={employee.employment_type || "-"}
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
        </div>

        {/* Status Change */}
        {employee.status !== "terminated" && (
          <div className="flex items-center gap-2 pt-4 border-t border-[hsl(var(--border-default))]">
            <span className="text-xs text-[hsl(var(--fg-tertiary))] shrink-0">
              {t("hr.changeStatus", "تغییر وضعیت:")}
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_ACTIONS.filter((a) => a.status !== employee.status).map((action) => {
                const IconComponent = action.icon;
                const colorClass = actionColorMap[action.color] || actionColorMap.secondary;
                return (
                  <button
                    key={action.status}
                    type="button"
                    onClick={() => onUpdate({ status: action.status })}
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                      colorClass,
                      "hover:brightness-90"
                    )}
                  >
                    <IconComponent className="size-3.5" />
                    {t(action.labelKey, action.status)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="size-5 text-[hsl(var(--color-primary))]" />
          <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t("hr.activityHistory", "تاریخچه فعالیت")}
          </h2>
        </div>

        {timeline.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))] text-center py-4">
            {t("hr.noActivity", "بدون فعالیت")}
          </p>
        ) : (
          <div className="relative">
            <div className="absolute start-[19px] top-2 bottom-2 w-px bg-[hsl(var(--border-default))]" />
            <div className="space-y-4">
              {timeline.map((event) => (
                <div key={event.id} className="relative flex items-start gap-4">
                  <TimelineIcon action={event.action} />
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                        {event.title}
                      </p>
                      <span className="text-[10px] text-[hsl(var(--fg-tertiary))]">
                        {event.date}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

EmployeeDetailView.displayName = "EmployeeDetailView";