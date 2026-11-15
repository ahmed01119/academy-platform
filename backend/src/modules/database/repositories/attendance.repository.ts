import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import type { AttendanceSession, AttendanceRecord, AttendanceStatus } from '@academy/database';
import type { TenantTransactionClient } from '@academy/database';

@Injectable()
export class AttendanceRepository extends BaseRepository {
  async findSessionById(
    tenantId: string,
    id: string,
    tx?: TenantTransactionClient,
  ): Promise<AttendanceSession | null> {
    return this.getClient(tx).attendanceSession.findFirst({
      where: { id, tenantId },
      include: {
        branch: true,
        group: true,
      },
    });
  }

  async findSessionRoster(
    tenantId: string,
    sessionId: string,
    tx?: TenantTransactionClient,
  ): Promise<AttendanceRecord[]> {
    return this.getClient(tx).attendanceRecord.findMany({
      where: {
        tenantId,
        sessionId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async upsertAttendance(
    tenantId: string,
    sessionId: string,
    playerId: string,
    status: AttendanceStatus,
    markedByUserId?: string,
    remarks?: string,
    tx?: TenantTransactionClient,
  ): Promise<AttendanceRecord> {
    const client = this.getClient(tx);
    return client.attendanceRecord.upsert({
      where: {
        sessionId_playerId: {
          sessionId,
          playerId,
        },
      },
      create: {
        tenantId,
        sessionId,
        playerId,
        status,
        checkInTime: new Date(),
        markedByUserId,
        remarks,
      },
      update: {
        status,
        checkInTime: new Date(),
        markedByUserId,
        remarks,
        version: { increment: 1 },
      },
    });
  }
}
