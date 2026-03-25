import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequestWithAuth } from '../auth/auth.guard';
import { SubmissionsService } from './submissions.service';

@Controller()
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @Post('f/:formId')
  async create(@Param('formId') formId: string, @Body() body: Record<string, unknown>) {
    return { data: await this.service.create(formId, body) };
  }

  @Post('f/:formId/events')
  async trackEvent(@Param('formId') formId: string, @Body() body: { event: 'view' | 'start' }) {
    return { data: await this.service.trackEvent(formId, body.event) };
  }

  @Get('forms/:id/submissions')
  @UseGuards(AuthGuard)
  async list(@Req() req: RequestWithAuth, @Param('id') formId: string) {
    return { data: await this.service.list(req.auth!, formId) };
  }
}
