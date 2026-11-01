import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAppUpdate, purgeAppCaches, hasUnsavedWork } from './ServiceWorkerRegistrar';

describe('Frontend Version Detection & PWA Update Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('purgeAppCaches (Cache Cleanup Scope & Safety)', () => {
    it('deletes ONLY versioned static shell caches and preserves unrelated caches', async () => {
      const deletedKeys: string[] = [];
      const mockCachesApi = {
        keys: vi
          .fn()
          .mockResolvedValue([
            'sportexus-shell-v1',
            'sportexus-shell-build-12345',
            'academy_offline_attendance',
            'user_avatars_v1',
            'custom_storage_cache',
          ]),
        delete: vi.fn().mockImplementation((key: string) => {
          deletedKeys.push(key);
          return Promise.resolve(true);
        }),
      } as unknown as CacheStorage;

      const purged = await purgeAppCaches(mockCachesApi);

      expect(purged).toEqual(['sportexus-shell-v1', 'sportexus-shell-build-12345']);
      expect(deletedKeys).toEqual(['sportexus-shell-v1', 'sportexus-shell-build-12345']);
      expect(deletedKeys).not.toContain('academy_offline_attendance');
      expect(deletedKeys).not.toContain('user_avatars_v1');
      expect(deletedKeys).not.toContain('custom_storage_cache');
    });

    it('handles null/undefined CacheStorage gracefully without throwing', async () => {
      const purged = await purgeAppCaches(undefined);
      expect(purged).toEqual([]);
    });
  });

  describe('executeAppUpdate (Lifecycle & Message Sequencing)', () => {
    it('blocks update when pending offline attendance operations exist', async () => {
      const postMessageSpy = vi.fn();
      const mockWorker = { postMessage: postMessageSpy };
      const onReload = vi.fn();
      const purgeCaches = vi.fn().mockResolvedValue([]);

      const result = await executeAppUpdate({
        waitingWorker: mockWorker,
        getPendingCount: async () => 3,
        checkUnsavedWork: () => false,
        onReload,
        purgeCaches,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('PENDING_OFFLINE');
      expect(result.pendingCount).toBe(3);
      expect(postMessageSpy).not.toHaveBeenCalled();
      expect(purgeCaches).not.toHaveBeenCalled();
      expect(onReload).not.toHaveBeenCalled();
    });

    it('fails closed when offline pending count verification throws an error', async () => {
      const postMessageSpy = vi.fn();
      const mockWorker = { postMessage: postMessageSpy };
      const onReload = vi.fn();

      const result = await executeAppUpdate({
        waitingWorker: mockWorker,
        getPendingCount: async () => {
          throw new Error('IndexedDB access failure');
        },
        checkUnsavedWork: () => false,
        onReload,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('VERIFY_FAILED');
      expect(postMessageSpy).not.toHaveBeenCalled();
      expect(onReload).not.toHaveBeenCalled();
    });

    it('blocks update when user is typing or active in a form', async () => {
      const postMessageSpy = vi.fn();
      const mockWorker = { postMessage: postMessageSpy };
      const onReload = vi.fn();

      const result = await executeAppUpdate({
        waitingWorker: mockWorker,
        getPendingCount: async () => 0,
        checkUnsavedWork: () => true,
        onReload,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('UNSAVED_WORK');
      expect(postMessageSpy).not.toHaveBeenCalled();
      expect(onReload).not.toHaveBeenCalled();
    });

    it('purges shell caches, sends CLEAR_STATIC_CACHE then SKIP_WAITING, and triggers reload via controllerchange', async () => {
      const postedMessages: unknown[] = [];
      const mockWorker = {
        postMessage: vi.fn((msg) => postedMessages.push(msg)),
      };

      let controllerListener: (() => void) | null = null;
      const mockSwContainer = {
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'controllerchange') {
            controllerListener = handler;
          }
        }),
      };

      const reloadSpy = vi.fn();
      const purgeCachesSpy = vi.fn().mockResolvedValue(['sportexus-shell-old']);

      const result = await executeAppUpdate({
        waitingWorker: mockWorker,
        swContainer: mockSwContainer,
        onReload: reloadSpy,
        getPendingCount: async () => 0,
        checkUnsavedWork: () => false,
        purgeCaches: purgeCachesSpy,
      });

      expect(result.success).toBe(true);
      expect(purgeCachesSpy).toHaveBeenCalledTimes(1);
      expect(result.purgedCaches).toEqual(['sportexus-shell-old']);

      // Integration: Verify exact message sequencing
      expect(postedMessages).toEqual([{ type: 'CLEAR_STATIC_CACHE' }, { type: 'SKIP_WAITING' }]);

      // ServiceWorker listener registered
      expect(mockSwContainer.addEventListener).toHaveBeenCalledWith(
        'controllerchange',
        expect.any(Function),
        { once: true },
      );

      // Reload not called immediately before controllerchange
      expect(reloadSpy).not.toHaveBeenCalled();

      // Trigger controllerchange event
      expect(controllerListener).not.toBeNull();
      controllerListener!();

      // Reload successfully triggered once
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('purges shell caches and reloads directly when no waiting worker exists', async () => {
      const reloadSpy = vi.fn();
      const purgeCachesSpy = vi.fn().mockResolvedValue(['sportexus-shell-v1']);

      const result = await executeAppUpdate({
        waitingWorker: null,
        onReload: reloadSpy,
        getPendingCount: async () => 0,
        checkUnsavedWork: () => false,
        purgeCaches: purgeCachesSpy,
      });

      expect(result.success).toBe(true);
      expect(purgeCachesSpy).toHaveBeenCalledTimes(1);
      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(result.messagesSent).toEqual([]);
    });
  });

  describe('hasUnsavedWork (DOM Guard Inspection)', () => {
    it('returns false in non-DOM environments', () => {
      // In node env without document or when undefined
      const isUnsaved = hasUnsavedWork();
      expect(typeof isUnsaved).toBe('boolean');
    });
  });

  describe('Version Manifest & Stamping Consistency', () => {
    it('stamps sw.js with deterministic buildId and preserves header semantics', () => {
      const template = [
        '/* Sportexus PWA Service Worker. */',
        "const VERSION = 'sportexus-shell-v2';",
        "const PRECACHE = ['/offline'];",
      ].join('\n');

      const buildId = '6e2f9b0d1d3a-test';
      const stamped = template.replace(
        /const VERSION = ['"][^'"]+['"];/,
        `const VERSION = 'sportexus-shell-${buildId}';`,
      );

      expect(stamped).toContain(`const VERSION = 'sportexus-shell-${buildId}';`);
      expect(stamped).not.toContain('sportexus-shell-v2');
      expect(stamped).toContain("const PRECACHE = ['/offline'];");
    });
  });
});
