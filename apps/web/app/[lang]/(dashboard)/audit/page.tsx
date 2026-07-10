// apps/web/app/[lang]/(dashboard)/audit/page.tsx
import { AuditContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "حسابرسی",
  "fa-AF": "حسابرسی",
  "en": "Audit",
};

const keywords: Record<string, string[]> = {
  "fa-IR": ["حسابرسی", "گزارش", "تغییرات", "لاگ"],
  "fa-AF": ["حسابرسی", "گزارش", "تغییرات", "لاگ"],
  "en": ["audit", "logs", "changes", "tracking"],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
  };
}

export default function AuditPage() {
  return <AuditContainer />;
}