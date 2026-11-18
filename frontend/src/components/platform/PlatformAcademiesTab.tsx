'use client';

import React, { useMemo, useState } from 'react';
import { useLocale } from '@/contexts/locale-context';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import type { PlatformAcademyItem } from '@academy/shared';
import { Building2, KeyRound, ShieldAlert, Layers } from 'lucide-react';

export interface PlatformAcademiesTabProps {
  academies: PlatformAcademyItem[];
  isLoading: boolean;
  actionLoading: string | null;
  onToggleStatus: (academy: PlatformAcademyItem) => void;
  onSupportAccess: (academy: PlatformAcademyItem) => void;
  onEditPlan: (academy: PlatformAcademyItem) => void;
}

export function PlatformAcademiesTab({
  academies,
  isLoading,
  actionLoading,
  onToggleStatus,
  onSupportAccess,
  onEditPlan,
}: PlatformAcademiesTabProps) {
  const { t, locale } = useLocale();
  const isAr = locale === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredAcademies = useMemo(() => {
    return academies.filter((academy) => {
      const matchesSearch =
        searchQuery === '' ||
        academy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        academy.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || academy.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [academies, searchQuery, statusFilter]);

  const academyColumns: Column<PlatformAcademyItem>[] = [
    {
      header: isAr ? 'الأكاديمية' : 'Academy',
      accessorKey: 'name',
      cell: (item) => (
        <div>
          <div className="font-semibold text-(--text-main)">{item.name}</div>
          <div className="text-xs text-(--text-muted) font-mono">{item.slug}</div>
        </div>
      ),
    },
    {
      header: isAr ? 'خطة الاشتراك' : 'Subscription Plan',
      id: 'plan',
      cell: (item) => {
        const plan = item.planCode || 'PRO';
        const isPro = plan === 'PRO';
        const isEnterprise = plan === 'ENTERPRISE';
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              isEnterprise
                ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                : isPro
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {plan}
          </span>
        );
      },
    },
    {
      header: isAr ? 'الفرع والمشتركين' : 'Branches & Members',
      id: 'usage',
      cell: (item) => (
        <div className="text-xs font-mono text-(--text-muted)">
          <span>
            {item.branchesCount} {isAr ? 'فروع' : item.branchesCount === 1 ? 'branch' : 'branches'}
          </span>
          <span className="mx-1">•</span>
          <span>
            {item.playersCount + item.coachesCount}{' '}
            {isAr ? 'مستخدم' : item.playersCount + item.coachesCount === 1 ? 'member' : 'members'}
          </span>
        </div>
      ),
    },
    {
      header: t('platform.status', 'الحالة'),
      accessorKey: 'status',
      cell: (item) => <StatusBadge status={item.status} />,
    },
    {
      header: isAr ? 'إجراءات الإدارة' : 'Actions',
      id: 'actions',
      cell: (item) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSupportAccess(item)}
            disabled={actionLoading === item.id}
            startIcon={<KeyRound className="w-3.5 h-3.5" />}
          >
            {isAr ? 'دخول الدعم' : 'Support Access'}
          </Button>

          <Button
            size="sm"
            variant={item.status === 'ACTIVE' ? 'danger' : 'outline'}
            onClick={() => onToggleStatus(item)}
            disabled={actionLoading === item.id}
            startIcon={<ShieldAlert className="w-3.5 h-3.5" />}
          >
            {item.status === 'ACTIVE' ? (isAr ? 'إيقاف' : 'Suspend') : isAr ? 'تفعيل' : 'Activate'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEditPlan(item)}
            startIcon={<Layers className="w-3.5 h-3.5" />}
          >
            {isAr ? 'الخطة' : 'Plan'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={
          isAr ? 'بحث باسم الأكاديمية أو المعرف...' : 'Search academy name or slug...'
        }
        filters={[
          {
            id: 'status',
            label: t('platform.status', 'الحالة'),
            value: statusFilter,
            options: [
              { label: t('common.all', 'الكل'), value: 'ALL' },
              { label: t('common.active', 'نشط'), value: 'ACTIVE' },
              { label: t('common.suspended', 'معلق'), value: 'SUSPENDED' },
              { label: t('common.provisioning', 'قيد الاعتماد'), value: 'PROVISIONING' },
            ],
            onChange: setStatusFilter,
          },
        ]}
      />

      <DataTable
        columns={academyColumns}
        data={filteredAcademies}
        isLoading={isLoading}
        keyExtractor={(item) => item.id}
        emptyState={
          <EmptyState
            icon={Building2}
            title={isAr ? 'لا توجد أكاديميات مطابقة' : 'No academies found'}
            description={
              isAr
                ? 'لم يتم العثور على أي أكاديميات تطابق شروط البحث الحالية.'
                : 'Try adjusting your filters or search keywords.'
            }
          />
        }
      />
    </div>
  );
}
