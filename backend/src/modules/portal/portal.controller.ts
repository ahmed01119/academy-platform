import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PortalService } from './portal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { CurrentTenantContext, CurrentUser } from '../auth/decorators/auth-user.decorator';
import {
  ClaimAccountRequestSchema,
  CreatePlayerJoinRequestSchema,
  Permission,
  type ClaimAccountRequest,
  type CreatePlayerJoinRequest,
  type TenantContext,
} from '@academy/shared';
import { z } from 'zod';

const GenerateClaimTokenDto = z.object({
  targetType: z.enum(['PLAYER', 'GUARDIAN']),
  targetId: z.string().uuid(),
});

@Controller('portal')
export class PortalController {
  constructor(@Inject(PortalService) private readonly portalService: PortalService) {}

  @Get('player/me')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  async getPlayerProfile(@CurrentUser('id') actorUserId: string) {
    return this.portalService.getPlayerPortalData(actorUserId);
  }

  @Get('player/qr-card')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  async getMyPlayerQrCard(@CurrentUser('id') actorUserId: string) {
    return this.portalService.getMyPlayerQrCard(actorUserId);
  }

  @Get('guardian/me')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  async getGuardianProfile(@CurrentUser('id') actorUserId: string) {
    return this.portalService.getGuardianPortalData(actorUserId);
  }

  @Post('claim')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async redeemClaimToken(@CurrentUser('id') actorUserId: string, @Body() body: unknown) {
    const dto: ClaimAccountRequest = ClaimAccountRequestSchema.parse(body);
    return this.portalService.redeemClaimToken(actorUserId, dto.claimToken);
  }

  @Post('claim-token')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
  @RequirePermissions(Permission.PLAYERS_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  async generateClaimToken(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Body() body: unknown,
  ) {
    const dto = GenerateClaimTokenDto.parse(body);
    return this.portalService.generateClaimToken(tenantContext, dto.targetType, dto.targetId);
  }

  /**
   * Join request from a PLAYER (for themself) or a GUARDIAN (for a child); see CreatePlayerJoinRequestSchema.
   * Anonymous callers get a new pending account; signed-in callers' requests are linked to their account.
   * CsrfGuard applies when the caller is cookie-authenticated.
   */
  @Post('player-join-requests')
  @UseGuards(OptionalJwtAuthGuard, CsrfGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitPlayerJoinRequest(
    @Body() body: unknown,
    @Req() req: Request,
    @CurrentUser('id') actorUserId?: string,
  ) {
    const dto: CreatePlayerJoinRequest = CreatePlayerJoinRequestSchema.parse(body);
    return this.portalService.submitPlayerJoinRequest(dto, actorUserId, req.clientIp);
  }

  /** The signed-in user's own join requests (any status), newest first: the "pending" list in the portal. */
  @Get('my-join-requests')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  async listMyJoinRequests(@CurrentUser('id') actorUserId: string) {
    return this.portalService.listMyJoinRequests(actorUserId);
  }

  @Get('academies')
  async listPublicAcademies() {
    return this.portalService.listPublicAcademies();
  }
}
