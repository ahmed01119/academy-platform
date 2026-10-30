import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PortalService } from './portal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { CurrentTenantContext, CurrentUser } from '../auth/decorators/auth-user.decorator';
import {
  ClaimAccountRequestSchema,
  Permission,
  type ClaimAccountRequest,
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

  @Get('guardian/me')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  async getGuardianProfile(@CurrentUser('id') actorUserId: string) {
    return this.portalService.getGuardianPortalData(actorUserId);
  }

  @Post('claim')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async redeemClaimToken(
    @CurrentUser('id') actorUserId: string,
    @Body() body: unknown,
  ) {
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
}
