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
  UseGuards,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { CurrentTenantContext } from '../auth/decorators/auth-user.decorator';
import {
  BranchQuerySchema,
  CreateBranchSchema,
  Permission,
  UpdateBranchSchema,
  UuidParamSchema,
  type CreateBranchRequest,
  type TenantContext,
  type UpdateBranchRequest,
} from '@academy/shared';

@Controller('branches')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
export class BranchesController {
  constructor(@Inject(BranchesService) private readonly branchesService: BranchesService) {}

  @RequirePermissions(Permission.BRANCHES_READ)
  @Get()
  async listBranches(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Query() query: unknown,
  ) {
    const validated = BranchQuerySchema.parse(query);
    return this.branchesService.listBranches(tenantContext, validated);
  }

  @RequirePermissions(Permission.BRANCHES_READ)
  @Get(':id')
  async getBranchById(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
  ) {
    const branchId = UuidParamSchema.parse(rawId);
    return this.branchesService.getBranchById(tenantContext, branchId);
  }

  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBranch(@CurrentTenantContext() tenantContext: TenantContext, @Body() body: unknown) {
    const dto: CreateBranchRequest = CreateBranchSchema.parse(body);
    return this.branchesService.createBranch(tenantContext, dto);
  }

  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @Patch(':id')
  async updateBranch(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const branchId = UuidParamSchema.parse(rawId);
    const dto: UpdateBranchRequest = UpdateBranchSchema.parse(body);
    return this.branchesService.updateBranch(tenantContext, branchId, dto);
  }

  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @Get(':id/deletion-impact')
  async getBranchDeletionImpact(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
  ) {
    const branchId = UuidParamSchema.parse(rawId);
    return this.branchesService.getBranchDeletionImpact(tenantContext, branchId);
  }

  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @Delete(':id')
  async archiveBranch(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') rawId: string,
  ) {
    const branchId = UuidParamSchema.parse(rawId);
    return this.branchesService.archiveBranch(tenantContext, branchId);
  }
}
