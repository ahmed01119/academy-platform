'use client';

import React from 'react';
import { useLocale } from '@/contexts/locale-context';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { PlatformAcademyItem } from '@academy/shared';

export interface ChangePlanModalProps {
  academy: PlatformAcademyItem | null;
  selectedPlanCode: 'STARTER' | 'PRO' | 'ENTERPRISE' | 'CUSTOM';
  onPlanCodeChange: (code: 'STARTER' | 'PRO' | 'ENTERPRISE' | 'CUSTOM') => void;
  onSave: () => Promise<void> | void;
  onClose: () => void;
  isLoading?: boolean;
}

export function ChangePlanModal({
  academy,
  selectedPlanCode,
  onPlanCodeChange,
  onSave,
  onClose,
  isLoading = false,
}: ChangePlanModalProps) {
  const { t, locale } = useLocale();
  const isAr = locale === 'ar';

  if (!academy) return null;

  return (
    <Modal
      isOpen={Boolean(academy)}
      onClose={onClose}
      title={isAr ? 'تعديل باقة الأكاديمية' : 'Change Academy Plan'}
      description={`${academy.name} (${academy.slug})`}
      size="md"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-(--text-main)">
            {isAr ? 'خطة الاشتراك التجارية' : 'Commercial Plan'}
          </label>
          <select
            value={selectedPlanCode}
            onChange={(e) =>
              onPlanCodeChange(e.target.value as 'STARTER' | 'PRO' | 'ENTERPRISE' | 'CUSTOM')
            }
            className="w-full px-3.5 py-2.5 rounded-xl bg-(--bg-surface-subtle) border border-(--border-subtle) text-sm text-(--text-main) font-medium focus:border-(--accent-primary) focus:outline-none"
          >
            <option value="STARTER">STARTER (1 Branch / 50 Players)</option>
            <option value="PRO">PRO (5 Branches / 250 Players / Cashiering)</option>
            <option value="ENTERPRISE">ENTERPRISE (25 Branches / 2000 Players)</option>
            <option value="CUSTOM">CUSTOM (Bespoke Negotiated SLA)</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-(--border-subtle)">
          <Button type="button" variant="ghost" onClick={onClose}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void onSave()}
            isLoading={isLoading}
          >
            {isLoading
              ? t('common.loading', isAr ? 'جارٍ الحفظ...' : 'Saving...')
              : t('common.save', isAr ? 'حفظ' : 'Save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
