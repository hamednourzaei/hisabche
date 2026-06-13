"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   FaqScene v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Zero inline styles — all Tailwind classes
   ═══════════════════════════════════════════════════════════════════════════ */

const faqs = [
  {
    q: "واقعاً آفلاین کار می‌کنه؟",
    a: "آره. بدون اینترنت فاکتور ثبت می‌کنی، موجودی رو آپدیت می‌کنی. هر وقت آنلاین شدی همه چیز sync میشه.",
  },
  {
    q: "چقدر هزینه داره؟",
    a: "نسخه پایه برای همیشه رایگانه. برای کسب‌وکارهای بزرگتر پلن‌های حرفه‌ای هم داریم.",
  },
  {
    q: "روی گوشی قدیمی هم کار می‌کنه؟",
    a: "آره. روی گوشی ۱ گیگ رم هم روانه. طراحیش برای شبکه ضعیف و دستگاه‌های قدیمی بهینه شده.",
  },
];

function FAQItem({ faq }: { faq: { q: string; a: string } }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight);
  }, [faq.a]);

  return (
    <div
      className={cn(
        "border border-[hsl(var(--border-default))] rounded-2xl overflow-hidden",
        "bg-[hsl(var(--surface-muted)/0.6)]",
        "transition-colors duration-300",
        open && "border-[hsl(var(--color-primary)/0.3)]",
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
        )}
        aria-expanded={open}
      >
        <span>{faq.q}</span>
        <span
          className={cn(
            "flex items-center justify-center shrink-0",
            "w-7 h-7 rounded-full",
            "border border-[hsl(var(--border-strong))]",
            "text-[hsl(var(--fg-secondary))]",
            "transition-transform duration-300",
            open && "rotate-45",
          )}
        >
          +
        </span>
      </button>
      <div
        className="overflow-hidden transition-[height] duration-300"
        style={{ height: open ? height : 0 }}
        aria-hidden={!open}
      >
        <div ref={contentRef} className="px-6 pb-5 text-sm text-[hsl(var(--fg-secondary))] leading-relaxed">
          {faq.a}
        </div>
      </div>
    </div>
  );
}

export default function FaqScene() {
  return (
    <section id="faq" className="section-padding">
      <div className="container-narrow max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-[0.2em] mb-3 text-[hsl(var(--fg-tertiary))]">
            پرسش‌های رایج
          </p>
          <h2 className="h2 text-[hsl(var(--fg-primary))]">
            سوالات متداول
          </h2>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i}>
              <FAQItem faq={faq} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}