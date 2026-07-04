import { useCurrencyStore, type CurrencyCode } from "@hisabche/store";

const CONFIG: Record<CurrencyCode, { locale: string; decimals: number }> = {
  AFN: { locale: "fa-AF", decimals: 0 },
  USD: { locale: "en-US", decimals: 2 },
  PKR: { locale: "ur-PK", decimals: 0 },
  IRR: { locale: "fa-IR", decimals: 0 },
};

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const fmt = (v: number): string => {
  if (typeof window === "undefined") return v.toLocaleString("fa-AF");
  const currency = (useCurrencyStore.getState?.()?.primaryCurrency || "AFN") as CurrencyCode;
  const config = CONFIG[currency] || CONFIG.AFN;
  return new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(v);
};

export const fmtDate = (d: string): string => {
  try {
    return new Date(d).toLocaleDateString("fa-AF");
  } catch {
    return d;
  }
};