"use client";

import { useEffect, useRef, useState } from "react";
import { useSceneObserver } from "./use-scene-observer";

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
  const sectionRef = useRef<HTMLElement>(null);
  const ctaText = getCTA();

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const visibleClass = visible ? "scene-visible" : "scene-hidden";

  return (
    <section
      id="hero"
      ref={ref}
      data-narrative="frustration"
      className="relative flex min-h-screen items-center justify-center overflow-hidden section-padding"
    >
      <div className="absolute inset-0 bg-pain pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 container-narrow text-center">

        <div
          className={`scene-transition ${visibleClass} inline-flex items-center gap-2 px-4 py-1.5 text-sm mb-6`}
          style={{
            transitionDelay: "0ms",
            borderRadius: "var(--radius-full)",
            border: "1px solid hsl(var(--color-purple) / 0.2)",
            background: "hsl(var(--color-purple) / 0.05)",
            color: "hsl(var(--color-purple))",
          }}
        >
          <span
            className="h-1.5 w-1.5"
            style={{ borderRadius: "var(--radius-full)", background: "hsl(var(--color-purple))" }}
          />
          ۳۴۰+ کسب‌وکار فعال در افغانستان
        </div>

        <h1
          className={`h1 scene-transition ${visibleClass} mb-6`}
          style={{
            transitionDelay: "80ms",
          }}
        >
          حسابداری‌ که
          <br />
          <span
            style={{
              background: "linear-gradient(to right, hsl(var(--color-purple)), hsl(var(--color-cyan)), hsl(var(--color-emerald)))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            هیچ‌وقت فراموش نمی‌کنه
          </span>
        </h1>

        <p
          className={`scene-transition ${visibleClass} mx-auto mb-10`}
          style={{
            transitionDelay: "160ms",
            fontSize: "var(--font-body-large)",
            color: "hsl(var(--hisab-muted-fg))",
            maxWidth: "42rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          این فقط یک اپ نیست — حافظه‌ی زنده‌ی کسب‌وکار توئه. فاکتور، گدام، بدهی — همه در یک جا.
        </p>

        <div
          className={`scene-transition ${visibleClass} flex flex-col sm:flex-row gap-4 justify-center`}
          style={{ transitionDelay: "240ms" }}
        >
          <button onClick={onNavigateLogin} className="btn-primary">
            {ctaText}
          </button>
          <button
            onClick={() =>
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
            }
            className="btn-secondary"
          >
            بیشتر بدون
          </button>
        </div>

        <p
          className={`scene-transition ${visibleClass} mt-6 text-sm`}
          style={{
            transitionDelay: "300ms",
            color: "hsl(var(--hisab-muted-fg))",
          }}
        >
          بدون کارت بانکی · فعال در ۳۰ ثانیه
        </p>

        <div
          className={`scene-transition ${visibleClass} mt-16 flex flex-wrap items-center justify-center gap-8 text-sm`}
          style={{
            transitionDelay: "360ms",
            color: "hsl(var(--hisab-muted-fg))",
          }}
        >
          {[
            ["🔌", "آفلاین واقعی"],
            ["🔐", "داده امن"],
            ["📱", "موبایل + وب"],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2">
              <span style={{ fontSize: "var(--font-body-large)" }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}