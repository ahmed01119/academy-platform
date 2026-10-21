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
  EnrollmentQuerySchema,
  Permission,
  TransferBranchSchema,
  UuidParamSchema,
  type CreateEnrollmentRequest,
  type TenantContext,
  type TransferBranchRequest,
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
    @Query() query: unknown,
  ) {
    const validated = EnrollmentQuerySchema.parse(query);
    return this.enrollmentsService.listEnrollments(tenantContext, validated);
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
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const enrollmentId = UuidParamSchema.parse(rawId);
    const dto: TransferBranchRequest = TransferBranchSchema.parse(body);
    return this.enrollmentsService.transferBranch(tenantContext, enrollmentId, dto);
  }
}
