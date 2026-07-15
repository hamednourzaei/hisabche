// packages/ui/src/components/ui/navigation/navigation-registry.tsx
"use client";

import { useEffect, useRef, memo } from "react";
import { registerSectionRef } from "../../../lib/menu/navigation-core";

/* ═══════════════════════════════════════════════════════════════════════════
   NavigationRegistry v2 — Memoized
   ✅ memo
   ═══════════════════════════════════════════════════════════════════════════ */

export interface NavigationRegistryProps {
  id: string;
  children: React.ReactNode;
}

export const NavigationRegistry = memo(function NavigationRegistry({
  id,
  children,
}: NavigationRegistryProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      registerSectionRef(id, ref.current);
    }
    return () => {
      registerSectionRef(id, null);
    };
  }, [id]);

  return (
    <div ref={ref} id={id}>
      {children}
    </div>
  );
});

NavigationRegistry.displayName = "NavigationRegistry";