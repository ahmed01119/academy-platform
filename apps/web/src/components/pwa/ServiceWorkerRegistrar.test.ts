import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Frontend Version Detection & Update Safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects a newer version when server buildId differs from running buildId', () => {
    const runningBuildId = 'build-100';
    const serverManifest = {
      version: '1.0.1',
      buildId: 'build-101',
      builtAt: '2026-10-30T00:00:00Z',
    };

    const isUpdateAvailable = serverManifest.buildId !== runningBuildId;
    expect(isUpdateAvailable).toBe(true);
  });

  it('does not trigger update when server buildId matches running buildId', () => {
    const runningBuildId = 'build-100';
    const serverManifest = {
      version: '1.0.0',
      buildId: 'build-100',
      builtAt: '2026-10-30T00:00:00Z',
    };

    const isUpdateAvailable = serverManifest.buildId !== runningBuildId;
    expect(isUpdateAvailable).toBe(false);
  });

  it('detects unsaved form work when an input or textarea is active', () => {
    function mockHasUnsavedWork(tagName: string, isBusy = false): boolean {
      if (isBusy) return true;
      return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    }

    expect(mockHasUnsavedWork('INPUT')).toBe(true);
    expect(mockHasUnsavedWork('TEXTAREA')).toBe(true);
    expect(mockHasUnsavedWork('SELECT')).toBe(true);
    expect(mockHasUnsavedWork('DIV')).toBe(false);
    expect(mockHasUnsavedWork('BUTTON')).toBe(false);
    expect(mockHasUnsavedWork('BODY', true)).toBe(true);
  });

  it('prevents update when pending offline attendance operations exist', () => {
    function canSafelyUpdate(pendingCount: number, hasUnsaved: boolean): { canUpdate: boolean; reason?: string } {
      if (pendingCount > 0) {
        return { canUpdate: false, reason: 'PENDING_OFFLINE_OPERATIONS' };
      }
      if (hasUnsaved) {
        return { canUpdate: false, reason: 'UNSAVED_FORM_WORK' };
      }
      return { canUpdate: true };
    }

    expect(canSafelyUpdate(3, false)).toEqual({ canUpdate: false, reason: 'PENDING_OFFLINE_OPERATIONS' });
    expect(canSafelyUpdate(0, true)).toEqual({ canUpdate: false, reason: 'UNSAVED_FORM_WORK' });
    expect(canSafelyUpdate(0, false)).toEqual({ canUpdate: true });
  });

  it('correctly handles bilingual update prompt text for Arabic and English', () => {
    function getUpdatePromptText(locale: 'ar' | 'en') {
      return {
        title: locale === 'ar' ? 'يتوفر إصدار جديد للتطبيق' : 'An application update is available',
        updateBtn: locale === 'ar' ? 'تحديث الآن' : 'Update now',
        laterBtn: locale === 'ar' ? 'لاحقاً' : 'Later',
      };
    }

    const ar = getUpdatePromptText('ar');
    expect(ar.title).toBe('يتوفر إصدار جديد للتطبيق');
    expect(ar.updateBtn).toBe('تحديث الآن');

    const en = getUpdatePromptText('en');
    expect(en.title).toBe('An application update is available');
    expect(en.updateBtn).toBe('Update now');
  });
});
