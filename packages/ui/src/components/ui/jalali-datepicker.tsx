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

// Jalali <-> Gregorian conversion, ported from the standard "jalaali-js"
// algorithm (Borkowski / breaks-array leap-year rule). The previous
// hand-rolled implementation used an ad-hoc day-counting loop (magic
// constant `355666`, `jy % 4 === 3` leap approximation) that drifted by
// roughly two years — e.g. it mapped 2024-03-20 to Jalali 1405/01/11
// instead of the correct 1403/01/01. This version is internally
// consistent (toGregorian(toJalali(d)) === d) and matches the reference
// epoch used by every locale branch (fa-IR and fa-AF share the same
// underlying solar-Hijri calendar, only month names differ).
function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

function g2d(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
    + div(153 * ((gm + 9) % 12) + 2, 5)
    + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(j % 1461, 4) * 5 + 308;
  const gd = div(i % 153, 5) + 1;
  const gm = (div(i, 153) % 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

const JALALI_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const bl = JALALI_BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = JALALI_BREAKS[0] as number;
  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = JALALI_BREAKS[i] as number;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(jump % 33, 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div((n % 33) + 3, 4);
  if (jump % 33 === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = (((n + 1) % 33) - 1) % 4;
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(r.gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      const jm = 1 + div(k, 31);
      const jd = (k % 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  const jm = 7 + div(k, 30);
  const jd = (k % 30) + 1;
  return { jy, jm, jd };
}

function toJalali(date: Date): { year: number; month: number; day: number } {
  const jdn = g2d(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const j = d2j(jdn);
  return { year: j.jy, month: j.jm, day: j.jd };
}

function toGregorian(year: number, month: number, day: number): Date {
  const jdn = j2d(year, month, day);
  const g = d2g(jdn);
  return new Date(g.gy, g.gm - 1, g.gd);
}

function isJalaliLeapYear(year: number): boolean {
  return jalCal(year).leap === 1;
}

function getDaysInMonth(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month < 12) return 30;
  return isJalaliLeapYear(year) ? 30 : 29;
}

function formatJalaliDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Format a Date's LOCAL calendar fields as an ISO (YYYY-MM-DD) string
// without going through `toISOString()`, which converts to UTC first —
// for timezones ahead of UTC (e.g. Iran +03:30, Afghanistan +04:30) that
// conversion silently rolls local midnight back to the previous day.
function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function jalaliToGregorianString(jalaliDate: string): string {
  const parts = jalaliDate.split("-").map(Number);
  const y = parts[0] || 1400; const m = parts[1] || 1; const d = parts[2] || 1;
  return toLocalIsoDate(toGregorian(y, m, d));
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
  // "days" = normal calendar grid, "jump" = month/year quick-jump grid so
  // users don't have to click prev/next repeatedly to reach a far-off date.
  const [pickerMode, setPickerMode] = useState<"days" | "jump">("days");
  const [jumpYear, setJumpYear] = useState(year);
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
    if (!isOpen) setPickerMode("days");
  }, [isOpen]);

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
    // Jalali week starts Saturday; JS getDay() is Sunday-indexed (0-6), so
    // shift by one to make Saturday -> 0.
    : (toGregorian(year, month, 1).getDay() + 1) % 7;

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

  const openJumpMode = () => { setJumpYear(year); setPickerMode("jump"); };
  const selectJumpMonth = (m: number) => { setYear(jumpYear); setMonth(m); setPickerMode("days"); };

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
            <button type="button" onClick={pickerMode === "days" ? prevMonth : () => setJumpYear(y => y - 1)}
              aria-label={t("calendar.prev", "قبلی")}
              className="p-1 rounded-lg hover:bg-[hsl(var(--surface-muted))]"><ChevronRight className="size-4" /></button>
            <button type="button" onClick={openJumpMode}
              className="text-sm font-semibold text-[hsl(var(--fg-primary))] rounded-lg px-2 py-0.5 hover:bg-[hsl(var(--surface-muted))] transition-colors duration-100">
              {pickerMode === "days" ? <>{months[month - 1] ?? ""} {year}</> : jumpYear}
            </button>
            <button type="button" onClick={pickerMode === "days" ? nextMonth : () => setJumpYear(y => y + 1)}
              aria-label={t("calendar.next", "بعدی")}
              className="p-1 rounded-lg hover:bg-[hsl(var(--surface-muted))]"><ChevronLeft className="size-4" /></button>
          </div>
          {pickerMode === "jump" ? (
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {months.map((m, i) => (
                <button key={i} type="button" onClick={() => selectJumpMonth(i + 1)}
                  className={cn("rounded-lg px-2 py-2 text-xs font-medium transition-colors duration-100",
                    "hover:bg-[hsl(var(--surface-muted))]",
                    jumpYear === year && month === i + 1
                      ? "bg-[hsl(var(--color-primary))] text-white hover:bg-[hsl(var(--color-primary))]"
                      : "text-[hsl(var(--fg-primary))]")}>
                  {m}
                </button>
              ))}
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}