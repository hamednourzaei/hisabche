import { Section, SectionHeading, FeatureCard } from "@hisabche/ui"

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
    <Section>
      <SectionHeading title="همه ابزارها" desc="هر چیزی که نیاز داری" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f, i) => <FeatureCard key={i} {...f} index={i} />)}
      </div>
    </Section>
  )
}