import { Section, LandingPreview } from "@hisabche/ui"

export default function TransformScene() {
  return (
    <Section>
      <div className="text-center">
        <h2 className="mb-6 text-4xl font-bold text-[var(--hisab-foreground)]">
          بعد از حسابچه
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-[var(--hisab-muted-fg)]">
          همه چیز در یک سیستم زنده. فاکتور، گدام، بدهی… همه در لحظه.
        </p>
        <LandingPreview />
      </div>
    </Section>
  )
}