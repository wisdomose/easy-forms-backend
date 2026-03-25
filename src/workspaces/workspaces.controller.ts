import { Body, Controller, Get, Post } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  createWorkspace(@Body('name') name: string) {
    return {
      data: this.workspacesService.create(name),
    };
  }

  @Get()
  listWorkspaces() {
    return {
      data: this.workspacesService.list(),
    };
  }
}
