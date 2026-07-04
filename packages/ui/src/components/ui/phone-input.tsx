"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean | undefined;
  error?: string;
  defaultCountry?: string;
}
// Common country codes for the region
const COUNTRY_CODES = [
  { code: "+93", flag: "🇦🇫", name: "افغانستان" },
  { code: "+98", flag: "🇮🇷", name: "ایران" },
  { code: "+92", flag: "🇵🇰", name: "پاکستان" },
  { code: "+1", flag: "🇺🇸", name: "آمریکا" },
  { code: "+44", flag: "🇬🇧", name: "انگلستان" },
  { code: "+90", flag: "🇹🇷", name: "ترکیه" },
  { code: "+971", flag: "🇦🇪", name: "امارات" },
  { code: "+91", flag: "🇮🇳", name: "هند" },
  { code: "+49", flag: "🇩🇪", name: "آلمان" },
  { code: "+33", flag: "🇫🇷", name: "فرانسه" },
  { code: "+966", flag: "🇸🇦", name: "عربستان" },
  { code: "+964", flag: "🇮🇶", name: "عراق" },
  { code: "+963", flag: "🇸🇾", name: "سوریه" },
  { code: "+974", flag: "🇶🇦", name: "قطر" },
  { code: "+973", flag: "🇧🇭", name: "بحرین" },
  { code: "+968", flag: "🇴🇲", name: "عمان" },
  { code: "+965", flag: "🇰🇼", name: "کویت" },
  { code: "+20", flag: "🇪🇬", name: "مصر" },
  { code: "+7", flag: "🇷🇺", name: "روسیه" },
  { code: "+86", flag: "🇨🇳", name: "چین" },
];

export function PhoneInput({
  value,
  onChange,
  placeholder = "شماره تماس",
  className,
  disabled = false,
  error,
  defaultCountry = "+98",
}: PhoneInputProps) {
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
        {/* Country Selector */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2.5 text-sm shrink-0",
            "border-e border-[hsl(var(--border-default))]",
            "hover:bg-[hsl(var(--surface-muted))] transition-colors",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="text-lg leading-none">{selected.flag}</span>
          <span className="text-[hsl(var(--fg-primary))]">{selected.code}</span>
          <svg width={12} height={12} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="text-[hsl(var(--fg-tertiary))]">
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>

        {/* Phone Input */}
        <input
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          placeholder={placeholder}
          disabled={disabled}
          dir="ltr"
          className={cn(
            "flex-1 px-3 py-2.5 text-sm bg-transparent outline-none",
            "text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      </div>

      {/* Error */}
      {error && <p className="text-xs text-[hsl(var(--color-destructive))] mt-1 px-1">{error}</p>}

      {/* Country Dropdown */}
    {/* Country Dropdown — باز شدن به سمت بالا */}
{isOpen && (
  <>
    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
    <div className={cn(
      "absolute start-0 bottom-full mb-1 z-50 w-64 max-h-60 overflow-y-auto",  // ✅ bottom-full = بالا
      "rounded-xl border border-[hsl(var(--border-default))]",
      "bg-[hsl(var(--surface-elevated)/0.99)] backdrop-blur-xl",
      "shadow-xl shadow-black/10",
      "animate-in slide-in-from-bottom-1 fade-in-0 duration-150"  // ✅ انیمیشن از پایین به بالا
    )}>
            <div className="py-1">
              {COUNTRY_CODES.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleCountrySelect(country.code)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm",
                    "transition-colors duration-100",
                    selectedCountry === country.code
                      ? "bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))] font-semibold"
                      : "text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
                  )}
                >
                  <span className="text-lg">{country.flag}</span>
                  <span className="flex-1 text-start">{country.name}</span>
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