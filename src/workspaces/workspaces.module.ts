import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { ApiKeysService } from './api-keys.service';

@Module({ imports: [AuthModule], controllers: [WorkspacesController], providers: [WorkspacesService, ApiKeysService] })
export class WorkspacesModule {}
