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
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { CurrentTenantContext } from '../auth/decorators/auth-user.decorator';
import {
  CreateBranchSchema,
  Permission,
  UpdateBranchSchema,
  type CreateBranchRequest,
  type TenantContext,
  type UpdateBranchRequest,
  type BranchStatus,
} from '@academy/shared';

@Controller('branches')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
export class BranchesController {
  constructor(@Inject(BranchesService) private readonly branchesService: BranchesService) {}

  @RequirePermissions(Permission.BRANCHES_READ)
  @Get()
  async listBranches(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.branchesService.listBranches(tenantContext, {
      search,
      status: status as BranchStatus,
    });
  }

  @RequirePermissions(Permission.BRANCHES_READ)
  @Get(':id')
  async getBranchById(
    @CurrentTenantContext() tenantContext: TenantContext,
    @Param('id') branchId: string,
  ) {
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
    @Param('id') branchId: string,
    @Body() body: unknown,
  ) {
    const dto: UpdateBranchRequest = UpdateBranchSchema.parse(body);
    return this.branchesService.updateBranch(tenantContext, branchId, dto);
  }
}
