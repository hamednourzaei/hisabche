// apps/web/app/[lang]/(dashboard)/projects/page.tsx
import { ProjectsContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa": "پروژه‌ها",
  "af": "پروژه‌ها",
  "en": "Projects",
};

const descriptions: Record<string, string> = {
  "fa": "مدیریت پروژه، تسک‌ها، اعضا و زمان‌بندی در حسابچه. پیگیری پیشرفت پروژه‌ها به‌صورت لحظه‌ای.",
  "af": "مدیریت پروژه، تسک‌ها، اعضا و زمان‌بندی در حسابچه. پیگیری پیشرفت پروژه‌ها به‌صورت لحظه‌ای.",
  "en": "Project management, tasks, members and scheduling in Hisabche. Track project progress in real-time.",
};

const keywords: Record<string, string[]> = {
  "fa": [
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
  "af": [
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
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
    keywords: keywords[lang] || keywords["fa"],
  };
}

export default function ProjectsPage() {
  return <ProjectsContainer />;
}