// packages/ui/src/components/navigation/top-nav.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigation } from "../../../hooks/menu/use-navigation-state";

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
  businessName 
}: TopNavProps) {
  const { sections, setSection, activeSection, scrollProgress, narrativeState } = useNavigation();
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const navListRef = useRef<HTMLUListElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });

  const getNarrativeColor = (state: string) => {
    const colors: Record<string, string> = {
      frustration: "#A855F7", confusion: "#EF4444", clarity: "#10B981",
      confidence: "#06B6D4", trust: "#8B5CF6", action: "#EC4899",
    };
    return colors[state] || "#A855F7";
  };

  const accent = getNarrativeColor(narrativeState);

  // Move indicator - measured only on active section change
  useEffect(() => {
    const activeBtn = document.querySelector(`.top-nav-btn[data-id="${activeSection}"]`) as HTMLButtonElement;
    if (!activeBtn || !indicatorRef.current || !navListRef.current) return;
    
    const listRect = navListRef.current.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    
    setIndicatorStyle({
      width: btnRect.width,
      left: btnRect.left - listRect.left,
    });
  }, [activeSection]);

  return (
    <header className="top-nav" style={{ "--nav-accent": accent } as React.CSSProperties}>
      <div className="top-nav-inner">
        {/* Logo */}
        <button className="top-nav-logo" onClick={() => setSection(sections[0]?.id || "")}>
          <span>{appName}</span>
          <span className="logo-dot" style={{ color: accent }}>.</span>
        </button>

        {/* Business info (dashboard only) */}
        {variant === "dashboard" && businessName && (
          <div className="top-nav-business">
            <span className="business-name">{businessName}</span>
          </div>
        )}

        {/* Navigation menu */}
        <nav className="top-nav-menu">
          <ul className="top-nav-list" ref={navListRef}>
            <span 
              ref={indicatorRef}
              className="top-nav-indicator" 
              style={{ 
                background: `${accent}22`,
                width: indicatorStyle.width,
                left: indicatorStyle.left,
              }} 
            />
            {sections.map(({ id, label }) => (
              <li key={id}>
                <button
                  data-id={id}
                  className={`top-nav-btn ${activeSection === id ? "active" : ""}`}
                  onClick={() => setSection(id)}
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
            <>
              <button className="nav-signin" onClick={onNavigateLogin}>ورود</button>
              <button className="nav-cta" onClick={onNavigateCta ?? onNavigateLogin}>شروع رایگان ←</button>
            </>
          )}
          {variant === "dashboard" && (
            <>
              <button className="nav-logout" onClick={onLogout}>خروج</button>
            </>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="top-nav-progress">
        <div className="progress-bar" style={{ width: `${scrollProgress}%`, background: `linear-gradient(90deg, ${accent}88, ${accent})` }} />
      </div>
    </header>
  );
}