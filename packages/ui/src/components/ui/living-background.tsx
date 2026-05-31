// ═══════════════════════════════════════════════════════════
// packages/ui/src/components/ui/living-background.tsx (v3)
// ✅ GPU friendly, no JS, CSS-only animation
// ═══════════════════════════════════════════════════════════

export function LivingBackground() {
  return (
    <div className="cinematic-bg" aria-hidden="true">
      <div className="bg-glow-1 motion-reduce:hidden" />
      <div className="bg-glow-2 motion-reduce:hidden" />
      <div className="bg-glow-3 motion-reduce:hidden" />
    </div>
  )
}