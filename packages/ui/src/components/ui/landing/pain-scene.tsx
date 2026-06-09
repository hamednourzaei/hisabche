"use client";

import { useSceneObserver } from "./use-scene-observer";

const pains = [
  { emoji: "📋", text: "دفترها گم میشن",          impact: "ساعت‌ها وقت تلف میشه"    },
  { emoji: "😰", text: "حساب‌ها فراموش میشن",      impact: "بدهی‌ها از یاد میرن"      },
  { emoji: "📉", text: "سود واقعی معلوم نیست",     impact: "تصمیمات اشتباه میگیری"   },
];

export default function PainScene() {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: "confusion",
  });

  const animated = state === "animated";

  return (
    <section
      id="pain"
      ref={ref}
      data-narrative="confusion"
      className="section-padding"
    >
      <div className="container-narrow">

        <div
          className="text-center mb-16 scene-transition"
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
            قبل از حسابچه
          </p>
          <h2
            className="h2"
            style={{ color: "hsl(var(--hisab-foreground))" }}
          >
            دنیای قدیم حسابداری
          </h2>
          <p
            className="mt-4 mx-auto"
            style={{
              color: "hsl(var(--hisab-muted-fg))",
              maxWidth: "28rem",
              fontSize: "var(--font-body-large)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            شاید این مشکلات رو هر روز تجربه میکنی
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {pains.map((pain, i) => (
            <div
              key={i}
              className="card-interactive text-center p-8"
              style={{
                opacity:         animated ? 1 : 0,
                transform:       animated ? "translateY(0)" : "translateY(24px)",
                transition:      `opacity 0.4s var(--ease-out) ${i * 0.12}s, transform 0.4s var(--ease-out) ${i * 0.12}s`,
                border:          "1px solid hsl(var(--hisab-destructive) / 0.2)",
                background:      "hsl(var(--hisab-destructive) / 0.05)",
                borderRadius:    "var(--radius-card)",
              }}
            >
              <div
                className="mx-auto mb-5 flex items-center justify-center"
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "var(--radius-full)",
                  background: "hsl(var(--hisab-destructive) / 0.1)",
                  fontSize: "1.75rem",
                }}
              >
                {pain.emoji}
              </div>

              <p
                className="text-lg font-semibold mb-2"
                style={{ color: "hsl(var(--hisab-foreground))" }}
              >
                {pain.text}
              </p>
              <p
                className="text-sm"
                style={{
                  color: "hsl(var(--hisab-muted-fg))",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {pain.impact}
              </p>

              <div
                className="mt-6 mx-auto"
                style={{
                  height: "2px",
                  width: "40px",
                  borderRadius: "var(--radius-full)",
                  background: "hsl(var(--hisab-destructive) / 0.4)",
                }}
              />
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}