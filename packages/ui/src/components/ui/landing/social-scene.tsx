"use client";

import { useSceneObserver } from "./use-scene-observer";

const testimonials = [
  { name: "احمد رحیمی", role: "سوپرمارکت کابل", text: "از وقتی حسابچه دارم، دیگه دفتر کاغذی ندارم. همه چیز دم دستمه." },
  { name: "فاطمه نوری", role: "بوتیک مزار شریف", text: "بدهی مشتریام همیشه جلومه. دیگه پولم گم نمیشه." },
  { name: "محمد عظیمی", role: "عمده‌فروش هرات", text: "۳ تا گدام دارم. با حسابچه همه رو یه‌جا می‌بینم." },
];

export default function SocialScene() {
  const { ref, state } = useSceneObserver<HTMLDivElement>({ 
    threshold: 0.3,
    narrativeState: "trust"
  });

  return (
    <section
      id="testimonials"
      ref={ref}
      data-narrative="trust"
      className="section-padding border-y border-border"
    >
      <div className="container-narrow">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-4 py-1.5 text-sm text-muted-foreground mb-6">
            ⭐ ۴.۹ · ۳۴۰+ کسب‌وکار فعال
          </div>
          <h2 className="text-4xl font-bold text-foreground">اعتماد واقعی</h2>
          <p className="text-muted-foreground mt-4">همونایی که مثل تو بودن</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="testimonial-card"
              style={{
                opacity: state === "animated" ? 1 : 0,
                transform: state === "animated" ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.4s var(--ease-out) ${i * 0.1}s, transform 0.4s var(--ease-out) ${i * 0.1}s`,
              }}
            >
              <p className="mb-5 text-sm leading-relaxed text-muted-foreground">«{t.text}»</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20 text-sm font-bold text-purple-300">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}