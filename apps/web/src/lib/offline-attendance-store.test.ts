import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { offlineStore } from './offline-attendance-store';
import { apiClient } from './api-client';
import type { SessionDetails } from '@academy/shared';

vi.mock('./api-client', () => ({
  apiClient: {
    attendance: {
      syncOfflineBatch: vi.fn(),
    },
  },
}));

describe('OfflineAttendanceStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear all pending items before each test
    const all = await offlineStore.getPendingScans();
    await offlineStore.removePendingScans(all.map((item) => item.operationId));
  });

  it('enqueues an offline scan and retrieves it with correct properties', async () => {
    const entry = await offlineStore.enqueueScan({
      sessionId: 'session-uuid-1',
      qrCardCode: 'QR-TEST-001',
      deviceObservedTime: '2026-10-22T10:15:30.000Z',
      playerName: 'Youssef Ahmed',
      reason: 'Field connection down',
    });

    expect(entry.operationId).toBeDefined();
    expect(entry.sessionId).toBe('session-uuid-1');
    expect(entry.qrCardCode).toBe('QR-TEST-001');
    expect(entry.deviceObservedTime).toBe('2026-10-22T10:15:30.000Z');
    expect(entry.playerName).toBe('Youssef Ahmed');

    const pending = await offlineStore.getPendingScans('session-uuid-1');
    expect(pending.length).toBe(1);
    expect(pending[0].operationId).toBe(entry.operationId);

    const count = await offlineStore.getPendingCount();
    expect(count).toBe(1);
  });

  it('isolates pending scans by sessionId', async () => {
    await offlineStore.enqueueScan({
      sessionId: 'session-A',
      qrCardCode: 'QR-A',
      deviceObservedTime: '2026-10-22T10:00:00.000Z',
    });

    await offlineStore.enqueueScan({
      sessionId: 'session-B',
      qrCardCode: 'QR-B',
      deviceObservedTime: '2026-10-22T10:05:00.000Z',
    });

    const scansA = await offlineStore.getPendingScans('session-A');
    const scansB = await offlineStore.getPendingScans('session-B');
    const allScans = await offlineStore.getPendingScans();

    expect(scansA.length).toBe(1);
    expect(scansA[0].qrCardCode).toBe('QR-A');

    expect(scansB.length).toBe(1);
    expect(scansB[0].qrCardCode).toBe('QR-B');

    expect(allScans.length).toBe(2);
    expect(await offlineStore.getPendingCount()).toBe(2);
  });

  it('caches and retrieves session details for offline viewing', async () => {
    const mockSession: SessionDetails = {
      id: 'session-123',
      tenantId: 'tenant-456',
      branchId: 'branch-789',
      branchName: 'Main Branch',
      sport: 'FOOTBALL',
      groupName: 'U14 Tigers',
      sessionDate: '2026-10-22',
      startTime: '16:00',
      endTime: '17:30',
      status: 'IN_PROGRESS',
      totalExpected: 2,
      totalPresent: 0,
      totalLate: 0,
      totalAbsent: 0,
      totalExcused: 0,
      totalUnmarked: 2,
      hasActiveQr: false,
      createdAt: '2026-10-22T08:00:00.000Z',
      roster: [
        {
          playerId: 'p1',
          name: 'Omar Sherif',
          status: 'UNMARKED',
          version: 1,
        },
        {
          playerId: 'p2',
          name: 'Ziad Tarek',
          status: 'UNMARKED',
          version: 1,
        },
      ],
    };

    await offlineStore.cacheSessionRoster(mockSession);
    const cached = await offlineStore.getCachedSession('session-123');

    expect(cached).not.toBeNull();
    expect(cached?.groupName).toBe('U14 Tigers');
    expect(cached?.roster.length).toBe(2);
    expect(cached?.roster[0].name).toBe('Omar Sherif');
  });

  it('syncs pending scans with the backend and clears successful ones from the queue', async () => {
    const scan1 = await offlineStore.enqueueScan({
      sessionId: 'session-sync-test',
      qrCardCode: 'QR-OK-1',
      deviceObservedTime: '2026-10-22T09:00:00.000Z',
    });

    const scan2 = await offlineStore.enqueueScan({
      sessionId: 'session-sync-test',
      qrCardCode: 'QR-FAIL-2',
      deviceObservedTime: '2026-10-22T09:05:00.000Z',
    });

    vi.mocked(apiClient.attendance.syncOfflineBatch).mockResolvedValueOnce({
      sessionId: 'session-sync-test',
      syncedCount: 1,
      failedCount: 1,
      alreadyCheckedInCount: 0,
      results: [
        {
          operationId: scan1.operationId,
          success: true,
          status: 'PRESENT',
          playerId: 'p1',
          playerName: 'Player 1',
        },
        {
          operationId: scan2.operationId,
          success: false,
          error: 'Player card revoked',
        },
      ],
    });

    const syncRes = await offlineStore.syncPendingScans('session-sync-test');

    expect(syncRes).not.toBeNull();
    expect(syncRes?.syncedCount).toBe(1);
    expect(syncRes?.failedCount).toBe(1);
    expect(apiClient.attendance.syncOfflineBatch).toHaveBeenCalledWith(
      'session-sync-test',
      expect.objectContaining({
        sessionId: 'session-sync-test',
        items: expect.arrayContaining([
          expect.objectContaining({ qrCardCode: 'QR-OK-1' }),
          expect.objectContaining({ qrCardCode: 'QR-FAIL-2' }),
        ]),
      }),
    );

    // Scan 1 should have been deleted, Scan 2 remains in queue
    const remaining = await offlineStore.getPendingScans('session-sync-test');
    expect(remaining.length).toBe(1);
    expect(remaining[0].operationId).toBe(scan2.operationId);
  });

  it('returns null when syncing an empty session queue', async () => {
    const res = await offlineStore.syncPendingScans('session-empty');
    expect(res).toBeNull();
    expect(apiClient.attendance.syncOfflineBatch).not.toHaveBeenCalled();
  });
});
