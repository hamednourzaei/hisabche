// apps/web/app/[lang]/(dashboard)/permissions/page.tsx
import { PermissionsContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa": "نقش‌ها و دسترسی‌ها",
  "af": "نقش‌ها و دسترسی‌ها",
  "en": "Roles & Permissions",
};

const descriptions: Record<string, string> = {
  "fa": "مشاهده‌ی نقش‌های تیم و آنچه هر نقش در حسابچه می‌تواند انجام دهد.",
  "af": "مشاهده‌ی نقش‌های تیم و آنچه هر نقش در حسابچه می‌تواند انجام دهد.",
  "en": "See your team's roles and what each role can do in Hisabche.",
};

const keywords: Record<string, string[]> = {
  "fa": [
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
  "af": [
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
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
    keywords: keywords[lang] || keywords["fa"],
  };
}

export default function PermissionsPage() {
  return <PermissionsContainer />;
}