import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({ imports: [AuthModule], controllers: [FormsController], providers: [FormsService], exports: [FormsService] })
export class FormsModule {}
