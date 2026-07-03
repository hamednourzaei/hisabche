// packages/ui/src/components/ui/projects/project-detail-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { ArrowRight, Plus, Trash2, Check, Circle, Clock, AlertCircle } from "lucide-react";
import { useState } from "react";

interface ProjectData {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  progress: number;
  start_date?: string;
  end_date?: string;
}

interface TaskData {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee_id?: string;
  due_date?: string;
  order_index: number;
}

interface ProjectDetailViewProps {
  t: (key: string, fallback?: string) => string;
  project: ProjectData | null | undefined;
  isLoading: boolean;
  tasks: TaskData[];
  tasksLoading: boolean;
  onUpdateProject: (values: Record<string, unknown>) => Promise<void>;
  onCreateTask: (values: Record<string, unknown>) => Promise<void>;
  onUpdateTask: (taskId: string, values: Record<string, unknown>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onBack: () => void;
}

const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;

const statusIcon = (s: string) => {
  switch (s) {
    case "done": return <Check className="size-4 text-[hsl(var(--color-success))]" />;
    case "in_progress": return <Clock className="size-4 text-[hsl(var(--color-primary))]" />;
    case "review": return <AlertCircle className="size-4 text-[hsl(var(--color-warning))]" />;
    default: return <Circle className="size-4 text-[hsl(var(--fg-tertiary))]" />;
  }
};

export function ProjectDetailView({
  t, project, isLoading, tasks, tasksLoading,
  onUpdateProject, onCreateTask, onUpdateTask, onDeleteTask, onBack,
}: ProjectDetailViewProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await onCreateTask({ title: newTaskTitle, status: "todo", priority: "medium" });
    setNewTaskTitle("");
  };

  const handleToggleTask = async (task: TaskData) => {
    const nextStatus = task.status === "done" ? "todo" : "done";
    await onUpdateTask(task.id, { status: nextStatus });
  };

  const groupedTasks = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    review: tasks.filter((t) => t.status === "review"),
    done: tasks.filter((t) => t.status === "done"),
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 p-8">
        <div className="h-8 w-48 rounded bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-60 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-[hsl(var(--fg-secondary))]">{t("projects.notFound", "پروژه پیدا نشد")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]">
          <ArrowRight className="size-4" />
          {t("action.back", "برگشت")}
        </button>
        <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">{project.name}</h1>
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[hsl(var(--fg-secondary))]">{t("projects.progress", "پیشرفت")}</span>
          <span className="text-sm font-bold text-[hsl(var(--fg-primary))]">{project.progress || 0}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[hsl(var(--surface-muted))] overflow-hidden">
          <div className="h-full rounded-full bg-[hsl(var(--color-primary))] transition-all" style={{ width: `${project.progress || 0}%` }} />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TASK_STATUSES.map((status) => (
          <div key={status} className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.5)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))] flex items-center gap-1.5">
                {statusIcon(status)}
                {t(`projects.${status}`, status)}
              </h3>
              <span className="text-xs text-[hsl(var(--fg-tertiary))]">{groupedTasks[status]?.length || 0}</span>
            </div>
            <div className="space-y-2">
              {groupedTasks[status]?.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3",
                    "hover:border-[hsl(var(--color-primary)/0.3)] transition-colors cursor-pointer",
                    task.status === "done" && "opacity-60",
                  )}
                  onClick={() => handleToggleTask(task)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm", task.status === "done" && "line-through")}>{task.title}</p>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }} className="shrink-0 p-0.5 rounded hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))] opacity-0 group-hover:opacity-100">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {task.due_date && (
                    <p className="text-[10px] text-[hsl(var(--fg-tertiary))] mt-1">{task.due_date}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Task */}
      <div className="flex gap-3">
        <input
          placeholder={t("projects.taskTitle", "عنوان تسک جدید...")}
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
          className="flex-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-4 py-2.5 text-sm"
        />
        <button onClick={handleAddTask} className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold",
          "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]",
        )}>
          <Plus className="size-4" />
          {t("projects.newTask", "تسک جدید")}
        </button>
      </div>
    </div>
  );
}