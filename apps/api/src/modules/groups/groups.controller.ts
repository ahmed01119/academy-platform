import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import {
  AssignCoachRequestSchema,
  AssignPlayerRequestSchema,
  CreateScheduleRequestSchema,
  CreateTrainingGroupRequestSchema,
  GroupQuerySchema,
  Permission,
  UpdateTrainingGroupRequestSchema,
  UuidParamSchema,
  type TenantContext,
} from '@academy/shared';

@Controller('groups')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
export class GroupsController {
  constructor(@Inject(GroupsService) private readonly groupsService: GroupsService) {}

  @Post()
  @RequirePermissions(Permission.GROUPS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async createGroup(@Body() body: unknown, @Req() req: Request) {
    const dto = CreateTrainingGroupRequestSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.groupsService.createGroup(tenantContext, dto);
  }

  @Get()
  @RequirePermissions(Permission.GROUPS_READ)
  async listGroups(@Query() query: unknown, @Req() req: Request) {
    const parsedQuery = GroupQuerySchema.parse(query);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.groupsService.listGroups(tenantContext, parsedQuery);
  }

  @Get(':id')
  @RequirePermissions(Permission.GROUPS_READ)
  async getGroupById(@Param('id') id: string, @Req() req: Request) {
    const validId = UuidParamSchema.parse(id);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.groupsService.getGroupById(tenantContext, validId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.GROUPS_MANAGE)
  @HttpCode(HttpStatus.OK)
  async updateGroup(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const validId = UuidParamSchema.parse(id);
    const dto = UpdateTrainingGroupRequestSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.groupsService.updateGroup(tenantContext, validId, dto);
  }

  @Post(':id/coaches')
  @RequirePermissions(Permission.GROUPS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async assignCoach(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const validGroupId = UuidParamSchema.parse(id);
    const dto = AssignCoachRequestSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.groupsService.assignCoach(tenantContext, validGroupId, dto);
  }

  @Delete(':id/coaches/:coachUserId')
  @RequirePermissions(Permission.GROUPS_MANAGE)
  @HttpCode(HttpStatus.OK)
  async removeCoach(
    @Param('id') id: string,
    @Param('coachUserId') coachUserId: string,
    @Req() req: Request,
  ) {
    const validGroupId = UuidParamSchema.parse(id);
    const validCoachId = UuidParamSchema.parse(coachUserId);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.groupsService.removeCoach(tenantContext, validGroupId, validCoachId);
  }

  @Post(':id/members')
  @RequirePermissions(Permission.GROUPS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async assignPlayer(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const validGroupId = UuidParamSchema.parse(id);
    const dto = AssignPlayerRequestSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.groupsService.assignPlayer(tenantContext, validGroupId, dto);
  }

  @Delete(':id/members/:playerId')
  @RequirePermissions(Permission.GROUPS_MANAGE)
  @HttpCode(HttpStatus.OK)
  async removePlayer(
    @Param('id') id: string,
    @Param('playerId') playerId: string,
    @Req() req: Request,
  ) {
    const validGroupId = UuidParamSchema.parse(id);
    const validPlayerId = UuidParamSchema.parse(playerId);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.groupsService.removePlayer(tenantContext, validGroupId, validPlayerId);
  }

  @Post(':id/schedules')
  @RequirePermissions(Permission.GROUPS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async createSchedule(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const validGroupId = UuidParamSchema.parse(id);
    const dto = CreateScheduleRequestSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.groupsService.createSchedule(tenantContext, validGroupId, dto);
  }

  @Delete(':id/schedules/:scheduleId')
  @RequirePermissions(Permission.GROUPS_MANAGE)
  @HttpCode(HttpStatus.OK)
  async deleteSchedule(
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
    @Req() req: Request,
  ) {
    const validGroupId = UuidParamSchema.parse(id);
    const validScheduleId = UuidParamSchema.parse(scheduleId);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.groupsService.deleteSchedule(tenantContext, validGroupId, validScheduleId);
  }
}
