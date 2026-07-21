// packages/ui/src/components/ui/landing/trust-bar-scene.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Marquee } from "../marquee";

/* ═══════════════════════════════════════════════════════════════════════════
   TrustBarScene v6 — Infinite marquee · 50 business categories
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TrustBarSceneProps {
  t: (key: string, fallback?: string) => string;
}

const INDUSTRIES = [
  { key: "retail", fallback: "Retail Store" },
  { key: "wholesale", fallback: "Wholesale" },
  { key: "supermarket", fallback: "Supermarket" },
  { key: "grocery", fallback: "Grocery Store" },
  { key: "pharmacy", fallback: "Pharmacy" },
  { key: "clinic", fallback: "Clinic" },
  { key: "restaurant", fallback: "Restaurant" },
  { key: "cafe", fallback: "Cafe" },
  { key: "bakery", fallback: "Bakery" },
  { key: "fastfood", fallback: "Fast Food" },
  { key: "boutique", fallback: "Boutique" },
  { key: "fashion", fallback: "Fashion Store" },
  { key: "cosmetics", fallback: "Cosmetics Store" },
  { key: "jewelry", fallback: "Jewelry Store" },
  { key: "electronics", fallback: "Electronics Store" },
  { key: "mobile", fallback: "Mobile Shop" },
  { key: "computer", fallback: "Computer Store" },
  { key: "hardware", fallback: "Hardware Store" },
  { key: "construction", fallback: "Building Materials" },
  { key: "furniture", fallback: "Furniture Store" },
  { key: "home", fallback: "Home Appliances" },
  { key: "stationery", fallback: "Stationery" },
  { key: "bookstore", fallback: "Bookstore" },
  { key: "autoParts", fallback: "Auto Parts" },
  { key: "workshop", fallback: "Repair Workshop" },
  { key: "service", fallback: "Service Business" },
  { key: "beauty", fallback: "Beauty Salon" },
  { key: "barbershop", fallback: "Barbershop" },
  { key: "laundry", fallback: "Laundry" },
  { key: "printing", fallback: "Printing Shop" },
  { key: "travel", fallback: "Travel Agency" },
  { key: "hotel", fallback: "Hotel & Guesthouse" },
  { key: "logistics", fallback: "Logistics" },
  { key: "distribution", fallback: "Distribution" },
  { key: "warehouse", fallback: "Warehouse" },
  { key: "manufacturing", fallback: "Manufacturing" },
  { key: "factory", fallback: "Factory" },
  { key: "agriculture", fallback: "Agriculture" },
  { key: "livestock", fallback: "Livestock" },
  { key: "feed", fallback: "Animal Feed" },
  { key: "fuel", fallback: "Fuel Station" },
  { key: "medical", fallback: "Medical Supply" },
  { key: "optical", fallback: "Optical Store" },
  { key: "sports", fallback: "Sports Store" },
  { key: "toys", fallback: "Toy Store" },
  { key: "gift", fallback: "Gift Shop" },
  { key: "florist", fallback: "Florist" },
  { key: "pet", fallback: "Pet Shop" },
  { key: "ecommerce", fallback: "Online Store" },
];

function IndustryChip({
  label,
}: {
  label: string;
}) {
  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium text-[hsl(var(--fg-secondary))] bg-[hsl(var(--surface-muted))] border border-[hsl(var(--border-default))] whitespace-nowrap hover:border-[hsl(var(--color-primary)/0.3)] hover:text-[hsl(var(--fg-primary))] transition-colors duration-200">
      {label}
    </span>
  );
}

export default function TrustBarScene({ t }: TrustBarSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);

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
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const firstHalf = INDUSTRIES.slice(0, Math.ceil(INDUSTRIES.length / 2));
  const secondHalf = INDUSTRIES.slice(Math.ceil(INDUSTRIES.length / 2));

  return (
    <section
      id="trust-bar"
      ref={ref}
      className={cn(
        "relative py-8 sm:py-10 border-b border-[hsl(var(--border-default))] overflow-hidden",
        "transition-opacity duration-700",
        animated ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="container-narrow mb-6 sm:mb-8">
        <p className="text-center text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--fg-tertiary))]">
          {t("landing.trustBarLabel", "Trusted by every type of business")}
        </p>
      </div>

      {/* Row 1 — forward */}
      <Marquee pauseOnHover repeat={4} className="[--duration:100s] py-1">
        {firstHalf.map(({ key, fallback }) => (
          <IndustryChip
            key={key}
            label={t(`landing.industry.${key}`, fallback)}
          />
        ))}
      </Marquee>

      {/* Row 2 — reverse, slightly faster */}
      <Marquee pauseOnHover repeat={4} reverse className="[--duration:90s] py-1">
        {secondHalf.map(({ key, fallback }) => (
          <IndustryChip
            key={key}
            label={t(`landing.industry.${key}`, fallback)}
          />
        ))}
      </Marquee>

      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-[hsl(var(--surface-base))] to-transparent z-10" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-[hsl(var(--surface-base))] to-transparent z-10" aria-hidden="true" />
    </section>
  );
}