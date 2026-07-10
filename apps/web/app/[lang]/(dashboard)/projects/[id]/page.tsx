// apps/web/app/[lang]/(dashboard)/projects/[id]/page.tsx
import { ProjectDetailContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "جزئیات پروژه",
  "fa-AF": "جزئیات پروژه",
  "en": "Project Details",
};

const descriptions: Record<string, string> = {
  "fa-IR": "مشاهده جزئیات پروژه، تسک‌ها، اعضا، زمان ثبت‌شده و پیشرفت پروژه در حسابچه.",
  "fa-AF": "مشاهده جزئیات پروژه، تسک‌ها، اعضا، زمان ثبت‌شده و پیشرفت پروژه در حسابچه.",
  "en": "View project details, tasks, members, time entries and project progress in Hisabche.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "جزئیات پروژه",
    "تسک‌های پروژه",
    "اعضای پروژه",
    "ثبت زمان",
    "پیشرفت پروژه",
    "مدیریت پروژه",
    "بودجه پروژه",
    "حسابچه",
    "وظایف",
    "زمان‌بندی",
  ],
  "fa-AF": [
    "جزئیات پروژه",
    "تسک‌های پروژه",
    "اعضای پروژه",
    "ثبت زمان",
    "پیشرفت پروژه",
    "مدیریت پروژه",
    "بودجه پروژه",
    "حسابچه",
    "وظایف",
    "زمان‌بندی",
  ],
  "en": [
    "project details",
    "project tasks",
    "project members",
    "time entry",
    "project progress",
    "project management",
    "project budget",
    "hisabche",
    "tasks",
    "scheduling",
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

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  return <ProjectDetailContainer id={params.id} />;
}