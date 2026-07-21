// packages/ui/src/hooks/use-currency.ts
"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export type CurrencyCode = "AFN" | "USD" | "EUR" | "IRR";

interface UseCurrencyOptions {
  code?: CurrencyCode;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function useCurrency(options: UseCurrencyOptions = {}) {
  const {
    code = "AFN",
    locale = "fa-AF",
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options;

  const { t } = useTranslation();

  const format = useMemo(() => {
    return (amount: number, showCode: boolean = true): string => {
      if (amount === undefined || amount === null || isNaN(amount)) {
        return t("common.zero", "۰");
      }

      const formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        minimumFractionDigits,
        maximumFractionDigits,
      });

      const formatted = formatter.format(amount);
      
      if (!showCode) {
        return formatted.replace(/[A-Z]{3}/, "").trim();
      }
      
      return formatted;
    };
  }, [code, locale, minimumFractionDigits, maximumFractionDigits, t]);

  const getSymbol = useMemo(() => {
    return (): string => {
      const symbols: Record<CurrencyCode, string> = {
        AFN: "؋",
        USD: "$",
        EUR: "€",
        IRR: "﷼",
      };
      return symbols[code] || code;
    };
  }, [code]);

  return {
    format,
    getSymbol,
    code,
    locale,
  };
}