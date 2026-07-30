// packages/ui/src/components/ui/permissions/containers/permissions-container.tsx
"use client";

import { useTranslations } from "next-intl";
import { PermissionsView } from "../permissions-view";
import { useCallback, memo } from "react";

export const PermissionsContainer = memo(function PermissionsContainer() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };

  return <PermissionsView t={t} />;
});

PermissionsContainer.displayName = "PermissionsContainer";
