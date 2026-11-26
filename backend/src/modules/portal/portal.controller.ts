import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PortalService } from './portal.service';
import { GuardianLinkService } from './guardian-link.service';
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
  DecideGuardianLinkSchema,
  GuardianLinkTokenSchema,
  RequestGuardianLinkSchema,
  type GuardianLinkRequestView,
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
  constructor(
    @Inject(PortalService) private readonly portalService: PortalService,
    @Inject(GuardianLinkService) private readonly guardianLinks: GuardianLinkService,
  ) {}

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

  /**
   * A signed-in guardian asks to be linked to a child with a player account (child's e-mail + the guardian's phone as
   * the academy registered it). Always 200 with the same answer; the child gets an approval e-mail when both match.
   */
  @Post('guardian-links')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async requestGuardianLink(@CurrentUser('id') actorUserId: string, @Body() body: unknown) {
    return this.guardianLinks.requestLink(actorUserId, RequestGuardianLinkSchema.parse(body));
  }

  /** The request the child is asked to approve (public; the signed link from the e-mail is the credential). */
  @Get('guardian-links/approval')
  async getGuardianLinkRequest(@Query('token') token: unknown): Promise<GuardianLinkRequestView> {
    return this.guardianLinks.getRequest(GuardianLinkTokenSchema.parse(token));
  }

  /** The child's answer: APPROVE links the guardian record to the requesting account; DECLINE leaves it unlinked. */
  @Post('guardian-links/approval')
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async decideGuardianLink(@Body() body: unknown) {
    return this.guardianLinks.decide(DecideGuardianLinkSchema.parse(body));
  }
}
