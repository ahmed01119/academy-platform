import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { CurrentTenantContext, CurrentUser } from '../auth/decorators/auth-user.decorator';
import {
  CreateEvaluationTemplateSchema,
  CreatePlayerEvaluationSchema,
  Permission,
  UuidParamSchema,
  type CreateEvaluationTemplateRequest,
  type CreatePlayerEvaluationRequest,
  type TenantContext,
} from '@academy/shared';

@Controller('evaluations')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
export class EvaluationsController {
  constructor(
    @Inject(EvaluationsService) private readonly evaluationsService: EvaluationsService,
  ) {}

  @RequirePermissions(Permission.EVALUATIONS_READ)
  @Get('templates')
  async listTemplates(@CurrentTenantContext() tenantContext: TenantContext) {
    return this.evaluationsService.listTemplates(tenantContext);
  }

  @RequirePermissions(Permission.EVALUATIONS_MANAGE)
  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Body() body: unknown,
  ) {
    const dto: CreateEvaluationTemplateRequest = CreateEvaluationTemplateSchema.parse(body);
    return this.evaluationsService.createTemplate(tenantContext, dto);
  }

  @RequirePermissions(Permission.EVALUATIONS_CREATE)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEvaluation(
    @CurrentTenantContext() tenantContext: TenantContext,
    @CurrentUser('id') evaluatorUserId: string,
    @Body() body: unknown,
  ) {
    const dto: CreatePlayerEvaluationRequest = CreatePlayerEvaluationSchema.parse(body);
    return this.evaluationsService.createEvaluation(tenantContext, evaluatorUserId, dto);
  }

  @RequirePermissions(Permission.EVALUATIONS_READ)
  @Get('player/:playerId')
  async listPlayerEvaluations(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('playerId') rawId: string,
  ) {
    const playerId = UuidParamSchema.parse(rawId);
    return this.evaluationsService.listPlayerEvaluations(tenantContext, playerId);
  }

  @RequirePermissions(Permission.EVALUATIONS_READ)
  @Get('player/:playerId/profile')
  async getPlayerDevelopmentProfile(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('playerId') rawId: string,
  ) {
    const playerId = UuidParamSchema.parse(rawId);
    return this.evaluationsService.getPlayerDevelopmentProfile(tenantContext, playerId);
  }

  @RequirePermissions(Permission.EVALUATIONS_READ)
  @Get('session/:sessionId')
  async listSessionEvaluations(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('sessionId') rawId: string,
  ) {
    const sessionId = UuidParamSchema.parse(rawId);
    return this.evaluationsService.listSessionEvaluations(tenantContext, sessionId);
  }

  @RequirePermissions(Permission.EVALUATIONS_READ)
  @Get('rankings')
  async getRankings(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Query('ageCategory') ageCategory?: string,
    @Query('groupId') groupId?: string,
    @Query('timeframe') timeframe?: string,
  ) {
    return this.evaluationsService.getPerformanceRankings(tenantContext, {
      ageCategory,
      groupId,
      timeframe,
    });
  }
}
