// packages/ui/src/components/ui/workspace/containers/workspace-container.tsx
"use client";

import { useEffect } from "react";
import { useWorkspaces, useWorkspaceMembers } from "@hisabche/api";
import { useWorkspaceStore } from "@hisabche/store";
import { WorkspacePage } from "../workspace-page";

export function WorkspaceContainer() {
  const { data: workspaces } = useWorkspaces();
  const store = useWorkspaceStore();
  const workspaceId = store.workspaceId || workspaces?.[0]?.id;
  const { data: membersData } = useWorkspaceMembers(workspaceId ?? "");

  // ست کردن workspace اول
  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      const first = workspaces[0];
      if (!store.workspaceId) {
        store.setWorkspace(first.id, first.name);
      }
      if (first.myRole) {
        store.setCurrentUserRole(first.myRole);
      }
    }
  }, [workspaces]);

  // آپدیت اعضا با داده واقعی
  useEffect(() => {
    if (membersData && Array.isArray(membersData)) {
      const realMembers = membersData.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        fullName: m.full_name || m.email || "کاربر",
        email: m.email || "",
        role: m.role || "member",
        joinedAt: m.joined_at ? new Date(m.joined_at).getTime() : Date.now(),
        isActive: true,
      }));
      useWorkspaceStore.setState({ members: realMembers });
    }
  }, [membersData]);

  return <WorkspacePage />;
}