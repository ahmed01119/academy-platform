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
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlayersService } from './players.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { CurrentTenantContext } from '../auth/decorators/auth-user.decorator';
import {
  CreatePlayerSchema,
  Permission,
  PlayerQuerySchema,
  RevokePlayerQrCardRequestSchema,
  RotatePlayerQrCardRequestSchema,
  UpdatePlayerSchema,
  ReviewPlayerJoinRequestSchema,
  UuidParamSchema,
  type CreatePlayerRequest,
  type RevokePlayerQrCardRequest,
  type RotatePlayerQrCardRequest,
  type ReviewPlayerJoinRequest,
  type ApplicationStatus,
  type TenantContext,
  type UpdatePlayerRequest,
} from '@academy/shared';

@Controller('players')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
export class PlayersController {
  constructor(@Inject(PlayersService) private readonly playersService: PlayersService) {}

  @RequirePermissions(Permission.PLAYERS_READ)
  @Get()
  async listPlayers(@CurrentTenantContext() tenantContext: TenantContext, @Query() query: unknown) {
    const validated = PlayerQuerySchema.parse(query);
    return this.playersService.listPlayers(tenantContext, validated);
  }

  @RequirePermissions(Permission.PLAYERS_READ)
  @Get('registration-requests')
  async listPlayerJoinRequests(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Query('status') status?: string,
  ) {
    return this.playersService.listPlayerJoinRequests(
      tenantContext,
      status as ApplicationStatus | undefined,
    );
  }

  @RequirePermissions(Permission.PLAYERS_CREATE)
  @Post('registration-requests/:id/review')
  async reviewPlayerJoinRequest(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const requestId = UuidParamSchema.parse(rawId);
    const dto: ReviewPlayerJoinRequest = ReviewPlayerJoinRequestSchema.parse(body);
    return this.playersService.reviewPlayerJoinRequest(tenantContext, requestId, dto);
  }

  @RequirePermissions(Permission.PLAYERS_READ)
  @Get(':id')
  async getPlayerById(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
  ) {
    const playerId = UuidParamSchema.parse(rawId);
    return this.playersService.getPlayerById(tenantContext, playerId);
  }

  @RequirePermissions(Permission.PLAYERS_READ)
  @Get(':id/qr-card')
  async getPlayerQrCard(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
  ) {
    const playerId = UuidParamSchema.parse(rawId);
    return this.playersService.getPlayerQrCard(tenantContext, playerId);
  }

  @RequirePermissions(Permission.PLAYERS_UPDATE)
  @Post(':id/qr-card/rotate')
  @HttpCode(HttpStatus.OK)
  async rotatePlayerQrCard(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const playerId = UuidParamSchema.parse(rawId);
    const dto: RotatePlayerQrCardRequest = RotatePlayerQrCardRequestSchema.parse(body || {});
    return this.playersService.rotatePlayerQrCard(tenantContext, playerId, dto);
  }

  @RequirePermissions(Permission.PLAYERS_UPDATE)
  @Post(':id/qr-card/revoke')
  @HttpCode(HttpStatus.OK)
  async revokePlayerQrCard(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const playerId = UuidParamSchema.parse(rawId);
    const dto: RevokePlayerQrCardRequest = RevokePlayerQrCardRequestSchema.parse(body);
    return this.playersService.revokePlayerQrCard(tenantContext, playerId, dto);
  }

  @RequirePermissions(Permission.PLAYERS_CREATE)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPlayer(@CurrentTenantContext() tenantContext: TenantContext, @Body() body: unknown) {
    const dto: CreatePlayerRequest = CreatePlayerSchema.parse(body);
    return this.playersService.createPlayer(tenantContext, dto);
  }

  @RequirePermissions(Permission.PLAYERS_UPDATE)
  @Patch(':id')
  async updatePlayer(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const playerId = UuidParamSchema.parse(rawId);
    const dto: UpdatePlayerRequest = UpdatePlayerSchema.parse(body);
    return this.playersService.updatePlayer(tenantContext, playerId, dto);
  }
}
