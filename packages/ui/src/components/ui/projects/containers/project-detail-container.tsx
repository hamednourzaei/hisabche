// packages/ui/src/components/ui/projects/containers/project-detail-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useProject, useUpdateProject, useProjectTasks, useCreateProjectTask, useUpdateProjectTask, useDeleteProjectTask, useEmployees } from "@hisabche/api";
import { ProjectDetailView } from "../project-detail-view";
import { useCallback, memo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   ProjectDetailContainer v2 — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProjectDetailContainerProps {
  id: string;
}

export const ProjectDetailContainer = memo(function ProjectDetailContainer({
  id,
}: ProjectDetailContainerProps) {
  const { t: tOriginal } = useTranslation();
  const router = useRouter();

  // ✅ safeT wrapper
  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
  );

  const { data: project, isLoading } = useProject(id);
  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(id);
  const { data: employees } = useEmployees();
  const updateProject = useUpdateProject();
  const createTask = useCreateProjectTask();
  const updateTask = useUpdateProjectTask();
  const deleteTask = useDeleteProjectTask();

  const handleUpdateProject = useCallback(
    (values: Record<string, unknown>) => updateProject.mutateAsync({ id, ...values }),
    [id, updateProject]
  );

  const handleCreateTask = useCallback(
    (values: Record<string, unknown>) => createTask.mutateAsync({ ...values, projectId: id }),
    [id, createTask]
  );

  const handleUpdateTask = useCallback(
    (taskId: string, values: Record<string, unknown>) =>
      updateTask.mutateAsync({ id: taskId, ...values }),
    [updateTask]
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => deleteTask.mutateAsync(taskId),
    [deleteTask]
  );

  const handleBack = useCallback(() => router.push("/projects"), [router]);

  return (
    <ProjectDetailView
      t={safeT}
      project={project}
      isLoading={isLoading}
      tasks={tasks ?? []}
      tasksLoading={tasksLoading}
      employees={employees ?? []}
      onUpdateProject={handleUpdateProject}
      onCreateTask={handleCreateTask}
      onUpdateTask={handleUpdateTask}
      onDeleteTask={handleDeleteTask}
      onBack={handleBack}
    />
  );
});

ProjectDetailContainer.displayName = "ProjectDetailContainer";