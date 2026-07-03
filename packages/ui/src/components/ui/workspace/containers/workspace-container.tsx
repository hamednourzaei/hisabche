// packages/ui/src/components/ui/workspace/containers/workspace-container.tsx
"use client";

import { useEffect } from "react";
import { useWorkspaces, useWorkspaceMembers } from "@hisabche/api";
import { useWorkspaceStore } from "@hisabche/store";
import { WorkspacePage } from "../workspace-page";

export function WorkspaceContainer() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const store = useWorkspaceStore();

  const activeWorkspaceId = store.workspaceId || workspaces?.[0]?.id;
  const { data: members } = useWorkspaceMembers(activeWorkspaceId ?? "");

  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !store.workspaceId) {
      const ws = workspaces[0];
      store.setWorkspace(ws.id, ws.name);
      store.setCurrentUserRole(ws.myRole || "member");
    }
  }, [workspaces, store]);

  useEffect(() => {
    if (members) {
      store.members = members.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        fullName: m.user?.full_name || m.user?.email || "-",
        email: m.user?.email || "",
        role: m.role,
        joinedAt: m.joined_at ? new Date(m.joined_at).getTime() : Date.now(),
        isActive: true,
      }));
    }
  }, [members, store]);

  return <WorkspacePage />;
}