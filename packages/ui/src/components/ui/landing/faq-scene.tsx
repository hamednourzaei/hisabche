// packages/ui/src/components/ui/landing/faq-scene.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   FaqScene v4 — Premium Accordion
   ✅ Lucide icons
   ✅ Glass morphism
   ✅ i18n-ready
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FaqSceneProps {
  t: (key: string, fallback?: string) => string;
}

const FAQ_COUNT = 3;

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight);
  }, [answer]);

  return (
    <div
      className={cn(
        "group border rounded-2xl overflow-hidden",
        "transition-all duration-300",
        "motion-reduce:transition-none",
        open
          ? "border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.03)] shadow-[var(--shadow-premium)]"
          : "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.5)] hover:border-[hsl(var(--border-strong))]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between gap-4",
          "px-6 py-5",
          "text-start font-semibold text-[hsl(var(--fg-primary))]",
          "transition-colors duration-150",
          "motion-reduce:transition-none",
          "min-h-[44px]",
        )}
        aria-expanded={open}
      >
        <span className="text-sm sm:text-base">{question}</span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-[hsl(var(--fg-tertiary))]",
            "transition-transform duration-300",
            "motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      <div
        className="overflow-hidden transition-[height] duration-300 motion-reduce:transition-none"
        style={{ height: open ? height : 0 }}
        aria-hidden={!open}
      >
        <div
          ref={contentRef}
          className="px-6 pb-5 text-sm text-[hsl(var(--fg-secondary))] leading-relaxed"
        >
          {answer}
        </div>
      </div>
    </div>
  );
}

export default function FaqScene({ t }: FaqSceneProps) {
  return (
    <section id="faq" className="section-padding">
      <div className="container-narrow max-w-2xl">
        {/* ── Header ── */}
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-[0.2em] mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {t("landing.faqLabel", "پرسش‌های رایج")}
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight">
            {t("landing.faqTitle", "سوالات متداول")}
          </h2>
        </div>

        {/* ── FAQ List ── */}
        <div className="space-y-3">
          {Array.from({ length: FAQ_COUNT }).map((_, i) => {
            const key = `faq${i + 1}`;
            return (
              <FAQItem
                key={key}
                question={t(`landing.${key}Q`, "")}
                answer={t(`landing.${key}A`, "")}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}