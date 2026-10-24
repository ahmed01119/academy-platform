import { z } from 'zod';

export const NotificationTypeSchema = z.enum([
  'ACADEMY_APPLICATION',
  'PLAYER_REGISTRATION',
  'EXPENSE_APPROVAL',
  'EVALUATION_PUBLISHED',
  'SUBSCRIPTION',
  'SECURITY',
  'SYSTEM',
]);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tenantId: z.string().uuid().nullable().optional(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  href: z.string().nullable().optional(),
  readAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()),
});

export type NotificationItem = z.infer<typeof NotificationItemSchema>;
export type AppNotificationItem = NotificationItem;

export const NotificationsListResponseSchema = z.object({
  items: z.array(NotificationItemSchema),
  unreadCount: z.number(),
  totalCount: z.number(),
});

export type NotificationsListResponse = z.infer<typeof NotificationsListResponseSchema>;
