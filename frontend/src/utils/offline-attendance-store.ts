import type {
  AttendanceStatus,
  OfflineAttendanceBatchItem,
  OfflineAttendanceBatchSyncResponse,
  SessionDetails,
} from '@academy/shared';
import { apiClient } from '../api/client';

const DB_NAME = 'academy_offline_attendance';
const DB_VERSION = 2;
const STORE_SESSIONS = 'cached_sessions';
const STORE_PENDING = 'pending_scans';
/** v2: manual marks (quick attendance) made offline; one per session and player, the latest status wins. */
const STORE_MARKS = 'pending_marks';

export interface PendingOfflineScan extends OfflineAttendanceBatchItem {
  sessionId: string;
  enqueuedAt: string;
  playerName?: string;
}

/** A manual mark (quick attendance) waiting to be sent to POST /attendance/records. */
export interface PendingOfflineMark {
  /** `${sessionId}:${playerId}`: marking the same player again replaces the earlier status. */
  key: string;
  sessionId: string;
  playerId: string;
  status: Exclude<AttendanceStatus, 'UNMARKED'>;
  /** Sent as the API idempotency key, so a replay after a lost response is not recorded twice. */
  idempotencyKey: string;
  markedAt: string;
}

export interface MarkSyncResult {
  synced: number;
  failed: number;
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
          if (!db.objectStoreNames.contains(STORE_MARKS)) {
            const store = db.createObjectStore(STORE_MARKS, { keyPath: 'key' });
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
   * Enqueues an offline attendance scan into local IndexedDB. A card already waiting for the same session is not
   * queued again (the camera keeps reading a card held in front of it): the first entry is kept, because its time is
   * the player's real arrival time.
   */
  async enqueueScan(item: {
    operationId?: string;
    sessionId: string;
    qrCardCode: string;
    deviceObservedTime: string;
    reason?: string;
    playerName?: string;
  }): Promise<PendingOfflineScan> {
    const existing = (await this.getPendingScans(item.sessionId)).find(
      (s) => s.qrCardCode === item.qrCardCode.trim(),
    );
    if (existing) return existing;

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
   * Counts everything waiting to be synced across all sessions (scans and manual marks).
   */
  async getPendingCount(): Promise<number> {
    return (await this.countStore(STORE_PENDING)) + (await this.countStore(STORE_MARKS));
  }

  private async countStore(name: string): Promise<number> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(name, 'readonly');
      const req = tx.objectStore(name).count();
      return new Promise<number>((resolve) => {
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  /**
   * Saves a manual mark made offline. Marking the same player again in the same session replaces it.
   */
  async enqueueMark(item: {
    sessionId: string;
    playerId: string;
    status: Exclude<AttendanceStatus, 'UNMARKED'>;
  }): Promise<PendingOfflineMark> {
    const db = await this.getDB();
    const entry: PendingOfflineMark = {
      key: `${item.sessionId}:${item.playerId}`,
      sessionId: item.sessionId,
      playerId: item.playerId,
      status: item.status,
      idempotencyKey: crypto.randomUUID(),
      markedAt: new Date().toISOString(),
    };
    const tx = db.transaction(STORE_MARKS, 'readwrite');
    tx.objectStore(STORE_MARKS).put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return entry;
  }

  /** Manual marks waiting for a session (or all of them). */
  async getPendingMarks(sessionId?: string): Promise<PendingOfflineMark[]> {
    try {
      const db = await this.getDB();
      const store = db.transaction(STORE_MARKS, 'readonly').objectStore(STORE_MARKS);
      const req = sessionId ? store.index('sessionId').getAll(sessionId) : store.getAll();
      return new Promise<PendingOfflineMark[]>((resolve) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  private async removeMark(key: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORE_MARKS, 'readwrite');
    tx.objectStore(STORE_MARKS).delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Sends waiting manual marks through the same endpoint as online marking. A mark is removed once the API accepts
   * it; one the API refuses stays queued and is counted as failed (the caller tells the user).
   */
  async syncPendingMarks(sessionId?: string): Promise<MarkSyncResult> {
    const marks = await this.getPendingMarks(sessionId);
    let synced = 0;
    let failed = 0;
    for (const mark of marks) {
      try {
        await apiClient.attendance.recordAttendance({
          sessionId: mark.sessionId,
          playerId: mark.playerId,
          status: mark.status,
          idempotencyKey: mark.idempotencyKey,
        });
        await this.removeMark(mark.key);
        synced++;
      } catch {
        failed++;
      }
    }
    return { synced, failed };
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
