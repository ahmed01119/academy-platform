import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  UserRepository,
  TenantRepository,
  PlayerRepository,
  FinanceRepository,
  AttendanceRepository,
} from './repositories';

const repositories = [
  UserRepository,
  TenantRepository,
  PlayerRepository,
  FinanceRepository,
  AttendanceRepository,
];

@Global()
@Module({
  providers: [PrismaService, ...repositories],
  exports: [PrismaService, ...repositories],
})
export class DatabaseModule {}
