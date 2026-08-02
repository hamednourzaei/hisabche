// apps/web/app/[lang]/(dashboard)/approvals/page.tsx
import { ApprovalsContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa": "در انتظار تأیید شما",
  "af": "در انتظار تأیید شما",
  "en": "Awaiting Your Approval",
};

const keywords: Record<string, string[]> = {
  "fa": ["تأیید", "درخواست", "فرآیند تأیید", "workflow"],
  "af": ["تأیید", "درخواست", "فرآیند تأیید", "workflow"],
  "en": ["approvals", "workflow", "requests", "pending"],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa"],
    keywords: keywords[lang] || keywords["fa"],
  };
}

export default function ApprovalsPage() {
  return <ApprovalsContainer />;
}
