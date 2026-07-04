// packages/ui/src/hooks/use-autosave.ts
"use client";

import { useEffect, useRef, useCallback } from "react";

export function useAutosave<T extends Record<string, unknown>>(
  data: T,
  onSave: (data: T) => Promise<void>,
  options: { interval?: number; enabled?: boolean } = {}
) {
  const { interval = 5000, enabled = true } = options;
  const savedRef = useRef<string>("");
  const dataRef = useRef(data);
  const savingRef = useRef(false);

  dataRef.current = data;

  const save = useCallback(async () => {
    if (savingRef.current) return;
    const current = JSON.stringify(dataRef.current);
    const isEmpty = Object.values(dataRef.current).every(v => !v);
    if (current === savedRef.current || isEmpty) return;

    savingRef.current = true;
    savedRef.current = current;
    try {
      await onSave(dataRef.current);
    } catch {
      // Silent — autosave shouldn't interrupt user
    } finally {
      savingRef.current = false;
    }
  }, [onSave]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(save, interval);
    return () => clearInterval(timer);
  }, [interval, enabled, save]);

  // Save on unmount
  useEffect(() => {
    return () => {
      const current = JSON.stringify(dataRef.current);
      const isEmpty = Object.values(dataRef.current).every(v => !v);
      if (current !== savedRef.current && !isEmpty) {
        onSave(dataRef.current).catch(() => {});
      }
    };
  }, [onSave]);
}