import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

@Controller()
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post('f/:form_id')
  createSubmission(
    @Param('form_id') formId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return {
      data: this.submissionsService.create(formId, body),
    };
  }

  @Get('forms/:id/submissions')
  listSubmissions(@Param('id') formId: string) {
    return {
      data: this.submissionsService.list(formId),
    };
  }
}
