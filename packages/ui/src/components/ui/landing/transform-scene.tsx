"use client";

import { useSceneObserver } from "./use-scene-observer";

const solutions = [
  { icon: "🧾", title: "فاکتور لحظه‌ای", desc: "صدور در ۳۰ ثانیه",        benefit: "دیگه مشتری منتظر نمیمونه"  },
  { icon: "📦", title: "گدام زنده",       desc: "موجودی همیشه آپدیت",      benefit: "فروش خارج از انبار نداریم" },
  { icon: "📒", title: "بدهی شفاف",      desc: "هر بدهی ثبت و پیگیری",    benefit: "پولت گم نمیشه"             },
];

export default function TransformScene() {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: "clarity",
  });

  const animated = state === "animated";

  return (
    <section
      id="transform"
      ref={ref}
      data-narrative="clarity"
      className="section-padding"
      style={{ background: "hsl(var(--surface-muted) / 0.3)" }}
    >
      <div className="container-narrow">

        {/* Header */}
        <div
          className="text-center mb-14 scene-transition"
          style={{
            opacity:   animated ? 1 : 0,
            transform: animated ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <p
            className="text-sm uppercase mb-3"
            style={{
              letterSpacing: "0.2em",
              color: "hsl(var(--hisab-muted-fg))",
            }}
          >
            بعد از حسابچه
          </p>
          <h2
            className="h2 mb-6"
            style={{ color: "hsl(var(--color-purple)), hsl(var(--color-cyan)), hsl(var(--color-emerald)))" }}
          >
            همه چیز در یک جا
          </h2>
          <p
            className="mx-auto"
            style={{
              color:      "hsl(var(--hisab-muted-fg))",
              maxWidth:   "36rem",
              fontSize:   "var(--font-body-large)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            فاکتور، گدام، بدهی… همه در لحظه. بدون کاغذ، بدون فراموشی.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {solutions.map((item, i) => (
            <div
              key={i}
              className="card-interactive text-center p-8"
              style={{
                opacity:      animated ? 1 : 0,
                transform:    animated ? "translateY(0)" : "translateY(24px)",
                transition:   `opacity 0.4s var(--ease-out) ${i * 0.12}s, transform 0.4s var(--ease-out) ${i * 0.12}s`,
                border:       "1px solid hsl(var(--color-purple) / 0.2)",
                background:   "hsl(var(--color-purple) / 0.05)",
                borderRadius: "var(--radius-card)",
              }}
            >
              {/* Icon */}
              <div
                className="mx-auto mb-5 flex items-center justify-center"
                style={{
                  width:        "56px",
                  height:       "56px",
                  borderRadius: "var(--radius-full)",
                  background:   "hsl(var(--color-purple) / 0.12)",
                  fontSize:     "1.75rem",
                }}
              >
                {item.icon}
              </div>

              {/* Title */}
              <div
                className="text-lg font-semibold mb-2"
                style={{ color: "hsl(var(--color-purple)), hsl(var(--color-cyan)), hsl(var(--color-emerald)))" }}
              >
                {item.title}
              </div>

              {/* Desc — با accent رنگ purple */}
              <div
                className="text-sm font-medium mb-3"
                style={{ color: "hsl(var(--color-purple))" }}
              >
                {item.desc}
              </div>

              {/* Benefit */}
              <div
                className="text-xs"
                style={{
                  color:      "hsl(var(--hisab-muted-fg))",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {item.benefit}
              </div>

              {/* Bottom accent */}
              <div
                className="mt-6 mx-auto"
                style={{
                  height:       "2px",
                  width:        "40px",
                  borderRadius: "var(--radius-full)",
                  background:   "hsl(var(--color-purple) / 0.4)",
                }}
              />
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}