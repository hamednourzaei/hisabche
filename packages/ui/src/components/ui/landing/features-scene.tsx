"use client";

import { useSceneObserver } from "./use-scene-observer";

const features = [
  { emoji: "🧾", title: "فاکتور در ۳۰ ثانیه", desc: "محصول از گدام، مشتری از دفتر تلفن." },
  { emoji: "📦", title: "گدام خودکار", desc: "ورود و خروج با هر فاکتور." },
  { emoji: "📒", title: "بدهی یادت بمونه", desc: "پرداخت در ۲ کلیک." },
  { emoji: "📱", title: "تو جیب شماست", desc: "موبایل، تبلت، کامپیوتر." },
  { emoji: "🔌", title: "آفلاین واقعی", desc: "اینترنت نیست؟ مشکلی نیست." },
  { emoji: "💱", title: "افغانی · دلار · تومان", desc: "تبدیل خودکار." },
];

export default function FeaturesScene() {
  const { ref, state } = useSceneObserver<HTMLDivElement>({ 
    threshold: 0.3,
    narrativeState: "confidence"
  });

  return (
    <section
      id="features"
      ref={ref}
      data-narrative="confidence"
      className="section-padding"
    >
      <div className="container-narrow">
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">ابزارها</p>
          <h2 className="text-4xl font-bold text-foreground">همه چیزی که نیاز داری</h2>
          <p className="text-muted-foreground mt-4">هیچ چیز اضافه، هیچ چیز کم</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface-muted/40 p-6 text-center transition-all duration-300 hover:border-purple-500/30"
              style={{
                opacity: state === "animated" ? 1 : 0,
                transition: `opacity 0.3s var(--ease-out) ${i * 0.05}s`,
              }}
            >
              <div className="text-3xl mb-3">{f.emoji}</div>
              <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}