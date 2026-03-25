import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InMemoryStore, Workspace } from '../common/in-memory.store';

@Injectable()
export class WorkspacesService {
  constructor(private readonly store: InMemoryStore) {}

  create(name: string): Workspace {
    const workspace: Workspace = {
      id: randomUUID(),
      name,
      created_at: new Date().toISOString(),
    };

    this.store.workspaces.push(workspace);
    return workspace;
  }

  list(): Workspace[] {
    return this.store.workspaces;
  }
}
