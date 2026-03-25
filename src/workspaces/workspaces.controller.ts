import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequestWithAuth } from '../auth/auth.guard';
import { WorkspacesService } from './workspaces.service';
import { ApiKeysService } from './api-keys.service';

@Controller()
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(private readonly service: WorkspacesService, private readonly apiKeys: ApiKeysService) {}

  @Post('workspaces')
  async create(@Req() req: RequestWithAuth, @Body() body: { name: string }) {
    return { data: await this.service.create(req.auth!, body.name) };
  }

  @Get('workspaces')
  async list(@Req() req: RequestWithAuth) {
    return { data: await this.service.list(req.auth!) };
  }

  @Get('workspaces/:id/members')
  async listMembers(@Req() req: RequestWithAuth, @Param('id') workspaceId: string) {
    return { data: await this.service.listMembers(req.auth!, workspaceId) };
  }

  @Post('workspaces/:id/members')
  async addMember(@Req() req: RequestWithAuth, @Param('id') workspaceId: string, @Body() body: { user_id?: string; email?: string; apply_defaults?: boolean }) {
    return { data: await this.service.addMember(req.auth!, workspaceId, body) };
  }


  @Post('workspaces/:id/keys')
  async createKey(@Req() req: RequestWithAuth, @Param('id') workspaceId: string, @Body() body: { name: string }) {
    return { data: await this.apiKeys.create(req.auth!, workspaceId, body.name) };
  }

  @Get('workspaces/:id/keys')
  async listKeys(@Req() req: RequestWithAuth, @Param('id') workspaceId: string) {
    return { data: await this.apiKeys.list(req.auth!, workspaceId) };
  }

  @Delete('workspaces/:id/keys/:keyId')
  async deleteKey(@Req() req: RequestWithAuth, @Param('id') workspaceId: string, @Param('keyId') keyId: string) {
    return { data: await this.apiKeys.revoke(req.auth!, workspaceId, keyId) };
  }

  @Patch('workspaces/:id/members/:memberId/permissions')
  async updatePermissions(
    @Req() req: RequestWithAuth,
    @Param('id') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() body: { assignments: Array<Record<string, string | null>> },
  ) {
    return { data: await this.service.updateMemberPermissions(req.auth!, workspaceId, memberId, body.assignments) };
  }

  @Delete('workspaces/:id/members/:memberId')
  async removeMember(@Req() req: RequestWithAuth, @Param('id') workspaceId: string, @Param('memberId') memberId: string) {
    return { data: await this.service.removeMember(req.auth!, workspaceId, memberId) };
  }
}
