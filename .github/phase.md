# FormEngine backend phased roadmap

This roadmap is derived from the strict compliance checklist in `.github/issue.md` and the requirements in `BACKEND_SPEC.md`.

## Phase 1 — Architecture and migration foundation

### Goal
Prepare the codebase for the remaining spec work without stacking more behavior onto temporary scaffolding.

### Work
- Introduce clearer module boundaries for database, queue, storage, auth, forms, submissions, workspaces, analytics, and retention.
- Replace runtime schema bootstrapping strategy with migration-oriented schema ownership.
- Choose Drizzle schema/migrations as the long-term persistence layer.

### Estimated file changes
- New files: 8–15
- Modified files: 5–10

### Tests
- Boot smoke test
- Module wiring smoke test

## Phase 2 — Relational schema completion

### Goal
Implement the missing spec tables so forms and submissions stop depending on JSONB as the primary source of truth.

### Work
- Add `permissions`, `workspace_default_permissions`.
- Add `form_fields`, `field_validations`, `field_options`, `condition_groups`, `field_conditions`, `form_redirects`.
- Add `submission_values`, `submission_multi_values`.
- Add indexes, FKs, and constraints.

### Estimated file changes
- New files: 10–20
- Modified files: 10–18

### Tests
- Migration tests
- Repository tests for relational save/load
- Constraint and uniqueness tests

## Phase 3 — WorkOS and authorization completion

### Goal
Move from local-secret JWT verification and hardcoded permissions to real WorkOS validation and spec-driven authorization.

### Work
- Implement JWKS-based WorkOS verification.
- Add permission catalog seeding.
- Add workspace default permission seeding.
- Refactor API key and membership permission flows to reference catalog/defaults.

### Estimated file changes
- New files: 4–8
- Modified files: 6–12

### Tests
- JWKS verification tests
- Permission precedence tests
- Default permission seeding tests
- API key scope tests

## Phase 4 — Forms relational rewrite

### Goal
Save and read form versions from relational tables while preserving current behavior.

### Work
- Persist fields, validations, options, condition groups, conditions, and redirects relationally.
- Compile schema from relational records.
- Keep cycle detection and redirect ordering guarantees.

### Estimated file changes
- New files: 2–5
- Modified files: 8–14

### Tests
- Form version persistence tests
- Compiled schema tests
- Cycle detection tests
- Redirect ordering tests

## Phase 5 — Submission relational rewrite

### Goal
Persist typed submission values relationally and finish admin submission querying.

### Work
- Write to `submission_values` and `submission_multi_values`.
- Support typed reads.
- Add pagination and filters to submissions listing.
- Maintain conditional validation semantics.

### Estimated file changes
- New files: 2–4
- Modified files: 6–12

### Tests
- Scalar value persistence tests
- Multi-value tests
- Pagination/filter tests
- Conditional submission tests

## Phase 6 — Real file upload and multipart handling

### Goal
Replace upload scaffolding with actual Cloudflare R2 integration and multipart support.

### Work
- Generate real R2 presigned URLs.
- Validate content type and size.
- Verify uploaded objects exist before final attach.
- Add multipart/form-data submission support.

### Estimated file changes
- New files: 4–8
- Modified files: 6–10

### Tests
- Presign tests
- MIME/size validation tests
- Multipart submission tests
- File attach verification tests

## Phase 7 — Redis and BullMQ queue/rate limiting migration

### Goal
Replace in-process worker and token buckets with spec-compliant distributed infrastructure.

### Work
- Add Redis wiring.
- Add BullMQ or Nest queues for webhooks, analytics, retention, and partition management.
- Replace in-process rate limiting with Redis token buckets.
- Split worker process from API process.

### Estimated file changes
- New files: 6–12
- Modified files: 8–14

### Tests
- Queue producer/consumer tests
- Retry/backoff tests
- Redis rate limiting tests
- Multi-process safety tests

## Phase 8 — Webhook and analytics hardening

### Goal
Align retries, delivery semantics, and analytics behavior with the spec.

### Work
- Enforce allowed webhook event types.
- Implement spec-aligned backoff schedule.
- Partition `form_events` where needed.
- Keep analytics queries served from `analytics_daily` only.

### Estimated file changes
- New files: 1–4
- Modified files: 4–10

### Tests
- Webhook retry schedule tests
- Signature tests
- Delivery failure tests
- Analytics aggregation and query tests

## Phase 9 — Retention, anti-spam, and production hardening

### Goal
Close remaining operational and compliance gaps.

### Work
- Add retention precedence/deletion test coverage.
- Add honeypot/CAPTCHA/abuse policy hooks.
- Add request IDs, structured logs, and worker metrics.
- Expand deployment documentation.

### Estimated file changes
- New files: 4–10
- Modified files: 6–12

### Tests
- Retention override tests
- Anti-spam tests
- Observability smoke tests

## Recommended milestone grouping
- Milestone A: Phases 1–2
- Milestone B: Phases 3–5
- Milestone C: Phases 6–7
- Milestone D: Phases 8–9
