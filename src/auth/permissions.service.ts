import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { AuthContext } from './auth.service';
import { DatabaseService } from '../common/database.service';

export const DEFAULT_PERMISSIONS = [
  'workspace.manage',
  'members.manage',
  'keys.manage',
  'forms.manage',
  'submissions.read',
  'webhooks.manage',
  'retention.manage',
  'analytics.read',
];

@Injectable()
export class PermissionsService {
  constructor(private readonly db: DatabaseService) {}

  async seedOwnerPermissions(client: PoolClient, workspaceId: string, membershipId: string, userId: string) {
    for (const permission of DEFAULT_PERMISSIONS) {
      await client.query(
        `INSERT INTO permission_assignments
          (id, workspace_id, membership_id, principal_type, principal_id, permission_key, effect)
         VALUES ($1, $2, $3, 'user', $4, $5, 'allow')`,
        [randomUUID(), workspaceId, membershipId, userId, permission],
      );
    }
  }

  async assertPermission(auth: AuthContext, workspaceId: string, permission: string, scopeType?: string, scopeId?: string) {
    if (auth.type === 'api_key' && auth.workspaceId !== workspaceId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'API key is not valid for this workspace' });
    }

    let principalId = auth.actorId;
    let principalType: 'user' | 'api_key' = auth.type;
    let membershipId: string | null = null;

    if (auth.type === 'user') {
      const membership = await this.db.query<{ id: string }>(
        'SELECT id FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [workspaceId, auth.userId!],
      );
      if (!membership.rowCount) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'User is not a workspace member' });
      }
      membershipId = membership.rows[0].id;
      principalId = auth.userId!;
      principalType = 'user';
    }

    const result = await this.db.query<{ effect: string }>(
      `SELECT effect FROM permission_assignments
       WHERE workspace_id = $1
         AND principal_type = $2
         AND principal_id = $3
         AND permission_key = $4
         AND ($5::text IS NULL OR scope_type IS NULL OR scope_type = $5)
         AND ($6::uuid IS NULL OR scope_id IS NULL OR scope_id = $6)
         ${membershipId ? 'AND membership_id = $7' : ''}`,
      membershipId
        ? [workspaceId, principalType, principalId, permission, scopeType ?? null, scopeId ?? null, membershipId]
        : [workspaceId, principalType, principalId, permission, scopeType ?? null, scopeId ?? null],
    );

    if (result.rows.some((row) => row.effect === 'deny')) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: `Denied: ${permission}` });
    }
    if (!result.rows.some((row) => row.effect === 'allow')) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: `Missing permission: ${permission}` });
    }
  }
}
