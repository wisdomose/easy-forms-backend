# Backend Implementation Plan

## Phase 1 - Foundations
1. Add `backend/README.md` with spec links and quick start commands.
2. Initialize Drizzle ORM schema and finalize migrations: constraints, indexes, soft deletes.
3. Add partition management helper for `form_events` (using Drizzle/raw SQL).
4. Initialize NestJS application and wire core dependencies (Drizzle, BullMQ).
5. Ensure app bootstrap loads config, connects DB, runs Drizzle migrations, and starts NestJS server.

## Phase 2 - Auth and Permissions
1. Implement WorkOS auth stub and API key auth with `last_used_at`.
2. Implement permission evaluation with scope support.
3. Seed default permissions from `workspace_default_permissions`.
4. Add audit logging for critical actions.

## Phase 3 - Workspaces, Members, Keys
1. Workspace create/list endpoints.
2. Member add/list/remove endpoints.
3. Permission assignment updates.
4. API key create/list/revoke with plaintext return on create.

## Phase 4 - Forms, Versions, Schema
1. Forms create/update/list.
2. Form versions with relational schema save.
3. Condition groups, field conditions, redirects.
4. Cycle detection on version save.
5. Schema endpoint that returns compiled schema.

## Phase 5 - Submissions
1. Submission intake and validation.
2. Conditional visibility/requirement application.
3. Type casting and persistence of values.
4. Multi-value and file metadata storage.
5. Redirect evaluation after validation.
6. Submissions list with pagination/filters.

## Phase 6 - Webhooks
1. Webhook create/list/delete endpoints.
2. Delivery worker with retries and HMAC signing.

## Phase 7 - Analytics
1. Write `form_events` for view/start/complete.
2. Aggregate daily into `analytics_daily`.

## Phase 8 - Retention
1. Retention endpoints for workspace and per-form overrides.
2. TTL sweeper job.

## Phase 9 - Files
1. R2 presign endpoint with file validation.
2. Store file metadata on submission.

## Phase 10 - Hardening
1. Redis rate limiting per workspace/form.
2. Structured logging and request IDs.
3. Integration tests for key flows.