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
  BulkAttendanceSubmissionSchema,
  CreateAttendanceSessionSchema,
  Permission,
  type AttendanceCorrection,
  type AttendanceMutation,
  type BulkAttendanceSubmission,
  type CreateAttendanceSession,
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
  async listSessions(
    @Req() req: Request,
    @Query('branchId') branchId?: string,
    @Query('sessionDate') sessionDate?: string,
  ) {
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.listSessions(tenantContext, branchId, sessionDate);
  }

  @Get('sessions/:id')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  async getSession(@Param('id') id: string, @Req() req: Request) {
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.getSession(tenantContext, id);
  }

  @Post('sessions/:id/close')
  @RequirePermissions(Permission.ATTENDANCE_CLOSE)
  @HttpCode(HttpStatus.OK)
  async closeSession(@Param('id') id: string, @Req() req: Request) {
    const tenantContext: TenantContext = (req as Request & { tenantContext: TenantContext })
      .tenantContext;
    return this.attendanceService.closeSession(tenantContext, id);
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
}
