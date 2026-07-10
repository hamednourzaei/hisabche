"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean | undefined;
  error?: string;
  defaultCountry?: string;
}

const COUNTRY_CODES = [
  { code: "+93", flag: "🇦🇫", nameKey: "afghanistan" },
  { code: "+98", flag: "🇮🇷", nameKey: "iran" },
  { code: "+92", flag: "🇵🇰", nameKey: "pakistan" },
  { code: "+1", flag: "🇺🇸", nameKey: "usa" },
  { code: "+44", flag: "🇬🇧", nameKey: "uk" },
  { code: "+90", flag: "🇹🇷", nameKey: "turkey" },
  { code: "+971", flag: "🇦🇪", nameKey: "uae" },
  { code: "+91", flag: "🇮🇳", nameKey: "india" },
  { code: "+49", flag: "🇩🇪", nameKey: "germany" },
  { code: "+33", flag: "🇫🇷", nameKey: "france" },
  { code: "+966", flag: "🇸🇦", nameKey: "saudi" },
  { code: "+964", flag: "🇮🇶", nameKey: "iraq" },
  { code: "+963", flag: "🇸🇾", nameKey: "syria" },
  { code: "+974", flag: "🇶🇦", nameKey: "qatar" },
  { code: "+973", flag: "🇧🇭", nameKey: "bahrain" },
  { code: "+968", flag: "🇴🇲", nameKey: "oman" },
  { code: "+965", flag: "🇰🇼", nameKey: "kuwait" },
  { code: "+20", flag: "🇪🇬", nameKey: "egypt" },
  { code: "+7", flag: "🇷🇺", nameKey: "russia" },
  { code: "+86", flag: "🇨🇳", nameKey: "china" },
] as const;

type CountryKey = (typeof COUNTRY_CODES)[number]["nameKey"];

const countryNames: Record<string, Record<CountryKey, string>> = {
  "fa-IR": {
    afghanistan: "افغانستان", iran: "ایران", pakistan: "پاکستان", usa: "آمریکا", uk: "انگلستان",
    turkey: "ترکیه", uae: "امارات", india: "هند", germany: "آلمان", france: "فرانسه",
    saudi: "عربستان", iraq: "عراق", syria: "سوریه", qatar: "قطر", bahrain: "بحرین",
    oman: "عمان", kuwait: "کویت", egypt: "مصر", russia: "روسیه", china: "چین",
  },
  "fa-AF": {
    afghanistan: "افغانستان", iran: "ایران", pakistan: "پاکستان", usa: "آمریکا", uk: "بریتانیا",
    turkey: "ترکیه", uae: "امارات", india: "هند", germany: "آلمان", france: "فرانسه",
    saudi: "عربستان", iraq: "عراق", syria: "سوریه", qatar: "قطر", bahrain: "بحرین",
    oman: "عمان", kuwait: "کویت", egypt: "مصر", russia: "روسیه", china: "چین",
  },
  "en": {
    afghanistan: "Afghanistan", iran: "Iran", pakistan: "Pakistan", usa: "USA", uk: "UK",
    turkey: "Turkey", uae: "UAE", india: "India", germany: "Germany", france: "France",
    saudi: "Saudi Arabia", iraq: "Iraq", syria: "Syria", qatar: "Qatar", bahrain: "Bahrain",
    oman: "Oman", kuwait: "Kuwait", egypt: "Egypt", russia: "Russia", china: "China",
  },
};

function getCountryName(lang: string, key: CountryKey): string {
  const names = countryNames[lang] ?? countryNames["fa-IR"]!;
  return names[key];
}

export function PhoneInput({
  value, onChange, placeholder, className, disabled = false, error, defaultCountry = "+98",
}: PhoneInputProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "fa-IR";

  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(
    value.startsWith(selectedCountry) ? value.slice(selectedCountry.length) : value
  );

  const selected = COUNTRY_CODES.find((c) => c.code === selectedCountry) ?? COUNTRY_CODES[0]!;

  const handleCountrySelect = (code: string) => {
    setSelectedCountry(code);
    setIsOpen(false);
    onChange(code + phoneNumber);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setPhoneNumber(raw);
    onChange(selectedCountry + raw);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-stretch rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] overflow-hidden focus-within:border-[hsl(var(--color-primary)/0.5)] transition-colors">
        <button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} disabled={disabled}
          className={cn("flex items-center gap-1.5 px-3 py-2.5 text-sm shrink-0", "border-e border-[hsl(var(--border-default))]", "hover:bg-[hsl(var(--surface-muted))] transition-colors", disabled && "opacity-50 cursor-not-allowed")}>
          <span className="text-lg leading-none">{selected.flag}</span>
          <span className="text-[hsl(var(--fg-primary))]">{selected.code}</span>
          <svg width={12} height={12} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="text-[hsl(var(--fg-tertiary))]"><path d="M5 8l5 5 5-5" /></svg>
        </button>
        <input type="tel" value={phoneNumber} onChange={handlePhoneChange}
          placeholder={placeholder || t("signup.phone", "شماره تماس")} disabled={disabled} dir="ltr"
          className={cn("flex-1 px-3 py-2.5 text-sm bg-transparent outline-none", "text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]", disabled && "opacity-50 cursor-not-allowed")} />
      </div>
      {error && <p className="text-xs text-[hsl(var(--color-destructive))] mt-1 px-1">{error}</p>}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className={cn("absolute start-0 bottom-full mb-1 z-50 w-64 max-h-60 overflow-y-auto", "rounded-xl border border-[hsl(var(--border-default))]", "bg-[hsl(var(--surface-elevated)/0.99)] backdrop-blur-xl", "shadow-xl shadow-black/10", "animate-in slide-in-from-bottom-1 fade-in-0 duration-150")}>
            <div className="py-1">
              {COUNTRY_CODES.map((country) => (
                <button key={country.code} type="button" onClick={() => handleCountrySelect(country.code)}
                  className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm", "transition-colors duration-100",
                    selectedCountry === country.code
                      ? "bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))] font-semibold"
                      : "text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]")}>
                  <span className="text-lg">{country.flag}</span>
                  <span className="flex-1 text-start">{getCountryName(lang, country.nameKey)}</span>
                  <span className="text-[hsl(var(--fg-tertiary))] text-xs">{country.code}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}