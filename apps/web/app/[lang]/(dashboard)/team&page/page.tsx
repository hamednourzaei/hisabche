import { TeamAndPayrollContainer } from "@hisabche/ui";
import { Suspense } from "react";

const titles: Record<string, string> = {
  "fa": "تیم و حقوق",
  "af": "تیم و حقوق",
  "en": "Team & Payroll",
};

const descriptions: Record<string, string> = {
  "fa": "مدیریت کارمندان، نقش‌ها، حقوق و دستمزد، وضعیت پرداخت حقوق و سابقه کار در حسابچه.",
  "af": "مدیریت کارمندان، نقش‌ها، حقوق و دستمزد، وضعیت پرداخت حقوق و سابقه کار در حسابچه.",
  "en": "Manage employees, roles, payroll, salary, payroll status and history in Hisabche.",
};

const keywords: Record<string, string[]> = {
  "fa": [
    "تیم و حقوق",
    "مدیریت کارمندان",
    "نقش‌ها",
    "حقوق و دستمزد",
    "وضعیت حقوق",
    "پرداخت حقوق",
    "سابقه کار",
    "حقوق آنلاین",
    "حسابچه",
    "پاداش کارکنان",
  ],
  "af": [
    "تیم و حقوق",
    "مدیریت کارمندان",
    "نقش‌ها",
    "حقوق و دستمزد",
    "وضعیت حقوق",
    "پرداخت حقوق",
    "سابقه کار",
    "حقوق آنلاین",
    "حسابچه",
    "پاداش کارکنان",
  ],
  "en": [
    "team and payroll",
    "employee management",
    "roles",
    "payroll",
    "salary",
    "payroll status",
    "payroll history",
    "online payroll",
    "hisabche",
    "employee payments",
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
    keywords: keywords[lang] || keywords["fa"],
    robots: { index: false, follow: false },
  };
}

export default function TeamAndPayrollPage() {
  return (
    <main className="section">
      <Suspense fallback={<div>در حال بارگذاری...</div>}>
        <TeamAndPayrollContainer />
      </Suspense>
    </main>
  );
}