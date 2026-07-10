// ═══════════════════════════════════════════════════════════
// apps/web/app/[lang]/signup/layout.tsx
// ═══════════════════════════════════════════════════════════

const titles: Record<string, string> = {
  "fa-IR": "ثبت‌نام",
  "fa-AF": "ثبت‌نام",
  "en": "Sign Up",
};

const descriptions: Record<string, string> = {
  "fa-IR": "ثبت‌نام در حسابچه و شروع مدیریت کسب‌وکار. ایجاد حساب رایگان در کمتر از ۱ دقیقه.",
  "fa-AF": "ثبت‌نام در حسابچه و شروع مدیریت تجارت. ایجاد حساب رایگان در کمتر از ۱ دقیقه.",
  "en": "Sign up for Hisabche and start managing your business. Create a free account in under 1 minute.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
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
  "fa-AF": [
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
    title: titles[lang] || titles["fa-IR"],
    description: descriptions[lang] || descriptions["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
    robots: { index: false, follow: false },
  };
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}