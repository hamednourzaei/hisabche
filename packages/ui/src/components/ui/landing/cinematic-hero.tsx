"use client";

import { useEffect, useState } from "react";
import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";

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
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { setVisible(true); return; }
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
      {/* Radial glow — GPU only, pointer-events none */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--color-primary) / 0.12), transparent)",
          willChange: "opacity",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 container-narrow text-center">

        {/* Badge */}
        <div
          className={cn("scene-transition inline-flex items-center gap-2 px-4 py-1.5 mb-6", v)}
          style={{
            transitionDelay: "0ms",
            borderRadius:    "var(--radius-full)",
            border:          "1px solid hsl(var(--color-primary) / 0.2)",
            background:      "hsl(var(--color-primary) / 0.06)",
            color:           "hsl(var(--color-primary))",
            fontSize:        "var(--text-caption)",
          }}
        >
          <span
            className="h-1.5 w-1.5"
            style={{ borderRadius: "var(--radius-full)", background: "hsl(var(--color-primary))" }}
          />
          ۳۴۰+ کسب‌وکار فعال در افغانستان
        </div>

        {/* H1 */}
        <h1
          className={cn("h1 scene-transition mb-6", v)}
          style={{ transitionDelay: "80ms", color: "hsl(var(--fg-primary))" }}
        >
          حسابداری‌ای که
          <br />
          <span style={{
            background:            "linear-gradient(to left, hsl(var(--color-success)), hsl(190 90% 50%), hsl(var(--color-primary)))",
            WebkitBackgroundClip:  "text",
            WebkitTextFillColor:   "transparent",
            backgroundClip:        "text",
          }}>
            هیچ‌وقت فراموش نمی‌کنه
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className={cn("scene-transition mx-auto mb-10 max-w-2xl", v)}
          style={{
            transitionDelay: "160ms",
            fontSize:        "var(--text-body)",
            color:           "hsl(var(--fg-secondary))",
            lineHeight:      "var(--leading-relaxed)",
          }}
        >
          این فقط یک اپ نیست — حافظه‌ی زنده‌ی کسب‌وکار توئه.
          فاکتور، گدام، بدهی — همه در یک جا.
        </p>

        {/* CTAs */}
        <div
          className={cn("scene-transition flex flex-col sm:flex-row gap-4 justify-center", v)}
          style={{ transitionDelay: "240ms" }}
        >
          <button type="button" onClick={onNavigateLogin} className="btn-primary">
            {ctaText}
          </button>
          <button
            type="button"
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            className="btn-secondary"
          >
            بیشتر بدون
          </button>
        </div>

        {/* Subtext */}
        <p
          className={cn("scene-transition mt-6", v)}
          style={{
            transitionDelay: "300ms",
            fontSize:        "var(--text-caption)",
            color:           "hsl(var(--fg-tertiary))",
          }}
        >
          بدون کارت بانکی · فعال در ۳۰ ثانیه
        </p>

        {/* Trust bar */}
        <div
          className={cn("scene-transition mt-16 flex flex-wrap items-center justify-center gap-8", v)}
          style={{
            transitionDelay: "360ms",
            fontSize:        "var(--text-caption)",
            color:           "hsl(var(--fg-tertiary))",
          }}
        >
          {[["🔌","آفلاین واقعی"],["🔐","داده امن"],["📱","موبایل + وب"]].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2">
              <span style={{ fontSize: "var(--text-body)" }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}