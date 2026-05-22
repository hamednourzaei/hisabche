import { Section, LandingPreview } from "@hisabche/ui"

export default function TransformScene() {
  return (
    <Section>
      <div className="text-center">
        <h2 className="text-4xl font-bold text-[var(--hisab-foreground)] mb-6">بعد از حسابچه</h2>
        <p className="text-[var(--hisab-muted-fg)] max-w-xl mx-auto mb-10">همه چیز در یک سیستم زنده. فاکتور، گدام، بدهی… همه در لحظه.</p>
        <LandingPreview />
      </div>
    </Section>
  )
}