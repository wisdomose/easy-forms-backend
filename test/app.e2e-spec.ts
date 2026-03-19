import { INestApplication } from '@nestjs/common';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('FormEngine API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1 returns service metadata', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect({
        data: {
          service: 'FormEngine',
          status: 'ok',
        },
      });
  });

  it('creates, publishes, and submits a form', async () => {
    const workspaceResponse = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .send({ name: 'Acme' })
      .expect(201);

    const workspaceId = workspaceResponse.body.data.id;

    const formResponse = await request(app.getHttpServer())
      .post('/api/v1/forms')
      .send({ workspace_id: workspaceId, name: 'Contact' })
      .expect(201);

    const formId = formResponse.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/forms/${formId}/versions`)
      .send({
        fields: [
          { id: 'f1', key: 'email', label: 'Email', type: 'email', required: true },
          { id: 'f2', key: 'company', label: 'Company', type: 'text', required: false },
        ],
        condition_groups: [
          {
            id: 'cg1',
            field_key: 'company',
            effect: 'require',
            operator: 'AND',
            conditions: [
              { id: 'c1', if_field_key: 'email', operator: 'contains', value: '@acme.com' },
            ],
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/forms/${formId}/publish`)
      .send({ version: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/f/${formId}`)
      .send({ email: 'user@example.com' })
      .expect(201)
      .expect((response) => {
        expect(response.body.data.submission_id).toBeDefined();
        expect(response.body.data.redirect_url).toBeNull();
      });

    await request(app.getHttpServer())
      .post(`/api/v1/f/${formId}`)
      .send({ email: 'user@acme.com' })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
  });
});
