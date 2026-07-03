// packages/ui/src/components/ui/projects/projects-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { Plus, Kanban, Trash2, Eye, Calendar, Users } from "lucide-react";
import { useState } from "react";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  progress: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
}

interface ProjectsViewProps {
  t: (key: string, fallback?: string) => string;
  projects: Project[];
  isLoading: boolean;
  status: string | undefined;   // ✅ union با undefined
  onStatusChange: (status: string | undefined) => void;
  onCreate: (values: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onView: (id: string) => void;
}

const STATUSES = ["planning", "in_progress", "on_hold", "completed", "cancelled"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export function ProjectsView({
  t, projects, isLoading, status, onStatusChange, onCreate, onDelete, onView,
}: ProjectsViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", priority: "medium" as typeof PRIORITIES[number], startDate: "" });

const handleSubmit = async () => {
  await onCreate({
    name: form.name,
    description: form.description || undefined,
    priority: form.priority,
    startDate: form.startDate 
      ? `${form.startDate}T00:00:00.000Z`   // ✅ ISO datetime کامل
      : new Date().toISOString(),
    status: "planning",
    budget: 0,
    currency: "AFN",
    tags: [],
  });
  setShowForm(false);
  setForm({ name: "", description: "", priority: "medium", startDate: "" });
};

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      planning: "bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]",
      in_progress: "bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]",
      on_hold: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]",
      completed: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]",
      cancelled: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]",
    };
    return map[s] || map.planning;
  };

  const priorityColor = (p: string) => {
    const map: Record<string, string> = {
      low: "text-[hsl(var(--fg-tertiary))]",
      medium: "text-[hsl(var(--color-info))]",
      high: "text-[hsl(var(--color-warning))]",
      urgent: "text-[hsl(var(--color-destructive))]",
    };
    return map[p] || map.medium;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Kanban className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t("projects.title", "پروژه‌ها")}</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold",
          "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]",
        )}>
          <Plus className="size-4" />
          {t("projects.newProject", "پروژه جدید")}
        </button>
      </div>

      {/* Quick Add Form */}
      {showForm && (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder={t("projects.projectName", "نام پروژه")} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm" />
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{t(`projects.${p}`, p)}</option>
              ))}
            </select>
            <input placeholder={t("projects.description", "شرح")} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm sm:col-span-2" />
            <input type="date" value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} className="rounded-full bg-[hsl(var(--color-primary))] text-white px-6 py-2.5 text-sm font-bold">{t("action.save", "ذخیره")}</button>
            <button onClick={() => setShowForm(false)} className="rounded-full border border-[hsl(var(--border-default))] px-6 py-2.5 text-sm">{t("action.cancel", "لغو")}</button>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onStatusChange(undefined)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", !status ? "bg-[hsl(var(--color-primary))] text-white" : "border border-[hsl(var(--border-default))]")}>
          {t("common.all", "همه")}
        </button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => onStatusChange(s)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", status === s ? "bg-[hsl(var(--color-primary))] text-white" : "border border-[hsl(var(--border-default))]")}>
            {t(`projects.${s}`, s)}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
          <Kanban className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
          <p className="text-[hsl(var(--fg-secondary))]">{t("projects.noProjects", "هیچ پروژه‌ای ثبت نشده")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 space-y-3 hover:border-[hsl(var(--color-primary)/0.3)] transition-colors cursor-pointer" onClick={() => onView(p.id)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{p.name}</h3>
                  {p.description && <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">{p.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} className="p-1.5 rounded-lg hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColor(p.status))}>
                  {t(`projects.${p.status}`, p.status)}
                </span>
                <span className={cn("text-xs", priorityColor(p.priority))}>
                  {t(`projects.${p.priority}`, p.priority)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-[hsl(var(--surface-muted))] overflow-hidden">
                <div className="h-full rounded-full bg-[hsl(var(--color-primary))] transition-all" style={{ width: `${p.progress || 0}%` }} />
              </div>
              <div className="flex items-center gap-4 text-xs text-[hsl(var(--fg-tertiary))]">
                {p.start_date && <span className="flex items-center gap-1"><Calendar className="size-3" />{p.start_date}</span>}
                <span>{p.progress || 0}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}