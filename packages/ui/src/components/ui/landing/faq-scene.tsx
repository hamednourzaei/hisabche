"use client"

import { useState } from "react"
import { Section, SectionHeading } from "@hisabche/ui"

const faqs = [
  {
    q: "واقعاً آفلاین کار می‌کنه؟",
    a: "آره. بدون اینترنت فاکتور ثبت می‌کنی.",
  },
  {
    q: "چقدر هزینه داره؟",
    a: "نسخه پایه برای همیشه رایگان.",
  },
  {
    q: "روی گوشی قدیمی هم کار می‌کنه؟",
    a: "آره. رو گوشی ۱ گیگ رم هم روانه.",
  },
]

export default function FaqScene() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <Section>
      <SectionHeading title="سوالات متداول" />

      <div className="mx-auto max-w-2xl space-y-3">
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i

          return (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-dashed border-[var(--hisab-border)] bg-[var(--hisab-card)]/70 backdrop-blur-sm transition-all hover:border-purple-500/30"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenIndex(isOpen ? null : i)
                }
                className="flex w-full items-center justify-between px-5 py-4 text-start"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-semibold text-[var(--hisab-foreground)]">
                  {faq.q}
                </span>
                <span
                  className={`text-[var(--hisab-muted-fg)] transition-transform duration-300 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                >
                  ▼
                </span>
              </button>

              <div
                className={`grid transition-all duration-300 ${
                  isOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-[var(--hisab-muted-fg)]">
                    {faq.a}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}