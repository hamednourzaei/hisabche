// ═══════════════════════════════════════════════════════════
// packages/ui/src/components/ui/living-background.tsx (v2)
// ✅ GPU friendly, no JS, CSS-only animation
// ═══════════════════════════════════════════════════════════
export function LivingBackground() {
  return (
    <div className="cinematic-bg" aria-hidden="true">
      <div className="cinematic-bg-glow-1 bg-glow-1 motion-reduce:hidden" />
      <div className="cinematic-bg-glow-2 bg-glow-2 motion-reduce:hidden" />
      <div className="cinematic-bg-glow-3 bg-glow-3 motion-reduce:hidden" />
      <div className="cinematic-bg-noise motion-reduce:hidden" />
    </div>
  )
}