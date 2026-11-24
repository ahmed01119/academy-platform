import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  JOIN_FIELDS_PENDING_BACKEND_SUPPORT,
  PENDING_JOIN_FIELD_LABELS,
  buildPlayerJoinRequest,
} from '@/features/landing/player-join-request';
import { UnsavedFieldsNotice } from './UnsavedFieldsNotice';

const render = (locale: 'ar' | 'en') =>
  renderToStaticMarkup(<UnsavedFieldsNotice locale={locale} />);

describe('UnsavedFieldsNotice (F17)', () => {
  it.each(['ar', 'en'] as const)('names every field that is not sent (%s)', (locale) => {
    const html = render(locale);
    for (const field of JOIN_FIELDS_PENDING_BACKEND_SUPPORT) {
      expect(html).toContain(PENDING_JOIN_FIELD_LABELS[field][locale]);
    }
  });

  it('explicitly mentions National ID and Medical Notes', () => {
    expect(render('en')).toContain('National ID');
    expect(render('en')).toContain('Medical notes');
    expect(render('ar')).toContain('الرقم القومي');
    expect(render('ar')).toContain('الملاحظات الطبية');
  });

  it('states the current behaviour: not submitted or saved', () => {
    expect(render('en')).toContain('currently not submitted or saved');
    expect(render('ar')).toContain('لا يتم إرسالها أو حفظها حالياً');
  });

  it('does not imply the academy will collect these details later', () => {
    for (const html of [render('en'), render('ar')]) {
      expect(html).not.toMatch(/later|will (be )?collect|will contact|سيتم جمع|لاحقاً|ستتواصل/i);
    }
  });

  it('the "only sent" sentence matches the real payload fields', () => {
    const { payload } = buildPlayerJoinRequest({
      tenantId: '22222222-2222-4222-8222-222222222222',
      requesterType: 'PLAYER',
      firstName: 'A',
      lastName: 'B',
      gender: 'MALE',
      birthYear: '2012',
      jerseyNumber: '',
      nationalId: '',
      medicalNotes: '',
      guardianName: 'G',
      guardianPhone: '010',
      email: 'g@x.co',
      playerEmail: 'e@x.co',
      password: 'Str0ng-Passw0rd!',
      confirmPassword: 'Str0ng-Passw0rd!',
    });
    // academy, who is applying, player name, birth year, guardian name and phone, account e-mail, password
    expect(Object.keys(payload).sort()).toEqual(
      [
        'contactEmail',
        'contactPhone',
        'dateOfBirth',
        'guardianName',
        'password',
        'playerName',
        'requesterType',
        'tenantId',
      ].sort(),
    );
  });

  it('is announced as a note for assistive technology', () => {
    expect(render('en')).toContain('role="note"');
  });
});
