// packages/ui/src/components/ui/navigation/navigation-registry.tsx
"use client";

import { useEffect, useRef } from "react";
import { registerSectionRef } from "../../../lib/menu/navigation-core";

export interface NavigationRegistryProps {
  id: string;
  children: React.ReactNode;
}

export function NavigationRegistry({ id, children }: NavigationRegistryProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      console.log("📍 Registering section:", id);
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
}