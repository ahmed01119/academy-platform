import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { OFFLINE_CAPABILITY, offlineEngine } from './offline-engine';

const tenantId = '11111111-1111-4111-8111-111111111111';
const actorUserId = '22222222-2222-4222-8222-222222222222';

describe('offline engine', () => {
  beforeEach(async () => {
    await offlineEngine.purgeAll();
  });

  it('marks finance as online-only and attendance as offline-capable', () => {
    expect(OFFLINE_CAPABILITY.finance).toBe('online-only');
    expect(OFFLINE_CAPABILITY.attendanceScan).toBe('offline');
    expect(OFFLINE_CAPABILITY.evaluationDraft).toBe('offline');
    expect(OFFLINE_CAPABILITY.evaluationPublish).toBe('online-only');
  });

  it('stores evaluation drafts scoped to a tenant', async () => {
    await offlineEngine.saveEvaluationDraft({
      id: 'draft-1',
      tenantId,
      actorUserId,
      playerId: '33333333-3333-4333-8333-333333333333',
      technicalScore: 7,
      tacticalScore: 8,
      physicalScore: 6,
      behavioralScore: 9,
      isPublished: false,
      updatedAt: new Date().toISOString(),
    });

    const loaded = await offlineEngine.getEvaluationDraft(tenantId, 'draft-1');
    expect(loaded?.playerId).toBe('33333333-3333-4333-8333-333333333333');
    expect(loaded?.tenantId).toBe(tenantId);
    expect(await offlineEngine.listEvaluationDrafts(tenantId)).toHaveLength(1);
  });

  it('purges tenant local data', async () => {
    await offlineEngine.saveEvaluationDraft({
      id: 'draft-2',
      tenantId,
      actorUserId,
      playerId: '33333333-3333-4333-8333-333333333333',
      technicalScore: 5,
      tacticalScore: 5,
      physicalScore: 5,
      behavioralScore: 5,
      isPublished: false,
      updatedAt: new Date().toISOString(),
    });
    await offlineEngine.purgeTenant(tenantId);
    expect(await offlineEngine.getEvaluationDraft(tenantId, 'draft-2')).toBeNull();
  });

  it('runs prepareForOfflineUse gracefully when network is disconnected', async () => {
    const { prepareForOfflineUse } = await import('./offline-engine');
    const result = await prepareForOfflineUse(tenantId);
    expect(result).toBeDefined();
    expect(typeof result.sessionsCached).toBe('number');
    expect(typeof result.playersCached).toBe('number');
    expect(result.cachedAt).toBeDefined();
  });
});
