"use client";

import { useSceneObserver } from "./use-scene-observer";
import { useScrollNarrative } from "./use-scroll-narrative-store";

export interface CTASceneProps {
  onNavigateLogin: () => void;
}

export default function CTAScene({ onNavigateLogin }: CTASceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: "action",
  });

  const { narrativeState } = useScrollNarrative();
  const animated = state === "animated";

  // رنگ‌های متناسب با narrative state
  const getGradientColors = () => {
    switch (narrativeState) {
      case 'action':
        return { from: 'hsl(var(--surface-elevated))', to: 'hsl(320 80% 60% / 0.15)' };
      case 'trust':
        return { from: 'hsl(var(--surface-elevated))', to: 'hsl(262 80% 65% / 0.15)' };
      case 'confidence':
        return { from: 'hsl(var(--surface-elevated))', to: 'hsl(190 90% 55% / 0.15)' };
      default:
        return { from: 'hsl(var(--surface-elevated))', to: 'hsl(var(--color-purple) / 0.05)' };
    }
  };

  const colors = getGradientColors();

  return (
    <section
      id="cta"
      ref={ref}
      data-narrative="action"
      className="section-padding"
    >
      <div className="container-narrow" style={{ maxWidth: "42rem" }}>
        <div
          className="relative overflow-hidden text-center"
          style={{
            opacity:      animated ? 1 : 0,
            transform:    animated ? "scale(1) translateY(0)" : "scale(0.97) translateY(16px)",
            transition:   "opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out)",
            borderRadius: "var(--radius-card)",
            border:       "1px solid hsl(var(--hisab-border))",
            background:   `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
            padding:      "clamp(2.5rem, 6vw, 4rem)",
          }}
        >
          {/* Glow orbs - رنگ متناسب با narrative state */}
          <div
            className="pointer-events-none absolute"
            style={{
              insetInlineEnd: 0,
              top:            0,
              width:          "16rem",
              height:         "16rem",
              borderRadius:   "var(--radius-full)",
              background:     narrativeState === 'action' ? "hsl(320 80% 60% / 0.15)" : "hsl(var(--color-purple) / 0.10)",
              filter:         "blur(48px)",
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute"
            style={{
              insetInlineStart: 0,
              bottom:           0,
              width:            "12rem",
              height:           "12rem",
              borderRadius:     "var(--radius-full)",
              background:       narrativeState === 'action' ? "hsl(320 80% 60% / 0.12)" : "hsl(var(--color-cyan) / 0.08)",
              filter:           "blur(40px)",
            }}
            aria-hidden="true"
          />

          {/* Content */}
          <div className="relative">
            <h2
              className="h2 mb-4"
              style={{ color: "hsl(var(--hisab-foreground))" }}
            >
              آماده‌ای؟
            </h2>

            <p
              className="mb-8"
              style={{
                color:      "hsl(var(--hisab-muted-fg))",
                fontSize:   "var(--font-body-large)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              ۳۰ ثانیه تا اولین فاکتور واقعی
            </p>

            <button
              onClick={onNavigateLogin}
              className="btn-primary mx-auto"
              style={{ fontSize: "var(--font-body-large)" }}
            >
              شروع کن — رایگان ←
            </button>

            <p
              className="mt-6 text-xs"
              style={{ color: "hsl(var(--hisab-muted-fg))" }}
            >
              بدون نیاز به کارت بانکی · لغو آسان
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}