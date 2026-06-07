"use client"

import { useState, useRef, useEffect } from "react"

const faqs = [
  { q: "واقعاً آفلاین کار می‌کنه؟", a: "آره. بدون اینترنت فاکتور ثبت می‌کنی، موجودی رو آپدیت می‌کنی. هر وقت آنلاین شدی همه چیز sync میشه." },
  { q: "چقدر هزینه داره؟", a: "نسخه پایه برای همیشه رایگانه. برای کسب‌وکارهای بزرگتر پلن‌های حرفه‌ای هم داریم." },
  { q: "روی گوشی قدیمی هم کار می‌کنه؟", a: "آره. روی گوشی ۱ گیگ رم هم روانه. طراحیش برای شبکه ضعیف و دستگاه‌های قدیمی بهینه شده." },
]

function FAQItem({ faq }: { faq: { q: string; a: string } }) {
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight)
  }, [faq.a])

  return (
    <div
      className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm transition-colors"
      style={{ borderColor: open ? "rgba(168,85,247,0.3)" : undefined }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-5 text-right"
        aria-expanded={open}
      >
        <span className="font-semibold text-foreground">{faq.q}</span>
        <span className="mr-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform duration-300" style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
      </button>
      <div style={{ height: open ? height : 0, overflow: "hidden", transition: "height 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
        <div ref={contentRef} className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">
          {faq.a}
        </div>
      </div>
    </div>
  )
}

export default function FaqScene() {
  return (
    <section id="faq" className="py-24 px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-foreground">سوالات متداول</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, i) => <FAQItem key={i} faq={faq} />)}
        </div>
      </div>
    </section>
  )
}