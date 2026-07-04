// packages/ui/src/components/ui/hr/employee-detail-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { ArrowRight, Save, User, Mail, MapPin, Briefcase, Calendar, Banknote, CreditCard, UserCircle, Hash, Clock, UserPlus, Edit, ShieldX, Pause, UserCheck, Plane, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { JalaliDatePicker } from "../../ui/jalali-datepicker";
import { PhoneInput } from "../../ui/phone-input";

interface EmployeeData {
  id: string; employee_code: string; first_name: string; last_name: string;
  father_name?: string; national_id?: string; date_of_birth?: string; gender?: string;
  phone?: string; email?: string; address?: string; position?: string;
  department?: { id: string; name: string } | null; hire_date: string;
  salary: number; salary_currency: string; status: string; employment_type: string;
}

interface TimelineEvent { id: string; action: string; date: string; title: string; description?: string; }

interface EmployeeDetailViewProps {
  t: (key: string, fallback?: string) => string;
  employee: EmployeeData | null | undefined; isLoading: boolean;
  onUpdate: (values: Record<string, unknown>) => Promise<void>; onBack: () => void;
}

const STATUS_ACTIONS = [
  { status: "active", label: "فعال", icon: UserCheck, color: "success" },
  { status: "on_leave", label: "مرخصی", icon: Plane, color: "warning" },
  { status: "inactive", label: "غیرفعال", icon: Pause, color: "secondary" },
  { status: "terminated", label: "اخراج", icon: ShieldX, color: "destructive" },
] as const;

function generateTimeline(emp: EmployeeData): TimelineEvent[] {
  const hireDate: string = (emp.hire_date || new Date().toISOString().split("T")[0]) as string;
  const today: string = new Date().toISOString().split("T")[0] as string;
  const lastMonth: string = new Date(Date.now() - 86400000 * 30).toISOString().split("T")[0] as string;
  const events: TimelineEvent[] = [{ id: "1", action: "create", date: hireDate, title: "استخدام شد", description: `به عنوان ${emp.position || "کارمند"} شروع به کار کرد` }];
  if (emp.status === "on_leave") events.unshift({ id: "2", action: "update", date: today, title: "در مرخصی", description: "وضعیت به مرخصی تغییر کرد" });
  const salary = emp.salary as number;
  if (salary && salary > 0) events.push({ id: "3", action: "update", date: lastMonth, title: "معاش ثبت شد", description: `${salary.toLocaleString("fa-AF")} افغانی` });
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export function EmployeeDetailView({ t, employee, isLoading, onUpdate, onBack }: EmployeeDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<EmployeeData>>({});

  useEffect(() => { if (employee) setForm(employee); }, [employee]);

  const handleSave = async () => {
    await onUpdate({ firstName: form.first_name, lastName: form.last_name, fatherName: form.father_name, nationalId: form.national_id, dateOfBirth: form.date_of_birth, gender: form.gender, phone: form.phone, email: form.email, address: form.address, position: form.position, salary: form.salary });
    setIsEditing(false);
  };

  if (isLoading) return (<div className="max-w-3xl mx-auto space-y-4 p-8"><div className="h-8 w-48 rounded bg-[hsl(var(--surface-muted))] animate-pulse" /><div className="h-60 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" /></div>);
  if (!employee) return (<div className="max-w-3xl mx-auto p-8 text-center"><User className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" /><p className="text-[hsl(var(--fg-secondary))]">{t("hr.notFound", "کارمند پیدا نشد")}</p><button onClick={onBack} className="mt-4 text-sm text-[hsl(var(--color-primary))]">{t("action.back", "برگشت")}</button></div>);

  const timeline = generateTimeline(employee);
  const statusBadge = (status: string) => { const m: Record<string, string> = { active: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]", inactive: "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]", terminated: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]", on_leave: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]" }; return <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", m[status] || m.active)}>{t(`hr.${status}`, status)}</span>; };
  const actionColor = (color: string) => { const m: Record<string, string> = { success: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]", warning: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]", destructive: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]", secondary: "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))] border-[hsl(var(--border-default))]" }; return m[color] || m.secondary; };

  const Field = ({ icon: Icon, label, value, field, editable, type }: { icon: any; label: string; value: string | number; field?: keyof EmployeeData; editable?: boolean; type?: string }) => (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]">
      <Icon className="size-5 text-[hsl(var(--fg-tertiary))] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{label}</p>
        {isEditing && editable && field === "date_of_birth" ? (
          <JalaliDatePicker value={form.date_of_birth || ""} onChange={(date) => setForm({ ...form, date_of_birth: date })} placeholder={label} />
        ) : isEditing && editable && field === "phone" ? (
          <PhoneInput value={form.phone || ""} onChange={(val) => setForm({ ...form, phone: val })} placeholder={label} defaultCountry="+93" />
        ) : isEditing && editable && field ? (
          <input type={type || "text"} value={form[field] as string || ""} onChange={(e) => setForm({ ...form, [field]: type === "number" ? Number(e.target.value) : e.target.value })} className="w-full bg-transparent border-b border-[hsl(var(--border-default))] py-1 text-sm font-medium focus:outline-none focus:border-[hsl(var(--color-primary))]" />
        ) : (
          <p className="font-medium text-[hsl(var(--fg-primary))]">{value || "-"}</p>
        )}
      </div>
    </div>
  );

  const timelineIcon = (action: string) => { switch (action) { case "create": return <UserPlus className="size-4 text-[hsl(var(--color-success))]" />; case "update": return <Edit className="size-4 text-[hsl(var(--color-primary))]" />; default: return <Clock className="size-4 text-[hsl(var(--fg-tertiary))]" />; } };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]"><ArrowRight className="size-4" />{t("action.back", "برگشت")}</button>
        <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold", isEditing ? "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]" : "border border-[hsl(var(--border-default))]")}>{isEditing ? <Save className="size-4" /> : null}{isEditing ? t("action.save", "ذخیره") : t("action.edit", "ویرایش")}</button>
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.12)] text-xl font-bold text-[hsl(var(--color-primary))]">{employee.first_name?.charAt(0)}{employee.last_name?.charAt(0)}</div>
          <div><h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">{employee.first_name} {employee.last_name}</h1><p className="text-sm text-[hsl(var(--fg-secondary))]">{employee.father_name ? `فرزند ${employee.father_name}` : ""}</p></div>
          <div className="ms-auto">{statusBadge(employee.status)}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field icon={Hash} label={t("hr.employeeCode", "کد کارمند")} value={employee.employee_code} />
          <Field icon={CreditCard} label={t("hr.nationalId", "تذکره")} value={employee.national_id || "-"} field="national_id" editable />
          <Field icon={Calendar} label={t("hr.dateOfBirth", "تاریخ تولد")} value={employee.date_of_birth || "-"} field="date_of_birth" editable />
          <Field icon={UserCircle} label={t("hr.gender", "جنسیت")} value={employee.gender === "male" ? t("hr.male", "مرد") : employee.gender === "female" ? t("hr.female", "زن") : "-"} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field icon={Phone} label={t("hr.phone", "شماره تماس")} value={employee.phone || "-"} field="phone" editable />
          <Field icon={Mail} label={t("hr.email", "ایمیل")} value={employee.email || "-"} field="email" editable />
          <div className="sm:col-span-2"><Field icon={MapPin} label={t("hr.address", "آدرس")} value={employee.address || "-"} field="address" editable /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field icon={Briefcase} label={t("hr.position", "وظیفه")} value={employee.position || "-"} field="position" editable />
          <Field icon={Calendar} label={t("hr.hireDate", "تاریخ استخدام")} value={employee.hire_date || "-"} />
          <Field icon={Banknote} label={t("hr.salary", "معاش")} value={`${(employee.salary || 0).toLocaleString("fa-AF")} ${employee.salary_currency || "AFN"}`} field="salary" editable type="number" />
          <Field icon={Briefcase} label={t("hr.employmentType", "نوع قرارداد")} value={employee.employment_type || "-"} />
        </div>
        {employee.status !== "terminated" && (
          <div className="flex items-center gap-2 pt-4 border-t border-[hsl(var(--border-default))]">
            <span className="text-xs text-[hsl(var(--fg-tertiary))] shrink-0">تغییر وضعیت:</span>
            <div className="flex gap-1.5 flex-wrap">{STATUS_ACTIONS.filter((a) => a.status !== employee.status).map((action) => { const IconComponent = action.icon; return (<button key={action.status} type="button" onClick={() => onUpdate({ status: action.status })} className={cn("inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors", actionColor(action.color), "hover:brightness-90")}><IconComponent className="size-3.5" />{action.label}</button>); })}</div>
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6">
        <div className="flex items-center gap-2 mb-5"><Clock className="size-5 text-[hsl(var(--color-primary))]" /><h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">تاریخچه فعالیت</h2></div>
        {timeline.length === 0 ? (<p className="text-sm text-[hsl(var(--fg-secondary))] text-center py-4">بدون فعالیت</p>) : (<div className="relative"><div className="absolute start-[19px] top-2 bottom-2 w-px bg-[hsl(var(--border-default))]" /><div className="space-y-4">{timeline.map((event) => (<div key={event.id} className="relative flex items-start gap-4"><div className={cn("relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2", event.action === "create" ? "border-[hsl(var(--color-success)/0.3)] bg-[hsl(var(--color-success)/0.08)]" : "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]")}>{timelineIcon(event.action)}</div><div className="flex-1 min-w-0 pt-1.5"><div className="flex items-center gap-2 flex-wrap"><p className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{event.title}</p><span className="text-[10px] text-[hsl(var(--fg-tertiary))]">{event.date}</span></div>{event.description && (<p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5">{event.description}</p>)}</div></div>))}</div></div>)}
      </div>
    </div>
  );
}