import { describe, expect, it } from 'vitest';
import {
  translateStatus,
  translateRole,
  translateSport,
  translatePaymentMethod,
  translateBillingCycle,
  translateGender,
  translateDataString,
} from './data-translator';

describe('Data Translator Module', () => {
  it('translates status enums accurately in both en and ar modes', () => {
    expect(translateStatus('ACTIVE', 'en')).toBe('Active');
    expect(translateStatus('ACTIVE', 'ar')).toBe('نشط');

    expect(translateStatus('PRESENT', 'en')).toBe('Present');
    expect(translateStatus('PRESENT', 'ar')).toBe('حاضر');

    expect(translateStatus('LATE', 'en')).toBe('Late');
    expect(translateStatus('LATE', 'ar')).toBe('متأخر');

    expect(translateStatus('ABSENT', 'en')).toBe('Absent');
    expect(translateStatus('ABSENT', 'ar')).toBe('غائب');

    expect(translateStatus('OVERDUE', 'en')).toBe('Overdue');
    expect(translateStatus('OVERDUE', 'ar')).toBe('متأخر سداده');
  });

  it('translates role enums accurately in both en and ar modes', () => {
    expect(translateRole('OWNER', 'en')).toBe('Academy Owner');
    expect(translateRole('OWNER', 'ar')).toBe('مالك الأكاديمية');

    expect(translateRole('COACH', 'en')).toBe('Certified Coach');
    expect(translateRole('COACH', 'ar')).toBe('مدرب معتمد');

    expect(translateRole('ACCOUNTANT', 'en')).toBe('Accountant');
    expect(translateRole('ACCOUNTANT', 'ar')).toBe('مسؤول مالي / محاسب');
  });

  it('translates sports accurately', () => {
    expect(translateSport('FOOTBALL', 'en')).toBe('Football (Soccer)');
    expect(translateSport('FOOTBALL', 'ar')).toBe('كرة القدم');

    expect(translateSport('SWIMMING', 'en')).toBe('Swimming');
    expect(translateSport('SWIMMING', 'ar')).toBe('السباحة');
  });

  it('translates payment methods accurately', () => {
    expect(translatePaymentMethod('CASH', 'en')).toBe('Cash');
    expect(translatePaymentMethod('CASH', 'ar')).toBe('نقداً (كاش)');

    expect(translatePaymentMethod('POS', 'en')).toBe('POS Terminal');
    expect(translatePaymentMethod('POS', 'ar')).toBe('نقطة بيع إلكترونية');

    expect(translatePaymentMethod('BANK_TRANSFER', 'en')).toBe('Bank Transfer');
    expect(translatePaymentMethod('BANK_TRANSFER', 'ar')).toBe('تحويل بنكي');
  });

  it('translates billing cycles accurately', () => {
    expect(translateBillingCycle('MONTHLY', 'en')).toBe('Monthly');
    expect(translateBillingCycle('MONTHLY', 'ar')).toBe('شهرياً');

    expect(translateBillingCycle('ANNUAL', 'en')).toBe('Annual');
    expect(translateBillingCycle('ANNUAL', 'ar')).toBe('سنوياً');
  });

  it('translates genders accurately', () => {
    expect(translateGender('MALE', 'en')).toBe('Male');
    expect(translateGender('MALE', 'ar')).toBe('ذكور (بنين)');

    expect(translateGender('FEMALE', 'en')).toBe('Female');
    expect(translateGender('FEMALE', 'ar')).toBe('إناث (بنات)');
  });

  it('translates common database Arabic fallback strings to clean English', () => {
    expect(translateDataString('الفرع الرئيسي', 'en')).toBe('Main Branch');
    expect(translateDataString('فرع المعادي', 'en')).toBe('Maadi Branch');
    expect(translateDataString('فريق البراعم', 'en')).toBe('Juniors Squad');
    expect(translateDataString('حاضر', 'en')).toBe('Present');
    expect(translateDataString('نقدي', 'en')).toBe('Cash');
    expect(translateDataString('كرة القدم', 'en')).toBe('Football');
  });

  it('leaves English strings intact in English mode', () => {
    expect(translateDataString('Main Branch', 'en')).toBe('Main Branch');
    expect(translateDataString('John Doe', 'en')).toBe('John Doe');
  });
});
