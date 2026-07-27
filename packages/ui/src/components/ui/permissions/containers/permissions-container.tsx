// packages/ui/src/components/ui/permissions/containers/permissions-container.tsx
"use client";

import { useTranslation } from "react-i18next";
import { PermissionsView } from "../permissions-view";
import { useCallback, memo } from "react";

export const PermissionsContainer = memo(function PermissionsContainer() {
  const { t: tOriginal } = useTranslation();

  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
  );

  return <PermissionsView t={safeT} />;
});

PermissionsContainer.displayName = "PermissionsContainer";
