// packages/ui/src/lib/invoices-format.ts

export const fmtDate = (d: string): string => {
  try {
    return new Date(d).toLocaleDateString("fa-AF")
  } catch {
    return ""
  }
}

export const STATUS_MAP: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  completed: "success",
  pending: "warning",
  partial: "secondary",
  cancelled: "destructive",
}