// apps/web/app/[lang]/(dashboard)/human-resources/[id]/page.tsx
import { EmployeeDetailContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "جزئیات کارمند",
  "fa-AF": "جزئیات کارمند",
  "en": "Employee Details",
};

const descriptions: Record<string, string> = {
  "fa-IR": "مشاهده و ویرایش اطلاعات کارمند، حقوق، حضور و غیاب، مرخصی‌ها و سوابق کاری در حسابچه.",
  "fa-AF": "مشاهده و ویرایش اطلاعات کارمند، حقوق، حضور و غیاب، مرخصی‌ها و سوابق کاری در حسابچه.",
  "en": "View and edit employee info, salary, attendance, leaves and work history in Hisabche.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "جزئیات کارمند",
    "اطلاعات کارمند",
    "حقوق کارمند",
    "حضور و غیاب",
    "مرخصی کارمند",
    "ویرایش کارمند",
    "سوابق کاری",
    "حسابچه",
    "مدیریت کارمند",
    "پرسنل",
  ],
  "fa-AF": [
    "جزئیات کارمند",
    "اطلاعات کارمند",
    "حقوق کارمند",
    "حضور و غیاب",
    "مرخصی کارمند",
    "ویرایش کارمند",
    "سوابق کاری",
    "حسابچه",
    "مدیریت کارمند",
    "پرسنل",
  ],
  "en": [
    "employee details",
    "employee info",
    "employee salary",
    "attendance",
    "employee leave",
    "edit employee",
    "work history",
    "hisabche",
    "employee management",
    "personnel",
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa-IR"],
    description: descriptions[lang] || descriptions["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
  };
}

export default function EmployeeDetailPage({ params }: { params: { id: string } }) {
  return <EmployeeDetailContainer id={params.id} />;
}