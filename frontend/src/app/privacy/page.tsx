'use client';

import React from 'react';
import Link from 'next/link';
import { SportexusLogo } from '@/components/brand/SportexusLogo';
import { useLocale } from '@/contexts/locale-context';

/** Public privacy policy (also the policy URL of the platform's Google OAuth client for sending e-mail). */

const CONTACT_EMAIL = 'sportexus.academy@gmail.com';
const LAST_UPDATED = { ar: '28 نوفمبر 2026', en: 'November 28, 2026' };

interface Section {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

const CONTENT: Record<'ar' | 'en', { title: string; intro: string; sections: Section[] }> = {
  ar: {
    title: 'سياسة الخصوصية',
    intro:
      'توضح هذه السياسة البيانات التي تجمعها منصة Sportexus لإدارة الأكاديميات الرياضية، ولماذا نجمعها، ومن يستطيع رؤيتها، وكيف نحميها.',
    sections: [
      {
        title: 'البيانات التي نجمعها',
        items: [
          'بيانات الحساب: الاسم، والبريد الإلكتروني، ورقم الهاتف، وكلمة المرور مشفرة (لا نخزنها كنص أبدًا).',
          'بيانات الأكاديمية: الاسم، والشعار، والفروع، والمجموعات، والمواعيد، والموظفون.',
          'بيانات اللاعبين وأولياء الأمور التي تسجلها الأكاديمية أو يرسلها المستخدم في طلب الانضمام، مثل تاريخ الميلاد، وقد تشمل الرقم القومي والملاحظات الطبية.',
          'الحضور، والتقييمات، والاشتراكات، والمدفوعات وإيصالاتها.',
          'بيانات تقنية لحماية الحسابات، مثل عنوان IP ونوع المتصفح في سجل الأمان.',
        ],
      },
      {
        title: 'لماذا نستخدمها',
        items: [
          'تشغيل الأكاديمية: التسجيل، والمجموعات، والحضور، والتقييمات، والتحصيل.',
          'إرسال رسائل الخدمة بالبريد الإلكتروني: الدعوات، وأكواد التأكيد، واستعادة كلمة المرور، والإيصالات، والإشعارات.',
          'حماية الحسابات ومنع إساءة الاستخدام.',
        ],
        paragraphs: ['لا نبيع البيانات، ولا نستخدمها للإعلانات.'],
      },
      {
        title: 'من يرى البيانات',
        items: [
          'كل أكاديمية ترى بياناتها فقط، والعزل بين الأكاديميات مطبق في قاعدة البيانات نفسها.',
          'داخل الأكاديمية تحدد الصلاحيات من يرى ماذا: المال للمالك فقط، والمدرب يرى مجموعاته فقط، والبيانات الحساسة للاعب لمن لديه صلاحية.',
          'ولي الأمر يرى أبناءه فقط، واللاعب يرى بياناته فقط.',
          'فريق تشغيل المنصة يصل إلى البيانات عند الحاجة للدعم أو الأمان فقط، ويُسجَّل ذلك.',
        ],
      },
      {
        title: 'مقدمو الخدمة',
        paragraphs: [
          'نستضيف المنصة وقاعدة بياناتها لدى مزودي استضافة سحابية. نرسل البريد الإلكتروني من حساب Gmail الخاص بالمنصة عبر واجهة Gmail الرسمية من Google، وتقتصر صلاحية المنصة على إرسال الرسائل فقط، دون قراءة البريد أو الوصول إلى أي بيانات أخرى في الحساب. المدفوعات الإلكترونية تتم عبر Paymob، ولا نخزن بيانات البطاقات.',
        ],
      },
      {
        title: 'الحماية والاحتفاظ',
        paragraphs: [
          'الاتصال مشفر، وكلمات المرور مشفرة، والعمليات الحساسة مسجلة. نحتفظ بالبيانات طوال مدة استخدام الأكاديمية للمنصة. السجلات المالية لا تُحذف، بل تُصحح بقيود عكسية، حفاظًا على سلامتها.',
        ],
      },
      {
        title: 'حقوقك',
        paragraphs: [
          'يمكنك تعديل بيانات حسابك من صفحة الحساب، وطلب نسخة من بياناتك أو حذفها بمراسلة الأكاديمية التابع لها أو مراسلتنا مباشرة.',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    intro:
      'This policy explains what data Sportexus, a platform for managing sports academies, collects, why, who can see it, and how it is protected.',
    sections: [
      {
        title: 'Data we collect',
        items: [
          'Account data: name, e-mail address, phone number, and a hashed password (never stored as plain text).',
          'Academy data: name, logo, branches, groups, schedules and staff.',
          'Player and guardian data entered by the academy or sent in a join request, such as date of birth, and possibly national ID and medical notes.',
          'Attendance, evaluations, subscriptions, payments and their receipts.',
          'Technical data used to protect accounts, such as IP address and browser type in the security log.',
        ],
      },
      {
        title: 'Why we use it',
        items: [
          'Running the academy: registration, groups, attendance, evaluations and fee collection.',
          'Sending service e-mails: invitations, confirmation codes, password resets, receipts and notifications.',
          'Protecting accounts and preventing abuse.',
        ],
        paragraphs: ['We do not sell data and do not use it for advertising.'],
      },
      {
        title: 'Who can see it',
        items: [
          'Each academy sees only its own data; academies are isolated in the database itself.',
          'Within an academy, roles decide who sees what: money is for the owner only, a coach sees only their groups, and sensitive player data needs a specific permission.',
          'A guardian sees only their own children; a player sees only their own data.',
          'The platform team accesses data only when needed for support or security, and such access is logged.',
        ],
      },
      {
        title: 'Service providers',
        paragraphs: [
          "The platform and its database are hosted by cloud providers. E-mail is sent from the platform's Gmail account through Google's official Gmail API; the platform's permission is limited to sending messages and it cannot read mail or access any other data in that account. Online payments go through Paymob; we do not store card details.",
        ],
      },
      {
        title: 'Security and retention',
        paragraphs: [
          'Connections are encrypted, passwords are hashed, and sensitive actions are logged. Data is kept for as long as the academy uses the platform. Financial records are never deleted; they are corrected with reversing entries to keep them intact.',
        ],
      },
      {
        title: 'Your rights',
        paragraphs: [
          'You can edit your account data from the account page, and request a copy or deletion of your data by contacting your academy or us directly.',
        ],
      },
    ],
  },
};

export default function PrivacyPage() {
  const { locale } = useLocale();
  const lang = locale === 'ar' ? 'ar' : 'en';
  const content = CONTENT[lang];

  return (
    <main
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-(--bg-app) px-4 py-10 text-(--text-main)"
    >
      <article className="mx-auto max-w-3xl rounded-2xl border border-(--border-app) bg-[var(--bg-surface)] p-6 sm:p-10">
        <Link href="/" className="inline-block" aria-label="Sportexus">
          <SportexusLogo />
        </Link>
        <h1 className="mt-6 text-2xl font-bold">{content.title}</h1>
        <p className="mt-1 text-xs text-(--text-muted)">
          {lang === 'ar' ? 'آخر تحديث: ' : 'Last updated: '}
          {LAST_UPDATED[lang]}
        </p>
        <p className="mt-4 leading-7">{content.intro}</p>

        {content.sections.map((section) => (
          <section key={section.title} className="mt-6">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {section.items && (
              <ul className="mt-2 list-disc space-y-1 ps-6 leading-7">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.paragraphs?.map((text) => (
              <p key={text} className="mt-2 leading-7">
                {text}
              </p>
            ))}
          </section>
        ))}

        <section className="mt-6">
          <h2 className="text-lg font-semibold">{lang === 'ar' ? 'تواصل معنا' : 'Contact'}</h2>
          <p className="mt-2 leading-7">
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent-primary)] underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
