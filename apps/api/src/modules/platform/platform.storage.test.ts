import { describe, expect, it, vi } from 'vitest';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

describe('Platform Storage Routes & Contract Verification', () => {
  it('exposes getStorageMetrics on GET /platform/storage/metrics and GET /platform/storage/stats', async () => {
    const mockStorageMetrics = {
      databaseSizeBytes: 13596351,
      formattedDatabaseSize: '13 MB',
      totalTables: 34,
      tables: [
        {
          tableName: 'audit_logs',
          rowCount: 376,
          totalBytes: 237568,
          tableBytes: 106496,
          indexBytes: 98304,
          formattedSize: '232 KB',
        },
      ],
      auditLogsCount: 376,
      auditLogsSizeBytes: 237568,
      mediaStorageBytes: 0,
      cacheKeysCount: null,
      cacheStatus: 'IN_MEMORY' as const,
      redisAvailable: false,
      estimatedMonthlyGrowthBytes: 664000,
      measuredAt: new Date().toISOString(),
    };

    const mockPlatformService = {
      getStorageMetrics: vi.fn().mockResolvedValue(mockStorageMetrics),
    } as unknown as PlatformService;

    const controller = new PlatformController(mockPlatformService);

    // Call primary storage/metrics route handler
    const metricsResult = await controller.getStorageMetrics('actor-super-admin-id');
    expect(metricsResult).toEqual(mockStorageMetrics);
    expect(mockPlatformService.getStorageMetrics).toHaveBeenCalledWith('actor-super-admin-id');

    // Call alias storage/stats route handler
    const statsResult = await controller.getStorageStatsAlias('actor-super-admin-id');
    expect(statsResult).toEqual(mockStorageMetrics);
    expect(mockPlatformService.getStorageMetrics).toHaveBeenCalledTimes(2);
  });
});
