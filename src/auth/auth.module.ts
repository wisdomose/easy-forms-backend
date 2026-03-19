import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';
import { DatabaseService } from '../common/database.service';
import { RateLimitService } from '../common/rate-limit.service';
import { WorkerService } from '../common/worker.service';

@Module({
  providers: [AuthService, AuthGuard, PermissionsService, DatabaseService, RateLimitService, WorkerService],
  exports: [AuthService, AuthGuard, PermissionsService, DatabaseService, RateLimitService, WorkerService],
})
export class AuthModule {}
