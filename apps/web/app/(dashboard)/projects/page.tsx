// apps/web/app/(dashboard)/projects/page.tsx
import { Metadata } from "next";
import { ProjectsContainer } from "@hisabche/ui";

export const metadata: Metadata = {
  title: "پروژه‌ها",
};

export default function ProjectsPage() {
  return <ProjectsContainer />;
}