"use client";

import { useState, useRef, useEffect } from "react";
import { useSceneObserver } from "./use-scene-observer";

const faqs = [
  { q: "واقعاً آفلاین کار می‌کنه؟", a: "آره. بدون اینترنت فاکتور ثبت می‌کنی، موجودی رو آپدیت می‌کنی. هر وقت آنلاین شدی همه چیز sync میشه." },
  { q: "چقدر هزینه داره؟", a: "نسخه پایه برای همیشه رایگانه. برای کسب‌وکارهای بزرگتر پلن‌های حرفه‌ای هم داریم." },
  { q: "روی گوشی قدیمی هم کار می‌کنه؟", a: "آره. روی گوشی ۱ گیگ رم هم روانه. طراحیش برای شبکه ضعیف و دستگاه‌های قدیمی بهینه شده." },
];

function FAQItem({ faq, index, isActive }: { faq: { q: string; a: string }; index: number; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight);
  }, [faq.a]);

  return (
    <div className={`faq-item ${open ? "open" : ""}`}>
      <button onClick={() => setOpen(!open)} className="faq-question" aria-expanded={open}>
        <span>{faq.q}</span>
        <span className={`faq-icon ${open ? "open" : ""}`}>+</span>
      </button>
      <div className="faq-answer" style={{ height: open ? height : 0 }}>
        <div ref={contentRef} className="faq-answer-inner">
          {faq.a}
        </div>
      </div>
    </div>
  );
}

export default function FaqScene() {
  const { ref, state } = useSceneObserver<HTMLDivElement>({ threshold: 0.3 });

  return (
    <section id="faq" ref={ref} className="section-padding">
      <div className="container-narrow max-w-2xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground">سوالات متداول</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                opacity: state === "animated" ? 1 : 0,
                transform: state === "animated" ? "translateY(0)" : "translateY(15px)",
                transition: `opacity 0.3s var(--ease-out) ${i * 0.1}s, transform 0.3s var(--ease-out) ${i * 0.1}s`,
              }}
            >
              <FAQItem faq={faq} index={i} isActive={state === "animated"} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}