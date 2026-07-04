// packages/ui/src/lib/persian-numbers.ts

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toPersianNumbers(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)] || d);
}

export function toArabicNumbers(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)] || d);
}

export function usePersianNumbers() {
  return { toPersian: toPersianNumbers, toArabic: toArabicNumbers };
}