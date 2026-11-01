import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service';
import type { PrismaService } from '../database/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPrisma: Partial<PrismaService>;

  beforeEach(() => {
    mockPrisma = {
      appNotification: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      } as any,
    };
    service = new NotificationsService(mockPrisma as PrismaService);
  });

  it('lists notifications and computes unread count', async () => {
    const mockItems = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        userId: '00000000-0000-0000-0000-000000000002',
        title: 'Session Scheduled',
        body: 'Your training starts at 5 PM',
        readAt: null,
      },
    ];

    (mockPrisma.appNotification!.findMany as any).mockResolvedValue(mockItems);
    (mockPrisma.appNotification!.count as any)
      .mockResolvedValueOnce(1) // unread count
      .mockResolvedValueOnce(1); // total count

    const result = await service.listUserNotifications('00000000-0000-0000-0000-000000000002');
    expect(result.items).toHaveLength(1);
    expect(result.unreadCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('marks a single notification as read', async () => {
    (mockPrisma.appNotification!.findFirst as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
    });
    (mockPrisma.appNotification!.update as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      readAt: new Date(),
    });

    const result = await service.markAsRead(
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000001',
    );
    expect(result.readAt).toBeDefined();
  });

  it('throws NotFoundException when notification does not exist or user mismatch', async () => {
    (mockPrisma.appNotification!.findFirst as any).mockResolvedValue(null);

    await expect(
      service.markAsRead(
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000099',
      ),
    ).rejects.toThrow('Notification not found or access denied');
  });

  it('marks all notifications as read', async () => {
    (mockPrisma.appNotification!.updateMany as any).mockResolvedValue({ count: 5 });

    const result = await service.markAllAsRead('00000000-0000-0000-0000-000000000002');
    expect(result.success).toBe(true);
    expect(mockPrisma.appNotification!.updateMany).toHaveBeenCalledWith({
      where: {
        userId: '00000000-0000-0000-0000-000000000002',
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
  });

  it('creates notification with appropriate parameters', async () => {
    (mockPrisma.appNotification!.create as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Alert',
    });

    const result = await service.createNotification({
      userId: '00000000-0000-0000-0000-000000000002',
      type: 'SECURITY',
      title: 'Suspicious Login',
      body: 'Login from new device',
    });

    expect(result.title).toBe('Alert');
  });
});
