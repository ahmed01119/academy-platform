import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import {
  Permission,
  CreatePlayerSubscriptionPlanRequestSchema,
  CreatePlayerSubscriptionRequestSchema,
  RecordPlayerPaymentRequestSchema,
  ReverseTransactionRequestSchema,
  RecordSessionExpenseRequestSchema,
  CloseSessionCashierRequestSchema,
  ApproveExpenseRequestSchema,
  RejectExpenseRequestSchema,
  UuidParamSchema,
  type TenantContext,
  type CreatePlayerSubscriptionPlanRequest,
  type CreatePlayerSubscriptionRequest,
  type RecordPlayerPaymentRequest,
  type ReverseTransactionRequest,
  type RecordSessionExpenseRequest,
  type CloseSessionCashierRequest,
  type ApproveExpenseRequest,
  type RejectExpenseRequest,
} from '@academy/shared';

@Controller('finance')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly financeService: FinanceService) {}

  @Get('subscription')
  @RequirePermissions(Permission.PAYMENTS_READ)
  async getTenantSubscription(@Req() req: Request) {
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    return this.financeService.getTenantSubscription(tenantContext);
  }

  @Get('player-plans')
  @RequirePermissions(Permission.PAYMENTS_READ)
  async listPlayerSubscriptionPlans(@Query('branchId') branchId: string, @Req() req: Request) {
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    return this.financeService.listPlayerSubscriptionPlans(tenantContext, branchId);
  }

  @Post('player-plans')
  @RequirePermissions(Permission.PAYMENTS_CREATE)
  async createPlayerSubscriptionPlan(@Body() body: unknown, @Req() req: Request) {
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const dto: CreatePlayerSubscriptionPlanRequest = CreatePlayerSubscriptionPlanRequestSchema.parse(body);
    return this.financeService.createPlayerSubscriptionPlan(tenantContext, dto);
  }

  @Get('player-subscriptions')
  @RequirePermissions(Permission.PAYMENTS_READ)
  async listPlayerSubscriptions(
    @Query('status') status: string,
    @Query('search') search: string,
    @Query('playerId') playerId: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Req() req: Request,
  ) {
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    return this.financeService.listPlayerSubscriptions(tenantContext, {
      status,
      search,
      playerId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('player-subscriptions/player/:playerId')
  @RequirePermissions(Permission.PAYMENTS_READ)
  async getPlayerSubscription(@Param('playerId') rawId: string, @Req() req: Request) {
    const playerId = UuidParamSchema.parse(rawId);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    return this.financeService.getPlayerSubscription(tenantContext, playerId);
  }

  @Post('player-subscriptions')
  @RequirePermissions(Permission.PAYMENTS_CREATE)
  async createPlayerSubscription(@Body() body: unknown, @Req() req: Request) {
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const dto: CreatePlayerSubscriptionRequest = CreatePlayerSubscriptionRequestSchema.parse(body);
    return this.financeService.createPlayerSubscription(tenantContext, dto);
  }

  @Post('payments/collect')
  @RequirePermissions(Permission.PAYMENTS_CREATE)
  async recordPayment(@Body() body: unknown, @Req() req: Request) {
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const dto: RecordPlayerPaymentRequest = RecordPlayerPaymentRequestSchema.parse(body);
    return this.financeService.recordPayment(tenantContext, dto);
  }

  @Post('transactions/:id/reverse')
  @RequirePermissions(Permission.PAYMENTS_REFUND)
  async reverseTransaction(
    @Param('id') rawId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const transactionId = UuidParamSchema.parse(rawId);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const dto: ReverseTransactionRequest = ReverseTransactionRequestSchema.parse(body);
    return this.financeService.reverseTransaction(tenantContext, transactionId, dto);
  }

  @Get('sessions/:sessionId/cashier')
  @RequirePermissions(Permission.SESSION_EXPENSES_READ)
  async getSessionCashierSummary(@Param('sessionId') rawId: string, @Req() req: Request) {
    const sessionId = UuidParamSchema.parse(rawId);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    return this.financeService.getSessionCashierSummary(tenantContext, sessionId);
  }

  @Post('sessions/:sessionId/expense')
  @RequirePermissions(Permission.SESSION_EXPENSES_CREATE)
  async recordSessionExpense(
    @Param('sessionId') rawId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const sessionId = UuidParamSchema.parse(rawId);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const dto: RecordSessionExpenseRequest = RecordSessionExpenseRequestSchema.parse(body);
    return this.financeService.recordSessionExpense(tenantContext, sessionId, dto);
  }

  @Post('expenses/:id/approve')
  @RequirePermissions(Permission.SESSION_EXPENSES_APPROVE)
  async approveSessionExpense(
    @Param('id') rawId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const transactionId = UuidParamSchema.parse(rawId);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const dto: ApproveExpenseRequest = ApproveExpenseRequestSchema.parse(body || {});
    return this.financeService.approveSessionExpense(tenantContext, transactionId, dto);
  }

  @Post('expenses/:id/reject')
  @RequirePermissions(Permission.SESSION_EXPENSES_APPROVE)
  async rejectSessionExpense(
    @Param('id') rawId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const transactionId = UuidParamSchema.parse(rawId);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const dto: RejectExpenseRequest = RejectExpenseRequestSchema.parse(body);
    return this.financeService.rejectSessionExpense(tenantContext, transactionId, dto);
  }

  @Post('sessions/:sessionId/close')
  @RequirePermissions(Permission.SESSION_EXPENSES_READ)
  async closeSessionCashier(
    @Param('sessionId') rawId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const sessionId = UuidParamSchema.parse(rawId);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const dto: CloseSessionCashierRequest = CloseSessionCashierRequestSchema.parse(body || {});
    return this.financeService.closeSessionCashier(tenantContext, sessionId, dto);
  }

  @Get('dashboard')
  @RequirePermissions(Permission.PAYMENTS_READ)
  async getDashboardMetrics(@Query('branchId') branchId: string, @Req() req: Request) {
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    return this.financeService.getDashboardMetrics(tenantContext, branchId);
  }
}
