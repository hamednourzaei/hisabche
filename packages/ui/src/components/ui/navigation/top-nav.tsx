"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigation } from "../../../hooks/menu/use-navigation-state";
import { cn } from "@/lib/utils";

export interface TopNavProps {
  variant?: "landing" | "dashboard";
  onNavigateLogin?: () => void;
  onNavigateCta?: () => void;
  onLogout?: () => void;
  appName?: string;
  businessName?: string;
}

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

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.setAttribute("data-narrative-state", narrativeState);
    }
  }, [narrativeState]);

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
    (id: string) => setSection(id),
    [setSection],
  );

  return (
<header
  className={cn(
    // Base (Desktop)
    "sticky top-0 z-[var(--z-sticky)] w-full",
    "bg-[hsl(var(--surface-base)/0.6)] backdrop-blur-md",
    "border-b border-transparent",
    "transition-all duration-300",
    // Mobile — padding from top & bottom
    "max-lg:py-3",
    // Desktop pill
    "lg:top-4 lg:w-[90%] lg:mx-auto lg:rounded-full",
    "lg:bg-[hsl(var(--surface-base)/0.7)] lg:backdrop-blur-xl",
    "lg:border-[hsl(var(--border-default))]",
    // Mobile override
    "max-lg:bg-[hsl(var(--surface-base))] max-lg:backdrop-blur-none",
    "max-lg:border-b max-lg:border-[hsl(var(--border-default))]",
  )}
  dir="rtl"
>
      <div
        className={cn(
          "mx-auto flex items-center justify-between",
          "h-14 px-4",
          "lg:h-[52px] lg:px-0 lg:w-[90%]",
          "max-lg:h-14",
        )}
      >
        {/* Logo */}
        {/* Logo — hidden below lg (iPad) */}
<button
  type="button"
  className="hidden lg:flex items-center gap-1 text-[hsl(var(--fg-primary))] font-bold text-lg shrink-0"
  onClick={() => handleSetSection(sections[0]?.id || "")}
>
  <span>{appName}</span>
  <span className="text-[hsl(var(--color-primary))]">.</span>
</button>

        {/* Navigation menu */}
        <nav className="flex-1 flex justify-center px-2">
          <ul
            ref={navListRef}
            className="relative flex items-center gap-1 list-none m-0 px-1 py-1 rounded-full bg-[hsl(var(--fg-primary)/0.04)] border border-[hsl(var(--fg-primary)/0.07)]"
          >
            <span
              ref={indicatorRef}
              className="absolute top-1 h-[calc(100%-8px)] rounded-full bg-[hsl(var(--color-primary)/0.15)] transition-all duration-300 z-0"
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
                  className={cn(
                    "relative z-10 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                    activeSection === id
                      ? "text-[hsl(var(--fg-primary))] font-semibold"
                      : "text-[hsl(var(--fg-primary)/0.55)] hover:text-[hsl(var(--fg-primary)/0.85)]",
                  )}
                  onClick={() => handleSetSection(id)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* CTA button — Desktop only */}
        {variant === "landing" && (
          <button
            type="button"
            className="hidden lg:inline-flex items-center gap-1 rounded-full px-5 py-2 text-sm font-bold text-white bg-[var(--gradient-brand)] hover:brightness-110 transition-all shrink-0"
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
            className="hidden lg:inline-flex rounded-full px-4 py-1.5 text-xs font-medium text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
          >
            خروج
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[hsl(var(--fg-primary)/0.06)] overflow-hidden">
        <div
          className="h-full bg-[var(--gradient-brand)] transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
    </header>
  );
}