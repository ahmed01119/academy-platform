import type {
  OfflineAttendanceBatchItem,
  OfflineAttendanceBatchSyncResponse,
  SessionDetails,
} from '@academy/shared';
import { apiClient } from './api-client';

const DB_NAME = 'academy_offline_attendance';
const DB_VERSION = 1;
const STORE_SESSIONS = 'cached_sessions';
const STORE_PENDING = 'pending_scans';

export interface PendingOfflineScan extends OfflineAttendanceBatchItem {
  sessionId: string;
  enqueuedAt: string;
  playerName?: string;
}

class OfflineAttendanceStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    const idb: IDBFactory | undefined =
      typeof window !== 'undefined'
        ? window.indexedDB
        : (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;

    if (!idb) {
      return Promise.reject(
        new Error('IndexedDB is only available in environments with indexedDB support'),
      );
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = idb.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
            db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_PENDING)) {
            const store = db.createObjectStore(STORE_PENDING, { keyPath: 'operationId' });
            store.createIndex('sessionId', 'sessionId', { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    return this.dbPromise;
  }

  /**
   * Caches a session details roster for offline attendance verification.
   */
  async cacheSessionRoster(session: SessionDetails): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      store.put(session);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Failed to cache session roster in IndexedDB:', err);
    }
  }

  /**
   * Retrieves a cached session roster by session ID.
   */
  async getCachedSession(sessionId: string): Promise<SessionDetails | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.get(sessionId);
      return new Promise<SessionDetails | null>((resolve) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Enqueues an offline attendance scan into local IndexedDB.
   */
  async enqueueScan(item: {
    operationId?: string;
    sessionId: string;
    qrCardCode: string;
    deviceObservedTime: string;
    reason?: string;
    playerName?: string;
  }): Promise<PendingOfflineScan> {
    const db = await this.getDB();
    const operationId = item.operationId || crypto.randomUUID();
    const entry: PendingOfflineScan = {
      operationId,
      sessionId: item.sessionId,
      qrCardCode: item.qrCardCode.trim(),
      deviceObservedTime: item.deviceObservedTime,
      reason: item.reason || 'Offline scan',
      enqueuedAt: new Date().toISOString(),
      playerName: item.playerName,
    };

    const tx = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    store.put(entry);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return entry;
  }

  /**
   * Retrieves all pending scans for a specific session (or all pending if no sessionId given).
   */
  async getPendingScans(sessionId?: string): Promise<PendingOfflineScan[]> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_PENDING, 'readonly');
      const store = tx.objectStore(STORE_PENDING);

      if (sessionId) {
        const index = store.index('sessionId');
        const req = index.getAll(sessionId);
        return new Promise<PendingOfflineScan[]>((resolve) => {
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
      }

      const req = store.getAll();
      return new Promise<PendingOfflineScan[]>((resolve) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Counts total pending scans waiting to be synced across all sessions.
   */
  async getPendingCount(): Promise<number> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_PENDING, 'readonly');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.count();
      return new Promise<number>((resolve) => {
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  /**
   * Removes synced operations from the pending queue.
   */
  async removePendingScans(operationIds: string[]): Promise<void> {
    if (operationIds.length === 0) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_PENDING, 'readwrite');
      const store = tx.objectStore(STORE_PENDING);
      for (const id of operationIds) {
        store.delete(id);
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('Failed to remove pending scans from IndexedDB:', err);
    }
  }

  /**
   * Submits all pending offline scans for a session to the backend batch sync endpoint.
   */
  async syncPendingScans(sessionId: string): Promise<OfflineAttendanceBatchSyncResponse | null> {
    const items = await this.getPendingScans(sessionId);
    if (items.length === 0) return null;

    const payload = {
      sessionId,
      items: items.map((i) => ({
        operationId: i.operationId,
        qrCardCode: i.qrCardCode,
        deviceObservedTime: i.deviceObservedTime,
        reason: i.reason,
      })),
    };

    const res = await apiClient.attendance.syncOfflineBatch(sessionId, payload);

    // Remove successfully processed or already checked-in operations
    const successfulOpIds = res.results.filter((r) => r.success).map((r) => r.operationId);

    if (successfulOpIds.length > 0) {
      await this.removePendingScans(successfulOpIds);
    }

    return res;
  }

  async purgeAll(): Promise<void> {
    this.dbPromise = null;
    const idb: IDBFactory | undefined =
      typeof window !== 'undefined'
        ? window.indexedDB
        : (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
    if (!idb) return;
    await new Promise<void>((resolve, reject) => {
      const req = idb.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  }
}

export const offlineStore = new OfflineAttendanceStore();
export default offlineStore;
