import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AppConfigService } from '../../config/app-config.service';
import { Public } from './guards/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { CurrentUser } from './decorators/auth-user.decorator';
import {
  ErrorCode,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  ChangePasswordRequestSchema,
  UpdateUserProfileRequestSchema,
  type AuthResponse,
  type ForgotPasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type RegisterResponse,
  type ResetPasswordRequest,
  type ChangePasswordRequest,
  type UpdateUserProfileRequest,
} from '@academy/shared';
import { z } from 'zod';

const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const ResendVerificationSchema = z.object({
  email: z.string().email(),
});

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const isProduction = this.config.cookieSecure;

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/v1/auth',
      maxAge: this.config.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookies(res: Response) {
    const isProduction = this.config.cookieSecure;

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/v1/auth',
    });
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<RegisterResponse> {
    const dto: RegisterRequest = RegisterRequestSchema.parse(body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { response } = await this.authService.register(dto, ipAddress, userAgent);
    return response;
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const dto: LoginRequest = LoginRequestSchema.parse(body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const activeTenantId = (req.headers['x-tenant-id'] as string) || req.cookies?.tenant_id;

    const { response, rawTokens } = await this.authService.login(
      dto,
      ipAddress,
      userAgent,
      activeTenantId,
    );
    this.setAuthCookies(res, rawTokens);

    return response;
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const token = req.cookies?.refresh_token || body?.refreshToken;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const activeTenantId = (req.headers['x-tenant-id'] as string) || req.cookies?.tenant_id;

    if (!token) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Refresh token is required',
      });
    }

    const { response, rawTokens } = await this.authService.refresh(
      token,
      ipAddress,
      userAgent,
      activeTenantId,
    );
    this.setAuthCookies(res, rawTokens);

    return response;
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const token = req.cookies?.refresh_token || body?.refreshToken;
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    await this.authService.logout(token, userId);
    this.clearAuthCookies(res);

    return { message: 'Logged out successfully' };
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const dto: ForgotPasswordRequest = ForgotPasswordRequestSchema.parse(body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.forgotPassword(dto, ipAddress, userAgent);
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: unknown, @Req() req: Request): Promise<{ message: string }> {
    const dto: ResetPasswordRequest = ResetPasswordRequestSchema.parse(body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.resetPassword(dto, ipAddress, userAgent);
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: unknown, @Req() req: Request): Promise<{ message: string }> {
    const dto = VerifyEmailSchema.parse(body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.verifyEmail(dto.token, ipAddress, userAgent);
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const dto = ResendVerificationSchema.parse(body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.resendVerificationEmail(dto.email, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser('id') userId: string, @Req() req: Request) {
    const activeTenantId = (req.headers['x-tenant-id'] as string) || req.cookies?.tenant_id;
    return this.authService.getMe(userId, activeTenantId);
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const dto: ChangePasswordRequest = ChangePasswordRequestSchema.parse(body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.changePassword(userId, dto, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() body: unknown,
  ): Promise<{ message: string; name?: string; phone?: string | null }> {
    const dto: UpdateUserProfileRequest = UpdateUserProfileRequestSchema.parse(body);
    return this.authService.updateUserProfile(userId, dto);
  }
}
