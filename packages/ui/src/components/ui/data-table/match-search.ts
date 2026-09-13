// ============================================
// Client-side search for a DataTable whose rows are already loaded.
//
// The list screens that follow the invoices structure fetch their whole list
// in one request, so the toolbar's search narrows what is on screen rather
// than issuing a new query. One definition, so every such screen matches the
// same way: case-insensitive, trimmed, any listed field.
// ============================================

export function matchesSearch(
  query: string,
  values: ReadonlyArray<string | number | null | undefined>,
): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return values.some((value) => value != null && String(value).toLowerCase().includes(needle))
}
