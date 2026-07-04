// packages/ui/src/hooks/use-currency.ts
"use client";

import { useCallback, useMemo } from "react";
import { useCurrencyStore, type CurrencyCode } from "@hisabche/store";

const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string; locale: string; decimals: number }> = {
  AFN: { symbol: "افغانی", locale: "fa-AF", decimals: 0 },
  USD: { symbol: "$", locale: "en-US", decimals: 2 },
  PKR: { symbol: "Rs", locale: "ur-PK", decimals: 0 },
  IRR: { symbol: "تومان", locale: "fa-IR", decimals: 0 },
};

export function useCurrency() {
  const primaryCurrency = useCurrencyStore((s) => s.primaryCurrency);
  const config = CURRENCY_CONFIG[primaryCurrency] || CURRENCY_CONFIG.AFN;

  const format = useCallback(
    (value: number, options?: { showSymbol?: boolean; compact?: boolean }) => {
      const { showSymbol = true, compact = false } = options || {};

      if (compact && value >= 1_000_000) {
        const millions = value / 1_000_000;
        return `${millions.toFixed(1)}M ${showSymbol ? config.symbol : ""}`.trim();
      }
      if (compact && value >= 1_000) {
        const thousands = value / 1_000;
        return `${thousands.toFixed(1)}K ${showSymbol ? config.symbol : ""}`.trim();
      }

      const formatted = new Intl.NumberFormat(config.locale, {
        minimumFractionDigits: config.decimals,
        maximumFractionDigits: config.decimals,
      }).format(value);

      return showSymbol ? `${formatted} ${config.symbol}` : formatted;
    },
    [config]
  );

  return useMemo(() => ({ format, currency: primaryCurrency, symbol: config.symbol }), [format, primaryCurrency, config.symbol]);
}