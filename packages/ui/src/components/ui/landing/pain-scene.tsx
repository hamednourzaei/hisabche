const items = [
  { emoji: "📋", text: "دفترها گم میشن" },
  { emoji: "😰", text: "حساب‌ها فراموش میشن" },
  { emoji: "📉", text: "سود واقعی معلوم نیست" },
]

export default function PainScene() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-5xl text-center">
        <p className="mb-3 text-xs tracking-[0.3em] text-[var(--hisab-muted-fg)] uppercase">قبل از حسابچه</p>
        <h2 className="mb-16 text-4xl font-bold text-[var(--hisab-foreground)]">دنیای قدیم</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center text-[var(--hisab-muted-fg)] transition-transform hover:scale-[1.03]"
            >
              <div className="mb-3 text-3xl">{item.emoji}</div>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}