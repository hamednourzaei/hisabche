// packages/ui/src/components/ui/workspace/containers/workspace-container.tsx
"use client";

import { useEffect, useCallback, memo, useRef } from "react";
import { useWorkspaces, useWorkspaceMembers } from "@hisabche/api";
import { useWorkspaceStore } from "@hisabche/store";
import { WorkspacePage } from "../workspace-page";

/* ═══════════════════════════════════════════════════════════════════════════
   WorkspaceContainer v3 — Fixed Infinite Loop
   ✅ memo · useCallback · useRef for preventing re-render loops
   ═══════════════════════════════════════════════════════════════════════════ */

export const WorkspaceContainer = memo(function WorkspaceContainer() {
  const { data: workspaces } = useWorkspaces();
  const store = useWorkspaceStore();
  const workspaceId = store.workspaceId || workspaces?.[0]?.id;
  const { data: membersData } = useWorkspaceMembers(workspaceId ?? "");
  
  // ✅ جلوگیری از به‌روزرسانی مکرر با useRef
  const isInitialized = useRef(false);
  const isMembersUpdated = useRef(false);

  // ✅ ست کردن workspace اول (فقط یک بار)
  const setInitialWorkspace = useCallback(() => {
    if (isInitialized.current) return;
    if (workspaces && workspaces.length > 0) {
      const first = workspaces[0];
      if (!store.workspaceId) {
        store.setWorkspace(first.id, first.name);
      }
      if (first.myRole) {
        store.setCurrentUserRole(first.myRole);
      }
      isInitialized.current = true;
    }
  }, [workspaces, store]);

  useEffect(() => {
    setInitialWorkspace();
  }, [setInitialWorkspace]);

  // ✅ آپدیت اعضا (فقط یک بار و با شرط تغییر)
  useEffect(() => {
    if (isMembersUpdated.current) return;
    if (membersData && Array.isArray(membersData) && membersData.length > 0) {
      const realMembers = membersData.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        fullName: m.full_name || m.email || "کاربر",
        email: m.email || "",
        role: m.role || "member",
        joinedAt: m.joined_at ? new Date(m.joined_at).getTime() : Date.now(),
        isActive: true,
      }));
      
      // ✅ فقط اگر members تغییر کرده باشد، به‌روزرسانی کن
      const currentMembers = useWorkspaceStore.getState().members;
      if (JSON.stringify(currentMembers) !== JSON.stringify(realMembers)) {
        useWorkspaceStore.setState({ members: realMembers });
      }
      isMembersUpdated.current = true;
    }
  }, [membersData]);

  return <WorkspacePage />;
});

WorkspaceContainer.displayName = "WorkspaceContainer";