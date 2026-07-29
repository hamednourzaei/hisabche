// packages/ui/src/components/ui/permissions/containers/permissions-container.tsx
"use client";

import { useTranslations } from "next-intl";
import { PermissionsView } from "../permissions-view";
import { useCallback, memo } from "react";

export const PermissionsContainer = memo(function PermissionsContainer() {
  const t = useTranslations();

  return <PermissionsView t={t} />;
});

PermissionsContainer.displayName = "PermissionsContainer";
