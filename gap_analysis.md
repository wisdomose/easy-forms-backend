# Gap Analysis: Backend Spec vs. Implementation

> [!IMPORTANT]
> This document compares [BACKEND_SPEC.md](file:///c:/dev/agent%20sites/easy-forms/backend2/BACKEND_SPEC.md) and [IMPLEMENTATION_PLAN.md](file:///c:/dev/agent%20sites/easy-forms/backend2/IMPLEMENTATION_PLAN.md) against the actual codebase. Items marked ✅ are done, ⚠️ are partially done, and ❌ are not started.

---

## Summary

| Phase | Status | Completion |
|---|---|---|
| 1 – Foundations | ⚠️ Partial | ~30% |
| 2 – Auth & Permissions | ⚠️ Partial | ~40% |
| 3 – Workspaces, Members, Keys | ⚠️ Partial | ~35% |
| 4 – Forms, Versions, Schema | ⚠️ Partial | ~50% |
| 5 – Submissions | ⚠️ Partial | ~35% |
| 6 – Webhooks | ⚠️ Partial | ~25% |
| 7 – Analytics | ⚠️ Partial | ~20% |
| 8 – Retention | ⚠️ Partial | ~30% |
| 9 – Files (R2) | ❌ Not started | 0% |
| 10 – Hardening | ⚠️ Partial | ~15% |

---

## Phase 1 — Foundations

| Item | Status | Notes |
|---|---|---|
| [backend/README.md](file:///c:/dev/agent%20sites/easy-forms/backend2/backend/README.md) with spec links and quick start | ✅ Done | [README.md](file:///c:/dev/agent%20sites/easy-forms/backend2/backend/README.md) exists |
| Drizzle ORM schema & migrations | ❌ Missing | Schema is bootstrapped via raw `CREATE TABLE` SQL in [database.service.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/common/database.service.ts). No Drizzle schema files, no migration files |
| Partition management for `form_events` | ❌ Missing | `form_events` table does not exist at all |
| NestJS app initialized | ✅ Done | NestJS is wired in [app.module.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/app.module.ts) |
| Core dependencies (Drizzle, BullMQ) wired | ❌ Missing | Neither Drizzle nor BullMQ are wired. DB uses raw `pg` Pool; worker is in-process polling |
| App bootstrap: config, DB, migrations, server start | ⚠️ Partial | Config loads via `ConfigModule`, DB connects, but no Drizzle migrations run — only bootstrap `CREATE TABLE IF NOT EXISTS` |

### What's left
- [ ] Initialize Drizzle ORM with proper schema files for every table
- [ ] Create migration files and run them on bootstrap
- [ ] Create `form_events` table with time-based partitioning
- [ ] Wire BullMQ as a queue dependency
- [ ] Separate worker process from API process

---

## Phase 2 — Auth & Permissions (Spec §3)

| Item | Status | Notes |
|---|---|---|
| WorkOS auth (JWT) | ⚠️ Stub | [auth.service.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/auth/auth.service.ts) uses HMAC with a local secret (`WORKOS_JWT_SECRET`). Spec requires JWKS-based WorkOS verification |
| API key auth with `last_used_at` | ✅ Done | API key auth via `fe_` prefix, hashed comparison, `last_used_at` update |
| Permission evaluation (allow/deny, scope) | ✅ Done | [permissions.service.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/auth/permissions.service.ts) implements deny-first evaluation with scope support |
| `permissions` catalog table | ❌ Missing | Spec §4.2 requires a `permissions` catalog table. Only `permission_assignments` exists |
| `workspace_default_permissions` table | ❌ Missing | Spec §4.2 requires this table. Defaults are hardcoded in `DEFAULT_PERMISSIONS` array |
| Seed default perms on member join | ❌ Missing | [seedOwnerPermissions](file:///c:/dev/agent%20sites/easy-forms/backend2/src/auth/permissions.service.ts#22-32) exists but is only for owners; no generic default seeding from `workspace_default_permissions` |
| Audit logging for critical actions | ❌ Missing | `audit_logs` table exists in DDL but no service code writes to it |
| Auth guard applied to routes | ⚠️ Partial | [auth.guard.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/auth/auth.guard.ts) exists but controllers don't use `@UseGuards` — forms and submissions endpoints are **unauthenticated** |

### What's left
- [ ] Implement JWKS-based WorkOS JWT verification (replace HMAC stub)
- [ ] Create `permissions` catalog table and seed it
- [ ] Create `workspace_default_permissions` table with configurable defaults
- [ ] Implement default permission seeding when a new member joins
- [ ] Build audit logging service and write audit entries for critical actions
- [ ] Apply auth guards to all admin endpoints (forms, workspaces, members, keys)
- [ ] Ensure submission endpoint `POST /api/v1/f/{form_id}` remains public

---

## Phase 3 — Workspaces, Members, Keys (Spec §7.2–7.4)

| Item | Status | Notes |
|---|---|---|
| `POST /api/v1/workspaces` | ⚠️ Partial | [workspaces.controller.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/workspaces/workspaces.controller.ts) exists but uses **InMemoryStore**, not DB. No `created_by` tracking |
| `GET /api/v1/workspaces` | ⚠️ Partial | Returns all workspaces, not user-scoped membership list as spec requires |
| `GET /workspaces/{id}/members` | ❌ Missing | No member endpoints at all |
| `POST /workspaces/{id}/members` | ❌ Missing | No member add with `apply_defaults` |
| `PATCH /workspaces/{id}/members/{id}/permissions` | ❌ Missing | No permission assignment update endpoint |
| `DELETE /workspaces/{id}/members/{id}` | ❌ Missing | No member removal (soft delete) |
| `POST /workspaces/{id}/keys` | ✅ Done | [api-keys.service.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/workspaces/api-keys.service.ts) creates with `plain_key` return |
| `GET /workspaces/{id}/keys` | ✅ Done | Lists keys with metadata |
| `DELETE /workspaces/{id}/keys/{id}` | ✅ Done | Revokes key (sets `revoked_at`) |
| API key controller/routes | ❌ Missing | Service exists but **no controller** exposes the routes |

### What's left
- [ ] Rewrite workspace service to use PostgreSQL instead of InMemoryStore
- [ ] Add `created_by` to workspace creation
- [ ] Scope `GET /workspaces` to return only user's memberships
- [ ] Create members controller with add/list/remove/permissions endpoints
- [ ] Implement soft-delete for member removal
- [ ] Implement `apply_defaults` flag on member add
- [ ] Create API keys controller to expose the existing service methods as routes

---

## Phase 4 — Forms, Versions, Schema (Spec §4.4, §5, §6, §7.5)

| Item | Status | Notes |
|---|---|---|
| `POST /api/v1/forms` | ⚠️ Partial | Works via [forms.controller.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/forms/forms.controller.ts) but uses **InMemoryStore**. No DB persistence |
| `PATCH /api/v1/forms/{id}` | ⚠️ Partial | In-memory only |
| `GET /workspaces/{id}/forms` | ⚠️ Partial | In-memory only |
| `POST /forms/{id}/versions` — relational save | ❌ Missing | Versions saved as JSONB in memory. Spec requires relational tables: `form_fields`, `field_validations`, `field_options`, `condition_groups`, `field_conditions`, `form_redirects` |
| `POST /forms/{id}/publish` | ⚠️ Partial | In-memory only |
| `GET /forms/{id}/schema` — compiled schema | ⚠️ Partial | Returns schema from memory. Needs to compile from relational tables |
| Cycle detection | ✅ Done | [forms.service.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/forms/forms.service.ts) has DFS cycle detection |
| Condition evaluation (all operators) | ✅ Done | All 8 operators implemented: eq, neq, gt, gte, lt, lte, contains, in |
| Redirect ordering (position ASC, id ASC) | ✅ Done | Sort applied on version save |

### Missing relational tables (Spec §4.4)
- [ ] `form_fields` — fields per version
- [ ] `field_validations` — rules per field
- [ ] `field_options` — select/radio options
- [ ] `condition_groups` — group operators
- [ ] `field_conditions` — conditional visibility/requirement rules
- [ ] `form_redirects` — post-submit redirects

### What's left
- [ ] Migrate forms from InMemoryStore to PostgreSQL persistence
- [ ] Create all 6 relational tables above
- [ ] Save form versions relationally (not as JSONB blob)
- [ ] Compile schema from relational records for the schema endpoint
- [ ] Add `created_by` tracking on forms and versions
- [ ] Add permission checks to form endpoints

---

## Phase 5 — Submissions (Spec §7.6, §8)

| Item | Status | Notes |
|---|---|---|
| `POST /api/v1/f/{form_id}` | ⚠️ Partial | [submissions.controller.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/submissions/submissions.controller.ts) works but stores in **InMemoryStore**. URL path is `/f/:form_id` (correct) |
| Conditional visibility/requirement | ✅ Done | Implemented in [submissions.service.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/submissions/submissions.service.ts) |
| Type casting/normalization | ⚠️ Partial | Basic [normalizeValue](file:///c:/dev/agent%20sites/easy-forms/backend2/src/submissions/submissions.service.ts#108-120) exists but doesn't handle all spec field types fully |
| `submission_values` (typed scalar storage) | ❌ Missing | Table does not exist in DDL or code — submissions use JSONB `values_json` in InMemoryStore |
| `submission_multi_values` | ❌ Missing | Table defined in spec but not in DDL or code |
| File metadata storage on submission | ❌ Missing | No file handling in submission flow |
| Webhook delivery creation on submit | ❌ Missing | Submission pipeline doesn't create `webhook_deliveries` records |
| Analytics event write on submit | ❌ Missing | Submission pipeline doesn't write `form_events` |
| `GET /forms/{id}/submissions` with pagination/filters | ⚠️ Partial | Exists but returns all results — no pagination, no filters |
| Redirect evaluation | ✅ Done | First-match redirect working |
| `multipart/form-data` support | ❌ Missing | Only `application/json` supported |

### What's left
- [ ] Migrate submissions from InMemoryStore to PostgreSQL
- [ ] Write to `submission_values` with typed scalars
- [ ] Create and write to `submission_multi_values` for multi-select/checkbox
- [ ] Add pagination (`limit`, `offset`/cursor) and filters to submissions list
- [ ] Create webhook deliveries in submission pipeline
- [ ] Write analytics events in submission pipeline
- [ ] Add `multipart/form-data` submission support
- [ ] Store file metadata on submission

---

## Phase 6 — Webhooks (Spec §7.8, §9)

| Item | Status | Notes |
|---|---|---|
| `POST /forms/{id}/webhooks` | ❌ Missing | No webhook controller. `webhooks` table exists in DDL |
| `GET /forms/{id}/webhooks` | ❌ Missing | No endpoint |
| `DELETE /forms/{id}/webhooks/{id}` | ❌ Missing | No endpoint |
| Webhook delivery worker | ⚠️ Partial | [worker.service.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/common/worker.service.ts) handles `webhook.delivery` jobs with HMAC signing and correct headers |
| HMAC signing with `X-FormEngine-*` headers | ✅ Done | Correctly implemented in worker |
| Retry with exponential backoff | ⚠️ Partial | Retries exist but schedule is linear (5 min flat), not spec-defined (5s/30s/2m/10m/30m) |
| DB constraint on webhook event types | ❌ Missing | No enforcement of allowed event types |

### What's left
- [ ] Create webhooks controller (create/list/delete)
- [ ] Enforce allowed webhook event types (`submission.created`, etc.)
- [ ] Fix retry schedule to match spec: 5s → 30s → 2m → 10m → 30m
- [ ] Integrate webhook delivery creation into submission pipeline
- [ ] Move from in-process worker to BullMQ queue

---

## Phase 7 — Analytics (Spec §7.9, §11)

| Item | Status | Notes |
|---|---|---|
| `form_events` raw event log | ❌ Missing | Table does not exist |
| Write events for view/start/complete | ❌ Missing | No event recording code (no endpoint, no submission hook) |
| Aggregation into `analytics_daily` | ⚠️ Partial | Worker has [handleAnalyticsAggregate](file:///c:/dev/agent%20sites/easy-forms/backend2/src/common/worker.service.ts#132-147) but it's never invoked from the submission pipeline |
| `GET /forms/{id}/analytics?range=7d` | ❌ Missing | No analytics endpoint |

### What's left
- [ ] Create `form_events` table with time-based partitioning
- [ ] Create endpoints or hooks for recording view/start/complete events
- [ ] Wire analytics aggregation into submission pipeline
- [ ] Create `GET /forms/{id}/analytics?range=7d` endpoint serving from `analytics_daily`
- [ ] Add partition management helper/job

---

## Phase 8 — Retention (Spec §7.10, §10)

| Item | Status | Notes |
|---|---|---|
| `GET/POST /workspaces/{id}/retention` | ❌ Missing | No retention endpoints |
| `GET/POST /forms/{id}/retention` | ❌ Missing | No retention endpoints |
| TTL sweeper job | ⚠️ Partial | Worker has [handleRetentionSweep](file:///c:/dev/agent%20sites/easy-forms/backend2/src/common/worker.service.ts#148-165) with correct policy precedence (form > workspace > skip) |
| Daily sweep schedule | ✅ Done | Re-enqueues itself for next day |

### What's left
- [ ] Create retention controller with workspace and per-form endpoints
- [ ] Add retention policy CRUD service
- [ ] Move sweeper to BullMQ scheduled job

---

## Phase 9 — Files / R2 (Spec §7.7, §4.6)

| Item | Status | Notes |
|---|---|---|
| `POST /forms/{id}/files/presign` | ❌ Missing | No R2/S3 integration at all |
| `form_files` table | ❌ Missing | Not in DDL or code |
| R2 config (`R2_ENDPOINT`, etc.) | ❌ Missing | Not in env validation |
| File validation (type, size) | ❌ Missing | |
| Multipart submission with file refs | ❌ Missing | |

### What's left
- [ ] Add R2/S3 client setup with Cloudflare credentials
- [ ] Create `form_files` table
- [ ] Create presign endpoint with MIME/size validation
- [ ] Verify uploaded objects exist before final attach
- [ ] Add `multipart/form-data` submission support with file refs

---

## Phase 10 — Hardening (Spec §12, §13)

| Item | Status | Notes |
|---|---|---|
| Redis rate limiting | ❌ Missing | [rate-limit.service.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/common/rate-limit.service.ts) is **in-memory** token bucket. Spec requires Redis |
| Stricter submission rate limits | ⚠️ Partial | [consumeSubmission](file:///c:/dev/agent%20sites/easy-forms/backend2/src/common/rate-limit.service.ts#32-40) applies per-workspace and per-form limits, but in-memory only |
| Structured logging | ❌ Missing | NestJS `Logger` used but no structured JSON logging or request IDs |
| Request IDs | ❌ Missing | |
| Integration tests | ⚠️ Partial | [app.e2e-spec.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/test/app.e2e-spec.ts) exists but scope unclear |
| Anti-spam (honeypot/CAPTCHA) | ❌ Missing | |

### What's left
- [ ] Replace in-memory rate limiter with Redis token bucket
- [ ] Add structured JSON logging
- [ ] Add request ID middleware (generate + propagate)
- [ ] Add comprehensive integration tests for key flows
- [ ] Add anti-spam policy hooks (honeypot, CAPTCHA)
- [ ] Split worker process from API process

---

## Cross-Cutting Issues

> [!CAUTION]
> These are fundamental architectural gaps that affect multiple phases.

| Issue | Impact |
|---|---|
| **InMemoryStore for forms, submissions, workspaces** | All data is lost on restart. Must migrate to PostgreSQL |
| **No Drizzle ORM** | Schema is managed via raw SQL `CREATE TABLE`. No migration system, no type-safe queries |
| **No BullMQ** | Worker is in-process polling a `job_queue` table. Not distributed, no separate worker process |
| **No Redis** | Rate limiting is per-process in-memory. Won't work with multiple instances |
| **Auth guard not applied** | Admin endpoints (forms, workspaces) are effectively public |
| **Duplicate import in main.ts** | `ApiExceptionFilter` is imported twice in [main.ts](file:///c:/dev/agent%20sites/easy-forms/backend2/src/main.ts#L2-L4) |
| **`job_queue` table missing from bootstrap DDL** | Worker service references `job_queue` table for polling jobs, but the table is never created in `database.service.ts` bootstrap — will crash at runtime with real DB |
| **Standard response format** | Some endpoints wrap in `{ data: ... }` but error format may not match spec's `{ error: { code, message, details } }` consistently |

---

## Priority Recommendations

1. **Migrate to PostgreSQL persistence** — InMemoryStore must be replaced before anything else makes sense
2. **Set up Drizzle ORM** — Establish proper schema files and migrations
3. **Apply auth guards** — Admin endpoints are currently unprotected
4. **Create missing controllers** — Members, API keys, webhooks, analytics, retention, files
5. **Create relational form tables** — Move from JSONB to relational schema for forms
6. **Wire submission pipeline** — Add webhook delivery + analytics event creation
7. **Add Redis + BullMQ** — For rate limiting and distributed job processing
8. **Files/R2 integration** — Presign, upload, multipart support
9. **JWKS auth** — Replace HMAC stub with real WorkOS verification
10. **Hardening** — Structured logging, request IDs, integration tests
