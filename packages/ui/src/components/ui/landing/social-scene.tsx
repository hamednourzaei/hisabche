import { Section } from "@hisabche/ui"

const testimonials = [
  {
    name: "احمد — سوپرمارکت کابل",
    text: "از وقتی حسابچه دارم، دیگه دفتر کاغذی ندارم.",
  },
  {
    name: "فاطمه — بوتیک مزار",
    text: "بدهی مشتریام همیشه جلومه. دیگه پولم گم نمیشه.",
  },
  {
    name: "محمد — عمده‌فروش هرات",
    text: "۳ تا گدام دارم. با حسابچه همه رو یه‌جا می‌بینم.",
  },
]

export default function SocialScene() {
  return (
    <Section bordered>
      {/* ── Header ── */}
      <div className="mb-10 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-1.5 text-xs text-[var(--hisab-muted-fg)]">
          ⭐ ۴.۹ · ۳۴۰+ کسب‌وکار فعال
        </div>
        <h2 className="text-3xl font-bold text-[var(--hisab-foreground)]">
          اعتماد واقعی
        </h2>
      </div>

      {/* ── Testimonials ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {testimonials.map((t, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)]/80 p-6 backdrop-blur-sm transition-all hover:border-purple-500/20"
          >
            <p className="mb-4 text-sm leading-relaxed text-[var(--hisab-muted-fg)]">
              &ldquo;{t.text}&rdquo;
            </p>
            <p className="text-xs font-semibold text-[var(--hisab-foreground)]">
              {t.name}
            </p>
          </div>
        ))}
      </div>
    </Section>
  )
}