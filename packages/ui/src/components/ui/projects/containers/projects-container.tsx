// packages/ui/src/components/ui/projects/containers/projects-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };
  const router = useRouter();

  const safeT = t;

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