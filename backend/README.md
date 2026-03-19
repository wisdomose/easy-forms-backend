# FormEngine Backend

This backend implements a database-backed NestJS API aligned with `BACKEND_SPEC.md`, including auth, permissions, member management, queue-driven webhook delivery, analytics events, retention policies, file upload metadata, and submission rate limiting.

## Implemented systems
- PostgreSQL-compatible persistence through `DatabaseService`, with `pg-mem` used in tests and `DATABASE_URL` used in real environments.
- WorkOS-style JWT user authentication plus hashed workspace-scoped API keys.
- Workspace memberships, permission assignments with allow/deny support, permission patching, and membership listing with effective assignments.
- Forms, immutable versions, cycle detection, publishing, compiled schema retrieval, and audit logs.
- Public submissions with conditional evaluation, file attachment association, analytics event capture, and queue-backed webhook delivery records.
- Background worker polling via `WorkerService` for webhook retries, analytics aggregation, and recurring retention sweeps.
- File presign responses backed by persisted upload metadata and form file listing.
- In-process token-bucket rate limiting for public form events and submissions.

## Local development
```bash
pnpm install
pnpm run start:dev
```

## Key environment variables
- `DATABASE_URL`
- `WORKOS_JWT_SECRET`
- `WORKER_POLL_MS`
- `RATE_LIMIT_WORKSPACE_LIMIT`
- `RATE_LIMIT_FORM_LIMIT`
- `WEBHOOK_TIMEOUT_MS`

## Tests
```bash
pnpm run build
pnpm run test
pnpm run test:e2e
```
