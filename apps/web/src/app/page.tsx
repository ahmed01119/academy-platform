const navigation = [
  'نظرة عامة',
  'الحضور والغياب',
  'اللاعبون',
  'المجموعات والحصص',
  'الاشتراكات',
  'المدفوعات',
  'المدربون',
  'التقارير',
  'الإعدادات',
];

const summaries = [
  { label: 'إجمالي اللاعبين', detail: 'سيظهر بعد إضافة اللاعبين' },
  { label: 'حضور اليوم', detail: 'مرتبط بالحصص المسجلة' },
  { label: 'اشتراكات تحتاج متابعة', detail: 'يظهر بعد تفعيل الاشتراكات' },
  { label: 'تحصيلات اليوم', detail: 'يظهر بعد تفعيل المدفوعات' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="bg-slate-900 p-6 text-white lg:min-h-screen lg:w-64">
          <h1 className="text-xl font-bold">⚽ Academy Platform</h1>
          <p className="mt-2 text-sm text-slate-300">إدارة الأكاديميات الرياضية</p>
          <nav aria-label="القائمة الرئيسية" className="mt-8 flex gap-2 lg:flex-col">
            {navigation.map((item, index) => (
              <span
                key={item}
                aria-current={index === 0 ? 'page' : undefined}
                className="shrink-0 rounded-lg bg-slate-800 px-4 py-3 text-sm"
              >
                {item}
              </span>
            ))}
          </nav>
          <p className="mt-8 text-xs text-slate-400">القائمة معاينة وليست روابط مفعلة.</p>
        </aside>
        <div className="min-w-0 flex-1 p-6 md:p-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">لوحة التحكم</h2>
            <span className="rounded-full bg-amber-100 px-4 py-2 text-xs text-amber-900">
              معاينة تصميم — بدون بيانات حقيقية
            </span>
          </header>
          <section className="mt-8 rounded-3xl bg-teal-800 p-8 text-white">
            <p className="text-sm">إدارة أبسط. متابعة أدق.</p>
            <h3 className="mt-3 text-3xl font-bold">كل تفاصيل أكاديميتك في مكان واحد</h3>
            <p className="mt-4 text-sm leading-7">
              الحصص والحضور واللاعبون والاشتراكات والتقارير، بواجهة عربية واضحة.
            </p>
          </section>
          <section aria-label="مؤشرات الأكاديمية" className="mt-6 grid gap-4 sm:grid-cols-2">
            {summaries.map((item) => (
              <article key={item.label} className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="font-semibold">{item.label}</h3>
                <p className="mt-4 text-sm text-slate-500">{item.detail}</p>
              </article>
            ))}
          </section>
          <section className="mt-6 grid gap-5 xl:grid-cols-2">
            <article className="rounded-2xl bg-slate-800 p-6 text-white">
              <h3 className="text-xl font-bold">تسجيل حضور سريع</h3>
              <p className="mt-4 text-sm leading-7">
                اختر الحصة وابحث عن اللاعب وسجل حالته بلمسة واحدة.
              </p>
            </article>
            <article className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold">حصص اليوم</h3>
              <p className="mt-4 text-sm text-slate-500">
                ستظهر الحصص هنا بعد إعداد الأكاديمية. لا توجد بيانات تجريبية مزيفة.
              </p>
            </article>
          </section>
          <p className="mt-6 text-xs text-slate-500">
            هذه واجهة تأسيسية وليست نظام حضور متصلًا بقاعدة البيانات.
          </p>
        </div>
      </div>
    </main>
  );
}
