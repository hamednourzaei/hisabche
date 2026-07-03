// packages/ui/src/components/ui/projects/containers/project-detail-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useProject, useUpdateProject, useProjectTasks, useCreateProjectTask, useUpdateProjectTask, useDeleteProjectTask } from "@hisabche/api";
import { ProjectDetailView } from "../project-detail-view";

export function ProjectDetailContainer({ id }: { id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: project, isLoading } = useProject(id);
  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(id);
  const updateProject = useUpdateProject();
  const createTask = useCreateProjectTask();
  const updateTask = useUpdateProjectTask();
  const deleteTask = useDeleteProjectTask();

  const safeT = (key: string, fallback?: string) => {
    const result = t(key);
    return result !== key ? result : (fallback ?? key);
  };

  return (
    <ProjectDetailView
      t={safeT}
      project={project}
      isLoading={isLoading}
      tasks={tasks ?? []}
      tasksLoading={tasksLoading}
      onUpdateProject={(values) => updateProject.mutateAsync({ id, ...values })}
      onCreateTask={(values) => createTask.mutateAsync({ ...values, projectId: id })}
      onUpdateTask={(taskId, values) => updateTask.mutateAsync({ id: taskId, ...values })}
      onDeleteTask={(taskId) => deleteTask.mutateAsync(taskId)}
      onBack={() => router.push("/projects")}
    />
  );
}