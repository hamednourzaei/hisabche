"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NarrativeState =
  | "frustration" | "confusion" | "clarity"
  | "confidence"  | "trust"    | "action";

export interface NavbarProps {
  onNavigateLogin?: () => void;
  onNavigateCta?:   () => void;
}

// ─── Narrative color map ──────────────────────────────────────────────────────

const NARRATIVE_COLORS: Record<NarrativeState, {
  accent: string;
  border: string;
  glow:   string;
}> = {
  frustration: { accent: "#A855F7", border: "rgba(168,85,247,0.35)",  glow: "rgba(168,85,247,0.06)"  },
  confusion:   { accent: "#EF4444", border: "rgba(239,68,68,0.35)",   glow: "rgba(239,68,68,0.06)"   },
  clarity:     { accent: "#10B981", border: "rgba(16,185,129,0.35)",  glow: "rgba(16,185,129,0.06)"  },
  confidence:  { accent: "#06B6D4", border: "rgba(6,182,212,0.35)",   glow: "rgba(6,182,212,0.06)"   },
  trust:       { accent: "#8B5CF6", border: "rgba(139,92,246,0.35)",  glow: "rgba(139,92,246,0.06)"  },
  action:      { accent: "#EC4899", border: "rgba(236,72,153,0.35)",  glow: "rgba(236,72,153,0.06)"  },
};

// ─── Nav sections ─────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: "hero",         label: "خانه"    },
  { id: "pain",         label: "مشکل"    },
  { id: "transform",    label: "راه‌حل"  },
  { id: "features",     label: "امکانات" },
  { id: "testimonials", label: "اعتماد"  },
  { id: "cta",          label: "شروع"    },
] as const;

type SectionId = typeof NAV_SECTIONS[number]["id"];

// ─── Section → narrative map ─────────────────────────────────────────────────

const SECTION_NARRATIVE: Record<SectionId, NarrativeState> = {
  hero:         "frustration",
  pain:         "confusion",
  transform:    "clarity",
  features:     "confidence",
  testimonials: "trust",
  cta:          "action",
};

// ─── Smooth scroll helper ─────────────────────────────────────────────────────

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export function Navbar({ onNavigateLogin, onNavigateCta }: NavbarProps) {
  const [activeSection, setActiveSection]     = useState<SectionId>("hero");
  const [narrativeState, setNarrativeState]   = useState<NarrativeState>("frustration");
  const [scrolled, setScrolled]               = useState(false);
  const [scrollPct, setScrollPct]             = useState(0);
  const indicatorRef                          = useRef<HTMLSpanElement>(null);
  const navListRef                            = useRef<HTMLUListElement>(null);
  const activeButtonRef                       = useRef<HTMLButtonElement | null>(null);

  // ── Track active section via IntersectionObserver ────────────────────────
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setActiveSection(id);
            setNarrativeState(SECTION_NARRATIVE[id]);
          }
        },
        { threshold: 0.35, rootMargin: "-10% 0px -55% 0px" }
      );

      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, []);

  // ── Scrolled state (for backdrop blur intensity) ──────────────────────────
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const max = document.body.scrollHeight - window.innerHeight;
      setScrollPct(max > 0 ? Math.round((window.scrollY / max) * 100) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Slide the active indicator pill ──────────────────────────────────────
  const moveIndicator = useCallback((btn: HTMLButtonElement | null) => {
    if (!btn || !indicatorRef.current || !navListRef.current) return;
    const listRect = navListRef.current.getBoundingClientRect();
    const btnRect  = btn.getBoundingClientRect();
    indicatorRef.current.style.width  = `${btnRect.width}px`;
    indicatorRef.current.style.left   = `${btnRect.left - listRect.left}px`;
  }, []);

  useEffect(() => {
    moveIndicator(activeButtonRef.current);
  }, [activeSection, moveIndicator]);

  // re-measure on resize
  useEffect(() => {
    const ro = new ResizeObserver(() => moveIndicator(activeButtonRef.current));
    if (navListRef.current) ro.observe(navListRef.current);
    return () => ro.disconnect();
  }, [moveIndicator]);

  const colors = NARRATIVE_COLORS[narrativeState];

  return (
    <header
      className="hn-header"
      style={{
        "--hn-accent": colors.accent,
        background: scrolled
          ? "rgba(14, 12, 22, 0.88)"
          : "rgba(14, 12, 22, 0.6)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: window.innerWidth >= 1024 ? "none" : `1px solid ${colors.border}`,
      } as React.CSSProperties}
    >
      <div className="hn-inner">
        {/* Logo - در موبایل فقط نقطه */}
        <button
          className="hn-logo"
          onClick={() => scrollToSection("hero")}
          aria-label="رفتن به ابتدای صفحه"
        >
          <span className="logo-text">حسابچه</span>
          <span className="hn-logo-dot" style={{ color: colors.accent }}>.</span>
        </button>

        {/* Nav items - در همه دستگاه‌ها نمایش داده می‌شود */}
        <nav className="hn-nav" aria-label="ناوبری اصلی">
          <ul className="hn-list" ref={navListRef}>
            <span
              ref={indicatorRef}
              className="hn-indicator"
              style={{
                background: `${colors.accent}22`,
                boxShadow: `0 0 0 1px ${colors.accent}44`,
              }}
              aria-hidden
            />
            {NAV_SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <button
                  className={`hn-btn ${activeSection === id ? "active" : ""}`}
                  ref={activeSection === id ? (el) => { activeButtonRef.current = el; } : undefined}
                  onClick={() => scrollToSection(id)}
                  aria-current={activeSection === id ? "page" : undefined}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Actions */}
        <div className="hn-actions">
          {/* دکمه ورود - فقط در دسکتاپ */}
          <button className="hn-signin desktop-only" onClick={onNavigateLogin}>
            ورود
          </button>
          {/* دکمه CTA - در دسکتاپ و تبلت */}
          <button
            className="hn-cta tablet-up"
            onClick={onNavigateCta ?? onNavigateLogin}
            style={{
              background: `linear-gradient(135deg, ${colors.accent}, ${colors.accent}bb)`,
              boxShadow: `0 2px 14px ${colors.accent}44`,
            }}
          >
            شروع رایگان ←
          </button>
        </div>
      </div>

      {/* Bottom progress line */}
      <div className="hn-border-line">
        <div
          className="hn-border-progress"
          style={{
            width: `${scrollPct}%`,
            background: `linear-gradient(90deg, ${colors.accent}88, ${colors.accent})`,
          }}
        />
      </div>
    </header>
  );
}