"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useScrollNarrative, setActiveSection, type NarrativeState, type SectionId } from "../../components/ui/landing/use-scroll-narrative-store";
import type { NavigationSection } from "../../lib/menu/navigation-core";
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
  const { progress, activeSection, narrativeState } = useScrollNarrative();
  
  const scrollProgress = Math.round(progress * 100);

  const registerSection = useCallback(() => {}, []);

  const setSection = useCallback((id: string) => {
    const element = getSectionRef(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      // 🔥 کلیک روی نوبار: مستقیم activeSection رو ست کن
      setActiveSection(id as SectionId);
    }
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