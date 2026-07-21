// packages/ui/src/components/ui/landing/social-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { Marquee } from "../marquee";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   SocialScene v8 — Marquee testimonials (Magic UI pattern, re-themed + RTL-safe)
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
        "w-64 sm:w-72 shrink-0 rounded-2xl p-4 sm:p-5",
        "border border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated)/0.75)] backdrop-blur-sm",
        "shadow-[var(--shadow-premium)]",
        "transition-colors duration-300",
        "hover:border-[hsl(var(--color-primary)/0.3)]",
      )}
    >
      <div className="flex gap-0.5 mb-2.5">
        {Array.from({ length: 5 }).map((_, s) => (
          <Star key={s} className="size-3 fill-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))]" aria-hidden="true" />
        ))}
      </div>

      <blockquote className="text-xs sm:text-sm text-[hsl(var(--fg-primary))] leading-relaxed mb-3 sm:mb-4">
        «{review.quote}»
      </blockquote>

      <figcaption className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-bold text-xs border border-[hsl(var(--color-primary)/0.2)] shrink-0">
          {initialOf(review.name)}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-xs sm:text-sm text-[hsl(var(--fg-primary))] truncate">{review.name}</div>
          <div className="text-[10px] sm:text-xs text-[hsl(var(--fg-tertiary))] truncate">{review.role}</div>
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

  // Translated reviews, falling back to the Persian defaults above so the
  // section still works before i18n keys are populated.
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
      className="section-padding border-y border-[hsl(var(--border-default))] overflow-hidden"
    >
      <div className="container-narrow">
        {/* ── Header ── */}
        <div
          className={cn(
            "text-center mb-10 sm:mb-14 min-h-[120px] sm:min-h-[140px]",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm mb-4 sm:mb-6",
              "rounded-full",
              "border border-[hsl(var(--border-default))]",
              "bg-[hsl(var(--surface-muted))]",
              "text-[hsl(var(--fg-secondary))]",
            )}
          >
            <span className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3 sm:size-3.5 fill-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))]" aria-hidden="true" />
              ))}
            </span>
            {t("landing.rating", "۴.۹ · ۳۴۰+ کسب‌وکار فعال")}
          </div>

          <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight">
            {t("landing.testimonialsTitle", "اعتماد واقعی")}
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed">
            {t("landing.testimonialsDesc", "همونایی که مثل تو بودن")}
          </p>
        </div>

        {/* ── Two-row horizontal marquee (all breakpoints) ── */}
        <div
          className={cn(
            "relative space-y-3 sm:space-y-4",
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
          <div className="pointer-events-none absolute inset-y-0 start-0 w-10 sm:w-24 bg-gradient-to-r rtl:bg-gradient-to-l from-[hsl(var(--surface-base))] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 end-0 w-10 sm:w-24 bg-gradient-to-l rtl:bg-gradient-to-r from-[hsl(var(--surface-base))] to-transparent" />
        </div>
      </div>
    </section>
  );
}