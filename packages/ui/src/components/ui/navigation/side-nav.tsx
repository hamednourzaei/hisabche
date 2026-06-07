// packages/ui/src/components/navigation/side-nav.tsx
"use client";

import { useNavigation } from "../../../hooks/menu/use-navigation-state";

export interface SideNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

export interface SideNavProps {
  items: SideNavItem[];
}

export function SideNav({ items }: SideNavProps) {
  const { activeSection, setSection } = useNavigation();

  return (
    <aside className="side-nav">
      <div className="side-nav-header">
        <div className="logo-icon">ح</div>
        <div>
          <p className="logo-title">حسابچه</p>
          <p className="logo-subtitle">مدیریت کسب‌وکار</p>
        </div>
      </div>
      <nav className="side-nav-menu">
        {items.map(({ id, icon, label }) => (
          <button
            key={id}
            className={`side-nav-item ${activeSection === id ? "active" : ""}`}
            onClick={() => setSection(id)}
          >
            {activeSection === id && <span className="active-indicator" />}
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}