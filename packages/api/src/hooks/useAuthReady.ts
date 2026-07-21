// packages/api/src/hooks/useAuthReady.ts
"use client";

import { useEffect, useState } from "react";
import { isTokenProviderReady, tokenReady } from "../lib/tokenProvider";

export function useAuthReady(): boolean {
  const [ready, setReady] = useState<boolean>(() => isTokenProviderReady());

  useEffect(() => {
    if (ready) return;
    let mounted = true;

    tokenReady.then(() => {
      if (mounted) setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, [ready]);

  return ready;
}