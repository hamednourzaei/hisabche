// packages/ui/src/hooks/menu/use-navigation-state.tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { NarrativeState, NavigationSection } from "../../lib/menu/navigation-core";
import { getSectionRef } from "../../lib/menu/navigation-core";

export interface NavigationState {
  activeSection: string;
  scrollProgress: number;
  narrativeState: NarrativeState;
  setSection: (id: string) => void;
  sections: NavigationSection[];
  registerSection: (section: NavigationSection) => void;
}

export const NavigationContext = createContext<NavigationState | undefined>(undefined);

export function NavigationProvider({ children, sections: initialSections }: { 
  children: React.ReactNode;
  sections: NavigationSection[];
}) {
  const [sections] = useState<NavigationSection[]>(initialSections);
  const [activeSection, setActiveSection] = useState<string>(initialSections[0]?.id || "");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [narrativeState, setNarrativeState] = useState<NarrativeState>("confidence");

  const registerSection = useCallback(() => {}, []);

  const setSection = useCallback((id: string) => {
    const element = getSectionRef(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Simple scroll listener to detect active section based on window scroll
  useEffect(() => {
    const updateActiveSection = () => {
      const scrollPosition = window.scrollY + (window.innerHeight / 3);
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (!section) continue;
        
        const element = getSectionRef(section.id);
        
        if (element) {
          const offsetTop = element.offsetTop;
          if (scrollPosition >= offsetTop - 50) {
            if (section.id !== activeSection) {
              console.log("🟢 Switching to:", section.id);
              setActiveSection(section.id);
              setNarrativeState(section.narrative);
              document.body.setAttribute("data-narrative-state", section.narrative);
            }
            break;
          }
        }
      }
    };

    updateActiveSection();
    
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, [sections, activeSection]);

  // Scroll progress
  useEffect(() => {
    const updateProgress = () => {
      const max = document.body.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.round((window.scrollY / max) * 100) : 0;
      setScrollProgress(progress);
    };
    
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => window.removeEventListener("scroll", updateProgress);
  }, []);

  return (
    <NavigationContext.Provider 
      value={{ 
        activeSection, 
        scrollProgress, 
        narrativeState, 
        setSection, 
        sections, 
        registerSection 
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}