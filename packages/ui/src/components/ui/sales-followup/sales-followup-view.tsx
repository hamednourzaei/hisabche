"use client";

import { cn } from "@/lib/utils";
import {
  Plus,
  MessageCircle,
  Phone,
  Mail,
  Calendar,
  User,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  Edit,
  Filter,
  Users
} from "lucide-react";
import { useState, useCallback, useMemo, memo } from "react";
import { format } from "date-fns";
import { JalaliDatePicker } from "../jalali-datepicker";

/* ═══════════════════════════════════════════════════════════════════════════
   SalesFollowupView v1 — Complete Sales Follow-up Module
   ✅ memo · useCallback · useMemo · Persian/English localization
   ═══════════════════════════════════════════════════════════════════════════ */

// ✅ export types برای Container
export type FollowUpStatus = "new" | "contacted" | "meeting_scheduled" | "won" | "lost" | "pending";

export interface Customer {
  id: string;
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  avatar?: string | undefined;
}

export interface FollowUp {
  id: string;
  customer: Customer;
  assignedTo: {
    id: string;
    name: string;
    avatar?: string;
  };
  type: "call" | "email" | "meeting" | "note";
  status: FollowUpStatus;
  nextActionDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  reminder?: boolean | undefined;
}

interface SalesFollowupViewProps {
  t: (key: string, fallback?: string) => string;
  followups: FollowUp[];
  customers: Customer[];
  employees: { id: string; name: string }[];
  isLoading: boolean;
  statusFilter?: FollowUpStatus | "all";
  onStatusChange?: (status: FollowUpStatus | "all") => void;
  onCreate: (values: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, values: Partial<FollowUp>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onView: (id: string) => void;
  onFilter?: (filter: { customerId?: string; employeeId?: string; type?: FollowUp["type"] | "all" }) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUSES: { value: FollowUpStatus; label: string; color: string; icon: React.ElementType }[] = [
  { value: "new", label: "جدید", color: "bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]", icon: MessageCircle },
  { value: "contacted", label: "تماس گرفته شد", color: "bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]", icon: Phone },
  { value: "meeting_scheduled", label: "جلسه برنامه‌ریزی", color: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]", icon: Calendar },
  { value: "won", label: "موفق", color: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]", icon: CheckCircle },
  { value: "lost", label: "باخته", color: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]", icon: XCircle },
  { value: "pending", label: "در انتظار", color: "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]", icon: Clock },
];

const TYPES: { value: FollowUp["type"]; label: string; icon: React.ElementType }[] = [
  { value: "call", label: "تماس تلفنی", icon: Phone },
  { value: "email", label: "ایمیل", icon: Mail },
  { value: "meeting", label: "جلسه", icon: Calendar },
  { value: "note", label: "یادداشت", icon: MessageCircle },
];

// ─── Sub-components ────────────────────────────────────────────────────────

const FollowUpCard = memo(function FollowUpCard({
  followUp,
  onUpdate,
  onDelete,
  onView,
  t,
}: {
  followUp: FollowUp;
  onUpdate: (id: string, values: Partial<FollowUp>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onView: (id: string) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const statusInfo = STATUSES.find(s => s.value === followUp.status);
  const typeInfo = TYPES.find(t => t.value === followUp.type);

  const handleStatusChange = useCallback(async (newStatus: FollowUpStatus) => {
    await onUpdate(followUp.id, { status: newStatus });
  }, [followUp.id, onUpdate]);

  const getStatusColor = (status: FollowUpStatus) => {
    const statusInfo = STATUSES.find(s => s.value === status);
    return statusInfo?.color || "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]";
  };

  return (
    <div
      className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 space-y-4 hover:border-[hsl(var(--color-primary)/0.3)] transition-all cursor-pointer"
      onClick={() => onView(followUp.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--color-primary)/0.12)] flex items-center justify-center text-[hsl(var(--color-primary))]">
            <User className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[hsl(var(--fg-primary))] mb-1">{followUp.customer.name}</h3>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{followUp.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {followUp.reminder && (
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--color-warning))] animate-pulse" title="یادآور وجود دارد" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(followUp.id);
            }}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]"
            aria-label="حذف یادداشت"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-[hsl(var(--fg-secondary))]">
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {followUp.assignedTo.name}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {format(new Date(followUp.nextActionDate), 'MMM dd, yyyy')}
          </span>
          <span className="flex items-center gap-1">
            {typeInfo?.icon && <typeInfo.icon className="size-3" />}
            {typeInfo?.label}
          </span>
        </div>

        <p className="text-sm text-[hsl(var(--fg-primary))] line-clamp-2">{followUp.notes}</p>

        <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border-default))]">
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getStatusColor(followUp.status))}>              {statusInfo?.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={followUp.status}
              onChange={(e) => handleStatusChange(e.target.value as FollowUpStatus)}
              onClick={(e) => e.stopPropagation()}
              className="text-xs border border-[hsl(var(--border-default))] rounded px-2 py-1 bg-[hsl(var(--surface-base))]"
            >
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
});
FollowUpCard.displayName = "FollowUpCard";

// ─── Form Component ────────────────────────────────────────────────────────

interface FormData {
  customerId: string;
  assignedTo: string;
  type: FollowUp["type"];
  status: FollowUpStatus;
  nextActionDate: string;
  notes: string;
  reminder: boolean;
}

const FollowUpForm = memo(function FollowUpForm({
  form,
  setForm,
  customers,
  employees,
  onSubmit,
  onCancel,
  t,
  isSubmitting,
}: {
  form: FormData;
  setForm: (data: FormData) => void;
  customers: Customer[];
  employees: { id: string; name: string }[];
  onSubmit: () => void;
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
  isSubmitting: boolean;
}) {
  const inputClass = "rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] transition-colors duration-150";

  const handleFieldChange = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm({ ...form, [field]: value });
  }, [form, setForm]);

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-2">{t("sales.followup.customer", "مشتری")}</label>
          <select
            value={form.customerId}
            onChange={(e) => handleFieldChange("customerId", e.target.value)}
            className={cn(inputClass, "w-full")}
          >
            <option value="">{t("common.select", "انتخاب کنید")}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-2">{t("sales.followup.assignedTo", "مسئول")}</label>
          <select
            value={form.assignedTo}
            onChange={(e) => handleFieldChange("assignedTo", e.target.value)}
            className={cn(inputClass, "w-full")}
          >
            <option value="">{t("common.select", "انتخاب کنید")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-2">{t("sales.followup.type", "نوع")}</label>
          <select
            value={form.type}
            onChange={(e) => handleFieldChange("type", e.target.value as FollowUp["type"])}
            className={cn(inputClass, "w-full")}
          >
            {TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-2">{t("sales.followup.status", "وضعیت")}</label>
          <select
            value={form.status}
            onChange={(e) => handleFieldChange("status", e.target.value as FollowUpStatus)}
            className={cn(inputClass, "w-full")}
          >
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-2">{t("sales.followup.nextActionDate", "تاریخ اقدام بعدی")}</label>
          <JalaliDatePicker
            value={form.nextActionDate}
            onChange={(date) => handleFieldChange("nextActionDate", date || "")}
            placeholder={t("sales.followup.selectDate", "تاریخ را انتخاب کنید")}
            className="w-full"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-2">{t("sales.followup.notes", "یادداشت‌ها")}</label>
          <textarea
            value={form.notes}
            onChange={(e) => handleFieldChange("notes", e.target.value)}
            placeholder={t("sales.followup.notesPlaceholder", "یادداشت‌ها...")}
            className={cn(inputClass, "w-full h-24 resize-none")}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.reminder}
              onChange={(e) => handleFieldChange("reminder", e.target.checked)}
              className="rounded border-[hsl(var(--border-default))] text-[hsl(var(--color-primary))] focus:ring-[hsl(var(--color-primary)/0.5)]"
            />
            <span className="text-sm text-[hsl(var(--fg-primary))] font-medium">{t("sales.followup.reminder", "تنظیم یادآور")}</span>
          </label>
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="rounded-full border border-[hsl(var(--border-default))] px-6 py-2.5 text-sm font-medium hover:bg-[hsl(var(--surface-muted))] transition-colors"
        >
          {t("action.cancel", "لغو")}
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting || !form.customerId || !form.assignedTo || !form.nextActionDate}
          className="rounded-full bg-[hsl(var(--color-primary))] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all"
        >
          {isSubmitting ? "..." : t("action.save", "ذخیره")}
        </button>
      </div>
    </div>
  );
});
FollowUpForm.displayName = "FollowUpForm";

// ─── Main Component ─────────────────────────────────────────────────────────

export const SalesFollowupView = memo(function SalesFollowupView({
  t,
  followups,
  customers,
  employees,
  isLoading,
  statusFilter = "all",
  onStatusChange,
  onCreate,
  onUpdate,
  onDelete,
  onView,
  onFilter,
}: SalesFollowupViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>({
    customerId: "",
    assignedTo: "",
    type: "call",
    status: "new",
    nextActionDate: "",
    notes: "",
    reminder: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterCustomer, setFilterCustomer] = useState<string>("");
  const [filterEmployee, setFilterEmployee] = useState<string>("");
  const [filterType, setFilterType] = useState<FollowUp["type"] | "all">("all");

  const filteredFollowups = useMemo(() => {
    let filtered = followups;
    if (statusFilter !== "all") {
      filtered = filtered.filter(f => f.status === statusFilter);
    }
    if (filterCustomer) {
      filtered = filtered.filter(f => f.customer.id === filterCustomer);
    }
    if (filterEmployee) {
      filtered = filtered.filter(f => f.assignedTo.id === filterEmployee);
    }
    if (filterType !== "all") {
      filtered = filtered.filter(f => f.type === filterType);
    }
    return filtered;
  }, [followups, statusFilter, filterCustomer, filterEmployee, filterType]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === form.customerId);
      const assignedEmployee = employees.find(e => e.id === form.assignedTo);
      if (!customer || !assignedEmployee) return;

      await onCreate({
        customerId: form.customerId,
        assignedTo: form.assignedTo,
        type: form.type,
        status: form.status,
        nextActionDate: form.nextActionDate ? `${form.nextActionDate}T00:00:00.000Z` : new Date().toISOString(),
        notes: form.notes,
        reminder: form.reminder,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        assignedEmployee: {
          id: assignedEmployee.id,
          name: assignedEmployee.name,
        },
      });
      setShowForm(false);
      setForm({
        customerId: "",
        assignedTo: "",
        type: "call",
        status: "new",
        nextActionDate: "",
        notes: "",
        reminder: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [form, customers, employees, onCreate]);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setForm({
      customerId: "",
      assignedTo: "",
      type: "call",
      status: "new",
      nextActionDate: "",
      notes: "",
      reminder: false,
    });
  }, []);

  const toggleForm = useCallback(() => {
    setShowForm(prev => !prev);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t("sales.followup.title", "پیگیری فروش")}</h1>
        </div>
        <button
          onClick={toggleForm}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] hover:brightness-110 transition"
        >
          <Plus className="size-4" />
          {t("sales.followup.newFollowup", "پیگیری جدید")}
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--fg-primary))]">
          <Filter className="size-4" />
          {t("sales.followup.filters", "فیلترها")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <select
            value={filterCustomer}
            onChange={(e) => {
              setFilterCustomer(e.target.value);
              onFilter?.({ customerId: e.target.value, employeeId: filterEmployee, type: filterType });
            }}
            className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm"
          >
            <option value="">{t("sales.followup.allCustomers", "همه مشتریان")}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>

          <select
            value={filterEmployee}
            onChange={(e) => {
              setFilterEmployee(e.target.value);
              onFilter?.({ customerId: filterCustomer, employeeId: e.target.value, type: filterType });
            }}
            className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm"
          >
            <option value="">{t("sales.followup.allEmployees", "همه کارمندان")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value as FollowUp["type"] | "all");
              onFilter?.({ customerId: filterCustomer, employeeId: filterEmployee, type: e.target.value as FollowUp["type"] | "all" });
            }}
            className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm"
          >
            <option value="all">{t("sales.followup.allTypes", "همه انواع")}</option>
            {TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <FollowUpForm
          form={form}
          setForm={setForm}
          customers={customers}
          employees={employees}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          t={t}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Status Filter */}
      {onStatusChange && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onStatusChange("all")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === "all"
                ? "bg-[hsl(var(--color-primary))] text-white"
                : "border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted))]"
            )}
          >
            {t("common.all", "همه")}
          </button>
          {STATUSES.map((status) => (
            <button
              key={status.value}
              onClick={() => onStatusChange(status.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1",
                statusFilter === status.value
                  ? status.color
                  : "border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted))]"
              )}
            >
              <status.icon className="size-3" />
              {status.label}
            </button>
          ))}
        </div>
      )}

      {/* Follow-ups Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
          ))}
        </div>
      ) : filteredFollowups.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
          <MessageCircle className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
          <p className="text-[hsl(var(--fg-secondary))]">{t("sales.followup.noFollowups", "هیچ پیگیری ثبت نشده")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredFollowups.map((followup) => (
            <FollowUpCard
              key={followup.id}
              followUp={followup}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onView={onView}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
});

SalesFollowupView.displayName = "SalesFollowupView";