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
import { CreateOnlinePaymentRequestSchema } from '@academy/shared';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { CurrentUser } from '../auth/decorators/auth-user.decorator';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

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
