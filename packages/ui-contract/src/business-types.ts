// ============================================
// Business types offered during onboarding.
//
// Onboarding used to show five cards — retail, wholesale, restaurant, service,
// other — which forced most shops to pick "other" and told us nothing. Retail
// and wholesale stay as cards because they describe *how* a business sells and
// almost everyone is one of the two; the specific trade is then chosen from
// this searchable list.
//
// Ids are stable and stored on the workspace. Renaming one changes what an
// existing row means, so add rather than rename.
// ============================================

export interface BusinessTypeOption {
  id: string
  /** Translation key. Falls back to the Persian label when a locale lacks it. */
  labelKey: string
  labelFa: string
}

/**
 * Presented above the search box because nearly every business is one of them,
 * and they answer a different question (sales model) than the list does (trade).
 */
export const BUSINESS_MODELS: readonly BusinessTypeOption[] = [
  { id: 'retail', labelKey: 'onboarding.retail', labelFa: 'خرده‌فروشی' },
  { id: 'wholesale', labelKey: 'onboarding.wholesale', labelFa: 'عمده‌فروشی' },
]

/** Searchable trades. Kept alphabetical by Persian label within each group. */
export const BUSINESS_TYPES: readonly BusinessTypeOption[] = [
  // ─── Food ───
  { id: 'grocery', labelKey: 'businessType.grocery', labelFa: 'خواروبار و سوپرمارکت' },
  { id: 'bakery', labelKey: 'businessType.bakery', labelFa: 'نانوایی و قنادی' },
  { id: 'butcher', labelKey: 'businessType.butcher', labelFa: 'قصابی' },
  { id: 'restaurant', labelKey: 'businessType.restaurant', labelFa: 'رستوران' },
  { id: 'cafe', labelKey: 'businessType.cafe', labelFa: 'کافه و قهوه‌خانه' },
  { id: 'fruitVegetable', labelKey: 'businessType.fruitVegetable', labelFa: 'میوه و سبزی' },
  { id: 'dairy', labelKey: 'businessType.dairy', labelFa: 'لبنیات' },
  { id: 'nuts', labelKey: 'businessType.nuts', labelFa: 'خشکبار و آجیل' },
  { id: 'spices', labelKey: 'businessType.spices', labelFa: 'عطاری و ادویه' },

  // ─── Precious goods (weight-based, the reason units matter) ───
  { id: 'jewellery', labelKey: 'businessType.jewellery', labelFa: 'طلا و جواهر' },
  { id: 'watches', labelKey: 'businessType.watches', labelFa: 'ساعت' },
  { id: 'currencyExchange', labelKey: 'businessType.currencyExchange', labelFa: 'صرافی' },

  // ─── Clothing & textiles ───
  { id: 'clothing', labelKey: 'businessType.clothing', labelFa: 'پوشاک' },
  { id: 'fabric', labelKey: 'businessType.fabric', labelFa: 'پارچه و خرازی' },
  { id: 'shoes', labelKey: 'businessType.shoes', labelFa: 'کفش' },
  { id: 'carpet', labelKey: 'businessType.carpet', labelFa: 'فرش و قالین' },
  { id: 'tailoring', labelKey: 'businessType.tailoring', labelFa: 'خیاطی' },

  // ─── Technology ───
  { id: 'mobilePhones', labelKey: 'businessType.mobilePhones', labelFa: 'موبایل و لوازم جانبی' },
  { id: 'computers', labelKey: 'businessType.computers', labelFa: 'کامپیوتر و لپ‌تاپ' },
  { id: 'electronics', labelKey: 'businessType.electronics', labelFa: 'لوازم برقی و الکترونیک' },
  { id: 'itServices', labelKey: 'businessType.itServices', labelFa: 'خدمات کامپیوتری' },

  // ─── Construction & industry ───
  { id: 'hardware', labelKey: 'businessType.hardware', labelFa: 'آهن‌فروشی و ابزار' },
  { id: 'buildingMaterials', labelKey: 'businessType.buildingMaterials', labelFa: 'مواد ساختمانی' },
  { id: 'paint', labelKey: 'businessType.paint', labelFa: 'رنگ و ابزار نقاشی' },
  { id: 'timber', labelKey: 'businessType.timber', labelFa: 'چوب و الوار' },
  { id: 'glass', labelKey: 'businessType.glass', labelFa: 'شیشه و آلومینیوم' },
  { id: 'construction', labelKey: 'businessType.construction', labelFa: 'ساخت‌وساز و پیمانکاری' },
  { id: 'manufacturing', labelKey: 'businessType.manufacturing', labelFa: 'تولیدی و کارگاه' },

  // ─── Vehicles ───
  { id: 'autoParts', labelKey: 'businessType.autoParts', labelFa: 'قطعات موتر و یدکی' },
  { id: 'carDealer', labelKey: 'businessType.carDealer', labelFa: 'نمایشگاه موتر' },
  { id: 'mechanic', labelKey: 'businessType.mechanic', labelFa: 'مکانیکی و سرویس' },
  { id: 'fuel', labelKey: 'businessType.fuel', labelFa: 'تیل‌فروشی و گاز' },

  // ─── Home ───
  { id: 'furniture', labelKey: 'businessType.furniture', labelFa: 'مبل و اثاثیه' },
  { id: 'kitchenware', labelKey: 'businessType.kitchenware', labelFa: 'ظروف و لوازم آشپزخانه' },
  { id: 'homeAppliances', labelKey: 'businessType.homeAppliances', labelFa: 'لوازم خانگی' },
  { id: 'stationery', labelKey: 'businessType.stationery', labelFa: 'لوازم‌التحریر و کتاب' },
  { id: 'toys', labelKey: 'businessType.toys', labelFa: 'اسباب‌بازی' },
  { id: 'giftShop', labelKey: 'businessType.giftShop', labelFa: 'کادو و تزئینات' },

  // ─── Health & beauty ───
  { id: 'pharmacy', labelKey: 'businessType.pharmacy', labelFa: 'دواخانه و داروخانه' },
  { id: 'cosmetics', labelKey: 'businessType.cosmetics', labelFa: 'لوازم آرایشی و بهداشتی' },
  { id: 'clinic', labelKey: 'businessType.clinic', labelFa: 'کلینیک و مطب' },
  { id: 'barber', labelKey: 'businessType.barber', labelFa: 'آرایشگاه و سلمانی' },
  { id: 'optician', labelKey: 'businessType.optician', labelFa: 'عینک‌فروشی' },

  // ─── Agriculture ───
  { id: 'agriculture', labelKey: 'businessType.agriculture', labelFa: 'زراعت و کشاورزی' },
  { id: 'livestock', labelKey: 'businessType.livestock', labelFa: 'مالداری و دامداری' },
  { id: 'seedsFertilizer', labelKey: 'businessType.seedsFertilizer', labelFa: 'تخم و کود' },
  { id: 'flowers', labelKey: 'businessType.flowers', labelFa: 'گل و گیاه' },

  // ─── Services ───
  { id: 'transport', labelKey: 'businessType.transport', labelFa: 'ترانسپورت و باربری' },
  { id: 'travelAgency', labelKey: 'businessType.travelAgency', labelFa: 'آژانس مسافرتی' },
  { id: 'realEstate', labelKey: 'businessType.realEstate', labelFa: 'املاک و مشاورین' },
  { id: 'printing', labelKey: 'businessType.printing', labelFa: 'چاپ و تبلیغات' },
  { id: 'photography', labelKey: 'businessType.photography', labelFa: 'عکاسی و فیلم‌برداری' },
  { id: 'education', labelKey: 'businessType.education', labelFa: 'آموزشگاه و کورس' },
  { id: 'laundry', labelKey: 'businessType.laundry', labelFa: 'خشک‌شویی' },
  { id: 'repairs', labelKey: 'businessType.repairs', labelFa: 'تعمیرات' },
  { id: 'wedding', labelKey: 'businessType.wedding', labelFa: 'تالار و خدمات عروسی' },
  { id: 'security', labelKey: 'businessType.security', labelFa: 'خدمات امنیتی' },
  { id: 'consulting', labelKey: 'businessType.consulting', labelFa: 'مشاوره و حسابداری' },
]

/**
 * The escape hatch, shown first AND last in the results.
 *
 * Someone whose trade is missing should not have to scroll the whole list to
 * discover that, and should not have to scroll back up once they do.
 */
export const BUSINESS_TYPE_OTHER: BusinessTypeOption = {
  id: 'other',
  labelKey: 'onboarding.businessTypeNotFound',
  labelFa: 'کسب‌وکارت پیدا نشد؟ (سایر)',
}

/** Case-insensitive match on the localised label, falling back to Persian. */
export function filterBusinessTypes(
  query: string,
  translate: (key: string, fallback: string) => string,
): readonly BusinessTypeOption[] {
  const term = query.trim().toLowerCase()
  if (!term) return BUSINESS_TYPES

  return BUSINESS_TYPES.filter((option) => {
    const label = translate(option.labelKey, option.labelFa).toLowerCase()
    // Match the id too, so an English speaker typing "jewel" finds طلا و جواهر
    // even before the English catalogue is complete.
    return label.includes(term) || option.id.toLowerCase().includes(term)
  })
}
