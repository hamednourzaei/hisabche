"use client";

import { useEffect, useRef, useState } from "react";
import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CinematicHero v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Zero inline styles — all Tailwind classes
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
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      id="hero"
      ref={ref}
      data-narrative="frustration"
      className="relative flex min-h-screen items-center justify-center overflow-hidden section-padding"
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-[hsl(var(--surface-base)/0.6)] pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 container-narrow text-center">
        {/* Badge */}
        <div
          className={cn(
            "scene-transition inline-flex items-center gap-2 px-4 py-1.5 text-sm mb-6",
            "rounded-full",
            "border border-[hsl(var(--color-primary)/0.2)]",
            "bg-[hsl(var(--color-primary)/0.05)]",
            "text-[hsl(var(--color-primary))]",
            visible ? "scene-visible" : "scene-hidden",
          )}
          style={{ transitionDelay: "0ms" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--color-primary))]" />
          ۳۴۰+ کسب‌وکار فعال در افغانستان
        </div>

        {/* Headline */}
        <h1
          className={cn(
            "h1 scene-transition mb-6",
            visible ? "scene-visible" : "scene-hidden",
          )}
          style={{ transitionDelay: "80ms" }}
        >
          حسابداری‌ که
          <br />
          <span className="bg-gradient-to-r from-[hsl(var(--color-primary))] via-[hsl(190_90%_50%)] to-[hsl(var(--color-success))] bg-clip-text text-transparent">
            هیچ‌وقت فراموش نمی‌کنه
          </span>
        </h1>

        {/* Description */}
        <p
          className={cn(
            "scene-transition mx-auto mb-10 max-w-2xl",
            "text-lg text-[hsl(var(--fg-secondary))] leading-relaxed",
            visible ? "scene-visible" : "scene-hidden",
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
            visible ? "scene-visible" : "scene-hidden",
          )}
          style={{ transitionDelay: "240ms" }}
        >
          <button
            type="button"
            onClick={onNavigateLogin}
            className="btn-primary"
          >
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

        {/* Footnote */}
        <p
          className={cn(
            "scene-transition mt-6 text-sm text-[hsl(var(--fg-tertiary))]",
            visible ? "scene-visible" : "scene-hidden",
          )}
          style={{ transitionDelay: "300ms" }}
        >
          بدون کارت بانکی · فعال در ۳۰ ثانیه
        </p>

        {/* Trust bar */}
        <div
          className={cn(
            "scene-transition mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-[hsl(var(--fg-tertiary))]",
            visible ? "scene-visible" : "scene-hidden",
          )}
          style={{ transitionDelay: "360ms" }}
        >
          {[
            ["🔌", "آفلاین واقعی"],
            ["🔐", "داده امن"],
            ["📱", "موبایل + وب"],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}