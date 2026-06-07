export default function TransformScene() {
  return (
    <section className="py-24 px-6 bg-card/20">
      <div className="mx-auto max-w-5xl text-center">
        <p className="mb-3 text-xs tracking-[0.3em] text-muted-foreground uppercase">بعد از حسابچه</p>
        <h2 className="mb-6 text-4xl font-bold text-foreground">همه چیز در یک جا</h2>
        <p className="mx-auto mb-14 max-w-xl text-muted-foreground">
          فاکتور، گدام، بدهی… همه در لحظه. بدون کاغذ، بدون فراموشی.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: "🧾", title: "فاکتور لحظه‌ای", desc: "صدور در ۳۰ ثانیه" },
            { icon: "📦", title: "گدام زنده", desc: "موجودی همیشه آپدیت" },
            { icon: "📒", title: "بدهی شفاف", desc: "هر بدهی ثبت و پیگیری" },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-8 text-center">
              <div className="mb-3 text-4xl">{item.icon}</div>
              <div className="mb-1 font-semibold text-foreground">{item.title}</div>
              <div className="text-sm text-muted-foreground">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}