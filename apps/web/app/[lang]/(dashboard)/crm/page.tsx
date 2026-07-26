// apps/web/app/[lang]/(dashboard)/crm/page.tsx
import { CrmContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "ارتباط با مشتریان",
  "fa-AF": "ارتباط با مشتریان",
  "en": "CRM",
};

const keywords: Record<string, string[]> = {
  "fa-IR": ["ارتباط با مشتریان", "تعاملات", "فرصت‌های فروش", "CRM"],
  "fa-AF": ["ارتباط با مشتریان", "تعاملات", "فرصت‌های فروش", "CRM"],
  "en": ["crm", "interactions", "sales opportunities", "pipeline"],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
  };
}

export default function CrmPage() {
  return <CrmContainer />;
}
