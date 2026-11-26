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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateOnlinePaymentRequestSchema, Permission, type TenantContext } from '@academy/shared';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/auth-user.decorator';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';

const tenantOf = (req: Request) =>
  (req as Request & { tenantContext: TenantContext }).tenantContext;

@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(PayoutsService) private readonly payouts: PayoutsService,
  ) {}

  /** Balances the signed-in player or guardian can pay. */
  @Get('dues')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  async dues(@CurrentUser('id') userId: string) {
    return this.payments.listDues(userId);
  }

  /** Starts an online payment and returns the provider's checkout page. */
  @Post('online')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  async start(@CurrentUser('id') userId: string, @Body() body: unknown) {
    const dto = CreateOnlinePaymentRequestSchema.parse(body);
    return this.payments.createPlayerSubscriptionPayment(userId, dto.subscriptionId);
  }

  @Get('online/:id')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  async status(@CurrentUser('id') userId: string, @Param('id') rawId: string) {
    return this.payments.getPaymentStatus(userId, z.string().uuid().parse(rawId));
  }

  /** Academy owner: what renewing the platform subscription online costs now. */
  @Get('platform-subscription/quote')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
  @RequirePermissions(Permission.TENANT_UPDATE)
  async platformQuote(@Req() req: Request) {
    return this.payments.getPlatformSubscriptionQuote(tenantOf(req));
  }

  /** Academy owner: pay one billing cycle of the platform subscription online. */
  @Post('platform-subscription')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
  @RequirePermissions(Permission.TENANT_UPDATE)
  async payPlatform(@Req() req: Request) {
    return this.payments.createPlatformSubscriptionPayment(tenantOf(req));
  }

  /** Academy finance: what families paid online and the transfers received from the platform. */
  @Get('academy-summary')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
  @RequirePermissions(Permission.PAYMENTS_READ)
  async academySummary(@Req() req: Request) {
    return this.payouts.academySummary(tenantOf(req));
  }

  /** Paymob transaction-processed callback: no session, authenticated by its HMAC. */
  @Post('paymob/webhook')
  @HttpCode(HttpStatus.OK)
  async paymobWebhook(@Body() body: unknown, @Query('hmac') hmac?: string) {
    return this.payments.handlePaymobCallback(
      (body ?? {}) as Parameters<PaymentsService['handlePaymobCallback']>[0],
      hmac,
    );
  }
}
