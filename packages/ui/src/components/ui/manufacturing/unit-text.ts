// The catalogue names these units; anything else is a unit the person typed
// and is shown exactly as typed — `t()` on a key that does not exist throws.
const CATALOGUE_UNITS = new Set(['piece', 'gram', 'kg', 'carton', 'box', 'pack', 'meter', 'liter'])

export function unitText(
  t: (key: string, fallback?: string) => string,
  unit: string | null | undefined,
): string {
  if (!unit) return ''
  return CATALOGUE_UNITS.has(unit) ? t(`unit.${unit}`, unit) : unit
}
