// packages/ui/src/components/ui/landing/dashboard-showcase-scene.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { TrendingUp, Bell } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardShowcaseScene v8 — Unoptimized images for large PNGs
   ═══════════════════════════════════════════════════════════════════════════ */

export interface DashboardShowcaseSceneProps {
  t?: (key: string, fallback?: string) => string;
}

export default function DashboardShowcaseScene(props: DashboardShowcaseSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const st = (key: string, fallback?: string): string => {
    if (typeof props.t === "function") {
      const result = props.t(key);
      if (typeof result === "string" && result !== key) return result;
    }
    return fallback ?? key;
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -4, y: px * 6 });
  };

  const resetTilt = () => setTilt({ x: 0, y: 0 });

  return (
    <section id="dashboard-showcase" ref={ref} className="py-12 sm:py-16 lg:py-20 overflow-hidden">
      <div className="container-narrow px-4 sm:px-6">
        <div
          className={cn(
            "text-center mb-8 sm:mb-12 lg:mb-16",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-[10px] sm:text-xs lg:text-sm uppercase tracking-[0.2em] mb-2 sm:mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {st("landing.dashboardLabel", "محصول")}
          </p>
          <h2 className="text-lg sm:text-2xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight mb-2 sm:mb-3 lg:mb-4">
            {st("landing.dashboardTitle", "این چیزیه که هر روز می‌بینی")}
          </h2>
          <p className="mx-auto max-w-xl text-sm sm:text-base lg:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed px-4 sm:px-0">
            {st("landing.dashboardDesc", "یک نگاه، همه چیز روشن — فروش امروز، موجودی گدام، بدهی مشتری‌ها.")}
          </p>
        </div>

        <div
          className={cn(
            "relative mx-auto max-w-4xl",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.97]",
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 -z-10 blur-[100px] max-sm:hidden"
            style={{ background: "radial-gradient(ellipse 70% 60% at 50% 40%, hsl(var(--color-primary)/0.12), transparent)" }}
            aria-hidden="true"
          />

          {/* Browser frame */}
          <div
            ref={frameRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={resetTilt}
            className={cn(
              "relative rounded-xl sm:rounded-2xl overflow-hidden",
              "border border-[hsl(var(--border-default))]",
              "bg-[hsl(var(--surface-elevated))]",
              "shadow-[var(--shadow-premium)]",
              "transition-transform duration-300 ease-out motion-reduce:transform-none",
              "will-change-transform",
            )}
            style={{
              transform: `perspective(1400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            }}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 bg-[hsl(var(--surface-muted))] border-b border-[hsl(var(--border-default))]">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[hsl(var(--color-destructive)/0.5)]" />
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[hsl(var(--color-warning)/0.5)]" />
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[hsl(var(--color-success)/0.5)]" />
              <div className="flex-1 flex justify-center">
                <span className="px-2 sm:px-3 py-0.5 rounded-full text-[8px] sm:text-[10px] lg:text-xs text-[hsl(var(--fg-tertiary))] bg-[hsl(var(--surface-base))] border border-[hsl(var(--border-default))]">
                  app.hisabche.af
                </span>
              </div>
            </div>

            {/* Desktop screenshot — unoptimized for large files */}
            <Image
              src="/dashboard-desktop.png"
              alt={st("landing.dashboardAlt", "نمای داشبورد حسابچه")}
              width={1600}
              height={1000}
              className="w-full h-auto"
              loading="lazy"
              unoptimized
            />
          </div>

          {/* Phone frame */}
          <div
            className={cn(
              "absolute -bottom-6 sm:-bottom-8 lg:-bottom-12 start-1 sm:start-[-20px] lg:start-[-40px]",
              "w-[80px] sm:w-[100px] lg:w-[150px] rounded-[1.2rem] sm:rounded-[1.4rem] lg:rounded-[2rem] overflow-hidden",
              "border-[3px] sm:border-4 lg:border-[6px] border-[hsl(var(--surface-base))]",
              "shadow-[var(--shadow-premium)] ring-1 ring-[hsl(var(--border-default))]",
              "transition-all duration-700 delay-200 motion-reduce:transition-none",
              animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
            )}
          >
            <Image
              src="/dashboard-mobile.png"
              alt={st("landing.dashboardMobileAlt", "نمای موبایل حسابچه")}
              width={750}
              height={1625}
              className="w-full h-auto"
              loading="lazy"
              unoptimized
            />
          </div>

          {/* Floating chips */}
          <div
            className={cn(
              "hidden lg:flex absolute -end-6 top-10 items-center gap-2 px-3.5 py-2.5 rounded-xl",
              "bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-default))] shadow-[var(--shadow-premium)]",
              "transition-all duration-700 delay-300 motion-reduce:transition-none",
              animated ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4",
            )}
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] shrink-0">
              <TrendingUp className="size-4" aria-hidden="true" />
            </span>
            <div className="text-xs">
              <div className="font-bold text-[hsl(var(--fg-primary))]">{st("landing.dashboardChip1Title", "فروش امروز")}</div>
              <div className="text-[hsl(var(--color-success))] font-semibold">{st("landing.dashboardChip1Value", "۱۲٪ بیشتر از دیروز")}</div>
            </div>
          </div>

          <div
            className={cn(
              "hidden lg:flex absolute -start-6 bottom-24 items-center gap-2 px-3.5 py-2.5 rounded-xl",
              "bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-default))] shadow-[var(--shadow-premium)]",
              "transition-all duration-700 delay-500 motion-reduce:transition-none",
              animated ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4",
            )}
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] shrink-0">
              <Bell className="size-4" aria-hidden="true" />
            </span>
            <div className="text-xs">
              <div className="font-bold text-[hsl(var(--fg-primary))]">{st("landing.dashboardChip2Title", "یادآوری بدهی")}</div>
              <div className="text-[hsl(var(--fg-secondary))]">{st("landing.dashboardChip2Value", "۳ مشتری امروز")}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}