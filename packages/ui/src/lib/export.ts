// packages/ui/src/lib/export.ts

export function exportToCSV<T>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string
) {
  if (!data || data.length === 0) return;

  const header = columns.map((c) => `"${c.label}"`).join(",");

  const rows = data.map((row) =>
    columns
      .map((c) => {
        const value = row[c.key];
        if (value === null || value === undefined) return '""';
        return `"${String(value).replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}