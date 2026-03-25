import { INestApplication } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/common/database.service';
import { WorkerService } from '../src/common/worker.service';

const base64Url = (value: string) => Buffer.from(value).toString('base64url');
const createToken = async (sub: string, email: string, name: string) => {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: 'https://api.workos.com',
    aud: 'form-engine',
    sub,
    email,
    name,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  const input = `${header}.${payload}`;
  const signature = createHmac('sha256', 'test-workos-secret').update(input).digest('base64url');
  return `${input}.${signature}`;
};

describe('FormEngine API (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let worker: WorkerService;
  let ownerAuthHeader: string;
  let memberAuthHeader: string;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'pgmem';
    process.env.WORKOS_JWT_SECRET = 'test-workos-secret';
    process.env.RATE_LIMIT_FORM_LIMIT = '3';
    process.env.RATE_LIMIT_WORKSPACE_LIMIT = '20';

    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 202, text: async () => 'accepted' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    db = moduleFixture.get(DatabaseService);
    worker = moduleFixture.get(WorkerService);
    ownerAuthHeader = `Bearer ${await createToken('user_owner', 'owner@example.com', 'Owner')}`;
    memberAuthHeader = `Bearer ${await createToken('user_member', 'member@example.com', 'Member')}`;

    await request(app.getHttpServer()).get('/api/v1').expect(200);
    await request(app.getHttpServer()).get('/api/v1').expect(200);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('returns service metadata', () => {
    return request(app.getHttpServer()).get('/api/v1').expect(200);
  });

  it('supports members, permissions, files, analytics, queue-driven webhooks, and retention-ready submissions', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/workspaces')
      .set('Authorization', memberAuthHeader)
      .expect(200);

    const workspace = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', ownerAuthHeader)
      .send({ name: 'Acme' })
      .expect(201);
    const workspaceId = workspace.body.data.id;

    const memberListBefore = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', ownerAuthHeader)
      .expect(200);
    expect(memberListBefore.body.data).toHaveLength(1);

    const memberAdded = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', ownerAuthHeader)
      .send({ email: 'member@example.com', apply_defaults: true })
      .expect(201);
    const memberId = memberAdded.body.data.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/${workspaceId}/members/${memberId}/permissions`)
      .set('Authorization', ownerAuthHeader)
      .send({
        assignments: [
          { permission_key: 'forms.manage', effect: 'deny', scope_type: null, scope_id: null },
          { permission_key: 'submissions.read', effect: 'allow', scope_type: null, scope_id: null },
        ],
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/forms')
      .set('Authorization', memberAuthHeader)
      .send({ workspace_id: workspaceId, name: 'Denied' })
      .expect(403);

    const form = await request(app.getHttpServer())
      .post('/api/v1/forms')
      .set('Authorization', ownerAuthHeader)
      .send({ workspace_id: workspaceId, name: 'Contact' })
      .expect(201);
    const formId = form.body.data.id;

    const presign = await request(app.getHttpServer())
      .post(`/api/v1/forms/${formId}/files/presign`)
      .set('Authorization', ownerAuthHeader)
      .send({ field_key: 'resume', filename: 'resume.pdf', mime: 'application/pdf', size_bytes: 128 })
      .expect(201);
    const storageKey = presign.body.data.storage_key;

    await request(app.getHttpServer())
      .post(`/api/v1/forms/${formId}/versions`)
      .set('Authorization', ownerAuthHeader)
      .send({
        fields: [
          { id: 'f1', key: 'email', label: 'Email', type: 'email', required: true },
          { id: 'f2', key: 'resume', label: 'Resume', type: 'file', required: false },
        ],
        redirects: [{ id: 'r1', position: 1, url: 'https://example.com/thanks' }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/forms/${formId}/publish`)
      .set('Authorization', ownerAuthHeader)
      .send({ version: 1 })
      .expect(201);

    const webhook = await request(app.getHttpServer())
      .post(`/api/v1/forms/${formId}/webhooks`)
      .set('Authorization', ownerAuthHeader)
      .send({ url: 'https://example.com/webhook', events: ['submission.created'] })
      .expect(201);
    const webhookId = webhook.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/retention`)
      .set('Authorization', ownerAuthHeader)
      .send({ ttl_days: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/f/${formId}/events`)
      .send({ event: 'view' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/f/${formId}/events`)
      .send({ event: 'start' })
      .expect(201);

    const submission = await request(app.getHttpServer())
      .post(`/api/v1/f/${formId}`)
      .send({ email: 'user@example.com', resume: storageKey })
      .expect(201);
    expect(submission.body.data.redirect_url).toBe('https://example.com/thanks');

    await worker.processPendingJobs();
    await worker.processPendingJobs();

    await request(app.getHttpServer())
      .get(`/api/v1/forms/${formId}/files`)
      .set('Authorization', ownerAuthHeader)
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0].status).toBe('attached');
      });

    await request(app.getHttpServer())
      .get(`/api/v1/forms/${formId}/submissions`)
      .set('Authorization', ownerAuthHeader)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/forms/${formId}/analytics?range=7d`)
      .set('Authorization', ownerAuthHeader)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.totals).toEqual({ views: 1, starts: 1, completes: 1 });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/forms/${formId}/webhooks/${webhookId}/deliveries`)
      .set('Authorization', ownerAuthHeader)
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0].status).toBe('delivered');
      });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const auditCount = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM audit_logs');
    expect(Number(auditCount.rows[0].count)).toBeGreaterThan(0);
  });

  it('creates and uses an API key for workspace-scoped admin access', async () => {
    const workspace = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', ownerAuthHeader)
      .send({ name: 'Keys' })
      .expect(201);
    const workspaceId = workspace.body.data.id;

    const keyResponse = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/keys`)
      .set('Authorization', ownerAuthHeader)
      .send({ name: 'CI key' })
      .expect(201);

    const apiKey = keyResponse.body.data.plain_key;

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/keys`)
      .set('Authorization', `Bearer ${apiKey}`)
      .expect(200);
  });

});
