import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthContext } from '../auth/auth.service';
import { PermissionsService } from '../auth/permissions.service';
import { DatabaseService } from '../common/database.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly permissions: PermissionsService,
  ) {}

  async create(auth: AuthContext, name: string) {
    const workspaceId = randomUUID();
    const membershipId = randomUUID();
    await this.db.withTransaction(async (client) => {
      await client.query('INSERT INTO workspaces (id, name, created_by) VALUES ($1, $2, $3)', [workspaceId, name, auth.userId ?? null]);
      await client.query('INSERT INTO workspace_memberships (id, workspace_id, user_id, role) VALUES ($1, $2, $3, $4)', [membershipId, workspaceId, auth.userId, 'owner']);
      if (auth.userId) {
        await this.permissions.seedOwnerPermissions(client, workspaceId, membershipId, auth.userId);
      }
      await client.query('INSERT INTO audit_logs (id, workspace_id, actor_type, actor_id, action, metadata_json) VALUES ($1, $2, $3, $4, $5, $6::jsonb)', [randomUUID(), workspaceId, auth.type, auth.actorId, 'workspace.created', JSON.stringify({ name })]);
    });

    return this.getById(workspaceId);
  }

  async list(auth: AuthContext) {
    return this.db.query(
      `SELECT w.id, w.name, w.created_at, wm.role
       FROM workspaces w
       JOIN workspace_memberships wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1 AND wm.deleted_at IS NULL
       ORDER BY w.created_at ASC`,
      [auth.userId],
    ).then((result) => result.rows);
  }

  async getById(workspaceId: string) {
    const result = await this.db.query('SELECT id, name, created_at FROM workspaces WHERE id = $1', [workspaceId]);
    if (!result.rowCount) {
      throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace was not found' });
    }
    return result.rows[0];
  }

  async listMembers(auth: AuthContext, workspaceId: string) {
    await this.permissions.assertPermission(auth, workspaceId, 'members.manage');
    const members = await this.db.query(
      `SELECT wm.id, wm.role, wm.created_at, u.id AS user_id, u.email, u.name
       FROM workspace_memberships wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1 AND wm.deleted_at IS NULL
       ORDER BY wm.created_at ASC`,
      [workspaceId],
    ).then((result) => result.rows);
    for (const member of members as Array<any>) {
      member.assignments = await this.db.query(
        'SELECT permission_key, effect, scope_type, scope_id FROM permission_assignments WHERE membership_id = $1 ORDER BY created_at ASC',
        [member.id],
      ).then((result) => result.rows);
    }
    return members;
  }

  async addMember(auth: AuthContext, workspaceId: string, input: { user_id?: string; email?: string; apply_defaults?: boolean }) {
    await this.permissions.assertPermission(auth, workspaceId, 'members.manage');
    const user = input.user_id
      ? await this.db.query<{ id: string }>('SELECT id FROM users WHERE id = $1', [input.user_id])
      : await this.db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [input.email ?? '']);
    if (!user.rowCount) {
      throw new BadRequestException({ code: 'USER_NOT_FOUND', message: 'User must authenticate at least once before being added to a workspace' });
    }
    const userId = user.rows[0].id;
    const membershipId = randomUUID();
    await this.db.query('INSERT INTO workspace_memberships (id, workspace_id, user_id, role) VALUES ($1, $2, $3, $4)', [membershipId, workspaceId, userId, 'member']);
    if (input.apply_defaults ?? true) {
      for (const permission of ['forms.manage', 'submissions.read', 'analytics.read']) {
        await this.db.query(
          `INSERT INTO permission_assignments (id, workspace_id, membership_id, principal_type, principal_id, permission_key, effect)
           VALUES ($1, $2, $3, 'user', $4, $5, 'allow')`,
          [randomUUID(), workspaceId, membershipId, userId, permission],
        );
      }
    }
    return { id: membershipId, workspace_id: workspaceId, user_id: userId };
  }

  async updateMemberPermissions(auth: AuthContext, workspaceId: string, memberId: string, assignments: Array<Record<string, string | null>>) {
    await this.permissions.assertPermission(auth, workspaceId, 'members.manage');
    const member = await this.db.query<{ user_id: string }>('SELECT user_id FROM workspace_memberships WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL', [memberId, workspaceId]);
    if (!member.rowCount) {
      throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Workspace member was not found' });
    }
    await this.db.query('DELETE FROM permission_assignments WHERE membership_id = $1', [memberId]);
    for (const assignment of assignments) {
      const permissionKey = assignment.permission_key ?? assignment.permission_id;
      if (!permissionKey || !assignment.effect) continue;
      await this.db.query(
        `INSERT INTO permission_assignments
          (id, workspace_id, membership_id, principal_type, principal_id, permission_key, effect, scope_type, scope_id)
         VALUES ($1, $2, $3, 'user', $4, $5, $6, $7, $8)`,
        [randomUUID(), workspaceId, memberId, member.rows[0].user_id, permissionKey, assignment.effect, assignment.scope_type, assignment.scope_id],
      );
    }
    return { updated: true };
  }

  async removeMember(auth: AuthContext, workspaceId: string, memberId: string) {
    await this.permissions.assertPermission(auth, workspaceId, 'members.manage');
    await this.db.query('UPDATE workspace_memberships SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2', [memberId, workspaceId]);
    return { deleted: true };
  }
}
