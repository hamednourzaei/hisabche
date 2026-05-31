import { Section, SectionHeading } from "@hisabche/ui"

const items = [
  "دفترها گم میشن",
  "حساب‌ها فراموش میشن",
  "سود واقعی معلوم نیست",
]

export default function PainScene() {
  return (
    <Section>
      <SectionHeading
        title="قبل از حسابچه"
        desc="دنیای قدیم"
      />

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((t, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--hisab-destructive)]/20 bg-[var(--hisab-destructive)]/5 p-6 text-center text-[var(--hisab-muted-fg)] transition-transform hover:scale-[1.03]"
          >
            {t}
          </div>
        ))}
      </div>
    </Section>
  )
}