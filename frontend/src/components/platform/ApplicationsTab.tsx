'use client';

import React, { useState } from 'react';
import { useLocale } from '../../lib/locale-context';
import apiClient from '../../lib/api-client';
import { useToast } from '../ui/Toast';
import { Select } from '../ui/Select';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Search,
  Filter,
} from 'lucide-react';
import type { AcademyApplicationItem } from '@academy/shared';

interface ApplicationsTabProps {
  applications: AcademyApplicationItem[];
  onRefresh: () => Promise<void>;
  isLoading: boolean;
}

export function ApplicationsTab({
  applications,
  onRefresh,
  isLoading: _isLoading,
}: ApplicationsTabProps) {
  const { locale } = useLocale();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [reviewingApp, setReviewingApp] = useState<AcademyApplicationItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUESTED'>(
    'APPROVED',
  );
  const [initialPlanCode, setInitialPlanCode] = useState<'STARTER' | 'PRO' | 'ENTERPRISE'>('PRO');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredApplications = applications.filter((app) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      app.academyName.toLowerCase().includes(q) ||
      app.academySlug.toLowerCase().includes(q) ||
      (app.applicantName && app.applicantName.toLowerCase().includes(q)) ||
      app.contactEmail.toLowerCase().includes(q) ||
      (app.city && app.city.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenReview = (app: AcademyApplicationItem) => {
    setReviewingApp(app);
    setReviewStatus('APPROVED');
    setInitialPlanCode('PRO');
    setReviewNotes('');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingApp) return;

    setIsSubmitting(true);
    try {
      await apiClient.platform.reviewAcademyApplication(reviewingApp.id, {
        status: reviewStatus,
        initialPlanCode: initialPlanCode,
        reviewNotes: reviewNotes.trim() || undefined,
      });

      toast.success(
        reviewStatus === 'APPROVED'
          ? locale === 'ar'
            ? 'تم اعتماد الأكاديمية بنجاح وتفعيل بيئة العمل الخاصة بها.'
            : 'Academy application approved and provisioned successfully.'
          : locale === 'ar'
            ? 'تم تحديث حالة الطلب وإرسال الإشعار لمقدم الطلب.'
            : 'Application status updated and applicant notified.',
      );

      setReviewingApp(null);
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        (err as Error)?.message ||
          (locale === 'ar' ? 'فشل تحديث حالة الطلب' : 'Failed to update application'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            {locale === 'ar' ? 'قيد المراجعة' : 'Pending Review'}
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            {locale === 'ar' ? 'معتمد ومُفعل' : 'Approved'}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            {locale === 'ar' ? 'مرفوض' : 'Rejected'}
          </span>
        );
      case 'MORE_INFO_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <HelpCircle className="w-3 h-3" />
            {locale === 'ar' ? 'مطلوب معلومات إضافية' : 'More Info Requested'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              locale === 'ar'
                ? 'بحث باسم الأكاديمية، مقدم الطلب، أو البريد...'
                : 'Search academy name, applicant, or email...'
            }
            className="w-full ps-9 pe-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm text-[var(--text-main)] focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">{locale === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="PENDING_REVIEW">
              {locale === 'ar' ? 'قيد المراجعة' : 'Pending Review'}
            </option>
            <option value="APPROVED">{locale === 'ar' ? 'المعتمدة' : 'Approved'}</option>
            <option value="REJECTED">{locale === 'ar' ? 'المرفوضة' : 'Rejected'}</option>
            <option value="MORE_INFO_REQUESTED">
              {locale === 'ar' ? 'مطلوب معلومات' : 'More Info'}
            </option>
          </select>
        </div>
      </div>

      {/* Applications Cards / Table */}
      {filteredApplications.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <Inbox className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-50 mb-3" />
          <h4 className="text-sm font-bold text-[var(--text-main)]">
            {locale === 'ar' ? 'لا توجد طلبات انضمام' : 'No applications found'}
          </h4>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {locale === 'ar'
              ? 'تظهر هنا جميع طلبات إنشاء الأكاديميات الواردة من الصفحة العامة للمراجعة والاعتماد.'
              : 'Academy registration requests submitted via the public landing page appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredApplications.map((app) => (
            <div
              key={app.id}
              className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm hover:border-[var(--border-app)] transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                      {app.academyName}
                      <span className="text-xs font-mono font-normal text-[var(--text-muted)]">
                        ({app.academySlug})
                      </span>
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> {app.applicantName}
                      </span>
                      {app.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {app.city}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(app.status)}
                  {app.status !== 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => handleOpenReview(app)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      {app.status === 'REJECTED'
                        ? locale === 'ar'
                          ? 'إعادة النظر والاعتماد'
                          : 'Reconsider Application'
                        : app.status === 'MORE_INFO_REQUESTED'
                          ? locale === 'ar'
                            ? 'مراجعة التحديث'
                            : 'Review Update'
                          : locale === 'ar'
                            ? 'مراجعة واعتماد'
                            : 'Review & Decide'}
                    </button>
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{app.contactEmail}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>{app.contactPhone || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {new Date(app.createdAt).toLocaleDateString(
                      locale === 'ar' ? 'ar-EG' : 'en-US',
                      { dateStyle: 'medium' },
                    )}
                  </span>
                </div>
              </div>

              {app.notes && (
                <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] text-xs text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text-main)] block mb-0.5">
                    {locale === 'ar' ? 'ملاحظات مقدم الطلب:' : 'Applicant Notes:'}
                  </span>
                  {app.notes}
                </div>
              )}

              {app.reviewNotes && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                  <span className="font-semibold block mb-0.5">
                    {locale === 'ar' ? 'ملاحظات المراجعة والقرار:' : 'Review Notes:'}
                  </span>
                  {app.reviewNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewingApp && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setReviewingApp(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border-app)] bg-[var(--bg-card)] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-main)]">
                {locale === 'ar' ? 'مراجعة طلب تأسيس أكاديمية' : 'Review Academy Application'}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {reviewingApp.academyName} ({reviewingApp.academySlug})
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Decision radio */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-main)]">
                  {locale === 'ar' ? 'القرار الإداري' : 'Administrative Decision'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus('APPROVED')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      reviewStatus === 'APPROVED'
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {locale === 'ar' ? 'اعتماد وإنشاء' : 'Approve'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus('MORE_INFO_REQUESTED')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      reviewStatus === 'MORE_INFO_REQUESTED'
                        ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    {locale === 'ar' ? 'طلب تفاصيل' : 'Need Info'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus('REJECTED')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      reviewStatus === 'REJECTED'
                        ? 'border-rose-500 bg-rose-500/15 text-rose-400'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    {locale === 'ar' ? 'رفض الطلب' : 'Reject'}
                  </button>
                </div>
              </div>

              {/* Initial plan selection if APPROVED */}
              {reviewStatus === 'APPROVED' && (
                <div className="space-y-1.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <label className="text-xs font-semibold text-emerald-400">
                    {locale === 'ar' ? 'الباقة الابتدائية المعتمدة' : 'Assigned Initial SaaS Plan'}
                  </label>
                  <Select
                    value={initialPlanCode}
                    onChange={(val) => setInitialPlanCode(val)}
                    options={[
                      {
                        value: 'STARTER',
                        label: 'STARTER',
                        description:
                          locale === 'ar'
                            ? 'فرع واحد / حتى 50 لاعباً'
                            : '1 Branch / up to 50 players',
                      },
                      {
                        value: 'PRO',
                        label:
                          locale === 'ar' ? 'PRO (موصى بها للنمو)' : 'PRO (Recommended for Growth)',
                        description:
                          locale === 'ar'
                            ? '5 فروع / 250 لاعباً / نقطة تحصيل'
                            : '5 Branches / 250 players / Cashiering',
                      },
                      {
                        value: 'ENTERPRISE',
                        label: 'ENTERPRISE',
                        description:
                          locale === 'ar'
                            ? '25 فرعاً / حتى 2000 لاعب / تقارير متقدمة'
                            : '25 Branches / 2000 players / Advanced Analytics',
                      },
                    ]}
                    aria-label={
                      locale === 'ar' ? 'الباقة الابتدائية المعتمدة' : 'Assigned Initial SaaS Plan'
                    }
                  />
                  <p className="text-[11px] text-emerald-300/80 pt-1">
                    {locale === 'ar'
                      ? 'عند الاعتماد، سيتم إنشاء المستأجر وحساب المالك والفرع الرئيسي تلقائياً.'
                      : 'Upon approval, tenant workspace, owner account, and main branch are automatically provisioned.'}
                  </p>
                </div>
              )}

              {/* Review notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-main)]">
                  {locale === 'ar'
                    ? 'ملاحظات المراجعة (تُرسل لمقدم الطلب)'
                    : 'Decision Notes (sent to applicant)'}
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={
                    locale === 'ar'
                      ? 'أدخل أي ملاحظات أو توجيهات لمقدم الطلب...'
                      : 'Enter optional guidance or rationale for the applicant...'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setReviewingApp(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--bg-card-hover)] text-[var(--text-muted)]"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  {isSubmitting
                    ? locale === 'ar'
                      ? 'جاري الحفظ والإنشاء...'
                      : 'Processing...'
                    : locale === 'ar'
                      ? 'حفظ القرار وتطبيقه'
                      : 'Apply Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
