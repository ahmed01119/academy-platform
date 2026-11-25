import { describe, expect, it } from 'vitest';
import { localizeNotification } from './localize-notification';

describe('localizeNotification', () => {
  it('keeps English as stored', () => {
    const n = {
      title: 'Training cancelled',
      body: 'U14: the session on 2026-12-01 (18:00-19:30) is cancelled.',
    };
    expect(localizeNotification(n, 'en')).toBe(n);
  });

  it('translates timetable changes with their dates, times and reason', () => {
    expect(
      localizeNotification(
        {
          title: 'Training cancelled',
          body: 'U14 Elite: the session on 2026-12-01 (18:00-19:30) is cancelled. Reason: Rain',
        },
        'ar',
      ),
    ).toEqual({
      title: 'إلغاء حصة تدريبية',
      body: 'U14 Elite: تم إلغاء حصة 2026-12-01 (18:00-19:30). السبب: Rain',
    });
    expect(
      localizeNotification(
        {
          title: 'Weekly training time changed',
          body: 'U14: training moves from Monday 18:00-19:30 to Tuesday 18:30-20:00, every week.',
        },
        'ar',
      ).body,
    ).toBe('U14: تم نقل التمرين من الإثنين 18:00-19:30 إلى الثلاثاء 18:30-20:00، كل أسبوع.');
  });

  it('translates join requests and academy applications', () => {
    expect(
      localizeNotification(
        {
          title: 'New Player Join Request',
          body: '"Omar Ali" submitted a join request for review (by guardian Ali).',
        },
        'ar',
      ),
    ).toEqual({
      title: 'طلب انضمام لاعب جديد',
      body: 'طلب انضمام جديد لـ"Omar Ali" للمراجعة (من ولي الأمر Ali).',
    });
    expect(
      localizeNotification(
        {
          title: 'Academy Application Update',
          body: 'Your application for "Stars" was reviewed: Missing papers',
        },
        'ar',
      ).body,
    ).toBe('تمت مراجعة طلب "Stars": Missing papers');
  });

  it('shows unknown texts as stored', () => {
    expect(localizeNotification({ title: 'Something new', body: 'Hello' }, 'ar')).toEqual({
      title: 'Something new',
      body: 'Hello',
    });
  });
});
