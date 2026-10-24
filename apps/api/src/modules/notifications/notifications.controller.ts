import {
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { CurrentUser } from '../auth/decorators/auth-user.decorator';
import { UuidParamSchema } from '@academy/shared';

@Controller('notifications')
@UseGuards(JwtAuthGuard, CsrfGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async listUserNotifications(
    @CurrentUser('id') userId: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.listUserNotifications(userId, tenantId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser('id') userId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const count = await this.notificationsService.getUnreadCount(userId, tenantId);
    return { unreadCount: count };
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') rawId: string,
  ) {
    const notificationId = UuidParamSchema.parse(rawId);
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  @Post('mark-all-read')
  async markAllAsRead(
    @CurrentUser('id') userId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.notificationsService.markAllAsRead(userId, tenantId);
  }
}
