"use client";

import { useEffect, useState } from "react";
import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CinematicHero v3 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Minimal inline styles — only gradient text + animation delays
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CinematicHeroProps {
  onNavigateLogin: () => void;
}

function getCTA() {
  if (typeof window === "undefined") return "شروع کن — رایگان ←";
  const v = localStorage.getItem("cta_variant");
  if (v) return v === "B" ? "ساخت حساب در ۳۰ ثانیه ←" : "شروع کن — رایگان ←";
  const variant = Math.random() > 0.5 ? "A" : "B";
  localStorage.setItem("cta_variant", variant);
  return variant === "B" ? "ساخت حساب در ۳۰ ثانیه ←" : "شروع کن — رایگان ←";
}

export default function CinematicHero({ onNavigateLogin }: CinematicHeroProps) {
  const { ref } = useSceneObserver<HTMLDivElement>({
    threshold: 0.1,
    narrativeState: "frustration",
  });

  const [visible, setVisible] = useState(false);
  const ctaText = getCTA();

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const v = visible ? "scene-visible" : "scene-hidden";

  return (
    <section
      id="hero"
      ref={ref}
      data-narrative="frustration"
      className="relative flex min-h-screen items-center justify-center overflow-hidden section-padding"
    >
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--color-primary) / 0.12), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 container-narrow text-center">
        {/* Badge */}
        <div
          className={cn(
            "scene-transition inline-flex items-center gap-2 px-4 py-1.5 mb-6",
            "rounded-full",
            "border border-[hsl(var(--color-primary)/0.2)]",
            "bg-[hsl(var(--color-primary)/0.06)]",
            "text-[hsl(var(--color-primary))]",
            "text-[length:var(--text-caption)]",
            v,
          )}
          style={{ transitionDelay: "0ms" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--color-primary))]" />
          ۳۴۰+ کسب‌وکار فعال در افغانستان
        </div>

        {/* H1 */}
        <h1
          className={cn(
            "h1 scene-transition mb-6",
            "text-[hsl(var(--fg-primary))]",
            v,
          )}
          style={{ transitionDelay: "80ms" }}
        >
          حسابداری‌ای که
          <br />
          <span
            className="bg-gradient-to-l from-[hsl(var(--color-success))] via-[hsl(190_90%_50%)] to-[hsl(var(--color-primary))] bg-clip-text text-transparent"
          >
            هیچ‌وقت فراموش نمی‌کنه
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className={cn(
            "scene-transition mx-auto mb-10 max-w-2xl",
            "text-[length:var(--text-body)]",
            "text-[hsl(var(--fg-secondary))]",
            "leading-[var(--leading-relaxed)]",
            v,
          )}
          style={{ transitionDelay: "160ms" }}
        >
          این فقط یک اپ نیست — حافظه‌ی زنده‌ی کسب‌وکار توئه. فاکتور، گدام، بدهی
          — همه در یک جا.
        </p>

        {/* CTAs */}
        <div
          className={cn(
            "scene-transition flex flex-col sm:flex-row gap-4 justify-center",
            v,
          )}
          style={{ transitionDelay: "240ms" }}
        >
          <button type="button" onClick={onNavigateLogin} className="btn-primary">
            {ctaText}
          </button>
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("features")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="btn-secondary"
          >
            بیشتر بدون
          </button>
        </div>

        {/* Subtext */}
        <p
          className={cn(
            "scene-transition mt-6",
            "text-[length:var(--text-caption)]",
            "text-[hsl(var(--fg-tertiary))]",
            v,
          )}
          style={{ transitionDelay: "300ms" }}
        >
          بدون کارت بانکی · فعال در ۳۰ ثانیه
        </p>

        {/* Trust bar */}
        <div
          className={cn(
            "scene-transition mt-16 flex flex-wrap items-center justify-center gap-8",
            "text-[length:var(--text-caption)]",
            "text-[hsl(var(--fg-tertiary))]",
            v,
          )}
          style={{ transitionDelay: "360ms" }}
        >
          {[
            ["🔌", "آفلاین واقعی"],
            ["🔐", "داده امن"],
            ["📱", "موبایل + وب"],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2">
              <span className="text-[length:var(--text-body)]">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}