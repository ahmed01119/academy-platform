import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { singleRow } from '../../common/db-function-error';
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
  'medicalnotes',
  'medical_notes',
  'nationalid',
  'national_id',
  'guardianphone',
  'guardian_phone',
  'emergencycontactphone',
  'emergency_contact_phone',
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

  /**
   * Appends an audit entry through public.append_audit_log (Phase 3A.2): the only write path the runtime database role
   * has. The function records the actor and tenant of the transaction context and rejects events whose claimed
   * tenant/actor differ from that context or whose actor has no link to the tenant.
   *
   * - Inside a caller's transaction (`tx`), the entry uses that transaction's context. A SAVEPOINT isolates it, so a
   *   rejected audit entry never aborts the caller's business transaction.
   * - Otherwise a short context transaction is opened: tenant events under the tenant context, all others under the
   *   actor context (or no actor, e.g. a failed login for an unknown e-mail).
   * Audit failures are logged and never thrown, as before.
   */
  async logEvent(params: AuditEventParams, tx?: Prisma.TransactionClient): Promise<void> {
    try {
      const sanitizedMeta = params.metadata ? sanitizeMetadata(params.metadata) : undefined;
      const metadataJson = sanitizedMeta === undefined ? null : JSON.stringify(sanitizedMeta);

      if (tx) {
        await tx.$executeRaw`SAVEPOINT audit_append`;
        try {
          await this.append(tx, params, metadataJson);
          await tx.$executeRaw`RELEASE SAVEPOINT audit_append`;
        } catch (err) {
          await tx.$executeRaw`ROLLBACK TO SAVEPOINT audit_append`;
          throw err;
        }
      } else if (params.tenantId) {
        await this.prisma.withTenantTransaction(
          { tenantId: params.tenantId, actorUserId: params.actorUserId },
          (tenantTx) => this.append(tenantTx, params, metadataJson),
        );
      } else {
        await this.prisma.withAuthLookupTransaction(
          { actorUserId: params.actorUserId },
          (actorTx) => this.append(actorTx, params, metadataJson),
        );
      }
    } catch (err) {
      // Never crash the primary operation because of secondary audit logging failure, but log error
      this.logger.error(
        `Failed to record audit log for action ${params.action}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Records an audit entry whose existence is the point of the operation (e.g. a support-access grant) and returns its
   * id. Unlike {@link logEvent} it throws when the entry cannot be written. Runs in its own context transaction.
   */
  async recordEvent(params: AuditEventParams): Promise<string> {
    const sanitizedMeta = params.metadata ? sanitizeMetadata(params.metadata) : undefined;
    const metadataJson = sanitizedMeta === undefined ? null : JSON.stringify(sanitizedMeta);
    return params.tenantId
      ? this.prisma.withTenantTransaction(
          { tenantId: params.tenantId, actorUserId: params.actorUserId },
          (tx) => this.append(tx, params, metadataJson),
        )
      : this.prisma.withAuthLookupTransaction({ actorUserId: params.actorUserId }, (tx) =>
          this.append(tx, params, metadataJson),
        );
  }

  private async append(
    client: Prisma.TransactionClient,
    params: AuditEventParams,
    metadataJson: string | null,
  ): Promise<string> {
    const rows = await client.$queryRaw<Array<{ id: string }>>`
      SELECT public.append_audit_log(
        ${params.action}, ${params.resourceType}, ${params.resourceId ?? null}, ${metadataJson}::jsonb,
        ${params.ipAddress ?? null}, ${params.userAgent ?? null},
        ${params.tenantId ?? null}::uuid, ${params.actorUserId ?? null}::uuid
      )::text AS id`;
    return singleRow(rows).id;
  }
}
