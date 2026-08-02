// packages/ui/src/components/ui/marquee.tsx
"use client";

import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Marquee — adapted from Magic UI (https://magicui.design/docs/components/marquee)
   to this project's token system and RTL layout.

   ⚠️ REQUIRES a tailwind.config.js addition — this component depends on the
   `animate-marquee` / `animate-marquee-vertical` utilities, which aren't
   built into Tailwind. Add this to theme.extend in tailwind.config.js:

   keyframes: {
     marquee: {
       from: { transform: "translateX(0)" },
       to: { transform: "translateX(calc(-100% - var(--gap)))" },
     },
     "marquee-vertical": {
       from: { transform: "translateY(0)" },
       to: { transform: "translateY(calc(-100% - var(--gap)))" },
     },
   },
   animation: {
     marquee: "marquee var(--duration) linear infinite",
     "marquee-vertical": "marquee-vertical var(--duration) linear infinite",
   },

   Speed is controlled via the `--duration` CSS var (default 40s below),
   override per-instance with e.g. className="[--duration:20s]".
   ═══════════════════════════════════════════════════════════════════════════ */

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  /** Reverse scroll direction. Note: in RTL layouts the "natural" forward
   *  direction is already flipped, so try without `reverse` first. */
  reverse?: boolean;
  pauseOnHover?: boolean;
  children?: React.ReactNode;
  vertical?: boolean;
  /** How many times to repeat the children — needs to be enough copies to
   *  fill the track with no visible gap; increase for short content. */
  repeat?: number;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      className={cn(
        "group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem] [gap:var(--gap)]",
        vertical ? "flex-col" : "flex-row",
        className,
      )}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          aria-hidden={i > 0}
          className={cn(
            "flex shrink-0 justify-around [gap:var(--gap)]",
            vertical ? "animate-marquee-vertical flex-col" : "animate-marquee flex-row",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
            // ✅ FIX (RTL): کی‌فریم مارکی جهت‌ثابت است (translateX منفی). در
            // چیدمان RTL محتوای ردیفِ بدون reverse از دید خارج می‌شد و ردیف
            // خالی به‌نظر می‌رسید — دقیقاً چیزی که در فارسی/دری دیده می‌شد و
            // در انگلیسی نه. در RTL جهت هر دو ردیف برعکس می‌شود تا رفتار با
            // LTR یکسان بماند.
            !vertical &&
              (reverse
                ? "[animation-direction:reverse] rtl:[animation-direction:normal]"
                : "rtl:[animation-direction:reverse]"),
            vertical && reverse && "[animation-direction:reverse]",
            "motion-reduce:animate-none",
          )}
        >
          {children}
        </div>
      ))}
    </div>
  );
}