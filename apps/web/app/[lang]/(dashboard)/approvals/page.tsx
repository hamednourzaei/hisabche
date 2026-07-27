// apps/web/app/[lang]/(dashboard)/approvals/page.tsx
import { ApprovalsContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "در انتظار تأیید شما",
  "fa-AF": "در انتظار تأیید شما",
  "en": "Awaiting Your Approval",
};

const keywords: Record<string, string[]> = {
  "fa-IR": ["تأیید", "درخواست", "فرآیند تأیید", "workflow"],
  "fa-AF": ["تأیید", "درخواست", "فرآیند تأیید", "workflow"],
  "en": ["approvals", "workflow", "requests", "pending"],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
  };
}

export default function ApprovalsPage() {
  return <ApprovalsContainer />;
}
