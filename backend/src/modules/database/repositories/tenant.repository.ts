import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import type { Tenant, TenantMembership, TenantStatus } from '@academy/database';
import type { TenantTransactionClient } from '@academy/database';

@Injectable()
export class TenantRepository extends BaseRepository {
  async findById(id: string, tx?: TenantTransactionClient): Promise<Tenant | null> {
    return this.getClient(tx).tenant.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string, tx?: TenantTransactionClient): Promise<Tenant | null> {
    return this.getClient(tx).tenant.findUnique({
      where: { slug: slug.toLowerCase().trim() },
    });
  }

  async findMembership(
    userId: string,
    tenantId: string,
    tx?: TenantTransactionClient,
  ): Promise<TenantMembership | null> {
    return this.getClient(tx).tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
    });
  }

  async listUserMemberships(
    userId: string,
    tx?: TenantTransactionClient,
  ): Promise<(TenantMembership & { tenant: Tenant })[]> {
    return this.getClient(tx).tenantMembership.findMany({
      where: { userId },
      include: { tenant: true },
    });
  }

  async updateStatus(
    tenantId: string,
    status: TenantStatus,
    tx?: TenantTransactionClient,
  ): Promise<Tenant> {
    return this.getClient(tx).tenant.update({
      where: { id: tenantId },
      data: { status },
    });
  }
}

