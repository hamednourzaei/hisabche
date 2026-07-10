// apps/web/app/[lang]/(dashboard)/workspace/page.tsx
import { WorkspaceContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "فضای کاری",
  "fa-AF": "فضای کاری",
  "en": "Workspace",
};

const descriptions: Record<string, string> = {
  "fa-IR": "مدیریت تیم، اعضا و دسترسی‌ها در فضای کاری حسابچه. همکاری تیمی آسان و امن.",
  "fa-AF": "مدیریت تیم، اعضا و دسترسی‌ها در فضای کاری حسابچه. همکاری تیمی آسان و امن.",
  "en": "Manage your team, members and permissions in Hisabche workspace. Easy and secure team collaboration.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "فضای کاری",
    "مدیریت تیم",
    "همکاری تیمی",
    "دعوت اعضا",
    "دسترسی کاربران",
    "نقش کاربری",
    "مدیریت کسب‌وکار",
    "حسابچه",
    "نرم‌افزار تیمی",
    "اشتراک‌گذاری",
  ],
  "fa-AF": [
    "فضای کاری",
    "مدیریت تیم",
    "همکاری تیمی",
    "دعوت اعضا",
    "دسترسی کاربران",
    "نقش کاربری",
    "مدیریت تجارت",
    "حسابچه",
    "نرم‌افزار تیمی",
    "اشتراک‌گذاری",
  ],
  "en": [
    "workspace",
    "team management",
    "team collaboration",
    "invite members",
    "user permissions",
    "user roles",
    "business management",
    "hisabche",
    "team software",
    "sharing",
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

export default function WorkspacePage() {
  return <WorkspaceContainer />;
}