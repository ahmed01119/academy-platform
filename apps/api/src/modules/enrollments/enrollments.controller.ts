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
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { CurrentTenantContext } from '../auth/decorators/auth-user.decorator';
import {
  CreateEnrollmentSchema,
  Permission,
  TransferBranchSchema,
  type CreateEnrollmentRequest,
  type TenantContext,
  type TransferBranchRequest,
  type EnrollmentStatus,
} from '@academy/shared';

@Controller('enrollments')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
export class EnrollmentsController {
  constructor(
    @Inject(EnrollmentsService) private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @RequirePermissions(Permission.PLAYERS_READ)
  @Get()
  async listEnrollments(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Query('playerId') playerId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.enrollmentsService.listEnrollments(tenantContext, {
      playerId,
      branchId,
      status: status as EnrollmentStatus,
    });
  }

  @RequirePermissions(Permission.PLAYERS_CREATE)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEnrollment(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Body() body: unknown,
  ) {
    const dto: CreateEnrollmentRequest = CreateEnrollmentSchema.parse(body);
    return this.enrollmentsService.createEnrollment(tenantContext, dto);
  }

  @RequirePermissions(Permission.PLAYERS_UPDATE)
  @Post(':id/transfer')
  @HttpCode(HttpStatus.OK)
  async transferBranch(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') enrollmentId: string,
    @Body() body: unknown,
  ) {
    const dto: TransferBranchRequest = TransferBranchSchema.parse(body);
    return this.enrollmentsService.transferBranch(tenantContext, enrollmentId, dto);
  }
}
