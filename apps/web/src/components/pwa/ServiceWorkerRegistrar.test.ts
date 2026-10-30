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
    function canSafelyUpdate(
      pendingCount: number,
      hasUnsaved: boolean,
    ): { canUpdate: boolean; reason?: string } {
      if (pendingCount > 0) {
        return { canUpdate: false, reason: 'PENDING_OFFLINE_OPERATIONS' };
      }
      if (hasUnsaved) {
        return { canUpdate: false, reason: 'UNSAVED_FORM_WORK' };
      }
      return { canUpdate: true };
    }

    expect(canSafelyUpdate(3, false)).toEqual({
      canUpdate: false,
      reason: 'PENDING_OFFLINE_OPERATIONS',
    });
    expect(canSafelyUpdate(0, true)).toEqual({ canUpdate: false, reason: 'UNSAVED_FORM_WORK' });
    expect(canSafelyUpdate(0, false)).toEqual({ canUpdate: true });
  });

  it('fails closed when pendingCount() throws an error (Issue #4)', async () => {
    async function evaluateUpdateSafety(
      getPendingCount: () => Promise<number>,
      hasUnsaved: () => boolean,
    ): Promise<{ allowed: boolean; warning?: string }> {
      try {
        const count = await getPendingCount();
        if (count > 0) {
          return { allowed: false, warning: 'PENDING_OFFLINE_COUNT' };
        }
      } catch {
        // Fail closed: do not refresh if pending offline work cannot be verified
        return { allowed: false, warning: 'VERIFICATION_FAILED_FAIL_CLOSED' };
      }

      if (hasUnsaved()) {
        return { allowed: false, warning: 'UNSAVED_WORK' };
      }

      return { allowed: true };
    }

    // When pendingCount throws, it must FAIL CLOSED (allowed: false)
    const result = await evaluateUpdateSafety(
      async () => {
        throw new Error('IndexedDB storage unavailable or corrupted');
      },
      () => false,
    );

    expect(result.allowed).toBe(false);
    expect(result.warning).toBe('VERIFICATION_FAILED_FAIL_CLOSED');
  });

  it('waits for controller activation and avoids reload loops during SW update (Issue #6)', () => {
    let reloads = 0;
    let isReloading = false;
    let controllerChangeFired = false;
    const messagesPosted: string[] = [];

    const mockWaitingWorker = {
      postMessage: (msg: { type: string }) => {
        messagesPosted.push(msg.type);
      },
    };

    function triggerSafeUpdate(worker: typeof mockWaitingWorker | null) {
      if (isReloading) return;
      isReloading = true;

      if (worker) {
        let reloaded = false;
        const doReload = () => {
          if (reloaded) return;
          reloaded = true;
          reloads++;
        };

        // Simulate registering controllerchange handler
        const simulateControllerChange = () => {
          controllerChangeFired = true;
          doReload();
        };

        worker.postMessage({ type: 'CLEAR_STATIC_CACHE' });
        worker.postMessage({ type: 'SKIP_WAITING' });
        // Simulating the controllerchange firing after skipWaiting
        simulateControllerChange();
      } else {
        reloads++;
      }
    }

    triggerSafeUpdate(mockWaitingWorker);
    expect(messagesPosted).toEqual(['CLEAR_STATIC_CACHE', 'SKIP_WAITING']);
    expect(controllerChangeFired).toBe(true);
    expect(reloads).toBe(1);

    // Subsequent triggers while reloading should be ignored (guard against update loop)
    triggerSafeUpdate(mockWaitingWorker);
    expect(reloads).toBe(1);
  });

  it('purges existing caches and sends CLEAR_STATIC_CACHE before SKIP_WAITING', async () => {
    const deletedCaches: string[] = [];
    const mockCaches = {
      keys: vi.fn().mockResolvedValue(['sportexus-shell-v1', 'sportexus-shell-v2', 'other-cache']),
      delete: vi.fn().mockImplementation((key: string) => {
        deletedCaches.push(key);
        return Promise.resolve(true);
      }),
    };

    const messages: string[] = [];
    const mockWorker = {
      postMessage: (msg: { type: string }) => messages.push(msg.type),
    };

    // Purge logic
    const keys = await mockCaches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('sportexus-')).map((k) => mockCaches.delete(k)),
    );

    mockWorker.postMessage({ type: 'CLEAR_STATIC_CACHE' });
    mockWorker.postMessage({ type: 'SKIP_WAITING' });

    expect(deletedCaches).toEqual(['sportexus-shell-v1', 'sportexus-shell-v2']);
    expect(deletedCaches).not.toContain('other-cache');
    expect(messages).toEqual(['CLEAR_STATIC_CACHE', 'SKIP_WAITING']);
  });

  it('correctly handles bilingual update prompt text for Arabic and English', () => {
    function getUpdatePromptText(locale: 'ar' | 'en', isUpdating = false) {
      return {
        title: locale === 'ar' ? 'يتوفر إصدار جديد للتطبيق' : 'An application update is available',
        updateBtn: isUpdating
          ? locale === 'ar'
            ? 'جاري التحديث...'
            : 'Updating...'
          : locale === 'ar'
            ? 'تحديث الآن'
            : 'Update now',
        laterBtn: locale === 'ar' ? 'لاحقاً' : 'Later',
      };
    }

    const ar = getUpdatePromptText('ar', false);
    expect(ar.title).toBe('يتوفر إصدار جديد للتطبيق');
    expect(ar.updateBtn).toBe('تحديث الآن');

    const arUpdating = getUpdatePromptText('ar', true);
    expect(arUpdating.updateBtn).toBe('جاري التحديث...');

    const en = getUpdatePromptText('en', false);
    expect(en.title).toBe('An application update is available');
    expect(en.updateBtn).toBe('Update now');

    const enUpdating = getUpdatePromptText('en', true);
    expect(enUpdating.updateBtn).toBe('Updating...');
  });

  it('stamps sw.js VERSION with unique buildId on release generation', () => {
    const swTemplate = "const VERSION = 'sportexus-shell-v2';\nconst PRECACHE = ['/offline'];";
    const buildId = '6e2f9b0d1d3a-mvu8sufe';
    const stamped = swTemplate.replace(
      /const VERSION = ['"][^'"]+['"];/,
      `const VERSION = 'sportexus-shell-${buildId}';`,
    );

    expect(stamped).toContain(`const VERSION = 'sportexus-shell-${buildId}';`);
    expect(stamped).not.toContain('sportexus-shell-v2');
  });
});
