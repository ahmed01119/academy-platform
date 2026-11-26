import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { singleRow } from '../../common/db-function-error';
import type { NotificationType } from '@academy/shared';
import { ErrorCode } from '@academy/shared';

export interface CreateNotificationDto {
  /** Recipient. */
  userId: string;
  /**
   * The user on whose behalf the notification is sent (the authenticated actor of the request). The database checks
   * that this sender may notify the recipient (Phase 3A.2, create_app_notification).
   */
  senderUserId: string;
  tenantId?: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
}

export interface ListNotificationsOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

/**
 * In-app notifications. Every query runs in the actor context of the signed-in user, so RLS
 * (app_notifications_owner) limits it to that user's own notifications. Creation goes through the
 * create_app_notification database function, the only insert path the runtime database role has.
 */
@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listUserNotifications(
    userId: string,
    tenantId?: string,
    options?: ListNotificationsOptions,
  ) {
    const limit = Math.min(options?.limit ?? 20, 100);
    const offset = Math.max(options?.offset ?? 0, 0);

    const whereClause: { userId: string; tenantId?: string | null; readAt?: null } = {
      userId,
      ...(options?.unreadOnly ? { readAt: null } : {}),
      ...(tenantId ? { tenantId } : {}),
    };

    return this.prisma.withAuthLookupTransaction({ actorUserId: userId }, async (tx) => {
      const items = await tx.appNotification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });
      const unreadCount = await tx.appNotification.count({
        where: { userId, readAt: null, ...(tenantId ? { tenantId } : {}) },
      });
      const totalCount = await tx.appNotification.count({ where: whereClause });
      return { items, unreadCount, totalCount };
    });
  }

  async getUnreadCount(userId: string, tenantId?: string): Promise<number> {
    return this.prisma.withAuthLookupTransaction({ actorUserId: userId }, (tx) =>
      tx.appNotification.count({
        where: { userId, readAt: null, ...(tenantId ? { tenantId } : {}) },
      }),
    );
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.withAuthLookupTransaction({ actorUserId: userId }, async (tx) => {
      const notification = await tx.appNotification.findFirst({
        where: { id: notificationId, userId },
      });

      if (!notification) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Notification not found or access denied',
        });
      }

      return tx.appNotification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
    });
  }

  async markAllAsRead(userId: string, tenantId?: string) {
    await this.prisma.withAuthLookupTransaction({ actorUserId: userId }, (tx) =>
      tx.appNotification.updateMany({
        where: { userId, readAt: null, ...(tenantId ? { tenantId } : {}) },
        data: { readAt: new Date() },
      }),
    );

    return { success: true };
  }

  /**
   * Creates a notification through public.create_app_notification. The sender is placed in the transaction context
   * (and the tenant, for tenant notifications); the function then verifies that the sender may notify the recipient
   * and validates type, text and link. Returns the new notification's id.
   */
  async createNotification(dto: CreateNotificationDto): Promise<{ id: string }> {
    const insert = async (
      tx: Parameters<Parameters<PrismaService['withAuthLookupTransaction']>[1]>[0],
    ): Promise<{ id: string }> => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT public.create_app_notification(
          ${dto.userId}::uuid, ${dto.tenantId ?? null}::uuid, ${dto.type}, ${dto.title}, ${dto.body},
          ${dto.href ?? null}
        )::text AS id`;
      return { id: singleRow(rows).id };
    };

    return dto.tenantId
      ? this.prisma.withTenantTransaction(
          { tenantId: dto.tenantId, actorUserId: dto.senderUserId },
          insert,
        )
      : this.prisma.withAuthLookupTransaction({ actorUserId: dto.senderUserId }, insert);
  }
}
