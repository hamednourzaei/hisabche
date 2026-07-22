// packages/ui/src/hooks/activity/useDebounce.ts
"use client";

import { useState, useEffect } from "react";

/**
 * Debounce hook — برای تاخیر در اجرای جستجو و فیلترها
 * 
 * @param value - مقداری که باید debounce شود
 * @param delay - زمان تاخیر به میلی‌ثانیه (پیش‌فرض: 300ms)
 * @returns مقدار debounce شده
 * 
 * @example
 * const [search, setSearch] = useState("");
 * const debouncedSearch = useDebounce(search, 300);
 * 
 * useEffect(() => {
 *   // این تابع فقط بعد از 300ms تایپ شدن اجرا می‌شود
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}