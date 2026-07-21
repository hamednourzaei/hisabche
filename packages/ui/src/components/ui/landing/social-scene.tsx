// packages/ui/src/components/ui/landing/social-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { Marquee } from "../marquee";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   SocialScene v9 — Marquee testimonials (Magic UI pattern, re-themed + RTL-safe)
   ✅ Two horizontal rows scrolling opposite directions, all breakpoints —
      dropped the 3D perspective variant, which was heavy enough (4 layered
      3D-transformed, blurred, simultaneously-animating columns) to jank on
      mid-range phones. translateX-only rows are far cheaper to composite.
   ✅ pauses on hover/focus · respects prefers-reduced-motion (marquee freezes,
      degrading to a static readable list rather than fighting the setting)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SocialSceneProps {
  t: (key: string, fallback?: string) => string;
}

interface Review {
  key: string;
  name: string;
  role: string;
  quote: string;
}

const REVIEWS: Review[] = [
  { key: "r1", name: "احمد رضایی", role: "صاحب سوپرمارکت، کابل", quote: "دیگه هیچ فاکتوری گم نمی‌شه. همه چیز رو گوشیم می‌بینم." },
  { key: "r2", name: "مریم احمدی", role: "صاحب بوتیک، هرات", quote: "وقتی برق و اینترنت قطع می‌شه هم کار می‌کنه. همین برام کافیه." },
  { key: "r3", name: "نجیب‌الله کریمی", role: "دواخانه، مزارشریف", quote: "یادآوری بدهی مشتری‌ها کار رو خیلی راحت کرده." },
  { key: "r4", name: "فاطمه نوری", role: "رستوران، کابل", quote: "از دفترچه و اکسل خسته شده بودم. حالا همه چیز مرتبه." },
  { key: "r5", name: "عبدالوهاب صافی", role: "عمده‌فروش مواد غذایی، ننگرهار", quote: "گزارش موجودی گدام رو در چند ثانیه می‌بینم، نه چند ساعت." },
  { key: "r6", name: "زهرا محمدی", role: "صاحب آرایشگاه، کابل", quote: "نصبش دو دقیقه طول کشید. آموزش خاصی لازم نداشت." },
  { key: "r7", name: "حکمت‌الله ولی‌زاده", role: "فروشگاه لوازم خانگی، بلخ", quote: "سود واقعی هر ماه رو بالاخره دقیق می‌دونم." },
  { key: "r8", name: "سمیه یوسفی", role: "صاحب کتاب‌فروشی، هرات", quote: "پشتیبانیش سریع جواب می‌ده، حتی شب‌ها." },
];

function initialOf(name: string) {
  return name.charAt(0);
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <figure
      className={cn(
        "w-56 sm:w-60 lg:w-72 shrink-0 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5",
        "border border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated)/0.75)] backdrop-blur-sm",
        "shadow-[var(--shadow-premium)]",
        "transition-colors duration-300",
        "hover:border-[hsl(var(--color-primary)/0.3)]",
      )}
    >
      <div className="flex gap-0.5 mb-2 sm:mb-2.5">
        {Array.from({ length: 5 }).map((_, s) => (
          <Star key={s} className="size-2.5 sm:size-3 fill-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))]" aria-hidden="true" />
        ))}
      </div>

      <blockquote className="text-[11px] sm:text-xs lg:text-sm text-[hsl(var(--fg-primary))] leading-relaxed mb-2.5 sm:mb-3 lg:mb-4 line-clamp-3 sm:line-clamp-none">
        «{review.quote}»
      </blockquote>

      <figcaption className="flex items-center gap-2 sm:gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-bold text-[10px] sm:text-xs border border-[hsl(var(--color-primary)/0.2)] shrink-0">
          {initialOf(review.name)}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[10px] sm:text-xs lg:text-sm text-[hsl(var(--fg-primary))] truncate">{review.name}</div>
          <div className="text-[9px] sm:text-[10px] lg:text-xs text-[hsl(var(--fg-tertiary))] truncate">{review.role}</div>
        </div>
      </figcaption>
    </figure>
  );
}

export default function SocialScene({ t }: SocialSceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: "trust",
  });
  const animated = state === "animated";

  const reviews = REVIEWS.map((r) => ({
    ...r,
    name: t(`landing.social.${r.key}.name`, r.name),
    role: t(`landing.social.${r.key}.role`, r.role),
    quote: t(`landing.social.${r.key}.quote`, r.quote),
  }));

  const rowA = reviews.slice(0, 4);
  const rowB = reviews.slice(4, 8);

  return (
    <section
      id="testimonials"
      ref={ref}
      data-narrative="trust"
      className="py-12 sm:py-16 lg:py-20 border-y border-[hsl(var(--border-default))] overflow-hidden"
    >
      <div className="container-narrow px-4 sm:px-6">
        {/* ── Header ── */}
        <div
          className={cn(
            "text-center mb-8 sm:mb-10 lg:mb-14 min-h-[100px] sm:min-h-[120px] lg:min-h-[140px]",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <div
            className={cn(
              "inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs lg:text-sm mb-3 sm:mb-4 lg:mb-6",
              "rounded-full",
              "border border-[hsl(var(--border-default))]",
              "bg-[hsl(var(--surface-muted))]",
              "text-[hsl(var(--fg-secondary))]",
            )}
          >
            <span className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-2.5 sm:size-3 lg:size-3.5 fill-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))]" aria-hidden="true" />
              ))}
            </span>
            {t("landing.rating", "۴.۹ · ۳۴۰+ کسب‌وکار فعال")}
          </div>

          <h2 className="text-lg sm:text-2xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight px-4 sm:px-0">
            {t("landing.testimonialsTitle", "اعتماد واقعی")}
          </h2>
          <p className="mt-2 sm:mt-3 lg:mt-4 text-sm sm:text-base lg:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed px-4 sm:px-0">
            {t("landing.testimonialsDesc", "همونایی که مثل تو بودن")}
          </p>
        </div>

        {/* ── Two-row horizontal marquee (all breakpoints) ── */}
        <div
          className={cn(
            "relative space-y-2 sm:space-y-3 lg:space-y-4",
            "transition-opacity duration-700 motion-reduce:transition-none",
            animated ? "opacity-100" : "opacity-0",
          )}
        >
          <Marquee pauseOnHover repeat={2} className="[--duration:32s]">
            {rowA.map((r) => (
              <ReviewCard key={r.key} review={r} />
            ))}
          </Marquee>
          <Marquee reverse pauseOnHover repeat={2} className="[--duration:32s]">
            {rowB.map((r) => (
              <ReviewCard key={r.key} review={r} />
            ))}
          </Marquee>

          {/* edge fades */}
          <div className="pointer-events-none absolute inset-y-0 start-0 w-8 sm:w-12 lg:w-24 bg-gradient-to-r rtl:bg-gradient-to-l from-[hsl(var(--surface-base))] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 end-0 w-8 sm:w-12 lg:w-24 bg-gradient-to-l rtl:bg-gradient-to-r from-[hsl(var(--surface-base))] to-transparent" />
        </div>
      </div>
    </section>
  );
}