// apps/web/app/(dashboard)/workspace/page.tsx
import { Metadata } from "next";
import { WorkspaceContainer } from "@hisabche/ui";

export const metadata: Metadata = {
  title: "فضای کاری",
};

export default function WorkspacePage() {
  return <WorkspaceContainer />;
}