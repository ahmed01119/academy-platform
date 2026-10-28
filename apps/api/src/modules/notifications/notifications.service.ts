import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { NotificationType } from '@academy/shared';
import { ErrorCode } from '@academy/shared';

export interface CreateNotificationDto {
  userId: string;
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

    const whereClause: {
      userId: string;
      tenantId?: string | null;
      readAt?: null;
    } = {
      userId,
      ...(options?.unreadOnly ? { readAt: null } : {}),
      ...(tenantId ? { tenantId } : {}),
    };

    const [items, unreadCount, totalCount] = await Promise.all([
      this.prisma.appNotification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.appNotification.count({
        where: {
          userId,
          readAt: null,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.appNotification.count({
        where: whereClause,
      }),
    ]);

    return {
      items,
      unreadCount,
      totalCount,
    };
  }

  async getUnreadCount(userId: string, tenantId?: string): Promise<number> {
    return this.prisma.appNotification.count({
      where: {
        userId,
        readAt: null,
        ...(tenantId ? { tenantId } : {}),
      },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.appNotification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Notification not found or access denied',
      });
    }

    return this.prisma.appNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string, tenantId?: string) {
    await this.prisma.appNotification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(tenantId ? { tenantId } : {}),
      },
      data: { readAt: new Date() },
    });

    return { success: true };
  }

  async createNotification(dto: CreateNotificationDto) {
    return this.prisma.appNotification.create({
      data: {
        userId: dto.userId,
        tenantId: dto.tenantId ?? null,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        href: dto.href ?? null,
      },
    });
  }
}
