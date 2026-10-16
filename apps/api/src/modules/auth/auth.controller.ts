import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
import { CurrentUser } from './decorators/auth-user.decorator';
import {
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  type AuthResponse,
  type ForgotPasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
} from '@academy/shared';

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
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const dto: RegisterRequest = RegisterRequestSchema.parse(body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { response, rawTokens } = await this.authService.register(dto, ipAddress, userAgent);
    this.setAuthCookies(res, rawTokens);

    return response;
  }

  @Public()
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

    const { response, rawTokens } = await this.authService.login(dto, ipAddress, userAgent);
    this.setAuthCookies(res, rawTokens);

    return response;
  }

  @Public()
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

    if (!token) {
      throw new Error('Refresh token is required');
    }

    const { response, rawTokens } = await this.authService.refresh(token, ipAddress, userAgent);
    this.setAuthCookies(res, rawTokens);

    return response;
  }

  @Public()
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
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ message: string; debugToken?: string }> {
    const dto: ForgotPasswordRequest = ForgotPasswordRequestSchema.parse(body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.forgotPassword(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: unknown, @Req() req: Request): Promise<{ message: string }> {
    const dto: ResetPasswordRequest = ResetPasswordRequestSchema.parse(body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.resetPassword(dto, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser('id') userId: string, @Req() req: Request) {
    const activeTenantId = (req.headers['x-tenant-id'] as string) || req.cookies?.tenant_id;
    return this.authService.getMe(userId, activeTenantId);
  }
}
