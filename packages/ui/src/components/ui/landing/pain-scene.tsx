"use client";

import { useSceneObserver } from "./use-scene-observer";

const pains = [
  { emoji: "📋", text: "دفترها گم میشن", impact: "ساعت‌ها وقت تلف میشه" },
  { emoji: "😰", text: "حساب‌ها فراموش میشن", impact: "بدهی‌ها از یاد میرن" },
  { emoji: "📉", text: "سود واقعی معلوم نیست", impact: "تصمیمات اشتباه میگیری" },
];

export default function PainScene() {
  const { ref, state } = useSceneObserver<HTMLDivElement>({ 
    threshold: 0.3,
    narrativeState: "confusion"
  });

  return (
    <section
      id="pain"
      ref={ref}
      data-narrative="confusion"
      className="section-padding"
    >
      <div className="container-narrow">
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">
            قبل از حسابچه
          </p>
          <h2 className="text-4xl font-bold text-foreground">دنیای قدیم حسابداری</h2>
          <p className="text-muted-foreground mt-4 max-w-md mx-auto">
            شاید این مشکلات رو هر روز تجربه میکنی
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {pains.map((pain, i) => (
            <div
              key={i}
              className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center transition-all duration-400"
              style={{
                opacity: state === "animated" ? 1 : 0,
                transform: state === "animated" ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.4s var(--ease-out) ${i * 0.1}s, transform 0.4s var(--ease-out) ${i * 0.1}s`,
              }}
            >
              <div className="text-4xl mb-4">{pain.emoji}</div>
              <p className="text-lg font-semibold text-foreground mb-2">{pain.text}</p>
              <p className="text-sm text-muted-foreground">{pain.impact}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}