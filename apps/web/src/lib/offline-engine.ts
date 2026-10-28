import { offlineStore } from './offline-attendance-store';
import { apiClient } from './api-client';
import type { SessionSummary } from '@academy/shared';

const DB_PREFIX = 'academy_offline_';
const DB_VERSION = 1;
const STORE_MUTATIONS = 'mutations';
const STORE_EVAL_DRAFTS = 'evaluation_drafts';
const STORE_META = 'meta';

export type OfflineMutationKind = 'attendance_scan' | 'evaluation_draft';

export type OfflineCapability = 'offline' | 'online-only';

export const OFFLINE_CAPABILITY = {
  attendanceScan: 'offline',
  evaluationDraft: 'offline',
  evaluationPublish: 'online-only',
  finance: 'online-only',
  admin: 'online-only',
} as const satisfies Record<string, OfflineCapability>;

export interface QueuedMutation {
  id: string;
  tenantId: string;
  actorUserId: string;
  kind: OfflineMutationKind;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface EvaluationDraft {
  id: string;
  tenantId: string;
  actorUserId: string;
  playerId: string;
  sessionId?: string;
  templateId?: string;
  technicalScore: number;
  tacticalScore: number;
  physicalScore: number;
  behavioralScore: number;
  strengths?: string;
  areasForImprovement?: string;
  privateCoachNotes?: string;
  guardianFeedback?: string;
  suggestedGoals?: string;
  isPublished: boolean;
  updatedAt: string;
}

function dbName(tenantId: string): string {
  return `${DB_PREFIX}${tenantId}`;
}

function openDb(name: string): Promise<IDBDatabase> {
  const idb: IDBFactory | undefined =
    typeof window !== 'undefined'
      ? window.indexedDB
      : (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) {
    return Promise.reject(new Error('IndexedDB is unavailable'));
  }

  return new Promise((resolve, reject) => {
    const req = idb.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
        const store = db.createObjectStore(STORE_MUTATIONS, { keyPath: 'id' });
        store.createIndex('kind', 'kind', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_EVAL_DRAFTS)) {
        db.createObjectStore(STORE_EVAL_DRAFTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export class OfflineEngine {
  async saveEvaluationDraft(draft: EvaluationDraft): Promise<void> {
    const db = await openDb(dbName(draft.tenantId));
    const tx = db.transaction([STORE_EVAL_DRAFTS, STORE_MUTATIONS, STORE_META], 'readwrite');
    tx.objectStore(STORE_EVAL_DRAFTS).put(draft);
    const mutation: QueuedMutation = {
      id: `eval-draft:${draft.id}`,
      tenantId: draft.tenantId,
      actorUserId: draft.actorUserId,
      kind: 'evaluation_draft',
      payload: { draftId: draft.id },
      createdAt: draft.updatedAt,
      attempts: 0,
    };
    tx.objectStore(STORE_MUTATIONS).put(mutation);
    tx.objectStore(STORE_META).put({ key: 'checkpoint', updatedAt: draft.updatedAt });
    await txDone(tx);
    db.close();
  }

  async getEvaluationDraft(tenantId: string, id: string): Promise<EvaluationDraft | null> {
    const db = await openDb(dbName(tenantId));
    const tx = db.transaction(STORE_EVAL_DRAFTS, 'readonly');
    const req = tx.objectStore(STORE_EVAL_DRAFTS).get(id);
    const result = await new Promise<EvaluationDraft | null>((resolve) => {
      req.onsuccess = () => resolve((req.result as EvaluationDraft | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
    db.close();
    return result;
  }

  async listEvaluationDrafts(tenantId: string): Promise<EvaluationDraft[]> {
    const db = await openDb(dbName(tenantId));
    const tx = db.transaction(STORE_EVAL_DRAFTS, 'readonly');
    const req = tx.objectStore(STORE_EVAL_DRAFTS).getAll();
    const result = await new Promise<EvaluationDraft[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as EvaluationDraft[]) || []);
      req.onerror = () => resolve([]);
    });
    db.close();
    return result.filter((item) => item.tenantId === tenantId);
  }

  async removeEvaluationDraft(tenantId: string, id: string): Promise<void> {
    const db = await openDb(dbName(tenantId));
    const tx = db.transaction([STORE_EVAL_DRAFTS, STORE_MUTATIONS], 'readwrite');
    tx.objectStore(STORE_EVAL_DRAFTS).delete(id);
    tx.objectStore(STORE_MUTATIONS).delete(`eval-draft:${id}`);
    await txDone(tx);
    db.close();
  }

  async pendingCount(tenantId?: string): Promise<number> {
    const attendance = await offlineStore.getPendingCount();
    if (!tenantId) return attendance;
    const drafts = await this.listEvaluationDrafts(tenantId);
    return attendance + drafts.length;
  }

  async purgeTenant(tenantId: string): Promise<void> {
    const idb: IDBFactory | undefined =
      typeof window !== 'undefined'
        ? window.indexedDB
        : (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
    if (!idb) return;
    await new Promise<void>((resolve) => {
      const req = idb.deleteDatabase(dbName(tenantId));
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }

  async purgeAll(): Promise<void> {
    await offlineStore.purgeAll();
    const idb: IDBFactory | undefined =
      typeof window !== 'undefined'
        ? window.indexedDB
        : (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
    if (!idb?.databases) return;
    const dbs = await idb.databases();
    await Promise.all(
      dbs
        .filter((entry) => entry.name?.startsWith(DB_PREFIX))
        .map(
          (entry) =>
            new Promise<void>((resolve) => {
              const req = idb.deleteDatabase(entry.name as string);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            }),
        ),
    );
  }
}

export const offlineEngine = new OfflineEngine();

export interface OfflinePreparationResult {
  sessionsCached: number;
  playersCached: number;
  cachedAt: string;
}

export async function prepareForOfflineUse(
  tenantId: string,
  branchId?: string,
): Promise<OfflinePreparationResult> {
  const todayStr = new Date().toISOString().slice(0, 10);
  let sessions: SessionSummary[] = [];
  try {
    const res = await apiClient.attendance.listSessions({
      branchId,
      dateFrom: todayStr,
      limit: 15,
    });
    sessions = res.items;
    if (sessions.length === 0) {
      const fallback = await apiClient.attendance.listSessions({ branchId, limit: 10 });
      sessions = fallback.items;
    }
  } catch {
    sessions = [];
  }

  let totalPlayers = 0;
  for (const session of sessions) {
    try {
      const details = await apiClient.attendance.getSession(session.id);
      await offlineStore.cacheSessionRoster(details);
      totalPlayers += details.roster?.length || 0;
    } catch {
      // Continue caching remaining sessions
    }
  }

  return {
    sessionsCached: sessions.length,
    playersCached: totalPlayers,
    cachedAt: new Date().toISOString(),
  };
}
