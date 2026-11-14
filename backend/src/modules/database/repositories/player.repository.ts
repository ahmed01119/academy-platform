import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import type { Player, PlayerStatus, Prisma } from '@academy/database';
import type { TenantTransactionClient } from '@academy/database';

@Injectable()
export class PlayerRepository extends BaseRepository {
  async findById(
    tenantId: string,
    id: string,
    tx?: TenantTransactionClient,
  ): Promise<Player | null> {
    return this.getClient(tx).player.findFirst({
      where: {
        id,
        tenantId,
      },
    });
  }

  async findWithDetails(
    tenantId: string,
    id: string,
    tx?: TenantTransactionClient,
  ) {
    return this.getClient(tx).player.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        guardians: true,
        enrollments: {
          include: {
            branch: true,
          },
        },
        groupMemberships: {
          include: {
            group: true,
          },
        },
      },
    });
  }

  async findMany(
    tenantId: string,
    params: {
      status?: PlayerStatus;
      search?: string;
      limit?: number;
      offset?: number;
    },
    tx?: TenantTransactionClient,
  ): Promise<Player[]> {
    const where: Prisma.PlayerWhereInput = {
      tenantId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { firstName: { contains: params.search, mode: 'insensitive' } },
              { lastName: { contains: params.search, mode: 'insensitive' } },
              { nationalId: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.getClient(tx).player.findMany({
      where,
      take: params.limit,
      skip: params.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(
    tenantId: string,
    filter?: Prisma.PlayerWhereInput,
    tx?: TenantTransactionClient,
  ): Promise<number> {
    return this.getClient(tx).player.count({
      where: {
        tenantId,
        ...filter,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: Prisma.PlayerUpdateInput,
    tx?: TenantTransactionClient,
  ): Promise<Player> {
    return this.getClient(tx).player.update({
      where: {
        tenantId_id: {
          tenantId,
          id,
        },
      },
      data,
    });
  }
}

