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

  // ✅ FIX: قبلاً isMembersUpdated.current بعد از اولین sync برای همیشه
  // true می‌ماند و همین‌جا return می‌کرد — یعنی بعد از اولین بار، دعوت
  // عضو جدید/تغییر نقش/حذف عضو هرگز در UI دیده نمی‌شد مگر با رفرش کامل
  // صفحه. حالا این افکت با هر تغییر واقعی membersData اجرا می‌شود؛
  // مقایسه‌ی JSON.stringify همان‌طور که قبلاً بود، از نوشتن تکراری/حلقه‌ی
  // بی‌نهایت جلوگیری می‌کند.
  useEffect(() => {
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

      // ✅ فقط اگر members واقعاً تغییر کرده باشد، به‌روزرسانی کن
      const currentMembers = useWorkspaceStore.getState().members;
      if (JSON.stringify(currentMembers) !== JSON.stringify(realMembers)) {
        useWorkspaceStore.setState({ members: realMembers });
      }
    }
  }, [membersData]);

  return <WorkspacePage />;
});

WorkspaceContainer.displayName = "WorkspaceContainer";