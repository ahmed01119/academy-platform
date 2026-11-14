import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import type { Prisma, User } from '@academy/database';
import type { TenantTransactionClient } from '@academy/database';

@Injectable()
export class UserRepository extends BaseRepository {
  async findById(id: string, tx?: TenantTransactionClient): Promise<User | null> {
    return this.getClient(tx).user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string, tx?: TenantTransactionClient): Promise<User | null> {
    return this.getClient(tx).user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findWithMemberships(id: string, tx?: TenantTransactionClient) {
    return this.getClient(tx).user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            tenant: true,
          },
        },
      },
    });
  }

  async updatePassword(
    id: string,
    passwordHash: string,
    tx?: TenantTransactionClient,
  ): Promise<User> {
    return this.getClient(tx).user.update({
      where: { id },
      data: {
        passwordHash,
        mustResetPassword: false,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
  }

  async setSuspended(
    id: string,
    isSuspended: boolean,
    suspendedReason?: string,
    tx?: TenantTransactionClient,
  ): Promise<User> {
    return this.getClient(tx).user.update({
      where: { id },
      data: {
        isSuspended,
        suspendedReason: isSuspended ? suspendedReason : null,
      },
    });
  }

  async update(
    id: string,
    data: Prisma.UserUpdateInput,
    tx?: TenantTransactionClient,
  ): Promise<User> {
    return this.getClient(tx).user.update({
      where: { id },
      data,
    });
  }
}

