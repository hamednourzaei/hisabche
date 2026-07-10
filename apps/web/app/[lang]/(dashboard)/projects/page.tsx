// apps/web/app/[lang]/(dashboard)/projects/page.tsx
import { ProjectsContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "پروژه‌ها",
  "fa-AF": "پروژه‌ها",
  "en": "Projects",
};

const descriptions: Record<string, string> = {
  "fa-IR": "مدیریت پروژه، تسک‌ها، اعضا و زمان‌بندی در حسابچه. پیگیری پیشرفت پروژه‌ها به‌صورت لحظه‌ای.",
  "fa-AF": "مدیریت پروژه، تسک‌ها، اعضا و زمان‌بندی در حسابچه. پیگیری پیشرفت پروژه‌ها به‌صورت لحظه‌ای.",
  "en": "Project management, tasks, members and scheduling in Hisabche. Track project progress in real-time.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "مدیریت پروژه",
    "تسک",
    "وظایف",
    "زمان‌بندی",
    "اعضای پروژه",
    "پیشرفت پروژه",
    "مدیریت کارها",
    "پروژه آنلاین",
    "حسابچه",
    "رهگیری پروژه",
  ],
  "fa-AF": [
    "مدیریت پروژه",
    "تسک",
    "وظایف",
    "زمان‌بندی",
    "اعضای پروژه",
    "پیشرفت پروژه",
    "مدیریت کارها",
    "پروژه آنلاین",
    "حسابچه",
    "رهگیری پروژه",
  ],
  "en": [
    "project management",
    "tasks",
    "to-do",
    "scheduling",
    "project members",
    "project progress",
    "task management",
    "online project",
    "hisabche",
    "project tracking",
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

export default function ProjectsPage() {
  return <ProjectsContainer />;
}