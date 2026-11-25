import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlayerProfileState } from '@/features/players/hooks/usePlayerProfile';
import { TransferBranchModal } from './TransferBranchModal';
import { EditPlayerModal } from './EditPlayerModal';
import { ArchivePlayerModal } from './ArchivePlayerModal';

const noop = () => undefined;

const transfer = {
  isOpen: true,
  open: noop,
  close: noop,
  targetBranchId: '',
  setTargetBranchId: noop,
  transferDate: '2026-11-14',
  setTransferDate: noop,
  notes: '',
  setNotes: noop,
  isSubmitting: false,
  submit: noop,
} as unknown as PlayerProfileState['transfer'];

const edit = {
  isOpen: true,
  open: noop,
  close: noop,
  form: {
    firstName: 'Omar',
    lastName: 'Ali',
    gender: 'MALE',
    birthYear: '2012',
    jerseyNumber: '7',
    nationalId: '29901011234567',
    medicalNotes: 'Asthma',
    guardianName: 'Ali Hassan',
    guardianPhone: '0100000001',
    status: 'ACTIVE',
  },
  error: null,
  update: noop,
  setField: noop,
  isSubmitting: false,
  submit: noop,
} as unknown as PlayerProfileState['edit'];

const archive = {
  isOpen: true,
  isLoadingImpact: false,
  isSubmitting: false,
  open: noop,
  close: noop,
  confirm: noop,
  impact: {
    playerId: 'p1',
    playerName: 'Omar Ali',
    activeEnrollments: 1,
    activeGroupMemberships: 2,
    attendanceRecordsCount: 30,
    financialTransactionsCount: 4,
    warnings: ['Has outstanding balance'],
  },
} as unknown as PlayerProfileState['archive'];

const branches = [
  { id: 'b1', name: 'Main', city: 'Cairo' },
  { id: 'b2', name: 'North', city: null },
] as never;

describe('TransferBranchModal', () => {
  it('is an accessible dialog with labelled fields, localized in English', () => {
    const html = renderToStaticMarkup(
      <TransferBranchModal
        transfer={transfer}
        branches={branches}
        currentBranchId="b1"
        isAr={false}
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby="transfer-branch-title"');
    expect(html).toContain('Transfer Athlete to Another Branch');
    expect(html).toContain('for="select-target-branch"');
    expect(html).toContain('aria-label="Close"');
    expect(html).not.toMatch(/الفرع المستهدف|تاريخ النقل الفعلي/); // no leftover Arabic in EN mode
  });

  it('keeps the original Arabic and excludes the current branch from targets', () => {
    const html = renderToStaticMarkup(
      <TransferBranchModal transfer={transfer} branches={branches} currentBranchId="b1" isAr />,
    );
    expect(html).toContain('نقل اللاعب إلى فرع آخر');
    expect(html).toContain('الفرع المستهدف *');
    expect(html).toContain('North');
    expect(html).not.toContain('>Main');
  });

  it('renders nothing when closed', () => {
    expect(
      renderToStaticMarkup(
        <TransferBranchModal
          transfer={{ ...transfer, isOpen: false }}
          branches={branches}
          currentBranchId="b1"
          isAr
        />,
      ),
    ).toBe('');
  });
});

describe('EditPlayerModal', () => {
  it('shows national ID and medical notes only with sensitive access', () => {
    const allowed = renderToStaticMarkup(
      <EditPlayerModal edit={edit} canViewSensitive isAr={false} />,
    );
    expect(allowed).toContain('id="edit-medical-notes"');
    expect(allowed).toContain('Asthma');

    const restricted = renderToStaticMarkup(
      <EditPlayerModal edit={edit} canViewSensitive={false} isAr={false} />,
    );
    expect(restricted).not.toContain('id="edit-medical-notes"');
    expect(restricted).not.toContain('id="edit-national-id"');
    expect(restricted).not.toContain('Asthma');
    expect(restricted).not.toContain('29901011234567');
    expect(restricted).toContain('National ID and medical notes are restricted');
  });

  it('labels every input and is localized in English', () => {
    const html = renderToStaticMarkup(
      <EditPlayerModal edit={edit} canViewSensitive isAr={false} />,
    );
    for (const id of [
      'edit-first-name',
      'edit-last-name',
      'edit-gender',
      'edit-birth-year',
      'edit-jersey-number',
      'edit-guardian-name',
      'edit-guardian-phone',
      'edit-player-status',
    ]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('Edit Athlete Profile');
    expect(html).not.toMatch(/الاسم الأول|حالة اللاعب/);
  });
});

describe('ArchivePlayerModal', () => {
  it('shows the server impact report in English with dialog semantics', () => {
    const html = renderToStaticMarkup(<ArchivePlayerModal archive={archive} isAr={false} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('You are about to archive athlete');
    expect(html).toContain('Omar Ali');
    expect(html).toContain('(will be cancelled)');
    expect(html).toContain('30 sessions');
    expect(html).toContain('Has outstanding balance');
    expect(html).not.toMatch(/أنت على وشك|سجلات الحضور المحفوظة/);
  });

  it('keeps the original Arabic copy', () => {
    const html = renderToStaticMarkup(<ArchivePlayerModal archive={archive} isAr />);
    expect(html).toContain('أنت على وشك أرشفة اللاعب');
    expect(html).toContain('(سيتم إلغاؤها)');
    expect(html).toContain('30 حصة');
  });

  it('renders nothing without an impact report', () => {
    expect(
      renderToStaticMarkup(<ArchivePlayerModal archive={{ ...archive, impact: null }} isAr />),
    ).toBe('');
  });
});
