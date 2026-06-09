"use client";

import { useSceneObserver } from "./use-scene-observer";

const features = [
  { emoji: "🧾", title: "فاکتور در ۳۰ ثانیه", desc: "محصول از گدام، مشتری از دفتر تلفن." },
  { emoji: "📦", title: "گدام خودکار",          desc: "ورود و خروج با هر فاکتور."          },
  { emoji: "📒", title: "بدهی یادت بمونه",      desc: "پرداخت در ۲ کلیک."                  },
  { emoji: "📱", title: "تو جیب شماست",         desc: "موبایل، تبلت، کامپیوتر."            },
  { emoji: "🔌", title: "آفلاین واقعی",         desc: "اینترنت نیست؟ مشکلی نیست."         },
  { emoji: "💱", title: "افغانی · دلار · تومان", desc: "تبدیل خودکار."                      },
];

export default function FeaturesScene() {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.2,
    narrativeState: "confidence",
  });

  const animated = state === "animated";

  return (
    <section
      id="features"
      ref={ref}
      data-narrative="confidence"
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
            ابزارها
          </p>
          <h2
            className="h2"
            style={{ color: "hsl(var(--hisab-foreground))" }}
          >
            همه چیزی که نیاز داری
          </h2>
          <p
            className="mt-4"
            style={{
              color: "hsl(var(--hisab-muted-fg))",
              fontSize: "var(--font-body-large)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            هیچ چیز اضافه، هیچ چیز کم
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="card-interactive p-6 text-center"
              style={{
                opacity:      animated ? 1 : 0,
                transform:    animated ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
                transition:   `opacity 0.35s var(--ease-out) ${i * 0.06}s, transform 0.35s var(--ease-out) ${i * 0.06}s`,
                borderRadius: "var(--radius-card-sm)",
                border:       "1px solid hsl(var(--hisab-border))",
                background:   "hsl(var(--surface-muted) / 0.4)",
              }}
            >
              <div
                className="mx-auto mb-4 flex items-center justify-center"
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "var(--radius-lg)",
                  background: "hsl(var(--color-cyan) / 0.08)",
                  fontSize: "1.5rem",
                }}
              >
                {f.emoji}
              </div>

              <h3
                className="font-semibold mb-2 text-sm"
                style={{ color: "hsl(var(--hisab-foreground))" }}
              >
                {f.title}
              </h3>

              <p
                className="text-xs"
                style={{
                  color: "hsl(var(--hisab-muted-fg))",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}