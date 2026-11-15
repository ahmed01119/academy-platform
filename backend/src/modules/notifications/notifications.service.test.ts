import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service';
import type { PrismaService } from '../database/prisma.service';

const USER = '00000000-0000-0000-0000-000000000002';
const SENDER = '00000000-0000-0000-0000-000000000003';
const TENANT = '00000000-0000-0000-0000-0000000000a1';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let tx: any;
  let prisma: any;

  beforeEach(() => {
    tx = {
      appNotification: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'n-1' }]),
    };
    prisma = {
      withAuthLookupTransaction: vi.fn(
        (_options: unknown, callback: (client: unknown) => unknown) => callback(tx),
      ),
      withTenantTransaction: vi.fn((_options: unknown, callback: (client: unknown) => unknown) =>
        callback(tx),
      ),
    };
    service = new NotificationsService(prisma as PrismaService);
  });

  it('lists notifications in the actor context of the reader (RLS: own rows only)', async () => {
    tx.appNotification.findMany.mockResolvedValue([{ id: 'n-1', userId: USER, readAt: null }]);
    tx.appNotification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const result = await service.listUserNotifications(USER);

    expect(prisma.withAuthLookupTransaction).toHaveBeenCalledWith(
      { actorUserId: USER },
      expect.any(Function),
    );
    expect(result).toMatchObject({ unreadCount: 1, totalCount: 1 });
    expect(result.items).toHaveLength(1);
  });

  it('marks a single notification as read in the actor context', async () => {
    tx.appNotification.findFirst.mockResolvedValue({ id: 'n-1', userId: USER });
    tx.appNotification.update.mockResolvedValue({ id: 'n-1', readAt: new Date() });

    const result = await service.markAsRead(USER, 'n-1');

    expect(result.readAt).toBeDefined();
    expect(tx.appNotification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { readAt: expect.any(Date) },
    });
    expect(prisma.withAuthLookupTransaction).toHaveBeenCalledWith(
      { actorUserId: USER },
      expect.any(Function),
    );
  });

  it('throws NotFoundException when the notification is not the reader’s', async () => {
    tx.appNotification.findFirst.mockResolvedValue(null);
    await expect(service.markAsRead(USER, 'n-99')).rejects.toThrow(
      'Notification not found or access denied',
    );
    expect(tx.appNotification.update).not.toHaveBeenCalled();
  });

  it('marks all notifications as read', async () => {
    tx.appNotification.updateMany.mockResolvedValue({ count: 5 });
    const result = await service.markAllAsRead(USER);
    expect(result.success).toBe(true);
    expect(tx.appNotification.updateMany).toHaveBeenCalledWith({
      where: { userId: USER, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('creates a platform notification through create_app_notification with the sender as actor', async () => {
    const result = await service.createNotification({
      userId: USER,
      senderUserId: SENDER,
      type: 'SECURITY',
      title: 'Suspicious Login',
      body: 'Login from new device',
    });

    expect(result).toEqual({ id: 'n-1' });
    expect(prisma.withAuthLookupTransaction).toHaveBeenCalledWith(
      { actorUserId: SENDER },
      expect.any(Function),
    );
    expect(prisma.withTenantTransaction).not.toHaveBeenCalled();
    const sql = (tx.$queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain('public.create_app_notification');
    expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([
      USER,
      null,
      'SECURITY',
      'Suspicious Login',
      'Login from new device',
      null,
    ]);
  });

  it('creates a tenant notification under the tenant context of the sender', async () => {
    await service.createNotification({
      userId: USER,
      senderUserId: SENDER,
      tenantId: TENANT,
      type: 'EXPENSE_APPROVAL',
      title: 'Expense',
      body: 'Pending',
      href: '/finance',
    });

    expect(prisma.withTenantTransaction).toHaveBeenCalledWith(
      { tenantId: TENANT, actorUserId: SENDER },
      expect.any(Function),
    );
    expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([
      USER,
      TENANT,
      'EXPENSE_APPROVAL',
      'Expense',
      'Pending',
      '/finance',
    ]);
  });
});
