"use client";

import { useSceneObserver } from "./use-scene-observer";

const solutions = [
  { icon: "🧾", title: "فاکتور لحظه‌ای", desc: "صدور در ۳۰ ثانیه", benefit: "دیگه مشتری منتظر نمیمونه" },
  { icon: "📦", title: "گدام زنده", desc: "موجودی همیشه آپدیت", benefit: "فروش خارج از انبار نداریم" },
  { icon: "📒", title: "بدهی شفاف", desc: "هر بدهی ثبت و پیگیری", benefit: "پولت گم نمیشه" },
];

export default function TransformScene() {
  const { ref, state } = useSceneObserver<HTMLDivElement>({ 
    threshold: 0.3,
    narrativeState: "clarity"
  });

  return (
    <section
      id="transform"
      ref={ref}
      data-narrative="clarity"
      className="section-padding bg-surface-muted/30"
    >
      <div className="container-narrow text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">
          بعد از حسابچه
        </p>
        <h2 className="text-4xl font-bold text-foreground mb-6">همه چیز در یک جا</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-14">
          فاکتور، گدام، بدهی… همه در لحظه. بدون کاغذ، بدون فراموشی.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {solutions.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-8 text-center"
              style={{
                opacity: state === "animated" ? 1 : 0,
                transform: state === "animated" ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.4s var(--ease-out) ${i * 0.1}s, transform 0.4s var(--ease-out) ${i * 0.1}s`,
              }}
            >
              <div className="text-4xl mb-4">{item.icon}</div>
              <div className="text-lg font-semibold text-foreground mb-1">{item.title}</div>
              <div className="text-sm text-purple-300 mb-2">{item.desc}</div>
              <div className="text-xs text-muted-foreground">{item.benefit}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}