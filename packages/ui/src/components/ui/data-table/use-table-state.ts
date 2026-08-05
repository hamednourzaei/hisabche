// ============================================
// Table state — column visibility and sorting.
//
// Visibility is persisted per table id so a user's column choices survive a
// reload. Sorting stays in memory: it is a transient view concern.
// ============================================

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { compareValues, type SortDirection, type TableColumn } from "./table-types";

const STORAGE_PREFIX = "hisabche.table.columns.";

function readHidden(tableId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + tableId);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export interface TableState<T> {
  /** Columns the user has chosen to show, in declaration order. */
  visibleColumns: TableColumn<T>[];
  hiddenIds: string[];
  toggleColumn: (id: string) => void;
  sortId: string | null;
  sortDirection: SortDirection;
  toggleSort: (id: string) => void;
  sortRows: (rows: readonly T[]) => T[];
}

export function useTableState<T>(tableId: string, columns: readonly TableColumn<T>[]): TableState<T> {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [sortId, setSortId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Read after mount so server and client render the same first paint.
  useEffect(() => setHiddenIds(readHidden(tableId)), [tableId]);

  const toggleColumn = useCallback(
    (id: string) => {
      setHiddenIds((current) => {
        const next = current.includes(id)
          ? current.filter((value) => value !== id)
          : [...current, id];

        try {
          window.localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(next));
        } catch {
          // A full or blocked storage must not break the toggle.
        }
        return next;
      });
    },
    [tableId],
  );

  // Clicking the active column flips direction; a new column starts descending.
  const toggleSort = useCallback((id: string) => {
    setSortId((currentId) => {
      if (currentId === id) {
        setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
        return currentId;
      }
      setSortDirection("desc");
      return id;
    });
  }, []);

  const visibleColumns = useMemo(
    () => columns.filter((column) => column.locked || !hiddenIds.includes(column.id)),
    [columns, hiddenIds],
  );

  const sortRows = useCallback(
    (rows: readonly T[]): T[] => {
      const column = columns.find((item) => item.id === sortId);
      if (!column?.sortValue) return [...rows];

      const read = column.sortValue;
      return [...rows].sort((a, b) => compareValues(read(a), read(b), sortDirection));
    },
    [columns, sortDirection, sortId],
  );

  return { visibleColumns, hiddenIds, toggleColumn, sortId, sortDirection, toggleSort, sortRows };
}
