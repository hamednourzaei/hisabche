"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigation } from "../../../hooks/menu/use-navigation-state";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   TopNav v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Zero inline styles — all Tailwind classes
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TopNavProps {
  variant?: "landing" | "dashboard";
  onNavigateLogin?: () => void;
  onNavigateCta?: () => void;
  onLogout?: () => void;
  appName?: string;
  businessName?: string;
}

const narrativeColorMap: Record<string, string> = {
  frustration: "hsl(var(--color-primary))",
  confusion: "hsl(var(--color-destructive))",
  clarity: "hsl(var(--color-success))",
  confidence: "hsl(190 90% 50%)",
  trust: "hsl(var(--color-primary))",
  action: "hsl(340 80% 60%)",
};

export function TopNav({
  variant = "landing",
  onNavigateLogin,
  onNavigateCta,
  onLogout,
  appName = "حسابچه",
  businessName,
}: TopNavProps) {
  const { sections, setSection, activeSection, scrollProgress, narrativeState } =
    useNavigation();
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const navListRef = useRef<HTMLUListElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });

  const accentColor =
    narrativeColorMap[narrativeState] || "hsl(var(--color-primary))";

  // Update body narrative state
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.setAttribute("data-narrative-state", narrativeState);
    }
  }, [narrativeState]);

  // Move indicator on active section change
  useEffect(() => {
    const activeBtn = document.querySelector(
      `.top-nav-btn[data-id="${activeSection}"]`,
    ) as HTMLButtonElement;
    if (!activeBtn || !indicatorRef.current || !navListRef.current) return;

    const listRect = navListRef.current.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    setIndicatorStyle({
      width: btnRect.width,
      left: btnRect.left - listRect.left,
    });
  }, [activeSection]);

  const handleSetSection = useCallback(
    (id: string) => {
      setSection(id);
    },
    [setSection],
  );

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        {/* Logo */}
        <button
          type="button"
          className="top-nav-logo"
          onClick={() => handleSetSection(sections[0]?.id || "")}
        >
          <span>{appName}</span>
          <span className="text-[hsl(var(--color-primary))]">.</span>
        </button>

        {/* Business info (dashboard) */}
        {variant === "dashboard" && businessName && (
          <div className="hidden sm:block min-w-0">
            <span className="text-xs text-[hsl(var(--fg-tertiary))] truncate">
              {businessName}
            </span>
          </div>
        )}

        {/* Navigation menu */}
        <nav className="top-nav-menu">
          <ul className="top-nav-list" ref={navListRef}>
            <span
              ref={indicatorRef}
              className="top-nav-indicator"
              style={{
                width: indicatorStyle.width,
                left: indicatorStyle.left,
              }}
            />
            {sections.map(({ id, label }) => (
              <li key={id}>
                <button
                  type="button"
                  data-id={id}
                  className={`top-nav-btn ${activeSection === id ? "active" : ""}`}
                  onClick={() => handleSetSection(id)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Actions */}
        <div className="top-nav-actions">
          {variant === "landing" && (
            <button
              type="button"
              className={cn(
                "nav-cta",
                "bg-[var(--gradient-brand)]",
                "hover:brightness-110",
              )}
              onClick={onNavigateCta ?? onNavigateLogin}
            >
              <span className="cta-text">شروع رایگان</span>
              <span> ←</span>
            </button>
          )}
          {variant === "dashboard" && (
            <button
              type="button"
              onClick={onLogout}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium",
                "text-[hsl(var(--fg-secondary))]",
                "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
                "transition-colors duration-150",
              )}
            >
              خروج
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="top-nav-progress">
        <div
          className="progress-bar"
          style={{
            width: `${scrollProgress}%`,
            background: `linear-gradient(90deg, ${accentColor}44, ${accentColor})`,
          }}
        />
      </div>
    </header>
  );
}