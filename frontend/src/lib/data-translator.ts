import type { SupportedLocale } from '@academy/shared';

export const STATUS_TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  ar: {
    ACTIVE: 'نشط',
    INACTIVE: 'غير نشط',
    PENDING: 'قيد الاعتماد',
    PENDING_REVIEW: 'قيد المراجعة',
    SUSPENDED: 'معلق',
    PROVISIONING: 'قيد التجهيز',
    PRESENT: 'حاضر',
    ABSENT: 'غائب',
    LATE: 'متأخر',
    EXCUSED: 'معذور',
    UNMARKED: 'غير محدد',
    SCHEDULED: 'مجدول',
    IN_PROGRESS: 'جارية الآن',
    COMPLETED: 'مكتمل / معتمد',
    CLOSED: 'مغلقة',
    CANCELLED: 'ملغاة',
    REJECTED: 'مرفوض',
    REVERSED: 'معكوس',
    OVERDUE: 'متأخر سداده',
    PARTIAL: 'سداد جزئي',
    PAID: 'مدفوع',
    UNPAID: 'غير مدفوع',
    VOID: 'ملغي / باطل',
    EXEMPT: 'معفى',
    PAUSED: 'موقوف مؤقتاً',
    EXPIRED: 'منتهي الصلاحية',
    TRIAL: 'تجريبي',
    DRAFT: 'مسودة',
    ARCHIVED: 'مؤرشف',
    PUBLISHED: 'منشور',
    INVITED: 'مدعو',
    REVOKED: 'ملغى الوصول',
    FAILED: 'فشل',
    CONFIRMED: 'مؤكد',
    ACCEPTED: 'مقبول',
    APPROVED: 'معتمد ومقبول',
    MORE_INFO_REQUESTED: 'بانتظار معلومات',
    MAINTENANCE: 'تحت الصيانة',
    HEALTHY: 'سليم ومستقر',
    DEGRADED: 'أداء منخفض',
    CRITICAL: 'حرج',
    OK: 'سليم',
    DOWN: 'متوقف',
    SKIPPED: 'تم التخطي',
    CONNECTED: 'متصل',
    IN_MEMORY: 'في الذاكرة',
    UNAVAILABLE: 'غير متاح',
  },
  en: {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    PENDING: 'Pending',
    PENDING_REVIEW: 'Pending Review',
    SUSPENDED: 'Suspended',
    PROVISIONING: 'Provisioning',
    PRESENT: 'Present',
    ABSENT: 'Absent',
    LATE: 'Late',
    EXCUSED: 'Excused',
    UNMARKED: 'Unmarked',
    SCHEDULED: 'Scheduled',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled',
    REJECTED: 'Rejected',
    REVERSED: 'Reversed',
    OVERDUE: 'Overdue',
    PARTIAL: 'Partial',
    PAID: 'Paid',
    UNPAID: 'Unpaid',
    VOID: 'Voided',
    EXEMPT: 'Exempt',
    PAUSED: 'Paused',
    EXPIRED: 'Expired',
    TRIAL: 'Trial',
    DRAFT: 'Draft',
    ARCHIVED: 'Archived',
    PUBLISHED: 'Published',
    INVITED: 'Invited',
    REVOKED: 'Revoked',
    FAILED: 'Failed',
    CONFIRMED: 'Confirmed',
    ACCEPTED: 'Accepted',
    APPROVED: 'Approved',
    MORE_INFO_REQUESTED: 'More Info Needed',
    MAINTENANCE: 'Maintenance',
    HEALTHY: 'Healthy',
    DEGRADED: 'Degraded',
    CRITICAL: 'Critical',
    OK: 'OK',
    DOWN: 'Down',
    SKIPPED: 'Skipped',
    CONNECTED: 'Connected',
    IN_MEMORY: 'In-Memory',
    UNAVAILABLE: 'Unavailable',
  },
};

export const ROLE_TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  ar: {
    SUPER_ADMIN: 'مشرف عام المنصة',
    PLATFORM_OWNER: 'مالك المنصة',
    PLATFORM_CO_OWNER: 'شريك إدارة المنصة',
    OWNER: 'مالك الأكاديمية',
    MANAGER: 'مدير عام',
    BRANCH_MANAGER: 'مدير فرع',
    HEAD_COACH: 'كبير المدربين',
    COACH: 'مدرب معتمد',
    RECEPTIONIST: 'مسؤول استقبال',
    ACCOUNTANT: 'مسؤول مالي / محاسب',
    STAFF: 'فريق العمل',
    PLAYER: 'لاعب / متدرب',
    GUARDIAN: 'ولي أمر',
    VIEWER: 'مراقب فقط',
  },
  en: {
    SUPER_ADMIN: 'Super Admin',
    PLATFORM_OWNER: 'Platform Owner',
    PLATFORM_CO_OWNER: 'Platform Co-Owner',
    OWNER: 'Academy Owner',
    MANAGER: 'General Manager',
    BRANCH_MANAGER: 'Branch Manager',
    HEAD_COACH: 'Head Coach',
    COACH: 'Certified Coach',
    RECEPTIONIST: 'Receptionist',
    ACCOUNTANT: 'Accountant',
    STAFF: 'Staff Member',
    PLAYER: 'Player',
    GUARDIAN: 'Guardian',
    VIEWER: 'Viewer',
  },
};

export const SPORT_TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  ar: {
    FOOTBALL: 'كرة القدم',
    BASKETBALL: 'كرة السلة',
    SWIMMING: 'السباحة',
    TENNIS: 'التنس الأرضي',
    PADEL: 'البادل',
    MARTIAL_ARTS: 'فنون قتالية',
    GYMNASTICS: 'الجمباز',
    VOLLEYBALL: 'كرة الطائرة',
    HANDBALL: 'كرة اليد',
    FITNESS: 'اللياقة والبدنية',
    OTHER: 'رياضات أخرى',
  },
  en: {
    FOOTBALL: 'Football (Soccer)',
    BASKETBALL: 'Basketball',
    SWIMMING: 'Swimming',
    TENNIS: 'Tennis',
    PADEL: 'Padel',
    MARTIAL_ARTS: 'Martial Arts',
    GYMNASTICS: 'Gymnastics',
    VOLLEYBALL: 'Volleyball',
    HANDBALL: 'Handball',
    FITNESS: 'Fitness & Conditioning',
    OTHER: 'Other Sports',
  },
};

export const PAYMENT_METHOD_TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  ar: {
    CASH: 'نقداً (كاش)',
    BANK_TRANSFER: 'تحويل بنكي',
    CARD: 'بطاقة ائتمان / مدى',
    POS: 'نقطة بيع إلكترونية',
    ONLINE: 'دفع إلكتروني أونلاين',
    WALLET: 'محفظة إلكترونية',
    FAWRY: 'خدمة فوري / منافذ الدفع',
  },
  en: {
    CASH: 'Cash',
    BANK_TRANSFER: 'Bank Transfer',
    CARD: 'Credit / Debit Card',
    POS: 'POS Terminal',
    ONLINE: 'Online Payment',
    WALLET: 'E-Wallet',
    FAWRY: 'Fawry / Gateway',
  },
};

export const BILLING_CYCLE_TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  ar: {
    MONTHLY: 'شهرياً',
    QUARTERLY: 'ربع سنوي (3 أشهر)',
    SEMIANNUAL: 'نصف سنوي (6 أشهر)',
    ANNUAL: 'سنوياً',
    PER_SESSION: 'بالحصة التدريبية',
  },
  en: {
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    SEMIANNUAL: 'Semi-Annual',
    ANNUAL: 'Annual',
    PER_SESSION: 'Per Session',
  },
};

export const GENDER_TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  ar: {
    MALE: 'ذكور (بنين)',
    FEMALE: 'إناث (بنات)',
    MIXED: 'مختلط',
  },
  en: {
    MALE: 'Male',
    FEMALE: 'Female',
    MIXED: 'Mixed',
  },
};

export const EVALUATION_CATEGORY_TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  ar: {
    TECHNICAL: 'مهارات فنية',
    TACTICAL: 'وعي خططي وتكتيكي',
    PHYSICAL: 'جاهزية بدنية ولياقة',
    BEHAVIORAL: 'سلوك وانضباط رياضي',
  },
  en: {
    TECHNICAL: 'Technical Skills',
    TACTICAL: 'Tactical Awareness',
    PHYSICAL: 'Physical Fitness',
    BEHAVIORAL: 'Behavior & Discipline',
  },
};

export const PLAN_CODE_TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  ar: {
    STARTER: 'الباقة الأساسية (Starter)',
    PRO: 'الباقة المتقدمة (Pro)',
    ENTERPRISE: 'باقة المؤسسات (Enterprise)',
    CUSTOM: 'باقة مخصصة (Custom)',
  },
  en: {
    STARTER: 'Starter Plan',
    PRO: 'Pro Plan',
    ENTERPRISE: 'Enterprise Plan',
    CUSTOM: 'Custom Plan',
  },
};

/**
 * Common Arabic phrases that may be returned in legacy or mock database records,
 * mapped to high-quality English equivalents.
 */
export const ARABIC_DATA_FALLBACKS: Record<string, string> = {
  'الفرع الرئيسي': 'Main Branch',
  'فرع المعادي': 'Maadi Branch',
  'فرع التجمع الخامس': 'New Cairo Branch',
  'فرع الشيخ زايد': 'Sheikh Zayed Branch',
  'فرع النصر': 'Al Nasr Branch',
  'فرع النادي الأهلي': 'Ahly Club Branch',
  'مجموعة النخبة': 'Elite Squad',
  'مجموعة البراعم': 'Juniors Squad',
  'فريق البراعم': 'Juniors Squad',
  'فريق الأمل': 'Hope Squad',
  'مجموعة الأمل': 'Hope Squad',
  'مجموعة الناشئين': 'Youth Squad',
  'كرة القدم': 'Football',
  'السباحة': 'Swimming',
  'كرة السلة': 'Basketball',
  'التنس': 'Tennis',
  'البادل': 'Padel',
  'نشط': 'Active',
  'غير نشط': 'Inactive',
  'معلق': 'Suspended',
  'حاضر': 'Present',
  'غائب': 'Absent',
  'متأخر': 'Late',
  'معذور': 'Excused',
  'مجدول': 'Scheduled',
  'جارية الآن': 'In Progress',
  'مكتمل': 'Completed',
  'معتمد / مكتمل': 'Completed',
  'معتمد': 'Approved',
  'ملغاة': 'Cancelled',
  'ملغي': 'Cancelled',
  'مرفوض': 'Rejected',
  'معكوس': 'Reversed',
  'متأخر سداده': 'Overdue',
  'سداد جزئي': 'Partial',
  'مدفوع': 'Paid',
  'غير مدفوع': 'Unpaid',
  'قيد المراجعة': 'Pending Review',
  'قيد الاعتماد': 'Pending Approval',
  'قيد الانتظار': 'Pending',
  'مؤكد': 'Confirmed',
  'مقبول': 'Accepted',
  'مغلقة': 'Closed',
  'مغلق': 'Closed',
  'ذكور': 'Male',
  'إناث': 'Female',
  'ذكور (بنين)': 'Male',
  'إناث (بنات)': 'Female',
  'شهري': 'Monthly',
  'شهرياً': 'Monthly',
  'سنوي': 'Annual',
  'سنوياً': 'Annual',
  'نقدي': 'Cash',
  'نقداً': 'Cash',
  'نقداً (كاش)': 'Cash',
  'تحويل بنكي': 'Bank Transfer',
  'بطاقة': 'Card',
};

export function translateStatus(status: string | undefined | null, locale: SupportedLocale): string {
  if (!status) return '';
  const key = status.toUpperCase().trim();
  const direct = STATUS_TRANSLATIONS[locale]?.[key];
  if (direct) return direct;

  if (locale === 'en' && ARABIC_DATA_FALLBACKS[status]) {
    return ARABIC_DATA_FALLBACKS[status];
  }

  // Format unknown uppercase keys as human-readable English
  if (locale === 'en') {
    return key
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return status;
}

export function translateRole(role: string | undefined | null, locale: SupportedLocale): string {
  if (!role) return '';
  const key = role.toUpperCase().trim();
  const direct = ROLE_TRANSLATIONS[locale]?.[key];
  if (direct) return direct;

  if (locale === 'en' && ARABIC_DATA_FALLBACKS[role]) {
    return ARABIC_DATA_FALLBACKS[role];
  }

  if (locale === 'en') {
    return key
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return role;
}

export function translateSport(sport: string | undefined | null, locale: SupportedLocale): string {
  if (!sport) return '';
  const key = sport.toUpperCase().trim();
  const direct = SPORT_TRANSLATIONS[locale]?.[key];
  if (direct) return direct;

  if (locale === 'en' && ARABIC_DATA_FALLBACKS[sport]) {
    return ARABIC_DATA_FALLBACKS[sport];
  }

  return sport;
}

export function translatePaymentMethod(method: string | undefined | null, locale: SupportedLocale): string {
  if (!method) return '';
  const key = method.toUpperCase().trim();
  const direct = PAYMENT_METHOD_TRANSLATIONS[locale]?.[key];
  if (direct) return direct;

  if (locale === 'en' && ARABIC_DATA_FALLBACKS[method]) {
    return ARABIC_DATA_FALLBACKS[method];
  }

  return method;
}

export function translateBillingCycle(cycle: string | undefined | null, locale: SupportedLocale): string {
  if (!cycle) return '';
  const key = cycle.toUpperCase().trim();
  const direct = BILLING_CYCLE_TRANSLATIONS[locale]?.[key];
  if (direct) return direct;

  if (locale === 'en' && ARABIC_DATA_FALLBACKS[cycle]) {
    return ARABIC_DATA_FALLBACKS[cycle];
  }

  return cycle;
}

export function translateGender(gender: string | undefined | null, locale: SupportedLocale): string {
  if (!gender) return '';
  const key = gender.toUpperCase().trim();
  const direct = GENDER_TRANSLATIONS[locale]?.[key];
  if (direct) return direct;

  if (locale === 'en' && ARABIC_DATA_FALLBACKS[gender]) {
    return ARABIC_DATA_FALLBACKS[gender];
  }

  return gender;
}

export function translateDataString(value: string | undefined | null, locale: SupportedLocale): string {
  if (!value) return '';
  if (locale === 'ar') return value;

  // Direct fallback lookup
  if (ARABIC_DATA_FALLBACKS[value]) {
    return ARABIC_DATA_FALLBACKS[value];
  }

  // Check known enum translations
  const upper = value.toUpperCase().trim();
  if (STATUS_TRANSLATIONS.en[upper]) return STATUS_TRANSLATIONS.en[upper];
  if (ROLE_TRANSLATIONS.en[upper]) return ROLE_TRANSLATIONS.en[upper];
  if (SPORT_TRANSLATIONS.en[upper]) return SPORT_TRANSLATIONS.en[upper];
  if (PAYMENT_METHOD_TRANSLATIONS.en[upper]) return PAYMENT_METHOD_TRANSLATIONS.en[upper];
  if (BILLING_CYCLE_TRANSLATIONS.en[upper]) return BILLING_CYCLE_TRANSLATIONS.en[upper];
  if (GENDER_TRANSLATIONS.en[upper]) return GENDER_TRANSLATIONS.en[upper];
  if (EVALUATION_CATEGORY_TRANSLATIONS.en[upper]) return EVALUATION_CATEGORY_TRANSLATIONS.en[upper];
  if (PLAN_CODE_TRANSLATIONS.en[upper]) return PLAN_CODE_TRANSLATIONS.en[upper];

  // If the string starts with Arabic characters but has known partial replacements:
  for (const [arKey, enVal] of Object.entries(ARABIC_DATA_FALLBACKS)) {
    if (value.includes(arKey)) {
      return value.replaceAll(arKey, enVal);
    }
  }

  return value;
}
