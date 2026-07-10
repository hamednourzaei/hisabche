// apps/web/app/[lang]/accept-invite/layout.tsx

const titles: Record<string, string> = {
  "fa-IR": "پذیرش دعوت",
  "fa-AF": "پذیرش دعوت",
  "en": "Accept Invite",
};

const descriptions: Record<string, string> = {
  "fa-IR": "پذیرش دعوت همکاری در فضای کاری حسابچه. به تیم خود بپیوندید و همکاری را شروع کنید.",
  "fa-AF": "پذیرش دعوت همکاری در فضای کاری حسابچه. به تیم خود بپیوندید و همکاری را شروع کنید.",
  "en": "Accept team invitation in Hisabche workspace. Join your team and start collaborating.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "پذیرش دعوت",
    "دعوت همکاری",
    "فضای کاری",
    "تیم",
    "همکاری",
    "ورک‌اسپیس",
    "عضویت",
    "حسابچه",
    "دعوت‌نامه",
    "پیوستن به تیم",
  ],
  "fa-AF": [
    "پذیرش دعوت",
    "دعوت همکاری",
    "فضای کاری",
    "تیم",
    "همکاری",
    "ورک‌اسپیس",
    "عضویت",
    "حسابچه",
    "دعوت‌نامه",
    "پیوستن به تیم",
  ],
  "en": [
    "accept invite",
    "team invitation",
    "workspace",
    "team",
    "collaboration",
    "join team",
    "membership",
    "hisabche",
    "invitation",
    "accept invitation",
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa-IR"],
    description: descriptions[lang] || descriptions["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
    robots: { index: false, follow: false },
  };
}

export default function AcceptInviteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}