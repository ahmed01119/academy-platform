import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service';
import { type AppConfigService } from '../../config/app-config.service';

describe('HealthService', () => {
  it('returns ok status with service metadata', () => {
    const config = {
      apiVersion: '0.0.0',
    } as AppConfigService;

    const service = new HealthService(config);
    const result = service.getStatus();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('academy-api');
    expect(result.version).toBe('0.0.0');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
