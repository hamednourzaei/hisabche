"use client";

import { useSceneObserver } from "./use-scene-observer";
import { useScrollNarrative } from "./use-scroll-narrative-store";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CTAScene v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Zero inline styles — all Tailwind classes
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CTASceneProps {
  onNavigateLogin: () => void;
}

const gradientMap: Record<string, string> = {
  action: "from-[hsl(var(--surface-elevated))] to-[hsl(320_80%_60%/0.15)]",
  trust: "from-[hsl(var(--surface-elevated))] to-[hsl(262_80%_65%/0.15)]",
  confidence: "from-[hsl(var(--surface-elevated))] to-[hsl(190_90%_55%/0.15)]",
};

const orbColorMap: Record<string, { end: string; start: string }> = {
  action: {
    end: "bg-[hsl(320_80%_60%/0.15)]",
    start: "bg-[hsl(320_80%_60%/0.12)]",
  },
  trust: {
    end: "bg-[hsl(var(--color-primary)/0.1)]",
    start: "bg-[hsl(190_90%_50%/0.08)]",
  },
  confidence: {
    end: "bg-[hsl(190_90%_55%/0.1)]",
    start: "bg-[hsl(190_90%_55%/0.08)]",
  },
};

const defaultGradient =
  "from-[hsl(var(--surface-elevated))] to-[hsl(var(--color-primary)/0.05)]";
const defaultOrbs = {
  end: "bg-[hsl(var(--color-primary)/0.1)]",
  start: "bg-[hsl(190_90%_50%/0.08)]",
};

export default function CTAScene({ onNavigateLogin }: CTASceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: "action",
  });

  const { narrativeState } = useScrollNarrative();
  const animated = state === "animated";

  const gradient = gradientMap[narrativeState] ?? defaultGradient;
  const orbs = orbColorMap[narrativeState] ?? defaultOrbs;

  return (
    <section
      id="cta"
      ref={ref}
      data-narrative="action"
      className="section-padding"
    >
      <div className="container-narrow max-w-2xl">
        <div
          className={cn(
            "relative overflow-hidden text-center",
            "rounded-[var(--radius-card)]",
            "border border-[hsl(var(--border-default))]",
            "bg-gradient-to-br",
            gradient,
            "p-[clamp(2.5rem,6vw,4rem)]",
            "transition-all duration-500",
            animated
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-[0.97] translate-y-4",
          )}
        >
          {/* Glow orbs */}
          <div
            className={cn(
              "pointer-events-none absolute",
              "end-0 top-0",
              "w-64 h-64 rounded-full blur-3xl",
              orbs.end,
            )}
            aria-hidden="true"
          />
          <div
            className={cn(
              "pointer-events-none absolute",
              "start-0 bottom-0",
              "w-48 h-48 rounded-full blur-3xl",
              orbs.start,
            )}
            aria-hidden="true"
          />

          {/* Content */}
          <div className="relative">
            <h2 className="h2 mb-4 text-[hsl(var(--fg-primary))]">
              آماده‌ای؟
            </h2>

            <p className="mb-8 text-lg text-[hsl(var(--fg-secondary))] leading-relaxed">
              ۳۰ ثانیه تا اولین فاکتور واقعی
            </p>

            <button
              type="button"
              onClick={onNavigateLogin}
              className="btn-primary mx-auto text-lg"
            >
              شروع کن — رایگان ←
            </button>

            <p className="mt-6 text-xs text-[hsl(var(--fg-tertiary))]">
              بدون نیاز به کارت بانکی · لغو آسان
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}