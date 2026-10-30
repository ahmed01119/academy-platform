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
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import {
  AttendanceCorrectionSchema,
  AttendanceMutationSchema,
  AttendanceReportQuerySchema,
  BulkAttendanceSubmissionSchema,
  CreateAttendanceSessionSchema,
  GenerateQrRequestSchema,
  Permission,
  QrCheckInRequestSchema,
  ScanPlayerQrRequestSchema,
  OfflineAttendanceBatchSyncRequestSchema,
  SessionQuerySchema,
  UuidParamSchema,
  type AttendanceCorrection,
  type AttendanceMutation,
  type BulkAttendanceSubmission,
  type CreateAttendanceSession,
  type GenerateQrRequest,
  type QrCheckInRequest,
  type ScanPlayerQrRequest,
  type OfflineAttendanceBatchSyncRequest,
  type TenantContext,
} from '@academy/shared';

@Controller('attendance')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard)
export class AttendanceController {
  constructor(@Inject(AttendanceService) private readonly attendanceService: AttendanceService) {}

  @Post('sessions')
  @RequirePermissions(Permission.ATTENDANCE_MARK)
  @HttpCode(HttpStatus.CREATED)
  async createSession(@Body() body: unknown, @Req() req: Request) {
    const dto: CreateAttendanceSession = CreateAttendanceSessionSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.createSession(tenantContext, dto);
  }

  @Get('sessions')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  async listSessions(@Query() query: unknown, @Req() req: Request) {
    const parsedQuery = SessionQuerySchema.parse(query);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.listSessions(tenantContext, parsedQuery);
  }

  @Get('sessions/:id')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  async getSession(@Param('id') id: string, @Req() req: Request) {
    const validId = UuidParamSchema.parse(id);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.getSession(tenantContext, validId);
  }

  @Post('sessions/:id/close')
  @RequirePermissions(Permission.ATTENDANCE_CLOSE)
  @HttpCode(HttpStatus.OK)
  async closeSession(@Param('id') id: string, @Req() req: Request) {
    const validId = UuidParamSchema.parse(id);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.closeSession(tenantContext, validId);
  }

  @Post('sessions/:id/qr')
  @RequirePermissions(Permission.ATTENDANCE_MARK)
  @HttpCode(HttpStatus.OK)
  async generateQrCode(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const validId = UuidParamSchema.parse(id);
    const dto: GenerateQrRequest = GenerateQrRequestSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.generateQrCode(tenantContext, validId, dto);
  }

  @Post('sessions/:id/checkin-qr')
  @RequirePermissions(Permission.ATTENDANCE_MARK)
  @HttpCode(HttpStatus.OK)
  async checkInViaQr(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const validId = UuidParamSchema.parse(id);
    const dto: QrCheckInRequest = QrCheckInRequestSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.checkInViaQr(tenantContext, validId, dto);
  }

  @Post('sessions/:id/scan-player-qr')
  @RequirePermissions(Permission.ATTENDANCE_MARK)
  @HttpCode(HttpStatus.OK)
  async scanPlayerQr(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const validId = UuidParamSchema.parse(id);
    const dto: ScanPlayerQrRequest = ScanPlayerQrRequestSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.scanPlayerQr(tenantContext, validId, dto);
  }

  @Post('sessions/:id/offline-sync')
  @RequirePermissions(Permission.ATTENDANCE_MARK)
  @HttpCode(HttpStatus.OK)
  async syncOfflineBatch(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const validId = UuidParamSchema.parse(id);
    const dto: OfflineAttendanceBatchSyncRequest = OfflineAttendanceBatchSyncRequestSchema.parse({
      ...(typeof body === 'object' && body !== null ? body : {}),
      sessionId: validId,
    });
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.syncOfflineBatch(tenantContext, dto);
  }

  @Get('sessions/:id/events')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  async getSessionEvents(@Param('id') id: string, @Req() req: Request) {
    const validId = UuidParamSchema.parse(id);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.getSessionEvents(tenantContext, validId);
  }

  @Post('records')
  @RequirePermissions(Permission.ATTENDANCE_MARK)
  @HttpCode(HttpStatus.OK)
  async recordAttendance(@Body() body: unknown, @Req() req: Request) {
    const dto: AttendanceMutation = AttendanceMutationSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.recordAttendance(tenantContext, dto);
  }

  @Post('records/bulk')
  @RequirePermissions(Permission.ATTENDANCE_MARK)
  @HttpCode(HttpStatus.OK)
  async bulkRecordAttendance(@Body() body: unknown, @Req() req: Request) {
    const dto: BulkAttendanceSubmission = BulkAttendanceSubmissionSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.bulkRecordAttendance(tenantContext, dto);
  }

  @Post('corrections')
  @RequirePermissions(Permission.ATTENDANCE_CORRECT)
  @HttpCode(HttpStatus.OK)
  async correctAttendance(@Body() body: unknown, @Req() req: Request) {
    const dto: AttendanceCorrection = AttendanceCorrectionSchema.parse(body);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.correctAttendance(tenantContext, dto);
  }

  @Get('reports')
  @RequirePermissions(Permission.REPORTS_READ)
  async getAttendanceReports(@Query() query: unknown, @Req() req: Request) {
    const parsedQuery = AttendanceReportQuerySchema.parse(query);
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.getAttendanceReports(tenantContext, parsedQuery);
  }
}
