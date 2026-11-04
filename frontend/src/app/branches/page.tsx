'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { translateDataString } from '@/utils/data-translator';
import { canAccessAdminRoutes, getRoleHomeRoute } from '@/utils/role-routing';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api } from '@/api/client';
import type {
  BranchStatus,
  BranchSummary,
  CreateBranchRequest,
  UpdateBranchRequest,
} from '@academy/shared';
import {
  Plus,
  MapPin,
  Phone,
  Users,
  Edit2,
  RefreshCw,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Building,
} from 'lucide-react';

export default function BranchesPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();
  const { locale, t } = useLocale();
  const ar = locale === 'ar';

  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchSummary | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [status, setStatus] = useState<BranchStatus>('ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!canAccessAdminRoutes(user, activeTenant)) {
        router.push(getRoleHomeRoute(user, activeTenant));
      }
    }
  }, [user, activeTenant, isLoading, router]);

  const loadBranches = useCallback(async () => {
    if (!user || !activeTenant) return;
    setIsFetching(true);
    try {
      const data = await api.branches.list();
      setBranches(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ar ? 'فشل تحميل الفروع' : 'Failed to load branches';
      setErrorMessage(msg);
    } finally {
      setIsFetching(false);
    }
  }, [user, activeTenant, ar]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const openCreateModal = () => {
    setName('');
    setCode('');
    setCity('');
    setAddress('');
    setPhone('');
    setCapacity('');
    setStatus('ACTIVE');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (branch: BranchSummary) => {
    setEditingBranch(branch);
    setName(branch.name);
    setCode(branch.code || '');
    setCity(branch.city || '');
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setCapacity(branch.capacity ?? '');
    setStatus(branch.status);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage(ar ? 'يرجى إدخال اسم الفرع' : 'Please enter branch name');
      return;
    }

    setIsSubmitting(true);
    try {
      const generatedCode = (
        code.trim() || name.trim().replace(/\s+/g, '_').slice(0, 10)
      ).toUpperCase();

      const payload: CreateBranchRequest = {
        name: name.trim(),
        code: generatedCode,
        city: city.trim() || undefined,
        country: 'EG',
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        capacity: capacity === '' ? undefined : Number(capacity),
      };

      await api.branches.create(payload);
      setSuccessMessage(ar ? 'تم إنشاء الفرع بنجاح' : 'Branch created successfully');
      setIsCreateModalOpen(false);
      await loadBranches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ar ? 'فشل إنشاء الفرع' : 'Failed to create branch';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage(ar ? 'يرجى إدخال اسم الفرع' : 'Please enter branch name');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: UpdateBranchRequest = {
        name: name.trim(),
        code: code.trim() || undefined,
        city: city.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        capacity: capacity === '' ? null : Number(capacity),
        status,
      };

      await api.branches.update(editingBranch.id, payload);
      setSuccessMessage(ar ? 'تم تحديث بيانات الفرع بنجاح' : 'Branch updated successfully');
      setIsEditModalOpen(false);
      await loadBranches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ar ? 'فشل تحديث الفرع' : 'Failed to update branch';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
        </div>
      </AppShell>
    );
  }

  if (!user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: t('common.home', 'الرئيسية'), href: '/dashboard' },
            { label: t('nav.branches', 'الفروع') },
          ]}
          title={ar ? 'إدارة الفروع والملاعب' : 'Operational Branches & Grounds'}
          description={
            ar
              ? 'إدارة مقرات الأكاديمية والملاعب المتاحة وسعة كل فرع وقيد اللاعبين.'
              : 'Manage academy sites, grounds, capacity limits, and player rosters.'
          }
          badge={
            <span className="rounded-full bg-[var(--accent-primary)]/15 px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
              {ar ? `إجمالي ${branches.length} فرع` : `Total: ${branches.length} Branches`}
            </span>
          }
          actions={
            <button
              type="button"
              id="btn-create-branch-modal"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{ar ? 'إضافة فرع جديد' : 'Add New Branch'}</span>
            </button>
          }
        />

        {/* Alerts */}
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* Branches Grid */}
        {isFetching ? (
          <div className="py-20 text-center text-[var(--text-muted)]">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[var(--accent-primary)] mb-2" />
            <p className="text-xs">{ar ? 'جارٍ تحميل الفروع...' : 'Loading branches...'}</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="py-20 text-center text-[var(--text-muted)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded-2xl">
            <Building className="h-12 w-12 mx-auto text-[var(--border-subtle)] mb-3" />
            <h3 className="text-base font-bold text-[var(--text-main)] mb-1">
              {ar ? 'لا توجد فروع مسجلة بعد' : 'No Branches Registered Yet'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mb-5">
              {ar
                ? 'قم بإنشاء الفرع الأول للأكاديمية لتبدأ في تسجيل المدربين واللاعبين به.'
                : 'Create the first branch to begin enrolling coaches and players.'}
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{ar ? 'إضافة فرع' : 'Add Branch'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((b) => {
              const activeCount = b.activePlayersCount || 0;
              const capacityVal = b.capacity || 0;
              const utilization =
                capacityVal > 0 ? Math.min(100, Math.round((activeCount / capacityVal) * 100)) : 0;

              const branchDisplayName =
                locale === 'en' ? translateDataString(b.name, 'en') : b.name;
              const cityDisplayName = b.city
                ? locale === 'en'
                  ? translateDataString(b.city, 'en')
                  : b.city
                : null;

              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4 hover:border-[var(--accent-primary)]/50 transition-all shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[var(--text-main)] text-base">
                            {branchDisplayName}
                          </h3>
                          {b.code && (
                            <span className="rounded bg-[var(--bg-surface-subtle)] px-2 py-0.5 text-[10px] font-mono text-[var(--accent-primary)] border border-[var(--border-subtle)]">
                              {b.code}
                            </span>
                          )}
                        </div>
                        {cityDisplayName && (
                          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3 text-[var(--accent-primary)]" />
                            <span>{cityDisplayName}</span>
                            {b.address && <span>• {b.address}</span>}
                          </div>
                        )}
                      </div>

                      <StatusBadge status={b.status} />
                    </div>

                    {b.phone && (
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 font-mono">
                        <Phone className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        <span>{b.phone}</span>
                      </div>
                    )}

                    {/* Capacity Indicator */}
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)] flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-blue-500" />
                          {ar ? 'اللاعبين المشتركين:' : 'Enrolled Players:'}
                        </span>
                        <span className="font-bold text-[var(--text-main)]">
                          {activeCount}{' '}
                          {capacityVal > 0 ? (
                            <span className="text-[var(--text-muted)] font-normal">
                              / {capacityVal}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] text-[10px] font-normal">
                              {ar ? '(غير محدد السعة)' : '(Unlimited)'}
                            </span>
                          )}
                        </span>
                      </div>

                      {capacityVal > 0 && (
                        <div>
                          <div className="w-full bg-[var(--border-subtle)] rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                utilization >= 90
                                  ? 'bg-rose-500'
                                  : utilization >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-[var(--accent-primary)]'
                              }`}
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] text-left mt-1">
                            {ar ? `نسبة الإشغال: ${utilization}%` : `Occupancy: ${utilization}%`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <Link
                      href={`/players?branchId=${b.id}`}
                      className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                    >
                      {ar ? 'عرض لاعبي الفرع' : 'View Branch Players'}
                    </Link>

                    <button
                      type="button"
                      id={`btn-edit-branch-${b.id}`}
                      onClick={() => openEditModal(b)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>{ar ? 'تعديل' : 'Edit'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Add Branch */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
                <h3 className="font-bold text-[var(--text-main)] text-base flex items-center gap-2">
                  <Plus className="h-5 w-5 text-[var(--accent-primary)]" />
                  {ar ? 'إضافة فرع جديد للأكاديمية' : 'Add New Academy Branch'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {ar ? 'اسم الفرع *' : 'Branch Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      id="input-create-branch-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={ar ? 'مثال: فرع التجمع الخامس' : 'e.g. Main Training Center'}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {ar ? 'كود الفرع (Code)' : 'Branch Code'}
                    </label>
                    <input
                      type="text"
                      id="input-create-branch-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="MAIN_01"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {ar ? 'المدينة' : 'City'}
                    </label>
                    <input
                      type="text"
                      id="input-create-branch-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={ar ? 'القاهرة' : 'Cairo'}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {ar ? 'السعة الاستيعابية (لاعب)' : 'Capacity (Players)'}
                    </label>
                    <input
                      type="number"
                      id="input-create-branch-capacity"
                      value={capacity}
                      onChange={(e) =>
                        setCapacity(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                      }
                      placeholder={ar ? 'مثال: 150' : 'e.g. 150'}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    {ar ? 'العنوان التفصيلي' : 'Address Details'}
                  </label>
                  <input
                    type="text"
                    id="input-create-branch-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={ar ? 'شارع التسعين، مجمع الملاعب الأولمبية' : 'Olympic Sports Complex, 90th St.'}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    {ar ? 'هاتف الفرع' : 'Branch Phone'}
                  </label>
                  <input
                    type="tel"
                    id="input-create-branch-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+201012345678"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    {ar ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-create-branch"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-5 py-2 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSubmitting ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : ar ? 'إنشاء الفرع' : 'Create Branch'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Branch */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
                <h3 className="font-bold text-[var(--text-main)] text-base flex items-center gap-2">
                  <Edit2 className="h-5 w-5 text-[var(--accent-primary)]" />
                  {ar ? 'تعديل بيانات الفرع' : 'Edit Branch Details'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {ar ? 'اسم الفرع *' : 'Branch Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {ar ? 'كود الفرع (Code)' : 'Branch Code'}
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {ar ? 'المدينة' : 'City'}
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {ar ? 'السعة الاستيعابية' : 'Capacity'}
                    </label>
                    <input
                      type="number"
                      value={capacity}
                      onChange={(e) =>
                        setCapacity(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                      }
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    {ar ? 'العنوان' : 'Address'}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {ar ? 'الهاتف' : 'Phone'}
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {ar ? 'حالة الفرع' : 'Branch Status'}
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as BranchStatus)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                    >
                      <option value="ACTIVE">{ar ? 'نشط' : 'Active'}</option>
                      <option value="INACTIVE">{ar ? 'غير نشط' : 'Inactive'}</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    {ar ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-update-branch"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-5 py-2 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSubmitting ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : ar ? 'حفظ التعديلات' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
