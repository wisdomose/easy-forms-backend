import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';
import { DatabaseService } from '../common/database.service';

@Module({
  providers: [AuthService, AuthGuard, PermissionsService, DatabaseService],
  exports: [AuthService, AuthGuard, PermissionsService, DatabaseService],
})
export class AuthModule {}
