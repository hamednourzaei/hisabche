// packages/ui/src/components/ui/jalali-datepicker.tsx
"use client";

import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface JalaliDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  dropUp?: boolean;
  /**
   * Which calendar system to render. Defaults to the app's current i18n
   * language (`i18n.language`) so callers don't need to think about it in
   * the common case. "fa-IR" → Iranian Jalali month names, "fa-AF" →
   * Afghan Dari Jalali month names (same underlying solar-Hijri calendar,
   * different names), anything starting with "en" → plain Gregorian.
   * `value`/`onChange` are ALWAYS a Gregorian ISO date string
   * (YYYY-MM-DD) regardless of which calendar is displayed — only the
   * on-screen month/day grid changes.
   */
  locale?: string;
}

// Iranian Jalali month names (fa-IR)
const monthDefaultsIR = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

// Afghan Dari Jalali month names (fa-AF) — same solar-Hijri calendar as
// fa-IR, different month names/locale conventions.
const monthDefaultsAF = [
  "حمل", "ثور", "جوزا", "سرطان", "اسد", "سنبله",
  "میزان", "عقرب", "قوس", "جدی", "دلو", "حوت",
];

// Gregorian month names (en)
const monthDefaultsEN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const weekdayDefaultsFa = ["ش", "ی", "د", "س", "چ", "پ", "ج"]; // starts Saturday
const weekdayDefaultsEn = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]; // starts Sunday

type CalendarSystem = "jalali-ir" | "jalali-af" | "gregorian";

function resolveCalendarSystem(locale: string): CalendarSystem {
  if (locale.startsWith("en")) return "gregorian";
  if (locale.startsWith("fa-AF") || locale.startsWith("prs") || locale === "af") return "jalali-af";
  return "jalali-ir";
}

function toJalali(date: Date): { year: number; month: number; day: number } {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const gdm: number[] = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  const days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + (gdm[gm - 1] || 0);
  let jy = -1595;
  let daysCount = 0;
  while (daysCount < days) { jy++; daysCount += jy % 4 === 3 ? 366 : 365; }
  const startOfYear = daysCount - (jy % 4 === 3 ? 366 : 365);
  const dayOfYear = days - startOfYear;
  let jm = 0;
  while (jm < 11 && dayOfYear > (jm < 6 ? 31 : 30)) { jm++; }
  const monthLen = jm < 6 ? 31 : 30;
  const jd = dayOfYear > monthLen ? dayOfYear - monthLen : dayOfYear;
  return { year: jy, month: jm + 1, day: jd || 1 };
}

function toGregorian(year: number, month: number, day: number): Date {
  const nowruz = new Date(year + 621, 2, 20);
  while (nowruz.getMonth() !== 2 || nowruz.getDate() < 19 || nowruz.getDate() > 22) {
    nowruz.setDate(nowruz.getDate() + 1);
    if (nowruz.getDate() === 1 && nowruz.getMonth() === 3) break;
  }
  for (let m = 1; m < month; m++) nowruz.setDate(nowruz.getDate() + (m <= 6 ? 31 : 30));
  nowruz.setDate(nowruz.getDate() + day - 1);
  return nowruz;
}

function getDaysInMonth(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month < 12) return 30;
  return year % 4 === 3 ? 30 : 29;
}

function formatJalaliDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function jalaliToGregorianString(jalaliDate: string): string {
  const parts = jalaliDate.split("-").map(Number);
  const y = parts[0] || 1400; const m = parts[1] || 1; const d = parts[2] || 1;
  return toGregorian(y, m, d).toISOString().split("T")[0] as string;
}

export function JalaliDatePicker({ value, onChange, placeholder, className, disabled = false, dropUp = false, locale }: JalaliDatePickerProps) {
  const { t, i18n } = useTranslation();
  const effectiveLocale = locale ?? i18n.language ?? "fa-IR";
  const calendarSystem = resolveCalendarSystem(effectiveLocale);
  const isGregorian = calendarSystem === "gregorian";

  const monthDefaults =
    calendarSystem === "jalali-af" ? monthDefaultsAF :
    calendarSystem === "gregorian" ? monthDefaultsEN :
    monthDefaultsIR;
  const weekdayDefaults = isGregorian ? weekdayDefaultsEn : weekdayDefaultsFa;
  // Look up month/weekday names in the i18n resources for the calendar's
  // OWN language (not necessarily the active UI language, if `locale` was
  // explicitly overridden) so callers can render e.g. an Afghan-calendar
  // picker even while the UI itself is in English.
  const calendarLng = calendarSystem === "jalali-af" ? "fa-AF" : calendarSystem === "gregorian" ? "en" : "fa-IR";
  const calendarT = i18n.getFixedT ? i18n.getFixedT(calendarLng) : t;

  const today = isGregorian
    ? (() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }; })()
    : toJalali(new Date());

  const [isOpen, setIsOpen] = useState(false);
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const months = calendarT("calendar.months", { returnObjects: true, defaultValue: monthDefaults }) as string[];
  const weekdays = calendarT("calendar.weekdaysShort", { returnObjects: true, defaultValue: weekdayDefaults }) as string[];

  useEffect(() => {
    if (!value) return;
    const parts = value.split("-").map(Number);
    const gy = parts[0], gm = parts[1], gd = parts[2];
    if (!gy || !gm || !gd) return;
    // `value` is always a Gregorian ISO date string — convert it into
    // whichever calendar system is currently displayed.
    if (isGregorian) {
      setYear(gy); setMonth(gm); setSelectedDay(gd);
    } else {
      const j = toJalali(new Date(gy, gm - 1, gd));
      setYear(j.year); setMonth(j.month); setSelectedDay(j.day);
    }
  }, [value, isGregorian]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target) && btnRef.current && !btnRef.current.contains(target)) setIsOpen(false);
    }
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handleClick); };
  }, [isOpen]);

  const daysInMonth = isGregorian ? new Date(year, month, 0).getDate() : getDaysInMonth(year, month);
  const weekdayOffset = isGregorian
    ? new Date(year, month - 1, 1).getDay()
    : (toJalali(toGregorian(year, month, 1)).day + toJalali(toGregorian(year, month, 1)).month * 2) % 7;

  const handleSelect = useCallback((day: number) => {
    const gregorianDate = isGregorian
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : jalaliToGregorianString(formatJalaliDate(year, month, day));
    setSelectedDay(day);
    onChange(gregorianDate);
    setIsOpen(false);
  }, [year, month, onChange, isGregorian]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const displayValue = selectedDay ? formatJalaliDate(year, month, selectedDay) : "";

  return (
    <div className={cn("relative", className)}>
      <button ref={btnRef} type="button" onClick={() => !disabled && setIsOpen(p => !p)} disabled={disabled}
        className={cn("flex items-center gap-2 h-10 px-3 rounded-xl border text-sm w-full", "transition-all duration-150",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[hsl(var(--surface-muted))]",
          "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]", "text-[hsl(var(--fg-primary))]",
          isOpen && "border-[hsl(var(--color-primary)/0.3)]")}>
        <CalendarDays className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]" />
        <span className={cn(!displayValue && "text-[hsl(var(--fg-tertiary))]")}>{displayValue || placeholder || t("dateRange.pickDate", "انتخاب تاریخ")}</span>
      </button>
      {isOpen && (
        <div ref={panelRef} className={cn("jalali-datepicker-popup absolute end-0 z-20 w-64",
          dropUp ? "bottom-full mb-1 sm:top-full sm:mt-1 sm:bottom-auto" : "top-full mt-1",
          "rounded-xl overflow-hidden border", "bg-[hsl(var(--surface-elevated)/0.99)] backdrop-blur-xl",
          "shadow-xl shadow-black/10", "border-[hsl(var(--border-default))]", "animate-in slide-in-from-top-1 fade-in-0 duration-150")}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border-default))]">
            <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-[hsl(var(--surface-muted))]"><ChevronRight className="size-4" /></button>
            <span className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{months[month - 1] ?? ""} {year}</span>
            <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-[hsl(var(--surface-muted))]"><ChevronLeft className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-2 pt-2 pb-1">
            {weekdays.map((day, i) => (<span key={i} className={cn("text-center text-[10px] font-medium py-1", i === 6 ? "text-[hsl(var(--color-destructive))]" : "text-[hsl(var(--fg-tertiary))]")}>{day}</span>))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-2 pb-3">
            {Array.from({ length: weekdayOffset }).map((_, i) => (<div key={`empty-${i}`} />))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = selectedDay === day;
              const isToday = today.year === year && today.month === month && today.day === day;
              return (
                <button key={day} type="button" onClick={() => handleSelect(day)}
                  className={cn("h-8 rounded-lg text-sm font-medium transition-colors duration-100", "hover:bg-[hsl(var(--surface-muted))]",
                    isSelected && "bg-[hsl(var(--color-primary))] text-white hover:bg-[hsl(var(--color-primary))]",
                    isToday && !isSelected && "border border-[hsl(var(--color-primary)/0.3)] text-[hsl(var(--color-primary))]",
                    !isSelected && !isToday && "text-[hsl(var(--fg-primary))]")}>{day}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}