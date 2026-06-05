"use client"

import { Section, SectionHeading } from "@hisabche/ui"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../accordion"

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
  return (
    <Section>
      <SectionHeading title="سوالات متداول" />

      <div className="mx-auto max-w-2xl">
        <Accordion  className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-2xl border border-dashed border-border bg-card/70 backdrop-blur-sm transition-all hover:border-purple-500/30"
            >
              <AccordionTrigger className="px-5 py-4 text-sm font-semibold text-foreground hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  )
}