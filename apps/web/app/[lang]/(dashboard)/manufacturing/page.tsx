// apps/web/app/[lang]/(dashboard)/manufacturing/page.tsx
import { ManufacturingContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa": "تولید",
  "af": "تولید",
  "en": "Manufacturing",
};

const keywords: Record<string, string[]> = {
  "fa": ["تولید", "فرمول ساخت", "دستور تولید", "BOM"],
  "af": ["تولید", "فرمول ساخت", "دستور تولید", "BOM"],
  "en": ["manufacturing", "bom", "bill of materials", "work orders"],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa"],
    keywords: keywords[lang] || keywords["fa"],
  };
}

export default function ManufacturingPage() {
  return <ManufacturingContainer />;
}
