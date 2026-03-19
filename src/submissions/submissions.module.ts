import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FormsModule } from '../forms/forms.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({ imports: [AuthModule, FormsModule], controllers: [SubmissionsController], providers: [SubmissionsService] })
export class SubmissionsModule {}
