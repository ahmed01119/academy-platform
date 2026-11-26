import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { CreateAcademyPayoutRequestSchema } from '@academy/shared';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/guards/platform-super-admin.guard';
import { PlatformOwnerGuard } from '../auth/guards/platform-owner.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { CurrentUser } from '../auth/decorators/auth-user.decorator';
import { PayoutsService } from './payouts.service';

/** Platform console: what the platform owes each academy from online payments, and the transfers made. */
@Controller('platform/payouts')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard, CsrfGuard)
export class PayoutsController {
  constructor(@Inject(PayoutsService) private readonly payouts: PayoutsService) {}

  @Get('balances')
  async balances(@CurrentUser('id') userId: string) {
    return this.payouts.listBalances(userId);
  }

  @Get()
  async list(@CurrentUser('id') userId: string, @Query('tenantId') tenantId?: string) {
    return this.payouts.listPayouts(
      userId,
      tenantId ? z.string().uuid().parse(tenantId) : undefined,
    );
  }

  /** Money leaves the platform account: the platform owner only. */
  @Post()
  @UseGuards(PlatformOwnerGuard)
  async record(@CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.payouts.recordPayout(userId, CreateAcademyPayoutRequestSchema.parse(body));
  }
}
