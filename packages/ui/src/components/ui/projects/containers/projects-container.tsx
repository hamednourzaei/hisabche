// packages/ui/src/components/ui/projects/containers/projects-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useProjects, useCreateProject, useDeleteProject } from "@hisabche/api";
import { ProjectsView } from "../projects-view";
import { useState, useCallback, memo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   ProjectsContainer v3 — Memoized · Type-Safe
   ✅ memo · useCallback · safeT · type-safe status
   ═══════════════════════════════════════════════════════════════════════════ */

// ✅ import type از projects-view
import type { StatusType } from "../projects-view";

export const ProjectsContainer = memo(function ProjectsContainer() {
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

  // ✅ type-safe status
  const [status, setStatus] = useState<StatusType | undefined>(undefined);

  const { data, isLoading } = useProjects(status ? { status } : undefined);
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const handleCreate = useCallback(
    async (values: Record<string, unknown>) => {
      await createProject.mutateAsync(values);
    },
    [createProject]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteProject.mutateAsync(id);
    },
    [deleteProject]
  );

  const handleView = useCallback(
    (id: string) => router.push(`/projects/${id}`),
    [router]
  );

  return (
    <ProjectsView
      t={safeT}
      projects={data ?? []}
      isLoading={isLoading}
      status={status}
      onStatusChange={setStatus}
      onCreate={handleCreate}
      onDelete={handleDelete}
      onView={handleView}
    />
  );
});

ProjectsContainer.displayName = "ProjectsContainer";