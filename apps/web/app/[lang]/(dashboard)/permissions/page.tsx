// apps/web/app/[lang]/(dashboard)/permissions/page.tsx
import { PermissionsContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "نقش‌ها و دسترسی‌ها",
  "fa-AF": "نقش‌ها و دسترسی‌ها",
  "en": "Roles & Permissions",
};

const descriptions: Record<string, string> = {
  "fa-IR": "مشاهده‌ی نقش‌های تیم و آنچه هر نقش در حسابچه می‌تواند انجام دهد.",
  "fa-AF": "مشاهده‌ی نقش‌های تیم و آنچه هر نقش در حسابچه می‌تواند انجام دهد.",
  "en": "See your team's roles and what each role can do in Hisabche.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "نقش کاربری",
    "دسترسی",
    "مجوز",
    "مدیر",
    "کارمند",
    "مالک",
    "کنترل دسترسی",
    "امنیت",
    "حسابچه",
    "سطح دسترسی",
  ],
  "fa-AF": [
    "نقش کاربری",
    "دسترسی",
    "مجوز",
    "مدیر",
    "کارمند",
    "مالک",
    "کنترل دسترسی",
    "امنیت",
    "حسابچه",
    "سطح دسترسی",
  ],
  "en": [
    "user roles",
    "permissions",
    "access control",
    "admin",
    "employee",
    "owner",
    "role management",
    "security",
    "hisabche",
    "access level",
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

export default function PermissionsPage() {
  return <PermissionsContainer />;
}