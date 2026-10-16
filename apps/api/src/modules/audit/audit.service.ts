import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '@academy/database';

export interface AuditEventParams {
  tenantId?: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'newpassword',
  'oldpassword',
  'token',
  'refreshtoken',
  'refresh_token',
  'accesstoken',
  'access_token',
  'authorization',
  'cookie',
  'secret',
  'cardnumber',
  'cvv',
  'pan',
]);

function sanitizeMetadata(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeMetadata);
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase().replace(/[-_]/g, ''))) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async logEvent(params: AuditEventParams, tx?: Prisma.TransactionClient): Promise<void> {
    try {
      const sanitizedMeta = params.metadata ? sanitizeMetadata(params.metadata) : undefined;
      const data = {
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        metadata: (sanitizedMeta as Prisma.InputJsonValue) ?? undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      };

      if (tx) {
        await tx.auditLog.create({ data });
      } else if (params.tenantId) {
        await this.prisma.withTenantTransaction(
          { tenantId: params.tenantId, actorUserId: params.actorUserId },
          async (tenantTx) => {
            await tenantTx.auditLog.create({ data });
          },
        );
      } else {
        await this.prisma.auditLog.create({ data });
      }
    } catch (err) {
      // Never crash the primary operation because of secondary audit logging failure, but log error
      this.logger.error(
        `Failed to record audit log for action ${params.action}: ${(err as Error).message}`,
      );
    }
  }
}
