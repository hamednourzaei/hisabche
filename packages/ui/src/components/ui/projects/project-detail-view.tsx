// packages/ui/src/components/ui/projects/project-detail-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { ArrowRight, Plus, Trash2, Check, Circle, Clock, AlertCircle } from "lucide-react";
import { useState, useCallback, useMemo, memo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   ProjectDetailView v3 — Memoized · Type-Safe
   ✅ memo · useCallback · useMemo · type-safe groupedTasks
   ═══════════════════════════════════════════════════════════════════════════ */

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

// ─── Constants ──────────────────────────────────────────────────────────────

const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;
type TaskStatus = typeof TASK_STATUSES[number];

const statusIconMap: Record<TaskStatus, React.ReactNode> = {
  done: <Check className="size-4 text-[hsl(var(--color-success))]" />,
  in_progress: <Clock className="size-4 text-[hsl(var(--color-primary))]" />,
  review: <AlertCircle className="size-4 text-[hsl(var(--color-warning))]" />,
  todo: <Circle className="size-4 text-[hsl(var(--fg-tertiary))]" />,
};

const statusLabelMap: Record<TaskStatus, string> = {
  todo: "projects.todo",
  in_progress: "projects.in_progress",
  review: "projects.review",
  done: "projects.done",
};

// ─── Status Icon ────────────────────────────────────────────────────────────

const StatusIcon = memo(function StatusIcon({ status }: { status: string }) {
  const icon = statusIconMap[status as TaskStatus] || statusIconMap.todo;
  return <>{icon}</>;
});
StatusIcon.displayName = "StatusIcon";

// ─── Task Card ─────────────────────────────────────────────────────────────

const TaskCard = memo(function TaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: TaskData;
  onToggle: (task: TaskData) => void;
  onDelete: (id: string) => void;
}) {
  const isDone = task.status === "done";

  const handleToggle = useCallback(() => onToggle(task), [task, onToggle]);
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(task.id);
    },
    [task.id, onDelete]
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3",
        "hover:border-[hsl(var(--color-primary)/0.3)] transition-colors cursor-pointer",
        isDone && "opacity-60"
      )}
      onClick={handleToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm", isDone && "line-through")}>{task.title}</p>
        <button
          onClick={handleDelete}
          className="shrink-0 p-0.5 rounded hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))] opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Delete task"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {task.due_date && (
        <p className="text-[10px] text-[hsl(var(--fg-tertiary))] mt-1">{task.due_date}</p>
      )}
    </div>
  );
});
TaskCard.displayName = "TaskCard";

// ─── Column ─────────────────────────────────────────────────────────────────

const TaskColumn = memo(function TaskColumn({
  status,
  tasks,
  onToggle,
  onDelete,
  t,
}: {
  status: string;
  tasks: TaskData[];
  onToggle: (task: TaskData) => void;
  onDelete: (id: string) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const label = t(statusLabelMap[status as TaskStatus] || `projects.${status}`, status);

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.5)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))] flex items-center gap-1.5">
          <StatusIcon status={status} />
          {label}
        </h3>
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
});
TaskColumn.displayName = "TaskColumn";

// ─── Main Component ─────────────────────────────────────────────────────────

export const ProjectDetailView = memo(function ProjectDetailView({
  t,
  project,
  isLoading,
  tasks,
  tasksLoading,
  onUpdateProject,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onBack,
}: ProjectDetailViewProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleAddTask = useCallback(async () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    await onCreateTask({ title: trimmed, status: "todo", priority: "medium" });
    setNewTaskTitle("");
  }, [newTaskTitle, onCreateTask]);

  const handleToggleTask = useCallback(
    async (task: TaskData) => {
      const nextStatus = task.status === "done" ? "todo" : "done";
      await onUpdateTask(task.id, { status: nextStatus });
    },
    [onUpdateTask]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTask();
      }
    },
    [handleAddTask]
  );

  // ✅ useMemo برای groupedTasks با type-safe
  const groupedTasks = useMemo(() => {
    const groups: Record<TaskStatus, TaskData[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const task of tasks) {
      const status = task.status as TaskStatus;
      if (status in groups) {
        groups[status].push(task);
      } else {
        groups.todo.push(task);
      }
    }
    return groups;
  }, [tasks]);

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
        <p className="text-[hsl(var(--fg-secondary))]">
          {t("projects.notFound", "پروژه پیدا نشد")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]"
        >
          <ArrowRight className="size-4" />
          {t("action.back", "برگشت")}
        </button>
        <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">{project.name}</h1>
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[hsl(var(--fg-secondary))]">
            {t("projects.progress", "پیشرفت")}
          </span>
          <span className="text-sm font-bold text-[hsl(var(--fg-primary))]">
            {project.progress || 0}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[hsl(var(--surface-muted))] overflow-hidden">
          <div
            className="h-full rounded-full bg-[hsl(var(--color-primary))] transition-all"
            style={{ width: `${project.progress || 0}%` }}
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TASK_STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={groupedTasks[status] ?? []}
            onToggle={handleToggleTask}
            onDelete={onDeleteTask}
            t={t}
          />
        ))}
      </div>

      {/* Add Task */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder={t("projects.taskTitle", "عنوان تسک جدید...")}
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />
        <button
          onClick={handleAddTask}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold",
            "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]",
            "hover:brightness-110 transition"
          )}
        >
          <Plus className="size-4" />
          {t("projects.newTask", "تسک جدید")}
        </button>
      </div>
    </div>
  );
});

ProjectDetailView.displayName = "ProjectDetailView";