/**
 * Egypt's 27 governorates, for the academy's city on the registration form. The English name is the stored value
 * (`city` of the academy application), so the record reads the same whatever the page language was.
 */
export interface Governorate {
  value: string;
  ar: string;
  en: string;
}

export const EGYPT_GOVERNORATES: readonly Governorate[] = [
  { value: 'Cairo', ar: 'القاهرة', en: 'Cairo' },
  { value: 'Giza', ar: 'الجيزة', en: 'Giza' },
  { value: 'Alexandria', ar: 'الإسكندرية', en: 'Alexandria' },
  { value: 'Qalyubia', ar: 'القليوبية', en: 'Qalyubia' },
  { value: 'Dakahlia', ar: 'الدقهلية', en: 'Dakahlia' },
  { value: 'Sharqia', ar: 'الشرقية', en: 'Sharqia' },
  { value: 'Gharbia', ar: 'الغربية', en: 'Gharbia' },
  { value: 'Monufia', ar: 'المنوفية', en: 'Monufia' },
  { value: 'Beheira', ar: 'البحيرة', en: 'Beheira' },
  { value: 'Kafr El Sheikh', ar: 'كفر الشيخ', en: 'Kafr El Sheikh' },
  { value: 'Damietta', ar: 'دمياط', en: 'Damietta' },
  { value: 'Port Said', ar: 'بورسعيد', en: 'Port Said' },
  { value: 'Ismailia', ar: 'الإسماعيلية', en: 'Ismailia' },
  { value: 'Suez', ar: 'السويس', en: 'Suez' },
  { value: 'North Sinai', ar: 'شمال سيناء', en: 'North Sinai' },
  { value: 'South Sinai', ar: 'جنوب سيناء', en: 'South Sinai' },
  { value: 'Faiyum', ar: 'الفيوم', en: 'Faiyum' },
  { value: 'Beni Suef', ar: 'بني سويف', en: 'Beni Suef' },
  { value: 'Minya', ar: 'المنيا', en: 'Minya' },
  { value: 'Asyut', ar: 'أسيوط', en: 'Asyut' },
  { value: 'Sohag', ar: 'سوهاج', en: 'Sohag' },
  { value: 'Qena', ar: 'قنا', en: 'Qena' },
  { value: 'Luxor', ar: 'الأقصر', en: 'Luxor' },
  { value: 'Aswan', ar: 'أسوان', en: 'Aswan' },
  { value: 'Red Sea', ar: 'البحر الأحمر', en: 'Red Sea' },
  { value: 'New Valley', ar: 'الوادي الجديد', en: 'New Valley' },
  { value: 'Matrouh', ar: 'مطروح', en: 'Matrouh' },
];

/** The governorate's name in the page language; any other stored text is shown as it is. */
export function governorateLabel(value: string, locale: 'ar' | 'en'): string {
  const match = EGYPT_GOVERNORATES.find((g) => g.value === value);
  return match ? match[locale] : value;
}
