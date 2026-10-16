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
  { label: 'إجمالي اللاعبين', detail: 'سيظهر بعد إضافة اللاعبين', accent: 'border-violet-400/40' },
  { label: 'حضور اليوم', detail: 'مرتبط بالحصص المسجلة', accent: 'border-emerald-400/40' },
  {
    label: 'اشتراكات تحتاج متابعة',
    detail: 'يظهر بعد تفعيل الاشتراكات',
    accent: 'border-amber-400/40',
  },
  { label: 'تحصيلات اليوم', detail: 'يظهر بعد تفعيل المدفوعات', accent: 'border-sky-400/40' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f3f6fa] text-[#172a3d]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="w-full shrink-0 bg-[#11283e] p-5 text-white lg:min-h-screen lg:w-64">
          <div className="flex items-center gap-3 border-b border-white/15 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl">
              ⚽
            </div>
            <div>
              <p className="font-bold">Academy Platform</p>
              <p className="text-xs text-slate-300">إدارة الأكاديميات الرياضية</p>
            </div>
          </div>
          <nav aria-label="القائمة الرئيسية" className="mt-5 flex gap-2 overflow-x-auto lg:flex-col">
            {navigation.map((item, index) => (
              <span
                key={item}
                aria-current={index === 0 ? 'page' : undefined}
                className={`shrink-0 rounded-xl px-4 py-3 text-sm ${
                  index === 0 ? 'bg-[#2363aa] font-semibold text-white' : 'text-slate-300'
                }`}
              >
                {item}
              </span>
            ))}
          </nav>
          <p className="mt-6 hidden text-xs leading-6 text-slate-400 lg:block">
            القائمة معاينة للهيكل القادم. الصفحات تحتاج تسجيل دخول وصلاحيات قبل تفعيلها.
          </p>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-5 md:px-8">
            <div>
              <p className="text-xs font-medium text-slate-500">مساحة عمل الأكاديمية</p>
              <h1 className="text-xl font-bold">لوحة التحكم</h1>
            </div>
            <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900">
              معاينة تصميم — بدون بيانات حقيقية
            </span>
          </header>

          <div className="space-y-6 p-5 md:p-8">
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#143e57] via-[#165e61] to-[#16816a] p-7 text-white md:p-10">
              <div className="absolute -left-8 -top-12 h-44 w-44 rounded-full border-[30px] border-white/10" />
              <div className="relative">
                <p className="mb-3 text-sm text-emerald-100">إدارة أبسط. متابعة أدق.</p>
                <h2 className="text-2xl font-bold md:text-4xl">كل تفاصيل أكاديميتك في مكان واحد</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50">
                  الحصص والحضور واللاعبون والاشتراكات والتقارير، بواجهة عربية واضحة
                  مصممة للاستقبال والمدربين والإدارة.
                </p>
              </div>
            </section>

            <section aria-label="مؤشرات الأكاديمية" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaries.map((item) => (
                <article
                  key={item.label}
                  className={`rounded-2xl border-t-4 bg-white p-5 shadow-sm ${item.accent}`}
                >
                  <h3 className="text-sm font-semibold text-slate-600">{item.label}</h3>
                  <p className="mt-4 text-sm text-slate-400">{item.detail}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-5">
              <article className="rounded-2xl bg-[#12344e] p-6 text-white xl:col-span-2">
                <p className="text-sm font-semibold text-cyan-200">أهم عملية يومية</p>
                <h2 className="mt-3 text-2xl font-bold">تسجيل حضور سريع</h2>
                <p className="mt-3 text-sm leading-7 text-slate-200">
                  اختر الحصة، ابحث عن اللاعب، وسجّل حالته بلمسة واحدة. النظام القادم
                  سيدعم منع التكرار، تصحيح الأخطاء بسجل تدقيق، وإغلاق الحصة.
                </p>
                <div className="mt-6 rounded-xl border border-white/20 bg-white/10 p-4 text-sm">
                  يبدأ التفعيل بعد بناء المستخدمين واللاعبين والحصص والصلاحيات.
                </div>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">حصص اليوم</h2>
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                    لا توجد بيانات تجريبية مزيفة
                  </span>
                </div>
                <div className="mt-6 flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <p className="font-semibold">ستظهر الحصص هنا بعد إعداد الأكاديمية</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    مع عدد المتوقع حضورهم، الحاضرين، المتأخرين، الغائبين، والحالات غير المسجلة.
                  </p>
                </div>
              </article>
            </section>
            <p className="text-xs leading-6 text-slate-500">
              هذه واجهة تأسيسية للمنتج وليست نظام حضور أو تحصيلات متصلًا بقاعدة البيانات.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
