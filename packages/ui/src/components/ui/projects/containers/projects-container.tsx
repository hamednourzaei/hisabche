// packages/ui/src/components/ui/projects/containers/projects-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useProjects, useCreateProject, useDeleteProject } from "@hisabche/api";
import { ProjectsView } from "../projects-view";
import { useState } from "react";

export function ProjectsContainer() {
  const { t } = useTranslation();
  const router = useRouter();
  const [status, setStatus] = useState<string | undefined>(undefined);

  const { data, isLoading } = useProjects(status ? { status } : undefined);
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const safeT = (key: string, fallback?: string) => {
    const result = t(key);
    return result !== key ? result : (fallback ?? key);
  };

  const handleCreate = async (values: any) => {
    await createProject.mutateAsync(values);
  };

  const handleDelete = async (id: string) => {
    await deleteProject.mutateAsync(id);
  };

  return (
    <ProjectsView
      t={safeT}
      projects={data ?? []}
      isLoading={isLoading}
      status={status}
      onStatusChange={setStatus}
      onCreate={handleCreate}
      onDelete={handleDelete}
      onView={(id) => router.push(`/projects/${id}`)}
    />
  );
}