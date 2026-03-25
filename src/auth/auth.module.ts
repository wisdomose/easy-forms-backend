import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';
import { DatabaseService } from '../common/database.service';
import { RateLimitService } from '../common/rate-limit.service';
import { WorkerService } from '../common/worker.service';
import { QueueService } from '../common/queue.service';

@Module({
  providers: [AuthService, AuthGuard, PermissionsService, DatabaseService, RateLimitService, WorkerService, QueueService],
  exports: [AuthService, AuthGuard, PermissionsService, DatabaseService, RateLimitService, WorkerService, QueueService],
})
export class AuthModule {}
