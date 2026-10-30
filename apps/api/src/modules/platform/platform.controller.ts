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
  DeleteAcademyRequestSchema,
  UpdateUserSecurityPolicyRequestSchema,
  UpdateSaaSPlanRequestSchema,
  UpdateTenantSubscriptionRequestSchema,
  CreatePlatformAnnouncementRequestSchema,
  CreateAcademyApplicationRequestSchema,
  ReviewAcademyApplicationRequestSchema,
  ExecuteStorageMaintenanceRequestSchema,
  InvitePlatformSuperAdminRequestSchema,
  UpdatePlatformAdminRoleRequestSchema,
  PlatformInviteUserRequestSchema,
  UuidParamSchema,
  type RequestSupportAccessRequest,
  type UpdateAcademyStatusRequest,
  type UpdateUserSecurityPolicyRequest,
  type UpdateSaaSPlanRequest,
  type UpdateTenantSubscriptionRequest,
  type CreatePlatformAnnouncementRequest,
  type CreateAcademyApplicationRequest,
  type ReviewAcademyApplicationRequest,
  type ExecuteStorageMaintenanceRequest,
  type InvitePlatformSuperAdminRequest,
  type UpdatePlatformAdminRoleRequest,
  type PlatformInviteUserRequest,
  type ApplicationStatus,
} from '@academy/shared';
import { PlatformOwnerGuard } from '../auth/guards/platform-owner.guard';
import { Public } from '../auth/guards/public.decorator';

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

  @Get('academies/:id/deletion-impact')
  @UseGuards(PlatformOwnerGuard)
  async getAcademyDeletionImpact(
    @CurrentUser('id') actorUserId: string,
    @Param('id') rawId: string,
  ) {
    const academyId = UuidParamSchema.parse(rawId);
    return this.platformService.getAcademyDeletionImpact(actorUserId, academyId);
  }

  @Post('academies/:id/archive')
  @UseGuards(PlatformOwnerGuard)
  async deleteOrArchiveAcademy(
    @CurrentUser('id') actorUserId: string,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const academyId = UuidParamSchema.parse(rawId);
    const dto = DeleteAcademyRequestSchema.parse(body);
    return this.platformService.deleteOrArchiveAcademy(actorUserId, academyId, dto);
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
  async revokeUserSessions(@CurrentUser('id') actorUserId: string, @Param('id') rawId: string) {
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
  async createAnnouncement(@CurrentUser('id') actorUserId: string, @Body() body: unknown) {
    const dto: CreatePlatformAnnouncementRequest =
      CreatePlatformAnnouncementRequestSchema.parse(body);
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

  @Public()
  @Post('applications/public')
  async submitAcademyApplicationPublic(
    @Body() body: unknown,
    @CurrentUser('id') actorUserId?: string,
  ) {
    const dto: CreateAcademyApplicationRequest = CreateAcademyApplicationRequestSchema.parse(body);
    return this.platformService.submitAcademyApplication(actorUserId ?? '', dto);
  }

  @Get('applications')
  async listAcademyApplications(
    @CurrentUser('id') actorUserId: string,
    @Query('status') status?: string,
  ) {
    return this.platformService.listAcademyApplications(
      actorUserId,
      status as ApplicationStatus | undefined,
    );
  }

  @Patch('applications/:id/review')
  async reviewAcademyApplication(
    @CurrentUser('id') actorUserId: string,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const applicationId = UuidParamSchema.parse(rawId);
    const dto: ReviewAcademyApplicationRequest = ReviewAcademyApplicationRequestSchema.parse(body);
    return this.platformService.reviewAcademyApplication(actorUserId, applicationId, dto);
  }

  @Post('applications/:id/review')
  async reviewAcademyApplicationPost(
    @CurrentUser('id') actorUserId: string,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const applicationId = UuidParamSchema.parse(rawId);
    const dto: ReviewAcademyApplicationRequest = ReviewAcademyApplicationRequestSchema.parse(body);
    return this.platformService.reviewAcademyApplication(actorUserId, applicationId, dto);
  }

  @Post('super-admin/invite')
  @UseGuards(PlatformOwnerGuard)
  async invitePlatformSuperAdmin(@CurrentUser('id') actorUserId: string, @Body() body: unknown) {
    const dto: InvitePlatformSuperAdminRequest = InvitePlatformSuperAdminRequestSchema.parse(body);
    return this.platformService.invitePlatformSuperAdmin(actorUserId, dto);
  }

  @Patch('super-admin/:id/role')
  @UseGuards(PlatformOwnerGuard)
  async updatePlatformAdminRole(
    @CurrentUser('id') actorUserId: string,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const targetUserId = UuidParamSchema.parse(rawId);
    const dto: UpdatePlatformAdminRoleRequest = UpdatePlatformAdminRoleRequestSchema.parse(body);
    return this.platformService.updatePlatformAdminRole(actorUserId, targetUserId, dto);
  }

  @Post('users/invite')
  async inviteUser(@CurrentUser('id') actorUserId: string, @Body() body: unknown) {
    const dto: PlatformInviteUserRequest = PlatformInviteUserRequestSchema.parse(body);
    return this.platformService.inviteUser(actorUserId, dto);
  }

  @Get('storage/metrics')
  async getStorageMetrics(@CurrentUser('id') actorUserId: string) {
    return this.platformService.getStorageMetrics(actorUserId);
  }

  @Get('storage/stats')
  async getStorageStatsAlias(@CurrentUser('id') actorUserId: string) {
    return this.platformService.getStorageMetrics(actorUserId);
  }

  @Post('storage/maintenance/dry-run')
  async dryRunStorageMaintenance(@CurrentUser('id') actorUserId: string) {
    return this.platformService.dryRunStorageMaintenance(actorUserId);
  }

  @Post('storage/maintenance/execute')
  async executeStorageMaintenance(@CurrentUser('id') actorUserId: string, @Body() body: unknown) {
    const dto: ExecuteStorageMaintenanceRequest =
      ExecuteStorageMaintenanceRequestSchema.parse(body);
    return this.platformService.executeStorageMaintenance(actorUserId, dto);
  }
}
