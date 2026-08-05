// ============================================
// DataTable — one table implementation for every dashboard page.
//
// Gives every table: collapsible search, column settings, sortable headers,
// responsive column hiding, and no-wrap cells.
// ============================================

"use client";

import { memo, useMemo, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { SortableHeader } from "./sortable-header";
import { TableToolbar } from "./table-toolbar";
import { VISIBILITY_CLASS, type TableColumn } from "./table-types";
import { useTableState } from "./use-table-state";

export interface DataTableProps<T> {
  /** Stable id — persists the user's column choices. */
  tableId: string;
  t: (key: string, fallback?: string) => string;
  rows: readonly T[];
  columns: readonly TableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: ((row: T) => void) | undefined;
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Export buttons, rendered next to the search and column icons. */
  actions?: ReactNode;
  emptyState?: ReactNode;
  /** Minimum table width before horizontal scrolling kicks in. */
  minWidthClass?: string;
}

function DataTableInner<T>({
  tableId,
  t,
  rows,
  columns,
  rowKey,
  onRowClick,
  searchValue,
  onSearchChange,
  actions,
  emptyState,
  minWidthClass = "min-w-[640px] sm:min-w-[720px]",
}: DataTableProps<T>) {
  const state = useTableState(tableId, columns);
  const sorted = useMemo(() => state.sortRows(rows), [rows, state]);

  return (
    <div className="w-full">
      <TableToolbar
        t={t}
        columns={columns}
        hiddenIds={state.hiddenIds}
        onToggleColumn={state.toggleColumn}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        actions={actions}
      />

      {rows.length === 0 && emptyState ? (
        emptyState
      ) : (
        <div className="w-full overflow-x-auto rounded-2xl border border-[hsl(var(--border-default))]">
          <table className={cn("w-full text-sm", minWidthClass)}>
            <thead>
              <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                {state.visibleColumns.map((column) => (
                  <SortableHeader
                    key={column.id}
                    column={column}
                    label={t(column.labelKey, column.labelFallback)}
                    sortId={state.sortId}
                    sortDirection={state.sortDirection}
                    onToggleSort={state.toggleSort}
                  />
                ))}
              </tr>
            </thead>

            <tbody>
              {sorted.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-[hsl(var(--border-default))] last:border-0",
                    "transition-colors duration-150 motion-reduce:transition-none",
                    onRowClick && "cursor-pointer hover:bg-[hsl(var(--surface-muted)/0.5)]",
                  )}
                >
                  {state.visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "whitespace-nowrap px-3 py-2.5",
                        column.align === "end" ? "text-end" : "text-start",
                        VISIBILITY_CLASS[column.showFrom ?? "always"],
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const DataTable = memo(DataTableInner) as typeof DataTableInner;
