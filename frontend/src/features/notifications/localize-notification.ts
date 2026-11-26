/**
 * Notifications are stored in one language (mostly English) when they are created; this shows them in the page
 * language. Known titles are translated, and known body texts are rebuilt from the values they carry (names, dates,
 * reasons). Anything unknown is shown as stored.
 */
type Locale = 'ar' | 'en';

const TITLES: Record<string, string> = {
  'New Academy Application': 'طلب تسجيل أكاديمية جديد',
  'Academy Approved & Ready': 'تم اعتماد الأكاديمية',
  'Academy Application Update': 'تحديث على طلب الأكاديمية',
  'Additional Information Required': 'مطلوب معلومات إضافية',
  'Academy applicant replied': 'صاحب طلب الأكاديمية أرسل الرد',
  'New Player Join Request': 'طلب انضمام لاعب جديد',
  'Join Request Approved': 'تم قبول طلب الانضمام',
  'Join Request Update': 'تحديث على طلب الانضمام',
  'Guardian account linked': 'تم ربط حساب ولي أمر',
  'Guardian link approved': 'تمت الموافقة على الربط',
  'Guardian link declined': 'تم رفض طلب الربط',
  'Training cancelled': 'إلغاء حصة تدريبية',
  'Training moved': 'تغيير موعد حصة',
  'Extra training': 'حصة إضافية',
  'Training schedule updated': 'تحديث جدول التدريب',
  'Weekly training time changed': 'تغيير الموعد الأسبوعي الثابت',
  'Suspicious Login': 'تسجيل دخول مريب',
  Expense: 'مصروف',
};

const DAYS: Record<string, string> = {
  Sunday: 'الأحد',
  Monday: 'الإثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة',
  Saturday: 'السبت',
};
const day = (d: string) => DAYS[d] ?? d;
const reason = (r?: string) => (r ? ` السبب: ${r}` : '');

/** [pattern, Arabic text from the captured values] */
const BODIES: Array<[RegExp, (m: string[]) => string]> = [
  [
    /^"(.+)" submitted a registration application for review\.$/,
    (m) => `أكاديمية "${m[1]}" قدّمت طلب تسجيل للمراجعة.`,
  ],
  [
    /^Congratulations! Your academy application for "(.+)" has been approved and activated\.$/,
    (m) => `مبروك! تم اعتماد طلب أكاديمية "${m[1]}" وتفعيلها.`,
  ],
  [/^Your application for "(.+)" was reviewed: (.*)$/s, (m) => `تمت مراجعة طلب "${m[1]}": ${m[2]}`],
  [
    /^Additional details required for "(.+)": (.*)$/s,
    (m) => `مطلوب بيانات إضافية لطلب "${m[1]}": ${m[2]}`,
  ],
  [
    /^"(.+)" answered the requested details and is waiting for review again\.$/,
    (m) => `أكاديمية "${m[1]}" أرسلت البيانات المطلوبة والطلب في انتظار المراجعة.`,
  ],
  [
    /^"(.+)" submitted a join request for review \(by guardian (.+)\)\.$/,
    (m) => `طلب انضمام جديد لـ"${m[1]}" للمراجعة (من ولي الأمر ${m[2]}).`,
  ],
  [
    /^"(.+)" submitted a join request for review\.$/,
    (m) => `طلب انضمام جديد لـ"${m[1]}" للمراجعة.`,
  ],
  [
    /^Your request to join the academy for "(.+)" has been approved!$/,
    (m) => `تم قبول طلب انضمام "${m[1]}" للأكاديمية!`,
  ],
  [
    /^Your join request for "(.+)" was rejected: (.*)$/s,
    (m) => `تم رفض طلب انضمام "${m[1]}": ${m[2]}`,
  ],
  [
    /^"(.+)" is now linked as guardian of "(.+)" \(phone matched, approved by the player\)\.$/,
    (m) => `تم ربط "${m[1]}" كولي أمر لـ"${m[2]}" (الرقم مطابق ووافق اللاعب).`,
  ],
  [
    /^(.+) approved the link\. You can now follow them in your guardian portal \((.+)\)\.$/,
    (m) => `وافق ${m[1]} على الربط. يمكنك الآن متابعته من بوابة ولي الأمر (${m[2]}).`,
  ],
  [
    /^(.+) did not approve the link to your account \((.+)\)\.$/,
    (m) => `لم يوافق ${m[1]} على ربط حسابك (${m[2]}).`,
  ],
  [
    /^(.+): the session on (\S+) \((\S+)\) is cancelled\.(?: Reason: (.*))?$/s,
    (m) => `${m[1]}: تم إلغاء حصة ${m[2]} (${m[3]}).${reason(m[4])}`,
  ],
  [
    /^(.+): the session on (\S+) moves to (\S+) (\S+)\.(?: Reason: (.*))?$/s,
    (m) => `${m[1]}: تم نقل حصة ${m[2]} إلى ${m[3]} ${m[4]}.${reason(m[5])}`,
  ],
  [
    /^(.+): an extra session on (\S+) (\S+)\.(?: Reason: (.*))?$/s,
    (m) => `${m[1]}: حصة إضافية يوم ${m[2]} ${m[3]}.${reason(m[4])}`,
  ],
  [
    /^(.+): the extra session on (\S+) is cancelled\.$/,
    (m) => `${m[1]}: تم إلغاء الحصة الإضافية يوم ${m[2]}.`,
  ],
  [
    /^(.+): the session on (\S+) is back at its usual time\.$/,
    (m) => `${m[1]}: عادت حصة ${m[2]} إلى موعدها المعتاد.`,
  ],
  [
    /^(.+): training moves from (\w+) (\S+) to (\w+) (\S+), every week\.$/,
    (m) => `${m[1]}: تم نقل التمرين من ${day(m[2]!)} ${m[3]} إلى ${day(m[4]!)} ${m[5]}، كل أسبوع.`,
  ],
];

export function localizeNotification(
  notification: { title: string; body: string },
  locale: Locale,
): { title: string; body: string } {
  if (locale !== 'ar') return notification;
  const title = TITLES[notification.title] ?? notification.title;
  for (const [pattern, toArabic] of BODIES) {
    const m = pattern.exec(notification.body);
    if (m) return { title, body: toArabic(m as unknown as string[]) };
  }
  return { title, body: notification.body };
}
