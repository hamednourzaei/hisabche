"use client";

import { useSceneObserver } from "./use-scene-observer";

const testimonials = [
  { name: "احمد رحیمی",  role: "سوپرمارکت کابل",    text: "از وقتی حسابچه دارم، دیگه دفتر کاغذی ندارم. همه چیز دم دستمه." },
  { name: "فاطمه نوری",  role: "بوتیک مزار شریف",    text: "بدهی مشتریام همیشه جلومه. دیگه پولم گم نمیشه."                  },
  { name: "محمد عظیمی",  role: "عمده‌فروش هرات",      text: "۳ تا گدام دارم. با حسابچه همه رو یه‌جا می‌بینم."               },
];

export default function SocialScene() {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: "trust",
  });

  const animated = state === "animated";

  return (
    <section
      id="testimonials"
      ref={ref}
      data-narrative="trust"
      className="section-padding"
      style={{ borderTop: "1px solid hsl(var(--hisab-border))", borderBottom: "1px solid hsl(var(--hisab-border))" }}
    >
      <div className="container-narrow">

        <div
          className="text-center mb-16 scene-transition"
          style={{
            opacity:   animated ? 1 : 0,
            transform: animated ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm mb-6"
            style={{
              borderRadius: "var(--radius-full)",
              border: "1px solid hsl(var(--hisab-border))",
              background: "hsl(var(--surface-muted))",
              color: "hsl(var(--hisab-muted-fg))",
            }}
          >
            <span style={{ color: "#facc15" }}>⭐</span>
            ۴.۹ · ۳۴۰+ کسب‌وکار فعال
          </div>

          <h2
            className="h2"
            style={{ color: "hsl(var(--hisab-foreground))" }}
          >
            اعتماد واقعی
          </h2>
          <p
            className="mt-4"
            style={{
              color: "hsl(var(--hisab-muted-fg))",
              fontSize: "var(--font-body-large)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            همونایی که مثل تو بودن
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="testimonial-card"
              style={{
                opacity:    animated ? 1 : 0,
                transform:  animated ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.4s var(--ease-out) ${i * 0.12}s, transform 0.4s var(--ease-out) ${i * 0.12}s`,
              }}
            >
              <div className="testimonial-rating">
                {Array.from({ length: 5 }).map((_, s) => (
                  <svg key={s} viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 1l1.9 3.9L14 5.8l-3 2.9.7 4.1L8 10.8l-3.7 2 .7-4.1-3-2.9 4.1-.9z" />
                  </svg>
                ))}
              </div>

              <p className="testimonial-text">«{t.text}»</p>

              <div className="testimonial-author">
                <div className="testimonial-avatar" aria-hidden="true">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}