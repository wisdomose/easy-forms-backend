# FormEngine Backend

This backend now implements a database-backed NestJS API aligned with the repository specification in `BACKEND_SPEC.md`.

## Implemented systems
- PostgreSQL-compatible persistence through a centralized `DatabaseService` with schema bootstrap and transactional writes.
- WorkOS-style bearer token authentication for user sessions plus hashed API key authentication for server-to-server access.
- Workspace membership and permission evaluation with allow/deny semantics.
- Forms, immutable versions, conditional rule cycle detection, publishing, compiled schema retrieval, and public submission intake.
- Webhook registration plus signed delivery records for `submission.created` events.
- Retention policy endpoints, basic daily analytics aggregation, and R2-style upload presign responses.
- Audit logging for workspace creation and key business actions persisted in the database.

## Local development
```bash
pnpm install
pnpm run start:dev
```

By default tests run against an in-memory PostgreSQL-compatible database (`pg-mem`). Set `DATABASE_URL` to a real PostgreSQL connection string for local or production environments.

## Tests
```bash
pnpm run build
pnpm run test
pnpm run test:e2e
```
