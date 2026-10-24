'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { canAccessAdminRoutes, getRoleHomeRoute } from '../../lib/role-routing';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api } from '../../lib/api-client';
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
      const msg = err instanceof Error ? err.message : 'فشل تحميل الفروع';
      setErrorMessage(msg);
    } finally {
      setIsFetching(false);
    }
  }, [user, activeTenant]);

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
      setErrorMessage('يرجى إدخال اسم الفرع');
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
      setSuccessMessage('تم إنشاء الفرع بنجاح');
      setIsCreateModalOpen(false);
      await loadBranches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إنشاء الفرع';
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
      setErrorMessage('يرجى إدخال اسم الفرع');
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
      setSuccessMessage('تم تحديث بيانات الفرع بنجاح');
      setIsEditModalOpen(false);
      await loadBranches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحديث الفرع';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
        </div>
      </AppShell>
    );
  }

  if (!user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[{ label: 'الرئيسية', href: '/dashboard' }, { label: 'الفروع' }]}
          title="إدارة الفروع التشغيلية"
          description="إدارة مقرات الأكاديمية والملاعب المتاحة وسعة كل فرع وقيد اللاعبين."
          badge={
            <span className="rounded-full bg-[var(--brand-primary)]/15 px-2.5 py-0.5 text-xs font-semibold text-[var(--brand-primary)] border border-[var(--brand-primary)]/30">
              إجمالي {branches.length} فرع
            </span>
          }
          actions={
            <button
              type="button"
              id="btn-create-branch-modal"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة فرع جديد</span>
            </button>
          }
        />

        {/* Alerts */}
        {errorMessage && (
          <div className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 p-4 text-xs text-[#fca5a5] flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-[#ef4444]" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-[#2f9e6b]/40 bg-[#2f9e6b]/10 p-4 text-xs text-[#45c387] flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#45c387]" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* Branches Grid */}
        {isFetching ? (
          <div className="py-20 text-center text-[#9bb5a8]">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#2f9e6b] mb-2" />
            <p className="text-xs">جارٍ تحميل الفروع...</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="py-20 text-center text-[var(--text-muted)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded-2xl">
            <Building className="h-12 w-12 mx-auto text-[var(--border-subtle)] mb-3" />
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
              لا توجد فروع مسجلة بعد
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mb-5">
              قم بإنشاء الفرع الأول للأكاديمية لتبدأ في تسجيل المدربين واللاعبين به.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة فرع</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((b) => {
              const activeCount = b.activePlayersCount || 0;
              const capacityVal = b.capacity || 0;
              const utilization =
                capacityVal > 0 ? Math.min(100, Math.round((activeCount / capacityVal) * 100)) : 0;

              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4 hover:border-[var(--brand-primary)]/50 transition-all shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[var(--text-primary)] text-base">
                            {b.name}
                          </h3>
                          {b.code && (
                            <span className="rounded bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-mono text-[var(--brand-primary)] border border-[var(--border-subtle)]">
                              {b.code}
                            </span>
                          )}
                        </div>
                        {b.city && (
                          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3 text-[var(--brand-primary)]" />
                            <span>{b.city}</span>
                            {b.address && <span>• {b.address}</span>}
                          </div>
                        )}
                      </div>

                      <StatusBadge status={b.status} />
                    </div>

                    {b.phone && (
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 font-mono">
                        <Phone className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                        <span>{b.phone}</span>
                      </div>
                    )}

                    {/* Capacity Indicator */}
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)] flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-blue-500" />
                          اللاعبين المشتركين:
                        </span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {activeCount}{' '}
                          {capacityVal > 0 ? (
                            <span className="text-[var(--text-muted)] font-normal">
                              / {capacityVal}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] text-[10px] font-normal">
                              (غير محدد السعة)
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
                                    : 'bg-[var(--brand-primary)]'
                              }`}
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] text-left mt-1">
                            نسبة الإشغال: {utilization}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <Link
                      href={`/players?branchId=${b.id}`}
                      className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                    >
                      عرض لاعبي الفرع
                    </Link>

                    <button
                      type="button"
                      id={`btn-edit-branch-${b.id}`}
                      onClick={() => openEditModal(b)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>تعديل</span>
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
                <h3 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
                  <Plus className="h-5 w-5 text-[var(--brand-primary)]" />
                  إضافة فرع جديد للأكاديمية
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      اسم الفرع *
                    </label>
                    <input
                      type="text"
                      required
                      id="input-create-branch-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: فرع التجمع الخامس"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      كود الفرع (Code)
                    </label>
                    <input
                      type="text"
                      id="input-create-branch-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="TAGAMO"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      المدينة
                    </label>
                    <input
                      type="text"
                      id="input-create-branch-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="القاهرة"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      السعة الاستيعابية (لاعب)
                    </label>
                    <input
                      type="number"
                      id="input-create-branch-capacity"
                      value={capacity}
                      onChange={(e) =>
                        setCapacity(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                      }
                      placeholder="مثال: 150"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    العنوان التفصيلي
                  </label>
                  <input
                    type="text"
                    id="input-create-branch-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="شارع التسعين، مجمع الملاعب الأولمبية"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    هاتف الفرع
                  </label>
                  <input
                    type="tel"
                    id="input-create-branch-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+201012345678"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-create-branch"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-5 py-2 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSubmitting ? 'جارٍ الحفظ...' : 'إنشاء الفرع'}</span>
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
                <h3 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
                  <Edit2 className="h-5 w-5 text-[var(--brand-primary)]" />
                  تعديل بيانات الفرع
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      اسم الفرع *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      كود الفرع (Code)
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      المدينة
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      السعة الاستيعابية
                    </label>
                    <input
                      type="number"
                      value={capacity}
                      onChange={(e) =>
                        setCapacity(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                      }
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    العنوان
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      الهاتف
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      حالة الفرع
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as BranchStatus)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                    >
                      <option value="ACTIVE">نشط (Active)</option>
                      <option value="INACTIVE">غير نشط (Inactive)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-update-branch"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-5 py-2 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSubmitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
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
