const testimonials = [
  { name: "احمد رحیمی", role: "سوپرمارکت کابل", text: "از وقتی حسابچه دارم، دیگه دفتر کاغذی ندارم. همه چیز دم دستمه." },
  { name: "فاطمه نوری", role: "بوتیک مزار شریف", text: "بدهی مشتریام همیشه جلومه. دیگه پولم گم نمیشه." },
  { name: "محمد عظیمی", role: "عمده‌فروش هرات", text: "۳ تا گدام دارم. با حسابچه همه رو یه‌جا می‌بینم." },
]

export default function SocialScene() {
  return (
    <section id="testimonials" className="py-24 px-6 border-y border-[var(--hisab-border)]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-1.5 text-xs text-[var(--hisab-muted-fg)]">
            ⭐ ۴.۹ · ۳۴۰+ کسب‌وکار فعال
          </div>
          <h2 className="text-4xl font-bold text-[var(--hisab-foreground)]">اعتماد واقعی</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--hisab-border)] bg-[var(--hisab-card)]/80 p-6 backdrop-blur-sm transition-all hover:border-purple-500/20"
            >
              <p className="mb-5 text-sm leading-relaxed text-[var(--hisab-muted-fg)]">«{t.text}»</p>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/15 text-xs font-bold text-purple-300">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--hisab-foreground)]">{t.name}</div>
                  <div className="text-xs text-[var(--hisab-muted-fg)]">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}