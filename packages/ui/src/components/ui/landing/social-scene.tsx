import { Section } from "@hisabche/ui"

const testimonials = [
  { name: "احمد — سوپرمارکت کابل", text: "از وقتی حسابچه دارم، دیگه دفتر کاغذی ندارم." },
  { name: "فاطمه — بوتیک مزار", text: "بدهی مشتریام همیشه جلومه. دیگه پولم گم نمیشه." },
  { name: "محمد — عمده‌فروش هرات", text: "۳ تا گدام دارم. با حسابچه همه رو یه‌جا می‌بینم." },
]

export default function SocialScene() {
  return (
    <Section bordered>
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-1.5 text-xs text-[var(--hisab-muted-fg)] mb-6">
          ⭐ ۴.۹ · ۳۴۰+ کسب‌وکار فعال
        </div>
        <h2 className="text-3xl font-bold text-[var(--hisab-foreground)]">اعتماد واقعی</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {testimonials.map((t, i) => (
          <div key={i} className="p-6 rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)]/80 backdrop-blur-sm hover:border-purple-500/20 transition-all">
            <p className="text-sm text-[var(--hisab-muted-fg)] leading-relaxed mb-4">"{t.text}"</p>
            <p className="text-xs font-semibold text-[var(--hisab-foreground)]">{t.name}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}