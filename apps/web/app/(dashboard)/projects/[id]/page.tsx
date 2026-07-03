// apps/web/app/(dashboard)/projects/[id]/page.tsx
import { Metadata } from "next";
import { ProjectDetailContainer } from "@hisabche/ui";

export const metadata: Metadata = {
  title: "جزئیات پروژه",
};

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  return <ProjectDetailContainer id={params.id} />;
}