# FormEngine Backend

This backend implements an API-first NestJS service for FormEngine and now includes a completed **Phase 1 Foundations** setup from `IMPLEMENTATION_PLAN.md`.

## Phase 1 foundations now in place
- PostgreSQL-compatible `DatabaseService` with `pg`/`pg-mem` support.
- Drizzle schema and migration scaffolding (`src/db/schema.ts`, `drizzle/*`).
- Migration execution during application bootstrap.
- Foundation queue wiring with BullMQ (`QueueService`) behind `QUEUE_ENABLED`.
- Form events indexing helper for partition-management foundation work.

## Quick start
```bash
pnpm install
pnpm run build
pnpm run start:dev
```

## Migration commands
```bash
pnpm run drizzle:generate
pnpm run drizzle:migrate
pnpm run drizzle:studio
```

## Test
```bash
pnpm run test
pnpm run test:e2e
```
