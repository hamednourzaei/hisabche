"use client";

import { useSceneObserver } from "./use-scene-observer";

export interface CinematicHeroProps {
  onNavigateLogin: () => void;
}

function getCTA() {
  if (typeof window === "undefined") return "شروع کن — رایگان";
  const v = localStorage.getItem("cta_variant");
  if (v) return v === "B" ? "ساخت حساب در ۳۰ ثانیه ←" : "شروع کن — رایگان ←";

  const variant = Math.random() > 0.5 ? "A" : "B";
  localStorage.setItem("cta_variant", variant);

  return variant === "B" ? "ساخت حساب در ۳۰ ثانیه ←" : "شروع کن — رایگان ←";
}

export default function CinematicHero({ onNavigateLogin }: CinematicHeroProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({ 
    threshold: 0.1,
    narrativeState: "frustration"
  });
  const ctaText = getCTA();

  return (
    <section
      id="hero"
      ref={ref}
      data-narrative="frustration"
      className="relative flex min-h-screen items-center justify-center overflow-hidden section-padding"
    >
      {/* Rest remains the same */}
      <div className="absolute inset-0 bg-clarity pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/5 px-4 py-1.5 text-sm text-purple-300 mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          ۳۴۰+ کسب‌وکار فعال در افغانستان
        </div>

        <h1 className="font-bold mb-6">
          حسابداری‌ای که
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            هیچ‌وقت فراموش نمی‌کنه
          </span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          این فقط یک اپ نیست — حافظه‌ی زنده‌ی کسب‌وکار توئه. فاکتور، گدام، بدهی — همه در یک جا.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={onNavigateLogin} className="btn-primary">
            {ctaText}
          </button>

          <button
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            className="btn-secondary"
          >
            بیشتر بدون
          </button>
        </div>

        <div className="mt-6 text-sm text-muted-foreground">
          بدون کارت بانکی · فعال در ۳۰ ثانیه
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
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