// packages/ui/src/hooks/use-sort-filter.ts
"use client";

import { useState, useMemo } from "react";

export interface SortConfig<T> {
  key: keyof T | null;
  direction: "asc" | "desc";
}

export function useSortFilter<T>(
  data: T[],
  options?: {
    initialSortKey?: keyof T;
    initialSortDir?: "asc" | "desc";
  }
) {
  const [sort, setSort] = useState<SortConfig<T>>({
    key: options?.initialSortKey ?? null,
    direction: options?.initialSortDir ?? "asc",
  });
  const [filter, setFilter] = useState<string>("");

  const toggleSort = (key: keyof T) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedFiltered = useMemo(() => {
    let result = [...data];

    // Filter
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter((item) =>
        Object.values(item as Record<string, unknown>).some(
          (val) => String(val ?? "").toLowerCase().includes(q)
        )
      );
    }

    // Sort
    if (sort.key) {
      result.sort((a, b) => {
        const aVal = a[sort.key!] ?? "";
        const bVal = b[sort.key!] ?? "";
        const cmp = String(aVal).localeCompare(String(bVal), "fa-AF");
        return sort.direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [data, sort, filter]);

  return { sortedData: sortedFiltered, sort, toggleSort, filter, setFilter };
}