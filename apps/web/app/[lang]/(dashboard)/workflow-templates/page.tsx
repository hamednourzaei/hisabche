// apps/web/app/[lang]/(dashboard)/workflow-templates/page.tsx
import { WorkflowTemplatesContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "الگوهای تأیید",
  "fa-AF": "الگوهای تأیید",
  "en": "Approval Templates",
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: titles[lang] || titles["fa-IR"] };
}

export default function WorkflowTemplatesPage() {
  return <WorkflowTemplatesContainer />;
}
