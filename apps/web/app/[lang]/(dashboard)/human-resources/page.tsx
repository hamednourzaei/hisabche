// apps/web/app/[lang]/(dashboard)/human-resources/page.tsx
import { HumanResourcesContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "منابع انسانی",
  "fa-AF": "منابع بشری",
  "en": "Human Resources",
};

const descriptions: Record<string, string> = {
  "fa-IR": "مدیریت کارمندان، حقوق و دستمزد، حضور و غیاب و مرخصی‌ها در حسابچه. سیستم کامل منابع انسانی.",
  "fa-AF": "مدیریت کارمندان، حقوق و دستمزد، حضور و غیاب و مرخصی‌ها در حسابچه. سیستم کامل منابع بشری.",
  "en": "Manage employees, payroll, attendance and leaves in Hisabche. Complete human resources system.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
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
  "fa-AF": [
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
    title: titles[lang] || titles["fa-IR"],
    description: descriptions[lang] || descriptions["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
  };
}

export default function HrPage() {
  return <HumanResourcesContainer />;
}