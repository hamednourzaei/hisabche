// ============================================
// Sortable table header cell.
// Clicking cycles the sort direction; unsortable columns render plain text.
// ============================================

"use client";

import { memo } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { VISIBILITY_CLASS, type SortDirection, type TableColumn } from "./table-types";

export interface SortableHeaderProps<T> {
  column: TableColumn<T>;
  label: string;
  sortId: string | null;
  sortDirection: SortDirection;
  onToggleSort: (id: string) => void;
}

function SortableHeaderInner<T>({
  column,
  label,
  sortId,
  sortDirection,
  onToggleSort,
}: SortableHeaderProps<T>) {
  const sortable = Boolean(column.sortValue);
  const active = sortId === column.id;

  const className = cn(
    "whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-[hsl(var(--fg-tertiary))]",
    column.align === "end" ? "text-end" : "text-start",
    VISIBILITY_CLASS[column.showFrom ?? "always"],
  );

  if (!sortable) {
    return <th className={className}>{label}</th>;
  }

  return (
    <th className={cn(className, "p-0")} aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onToggleSort(column.id)}
        className={cn(
          "inline-flex w-full items-center gap-1 px-3 py-2.5",
          column.align === "end" ? "justify-end" : "justify-start",
          "hover:text-[hsl(var(--fg-primary))] transition-colors duration-150",
          active && "text-[hsl(var(--color-primary))]",
        )}
      >
        <span className="whitespace-nowrap">{label}</span>
        {active ? (
          sortDirection === "asc" ? (
            <ChevronUp className="size-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3" aria-hidden="true" />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

export const SortableHeader = memo(SortableHeaderInner) as typeof SortableHeaderInner;
