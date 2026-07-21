// packages/ui/src/hooks/use-media-query.ts
"use client";

import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    // بررسی اینکه در مرورگر هستیم
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia(query);
    
    // مقدار اولیه
    setMatches(media.matches);

    // تابع تغییر
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // اضافه کردن listener
    media.addEventListener("change", handler);

    // پاکسازی
    return () => {
      media.removeEventListener("change", handler);
    };
  }, [query]);

  return matches;
}

// شورت‌کات‌های رایج
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 640px)");
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 641px) and (max-width: 1024px)");
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1025px)");
}

export function useIsDarkMode(): boolean {
  return useMediaQuery("(prefers-color-scheme: dark)");
}

export function useIsReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}