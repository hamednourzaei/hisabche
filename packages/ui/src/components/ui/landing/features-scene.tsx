const features = [
  { emoji: "🧾", title: "فاکتور در ۳۰ ثانیه", desc: "محصول از گدام، مشتری از دفتر تلفن." },
  { emoji: "📦", title: "گدام خودکار", desc: "ورود و خروج با هر فاکتور." },
  { emoji: "📒", title: "بدهی یادت بمونه", desc: "پرداخت در ۲ کلیک." },
  { emoji: "📱", title: "تو جیب شماست", desc: "موبایل، تبلت، کامپیوتر." },
  { emoji: "🔌", title: "آفلاین واقعی", desc: "اینترنت نیست؟ مشکلی نیست." },
  { emoji: "💱", title: "افغانی · دلار · تومان", desc: "تبدیل خودکار." },
]

export default function FeaturesScene() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs tracking-[0.3em] text-[var(--hisab-muted-fg)] uppercase">ابزارها</p>
          <h2 className="text-4xl font-bold text-[var(--hisab-foreground)]">همه چیزی که نیاز داری</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--hisab-border)] bg-[var(--hisab-card)]/60 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-purple-500/30"
            >
              <div className="mb-4 text-3xl">{f.emoji}</div>
              <h3 className="mb-2 font-semibold text-[var(--hisab-foreground)]">{f.title}</h3>
              <p className="text-sm text-[var(--hisab-muted-fg)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}