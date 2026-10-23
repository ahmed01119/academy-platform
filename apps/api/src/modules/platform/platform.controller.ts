import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/guards/platform-super-admin.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { CurrentUser } from '../auth/decorators/auth-user.decorator';
import {
  RequestSupportAccessSchema,
  UpdateAcademyStatusRequestSchema,
  UpdateUserSecurityPolicyRequestSchema,
  UpdateSaaSPlanRequestSchema,
  UpdateTenantSubscriptionRequestSchema,
  CreatePlatformAnnouncementRequestSchema,
  UuidParamSchema,
  type RequestSupportAccessRequest,
  type UpdateAcademyStatusRequest,
  type UpdateUserSecurityPolicyRequest,
  type UpdateSaaSPlanRequest,
  type UpdateTenantSubscriptionRequest,
  type CreatePlatformAnnouncementRequest,
} from '@academy/shared';

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard, CsrfGuard)
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platformService: PlatformService) {}

  @Get('metrics')
  async getMetrics(@CurrentUser('id') actorUserId: string) {
    return this.platformService.getOverviewMetrics(actorUserId);
  }

  @Get('academies')
  async listAcademies(
    @CurrentUser('id') actorUserId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.platformService.listAcademies(actorUserId, { status, search });
  }

  @Patch('academies/:id/status')
  async updateAcademyStatus(
    @CurrentUser('id') actorUserId: string,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const academyId = UuidParamSchema.parse(rawId);
    const dto: UpdateAcademyStatusRequest = UpdateAcademyStatusRequestSchema.parse(body);
    return this.platformService.updateAcademyStatus(actorUserId, academyId, dto);
  }

  @Patch('academies/:id/subscription')
  async updateAcademySubscription(
    @CurrentUser('id') actorUserId: string,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const academyId = UuidParamSchema.parse(rawId);
    const dto: UpdateTenantSubscriptionRequest = UpdateTenantSubscriptionRequestSchema.parse(body);
    return this.platformService.updateTenantSubscription(actorUserId, academyId, dto);
  }

  @Post('academies/:id/support-access')
  async requestSupportAccess(
    @CurrentUser('id') actorUserId: string,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const academyId = UuidParamSchema.parse(rawId);
    const dto: RequestSupportAccessRequest = RequestSupportAccessSchema.parse(body);
    return this.platformService.requestSupportAccess(actorUserId, academyId, dto);
  }

  @Get('users')
  async listUsers(
    @CurrentUser('id') actorUserId: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.platformService.listUsers(actorUserId, {
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('users/:id/revoke-sessions')
  async revokeUserSessions(
    @CurrentUser('id') actorUserId: string,
    @Param('id') rawId: string,
  ) {
    const userId = UuidParamSchema.parse(rawId);
    return this.platformService.revokeUserSessions(actorUserId, userId);
  }

  @Patch('users/:id/security-policy')
  async updateUserSecurityPolicy(
    @CurrentUser('id') actorUserId: string,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const userId = UuidParamSchema.parse(rawId);
    const dto: UpdateUserSecurityPolicyRequest = UpdateUserSecurityPolicyRequestSchema.parse(body);
    return this.platformService.updateUserSecurityPolicy(actorUserId, userId, dto);
  }

  @Get('saas-plans')
  async listSaaSPlans(@CurrentUser('id') actorUserId: string) {
    return this.platformService.listSaaSPlans(actorUserId);
  }

  @Patch('saas-plans/:code')
  async updateSaaSPlan(
    @CurrentUser('id') actorUserId: string,
    @Param('code') code: string,
    @Body() body: unknown,
  ) {
    const dto: UpdateSaaSPlanRequest = UpdateSaaSPlanRequestSchema.parse(body);
    return this.platformService.updateSaaSPlan(actorUserId, code, dto);
  }

  @Get('announcements')
  async listAnnouncements(@CurrentUser('id') actorUserId: string) {
    return this.platformService.listAnnouncements(actorUserId);
  }

  @Post('announcements')
  async createAnnouncement(
    @CurrentUser('id') actorUserId: string,
    @Body() body: unknown,
  ) {
    const dto: CreatePlatformAnnouncementRequest = CreatePlatformAnnouncementRequestSchema.parse(body);
    return this.platformService.createAnnouncement(actorUserId, dto);
  }

  @Get('audit-logs')
  async listAuditLogs(
    @CurrentUser('id') actorUserId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.platformService.listAuditLogs(actorUserId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('security-events')
  async getSecurityEvents(@CurrentUser('id') actorUserId: string) {
    return this.platformService.getSecurityEvents(actorUserId);
  }
}
