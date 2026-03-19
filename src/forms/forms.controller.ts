import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { FormsService } from './forms.service';

@Controller()
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Post('forms')
  createForm(@Body() body: { workspace_id: string; name: string }) {
    return {
      data: this.formsService.create(body.workspace_id, body.name),
    };
  }

  @Patch('forms/:id')
  updateForm(
    @Param('id') id: string,
    @Body() body: { name?: string; status?: 'draft' | 'active' | 'archived' },
  ) {
    return {
      data: this.formsService.update(id, body),
    };
  }

  @Get('workspaces/:id/forms')
  listWorkspaceForms(@Param('id') workspaceId: string) {
    return {
      data: this.formsService.listByWorkspace(workspaceId),
    };
  }

  @Post('forms/:id/versions')
  saveVersion(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return {
      data: this.formsService.saveVersion(id, {
        fields: (body.fields as never[]) ?? [],
        condition_groups: (body.condition_groups as never[]) ?? [],
        redirects: (body.redirects as never[]) ?? [],
      }),
    };
  }

  @Post('forms/:id/publish')
  publish(@Param('id') id: string, @Body('version') version: number) {
    return {
      data: this.formsService.publish(id, version),
    };
  }

  @Get('forms/:id/schema')
  getSchema(@Param('id') id: string) {
    return {
      data: this.formsService.getCompiledSchema(id),
    };
  }
}
