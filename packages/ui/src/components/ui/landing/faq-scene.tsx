"use client";

import { useState, useRef, useEffect } from "react";
// ❌ حذف useSceneObserver - دیگه نیاز نیست
// import { useSceneObserver } from "./use-scene-observer";

const faqs = [
  { q: "واقعاً آفلاین کار می‌کنه؟",       a: "آره. بدون اینترنت فاکتور ثبت می‌کنی، موجودی رو آپدیت می‌کنی. هر وقت آنلاین شدی همه چیز sync میشه." },
  { q: "چقدر هزینه داره؟",                  a: "نسخه پایه برای همیشه رایگانه. برای کسب‌وکارهای بزرگتر پلن‌های حرفه‌ای هم داریم."                   },
  { q: "روی گوشی قدیمی هم کار می‌کنه؟",   a: "آره. روی گوشی ۱ گیگ رم هم روانه. طراحیش برای شبکه ضعیف و دستگاه‌های قدیمی بهینه شده."             },
];

function FAQItem({ faq }: { faq: { q: string; a: string } }) {
  const [open, setOpen]   = useState(false);
  const contentRef        = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight);
  }, [faq.a]);

  return (
    <div className={`faq-item ${open ? "open" : ""}`}>
      <button
        onClick={() => setOpen(!open)}
        className="faq-question"
        aria-expanded={open}
      >
        <span>{faq.q}</span>
        <span className={`faq-icon ${open ? "open" : ""}`}>+</span>
      </button>
      <div
        className="faq-answer"
        style={{ height: open ? height : 0 }}
        aria-hidden={!open}
      >
        <div ref={contentRef} className="faq-answer-inner">
          {faq.a}
        </div>
      </div>
    </div>
  );
}

export default function FaqScene() {
  // ❌ حذف useSceneObserver - FAQ نباید narrative رو عوض کنه
  // فقط یک سکت معمولی بدون observer

  return (
    <section
      id="faq"
      // ❌ حذف ref و data-narrative
      className="section-padding"
    >
      <div className="container-narrow" style={{ maxWidth: "42rem" }}>

        <div
          className="text-center mb-12"
        >
          <p
            className="text-sm uppercase mb-3"
            style={{
              letterSpacing: "0.2em",
              color: "hsl(var(--hisab-muted-fg))",
            }}
          >
            پرسش‌های رایج
          </p>
          <h2
            className="h2"
            style={{ color: "hsl(var(--hisab-foreground))" }}
          >
            سوالات متداول
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                opacity: 1,
                transform: "translateY(0)",
              }}
            >
              <FAQItem faq={faq} />
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}