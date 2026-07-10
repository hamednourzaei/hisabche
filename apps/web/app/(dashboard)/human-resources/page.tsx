// apps/web/app/(dashboard)/hr/page.tsx
import { Metadata } from "next";
import { HumanResourcesContainer } from "@hisabche/ui";

export const metadata: Metadata = {
  title: "منابع انسانی",
};

export default function HrPage() {
  return <HumanResourcesContainer />;
}