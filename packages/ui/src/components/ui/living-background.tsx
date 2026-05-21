// ═══════════════════════════════════════════════════════════
// packages/ui/src/components/ui/living-background.tsx
// ═══════════════════════════════════════════════════════════
export function LivingBackground() {
  return (
    <div className="cinematic-bg" aria-hidden="true">
      <div className="cinematic-bg-glow-1 bg-glow-1" />
      <div className="cinematic-bg-glow-2 bg-glow-2" />
      <div className="cinematic-bg-glow-3 bg-glow-3" />
      <div className="cinematic-bg-noise" />
    </div>
  )
}