import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { TenancyService } from './tenancy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { CurrentUser, CurrentTenantContext } from '../auth/decorators/auth-user.decorator';
import {
  AcceptInviteRequestSchema,
  InviteStaffRequestSchema,
  Permission,
  SwitchTenantRequestSchema,
  UpdateAcademySettingsSchema,
  type AcceptInviteRequest,
  type InviteStaffRequest,
  type SwitchTenantRequest,
  type TenantContext,
  type UpdateAcademySettings,
} from '@academy/shared';

@Controller('tenants')
@UseGuards(CsrfGuard)
export class TenancyController {
  constructor(@Inject(TenancyService) private readonly tenancyService: TenancyService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my-memberships')
  async listMyMemberships(@CurrentUser('id') userId: string) {
    return this.tenancyService.listUserMemberships(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch')
  @HttpCode(HttpStatus.OK)
  async switchTenant(
    @CurrentUser('id') userId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const dto: SwitchTenantRequest = SwitchTenantRequestSchema.parse(body);
    const membership = await this.tenancyService.switchTenant(userId, dto.tenantId);

    res.cookie('tenant_id', dto.tenantId, {
      httpOnly: false, // accessible to client for UI awareness
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return membership;
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  async inviteStaff(@CurrentTenantContext() tenantContext: TenantContext, @Body() body: unknown) {
    const dto: InviteStaffRequest = InviteStaffRequestSchema.parse(body);
    return this.tenancyService.inviteStaff(tenantContext, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(@Req() req: Request, @Body() body: unknown) {
    const dto: AcceptInviteRequest = AcceptInviteRequestSchema.parse(body);
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    return this.tenancyService.acceptInvitation(userId, dto);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @Post('memberships/:id/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeMembership(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') membershipId: string,
  ) {
    return this.tenancyService.revokeMembership(tenantContext, membershipId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_READ)
  @Get('staff')
  async listStaff(@CurrentTenantContext() tenantContext: TenantContext) {
    return this.tenancyService.listStaff(tenantContext);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('branches')
  async listBranches(@CurrentTenantContext() tenantContext: TenantContext) {
    return this.tenancyService.listBranches(tenantContext);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('profile')
  async getProfile(@CurrentTenantContext() tenantContext: TenantContext) {
    return this.tenancyService.getProfile(tenantContext);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.TENANT_UPDATE)
  @Patch('profile')
  async updateProfile(@CurrentTenantContext() tenantContext: TenantContext, @Body() body: unknown) {
    const dto: UpdateAcademySettings = UpdateAcademySettingsSchema.parse(body);
    return this.tenancyService.updateProfile(tenantContext, dto);
  }
}
