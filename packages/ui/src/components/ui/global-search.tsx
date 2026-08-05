// packages/ui/src/components/ui/global-search.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import { apiClient } from "@hisabche/api";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   GlobalSearch — جستجوی سراسری در بالای داشبورد.

   در سه موجودیت اصلی جستجو می‌کند (مشتری، محصول، فاکتور) و در کنارشان
   صفحه‌های خودِ برنامه را هم که به‌صورت محلی فیلتر می‌شوند نشان می‌دهد،
   تا کاربر بتواند هم داده پیدا کند هم به بخش‌های سایت برود.

   عمداً endpoint جدیدی ساخته نشد: هر سه روت موجود از قبل پارامتر `search`
   را پشتیبانی می‌کنند، پس این کامپوننت فقط همان‌ها را موازی صدا می‌زند.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SearchPageItem {
  id: string;
  label: string;
  path: string;
}

interface ResultItem {
  id: string;
  title: string;
  subtitle?: string | undefined;
  group: string;
  path: string;
}

interface GlobalSearchProps {
  /** صفحه‌های برنامه برای جستجوی محلی (از NAV_ITEMS ساخته می‌شود). */
  pages?: SearchPageItem[];
  onNavigate: (path: string) => void;
  t: (key: string, fallback?: string) => string;
  placeholder?: string | undefined;
  /**
   * حالت هدر: زیر md فقط یک آیکون 🔍 دیده می‌شود و با کلیک، فیلد به سمت
   * پایین باز می‌شود؛ از md به بالا فیلد همیشه باز است.
   */
  compact?: boolean | undefined;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

export function GlobalSearch({ pages = [], onNavigate, t, placeholder, compact = false }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  /** فقط در حالت compact و زیر md معنا دارد. */
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [remote, setRemote] = useState<ResultItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  // هر جستجو یک شناسه می‌گیرد تا پاسخ کند و قدیمی، نتیجه‌ی تازه را overwrite نکند.
  const requestIdRef = useRef(0);

  // ─── صفحه‌های برنامه (محلی، بدون شبکه) ──────────────────────────────────
  const pageResults = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pages
      .filter((p) => p.label.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p) => ({
        id: `page:${p.id}`,
        title: p.label,
        group: t("search.pages", "صفحه‌ها"),
        path: p.path,
      }));
  }, [pages, query, t]);

  // ─── جستجوی داده‌ها ─────────────────────────────────────────────────────
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setRemote([]);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const [customers, products, invoices] = await Promise.all([
          apiClient
            .get("/customers", { params: { search: q, limit: 5, page: 1 } })
            .then((r) => r.data)
            .catch(() => null),
          apiClient
            .get("/products", { params: { search: q, limit: 5, page: 1 } })
            .then((r) => r.data)
            .catch(() => null),
          apiClient
            .get("/invoices", { params: { search: q, limit: 5, page: 1 } })
            .then((r) => r.data)
            .catch(() => null),
        ]);

        // اگر بین‌زمانی جستجوی جدیدتری شروع شده، این نتیجه دور ریخته می‌شود.
        if (requestId !== requestIdRef.current) return;

        const next: ResultItem[] = [];

        for (const c of customers?.customers ?? customers?.data ?? []) {
          next.push({
            id: `customer:${c.id}`,
            title: c.fullName || c.full_name || c.name || t("common.noName", "بدون نام"),
            subtitle: c.phone || undefined,
            group: t("nav.customers", "مشتریان"),
            path: `/customers/${c.id}`,
          });
        }

        for (const p of products?.products ?? products?.data ?? []) {
          next.push({
            id: `product:${p.id}`,
            title: p.name,
            subtitle: typeof p.quantity === "number" ? `${p.quantity} ${p.unit ?? ""}`.trim() : undefined,
            group: t("nav.warehouse", "انبار"),
            path: `/warehouse/${p.id}`,
          });
        }

        for (const inv of invoices?.invoices ?? invoices?.data ?? []) {
          next.push({
            id: `invoice:${inv.id}`,
            title: inv.invoice_number || inv.invoiceNumber || inv.id.slice(0, 8),
            subtitle: inv.customerName || inv.customer?.full_name || undefined,
            group: t("nav.invoices", "فاکتورها"),
            path: `/invoices/${inv.id}`,
          });
        }

        setRemote(next);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, t]);

  const results = useMemo(() => [...pageResults, ...remote], [pageResults, remote]);

  // ─── بستن با کلیک بیرون ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen && !expanded) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
      // در حالت فشرده، کلیک بیرون فیلد را هم جمع می‌کند.
      setExpanded(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [expanded, isOpen]);

  const select = useCallback(
    (item: ResultItem) => {
      setIsOpen(false);
      setQuery("");
      setRemote([]);
      onNavigate(item.path);
    },
    [onNavigate]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ResultItem[]>();
    for (const r of results) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return Array.from(map.entries());
  }, [results]);

  const showPanel = isOpen && query.trim().length > 0;

  return (
    <div
      ref={containerRef}
      className={cn("relative", compact ? "md:w-72 lg:w-80" : "w-full max-w-md")}
    >
      {/* حالت فشرده: زیر md فقط دکمه‌ی ذره‌بین. با باز شدن، فیلد جای آن را
          می‌گیرد و پنل نتایج به سمت پایین باز می‌شود. */}
      {compact && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={t("search.placeholder", "جستجو")}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-lg md:hidden",
            "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]",
            "transition-colors duration-150 motion-reduce:transition-none",
          )}
        >
          <Search className="size-[18px]" aria-hidden="true" />
        </button>
      ) : null}

      <div
        className={cn(
          "relative",
          // زیر md وقتی بسته است پنهان می‌ماند؛ از md به بالا همیشه باز.
          compact && !expanded && "hidden md:block",
          compact && expanded && "fixed inset-x-3 top-16 z-50 md:static md:inset-auto md:top-auto",
        )}
      >
        <Search
          className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--fg-tertiary))] start-3"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder ?? t("search.placeholder", "جستجو در مشتریان، محصولات، فاکتورها...")}
          aria-label={t("search.placeholder", "جستجو")}
          className={cn(
            "w-full rounded-full border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]",
            "py-2 ps-9 pe-9 text-sm text-[hsl(var(--fg-primary))]",
            "placeholder:text-[hsl(var(--fg-tertiary))]",
            "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
          )}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRemote([]);
            }}
            aria-label={t("action.clear", "پاک کردن")}
            className="absolute top-1/2 -translate-y-1/2 end-3 text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          className={cn(
            "absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border shadow-lg",
            "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]"
          )}
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[hsl(var(--fg-tertiary))]">
              {isLoading
                ? t("common.loading", "در حال جستجو...")
                : query.trim().length < MIN_QUERY_LENGTH
                  ? t("search.minChars", "حداقل دو حرف بنویسید")
                  : t("search.noResults", "چیزی پیدا نشد")}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {grouped.map(([group, items]) => (
                <li key={group}>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-medium text-[hsl(var(--fg-tertiary))]">
                    {group}
                  </p>
                  <ul>
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => select(item)}
                          className="flex w-full items-center justify-between gap-2 px-4 py-2 text-start text-sm hover:bg-[hsl(var(--surface-muted))]"
                        >
                          <span className="truncate text-[hsl(var(--fg-primary))]">{item.title}</span>
                          {item.subtitle ? (
                            <span className="shrink-0 text-[11px] text-[hsl(var(--fg-tertiary))]">
                              {item.subtitle}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
