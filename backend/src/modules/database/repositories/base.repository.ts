import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { TenantTransactionClient } from '@academy/database';

@Injectable()
export abstract class BaseRepository {
  constructor(@Inject(PrismaService) protected readonly prisma: PrismaService) {}

  /**
   * Helper to select the active execution client:
   * Returns the explicit transaction client `tx` if supplied, otherwise falls back to `PrismaService`.
   */
  protected getClient(tx?: TenantTransactionClient): TenantTransactionClient | PrismaService {
    return tx ?? this.prisma;
  }
}
