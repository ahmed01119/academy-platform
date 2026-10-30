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
  UpdatePlayerSchema,
  UuidParamSchema,
  type CreatePlayerRequest,
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
  @Get(':id')
  async getPlayerById(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
  ) {
    const playerId = UuidParamSchema.parse(rawId);
    return this.playersService.getPlayerById(tenantContext, playerId);
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
