// packages/ui/src/lib/thousands.ts
//
// Shared thousand-separator formatting for money/price/amount/salary inputs.
// The DISPLAYED string gets ",", but the value handed back to callers via
// `unformatThousands` (and thus stored in component state / submitted to the
// API) is always the clean digit string — no separators, no currency
// symbols — so existing `Number(...)` / `parseFloat(...)` call sites keep
// working unchanged.

/** Strip everything except digits and a single decimal point. */
export function unformatThousands(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  const str = String(input);
  const cleaned = str.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  // Keep only the first decimal point; drop any extras the user typed.
  const intPart = cleaned.slice(0, firstDot);
  const decPart = cleaned.slice(firstDot + 1).replace(/\./g, "");
  return `${intPart}.${decPart}`;
}

/** Format a clean (or dirty) numeric string with thousand separators. */
export function formatThousands(input: string | number | null | undefined): string {
  const raw = unformatThousands(input);
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const grouped = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}
