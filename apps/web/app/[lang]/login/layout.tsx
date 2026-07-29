// ═══════════════════════════════════════════════════════════
// apps/web/app/[lang]/login/layout.tsx
// ═══════════════════════════════════════════════════════════

const titles: Record<string, string> = {
  "fa": "ورود",
  "af": "ورود",
  "en": "Login",
};

const descriptions: Record<string, string> = {
  "fa": "ورود به حساب حسابچه و مدیریت کسب‌وکار خود. دسترسی سریع و امن به داشبورد.",
  "af": "ورود به حساب حسابچه و مدیریت تجارت خود. دسترسی سریع و امن به داشبورد.",
  "en": "Log in to your Hisabche account and manage your business. Fast, secure access to your dashboard.",
};

const keywords: Record<string, string[]> = {
  "fa": [
    "ورود",
    "ورود به حساب",
    "ورود کاربران",
    "حساب کاربری",
    "نرم‌افزار حسابداری",
    "مدیریت کسب‌وکار",
    "حسابچه",
    "ورود آنلاین",
  ],
  "af": [
    "ورود",
    "ورود به حساب",
    "ورود کاربران",
    "حساب کاربری",
    "نرم‌افزار حسابداری",
    "مدیریت تجارت",
    "حسابچه",
    "ورود آنلاین",
  ],
  "en": [
    "login",
    "log in",
    "sign in",
    "account access",
    "accounting software",
    "business management",
    "hisabche",
    "online login",
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

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
