import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { AuthContext, AuthService } from '../auth/auth.service';
import { PermissionsService } from '../auth/permissions.service';
import { DatabaseService } from '../common/database.service';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly db: DatabaseService,
    private readonly authService: AuthService,
    private readonly permissions: PermissionsService,
  ) {}

  async create(auth: AuthContext, workspaceId: string, name: string) {
    await this.permissions.assertPermission(auth, workspaceId, 'keys.manage');
    const plainKey = `fe_${randomBytes(24).toString('hex')}`;
    const id = randomUUID();
    await this.db.query(
      'INSERT INTO api_keys (id, workspace_id, name, key_prefix, hashed_key, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, workspaceId, name, plainKey.slice(0, 12), this.authService.hashApiKey(plainKey), auth.userId ?? null],
    );
    for (const permission of ['workspace.manage','members.manage','keys.manage','forms.manage','submissions.read','webhooks.manage','retention.manage','analytics.read']) {
      await this.db.query(
        `INSERT INTO permission_assignments (id, workspace_id, membership_id, principal_type, principal_id, permission_key, effect)
         VALUES ($1, $2, NULL, 'api_key', $3, $4, 'allow')`,
        [randomUUID(), workspaceId, id, permission],
      );
    }
    return { id, name, plain_key: plainKey };
  }

  async list(auth: AuthContext, workspaceId: string) {
    await this.permissions.assertPermission(auth, workspaceId, 'keys.manage');
    return this.db.query(
      'SELECT id, name, key_prefix, last_used_at, revoked_at, created_at FROM api_keys WHERE workspace_id = $1 ORDER BY created_at ASC',
      [workspaceId],
    ).then((r) => r.rows);
  }

  async revoke(auth: AuthContext, workspaceId: string, keyId: string) {
    await this.permissions.assertPermission(auth, workspaceId, 'keys.manage');
    await this.db.query('UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND workspace_id = $2', [keyId, workspaceId]);
    return { deleted: true };
  }
}
