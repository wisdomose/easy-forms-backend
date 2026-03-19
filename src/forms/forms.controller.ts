import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequestWithAuth } from '../auth/auth.guard';
import { FormsService } from './forms.service';

@Controller()
@UseGuards(AuthGuard)
export class FormsController {
  constructor(private readonly service: FormsService) {}

  @Post('forms')
  async create(@Req() req: RequestWithAuth, @Body() body: { workspace_id: string; name: string }) {
    return { data: await this.service.create(req.auth!, body.workspace_id, body.name) };
  }

  @Patch('forms/:id')
  async update(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: { name?: string; status?: string }) {
    return { data: await this.service.update(req.auth!, id, body) };
  }

  @Get('workspaces/:id/forms')
  async list(@Req() req: RequestWithAuth, @Param('id') workspaceId: string) {
    return { data: await this.service.listByWorkspace(req.auth!, workspaceId) };
  }

  @Post('forms/:id/versions')
  async saveVersion(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return { data: await this.service.saveVersion(req.auth!, id, body) };
  }

  @Post('forms/:id/publish')
  async publish(@Req() req: RequestWithAuth, @Param('id') id: string, @Body('version') version: number) {
    return { data: await this.service.publish(req.auth!, id, version) };
  }

  @Get('forms/:id/schema')
  async schema(@Param('id') id: string) {
    return { data: await this.service.getCompiledSchema(id) };
  }

  @Post('forms/:id/webhooks')
  async createWebhook(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: { url: string; events: string[] }) {
    return { data: await this.service.createWebhook(req.auth!, id, body.url, body.events) };
  }

  @Get('forms/:id/webhooks')
  async listWebhooks(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return { data: await this.service.listWebhooks(req.auth!, id) };
  }

  @Delete('forms/:id/webhooks/:webhookId')
  async deleteWebhook(@Req() req: RequestWithAuth, @Param('id') id: string, @Param('webhookId') webhookId: string) {
    return { data: await this.service.deleteWebhook(req.auth!, id, webhookId) };
  }

  @Get('forms/:id/analytics')
  async analytics(@Req() req: RequestWithAuth, @Param('id') id: string, @Query('range') range = '7d') {
    return { data: await this.service.getAnalytics(req.auth!, id, range) };
  }

  @Post('forms/:id/files/presign')
  async presign(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: { field_key: string; filename: string; mime: string }) {
    return { data: await this.service.createPresignedUpload(req.auth!, id, body.field_key, body.filename, body.mime) };
  }

  @Get('workspaces/:id/retention')
  async getWorkspaceRetention(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return { data: await this.service.getRetention(req.auth!, { workspaceId: id }) };
  }

  @Post('workspaces/:id/retention')
  async setWorkspaceRetention(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: { ttl_days: number }) {
    return { data: await this.service.setRetention(req.auth!, { workspaceId: id }, body.ttl_days) };
  }

  @Get('forms/:id/retention')
  async getFormRetention(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return { data: await this.service.getRetention(req.auth!, { formId: id }) };
  }

  @Post('forms/:id/retention')
  async setFormRetention(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: { ttl_days: number }) {
    return { data: await this.service.setRetention(req.auth!, { formId: id }, body.ttl_days) };
  }
}
