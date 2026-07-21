// packages/ui/src/lib/dashboard/dashboard-utils.ts

// ✅ فرمت تاریخ بر اساس وقت محلی کاربر، نه UTC
// قبلاً از new Date().toISOString().slice(0,10) استفاده می‌شد که برای
// کاربران با منطقه‌زمانی جلوتر از UTC (مثل افغانستان UTC+4:30)، درست بعد از
// نیمه‌شب محلی، هنوز تاریخ «دیروز» را برمی‌گرداند (چون UTC هنوز به نیمه‌شب نرسیده)
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDate(): string {
  return toLocalDateString(new Date());
}

export function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toLocalDateString(date);
}

/**
 * ✅ تبدیل تاریخ به فرمت نمایشی (برای UI)
 */
export function formatDisplayDate(dateStr: string, locale: string = "fa-AF"): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * ✅ بررسی معتبر بودن تاریخ
 */
export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}