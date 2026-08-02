// ═══════════════════════════════════════════════════════════
// apps/web/app/[lang]/signup/layout.tsx
// ═══════════════════════════════════════════════════════════

const titles: Record<string, string> = {
  "fa": "ثبت‌نام",
  "af": "ثبت‌نام",
  "en": "Sign Up",
};

const descriptions: Record<string, string> = {
  "fa": "ثبت‌نام در حسابچه و شروع مدیریت کسب‌وکار. ایجاد حساب رایگان در کمتر از ۱ دقیقه.",
  "af": "ثبت‌نام در حسابچه و شروع مدیریت تجارت. ایجاد حساب رایگان در کمتر از ۱ دقیقه.",
  "en": "Sign up for Hisabche and start managing your business. Create a free account in under 1 minute.",
};

const keywords: Record<string, string[]> = {
  "fa": [
    "ثبت‌نام",
    "ایجاد حساب",
    "ثبت‌نام رایگان",
    "حساب جدید",
    "عضویت",
    "نرم‌افزار حسابداری",
    "مدیریت کسب‌وکار",
    "حسابچه",
    "شروع کار",
    "ثبت‌نام آنلاین",
  ],
  "af": [
    "ثبت‌نام",
    "ایجاد حساب",
    "ثبت‌نام رایگان",
    "حساب جدید",
    "عضویت",
    "نرم‌افزار حسابداری",
    "مدیریت تجارت",
    "حسابچه",
    "شروع کار",
    "ثبت‌نام آنلاین",
  ],
  "en": [
    "sign up",
    "create account",
    "free signup",
    "new account",
    "register",
    "accounting software",
    "business management",
    "hisabche",
    "get started",
    "online registration",
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

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}