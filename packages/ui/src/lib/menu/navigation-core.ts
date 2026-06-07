// packages/ui/src/lib/menu/navigation-core.ts

export type NarrativeState =
  | "frustration" 
  | "confusion" 
  | "clarity"
  | "confidence" 
  | "trust" 
  | "action";

export interface NavigationSection {
  id: string;
  label: string;
  narrative: NarrativeState;
}

// Registry for DOM refs
const sectionRefs = new Map<string, HTMLElement>();

export function registerSectionRef(id: string, element: HTMLElement | null): void {
  if (element) {
    sectionRefs.set(id, element);
  } else {
    sectionRefs.delete(id);
  }
}

export function getSectionRef(id: string): HTMLElement | undefined {
  return sectionRefs.get(id);
}

export function getAllSectionRefs(): Map<string, HTMLElement> {
  return new Map(sectionRefs);
}