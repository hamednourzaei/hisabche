// ============================================
// Shared table contract.
//
// One definition drives the header, the body, column visibility, sorting and
// the responsive rules — so every table in the app behaves identically.
// ============================================

import type { ReactNode } from "react";

export type SortDirection = "asc" | "desc";

/** Breakpoint below which a column is hidden. `always` never hides. */
export type ColumnVisibility = "always" | "sm" | "md" | "lg";

export interface TableColumn<T> {
  /** Stable id — also the persistence key for the visibility toggle. */
  id: string;
  /** Translation key for the header label. */
  labelKey: string;
  labelFallback: string;
  render: (row: T) => ReactNode;
  /** Value used for sorting. Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | null;
  /** Smallest breakpoint at which the column appears. Default `always`. */
  showFrom?: ColumnVisibility;
  /** Columns the user may not hide (identity/actions). */
  locked?: boolean;
  align?: "start" | "end";
}

/** Tailwind classes that hide a column below its breakpoint. */
export const VISIBILITY_CLASS: Record<ColumnVisibility, string> = {
  always: "",
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

export function compareValues(
  a: string | number | null,
  b: string | number | null,
  direction: SortDirection,
): number {
  // Nulls always sink, regardless of direction.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  const result =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true });

  return direction === "asc" ? result : -result;
}
