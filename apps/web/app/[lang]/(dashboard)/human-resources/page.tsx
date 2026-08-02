// apps/web/app/[lang]/(dashboard)/human-resources/page.tsx
import { HumanResourcesContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa": "منابع انسانی",
  "af": "منابع بشری",
  "en": "Human Resources",
};

const descriptions: Record<string, string> = {
  "fa": "مدیریت کارمندان، حقوق و دستمزد، حضور و غیاب و مرخصی‌ها در حسابچه. سیستم کامل منابع انسانی.",
  "af": "مدیریت کارمندان، حقوق و دستمزد، حضور و غیاب و مرخصی‌ها در حسابچه. سیستم کامل منابع بشری.",
  "en": "Manage employees, payroll, attendance and leaves in Hisabche. Complete human resources system.",
};

const keywords: Record<string, string[]> = {
  "fa": [
    "منابع انسانی",
    "مدیریت کارمندان",
    "حقوق و دستمزد",
    "حضور و غیاب",
    "مرخصی",
    "کارمند",
    "استخدام",
    "حقوق ماهانه",
    "حسابچه",
    "مدیریت پرسنل",
  ],
  "af": [
    "منابع بشری",
    "مدیریت کارمندان",
    "حقوق و دستمزد",
    "حضور و غیاب",
    "مرخصی",
    "کارمند",
    "استخدام",
    "حقوق ماهانه",
    "حسابچه",
    "مدیریت پرسنل",
  ],
  "en": [
    "human resources",
    "employee management",
    "payroll",
    "attendance",
    "leaves",
    "employee",
    "hiring",
    "monthly salary",
    "hisabche",
    "personnel management",
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
    keywords: keywords[lang] || keywords["fa"],
  };
}

export default function HrPage() {
  return <HumanResourcesContainer />;
}