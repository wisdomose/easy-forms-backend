# Backend Specification (Detailed, Build-Ready)

## 1) Overview
FormEngine is a multi-tenant, API-first form backend. Users authenticate via
WorkOS. Workspaces, permissions, and all business logic are internal.
Submissions are stored relationally for analytics and exports, with minimal
JSONB usage only for schema snapshots and audit metadata.

## 2) Core Services
- API service: NestJS (Node.js/TypeScript) HTTP server.
- Background workers: BullMQ or NestJS queues for webhook dispatch, retention cleanup, analytics
  aggregation, partition management.
- Persistence: PostgreSQL (relational via Drizzle ORM), Redis (rate limiting, queues, retries).
- Object storage: Cloudflare R2 (S3-compatible).

## 3) Authentication and Authorization

### 3.1 Auth Methods
- User sessions: WorkOS identity token (JWT) provided by frontend.
- API keys: used by developers for server-to-server operations.

### 3.2 Request Auth Rules
- Admin endpoints require WorkOS-authenticated user OR API key with proper
  scope.
- Submission endpoint `POST /api/v1/f/{form_id}` accepts public submissions.
  Optional anti-spam policies are enforced.

### 3.3 Auth Headers
- User: `Authorization: Bearer <workos_jwt>`
- API key: `Authorization: Bearer <api_key>`

### 3.4 Permission Evaluation
- Permissions stored in `permission_assignments`.
- Each assignment has `effect` allow/deny and optional scope.
- Evaluation for (action, resource, scope):
  1. Find matching assignments in workspace.
  2. If any deny matches -> deny.
  3. Else if any allow matches -> allow.
  4. Else -> deny.

### 3.5 Permission Scopes
- Workspace-wide: `scope_type` null, `scope_id` null.
- Resource-scoped: `scope_type` in (`form`, `submission`, `webhook`) and
  `scope_id` set.

### 3.6 Default Permissions
- `workspace_default_permissions` seeds assignments when a member joins.

## 4) Data Model (Relational)

### 4.1 Identity and Tenancy
- `workspaces`: tenant container.
- `users`: WorkOS identity mapping.
- `workspace_memberships`: membership (soft delete).

### 4.2 Permissions
- `permissions`: catalog of allowed actions.
- `permission_assignments`: per-user allow/deny assignments.
- `workspace_default_permissions`: default assignment seed.

### 4.3 API Keys
- `api_keys`: hashed key, created_by, last_used_at, revoke and delete.

### 4.4 Forms and Schema
- `forms`: root form object.
- `form_versions`: immutable versions, `created_by`, optional `schema_json`
  snapshot.
- `form_fields`: fields for a version.
- `field_validations`: rules per field.
- `field_options`: select/radio options.
- `condition_groups`: group operators.
- `field_conditions`: conditional visibility/requirement rules.
- `form_redirects`: post-submit redirects, ordered.

### 4.5 Submissions
- `submissions`: metadata.
- `submission_values`: typed scalar values.
- `submission_multi_values`: ordered multi values.

### 4.6 Files
- `form_files`: R2 metadata plus original filename.

### 4.7 Webhooks
- `webhooks`: endpoint config, event array with DB constraint.
- `webhook_deliveries`: status history for each submission.

### 4.8 Analytics
- `form_events`: raw event log, partitioned by time.
- `analytics_daily`: aggregated stats.

### 4.9 Retention
- `retention_policies`: TTL for workspace or per-form override.

### 4.10 Audit
- `audit_logs`: action trace with JSONB metadata.

## 5) Field Conditions Contract

### 5.1 Structures
- `condition_groups`: `operator` = AND/OR.
- `field_conditions`: `effect` = show/hide/require.

### 5.2 Evaluation
- Normalize all values by field type.
- Evaluate each group: AND requires all conditions true; OR requires any true.
- Effects:
  1. If any `hide` group true -> field hidden.
  2. Else if any `show` group true -> field shown.
  3. Else default visibility applies.
  4. If any `require` group true -> required; else schema default.

### 5.3 Operators
`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`.

### 5.4 `in` Format
- `field_conditions.value` is JSON array string. Example: `["a","b","c"]`.

### 5.5 Cycle Detection
- On form version save, build dependency graph from `if_field_key`.
- Reject save if cycle exists.
- Renderer assumes acyclic graph.

## 6) Redirect Contract
- Redirects evaluate after validation success.
- Ordered by `position ASC`, then `id ASC`.
- First match wins.
- If none match, return default success response or default URL.

## 7) API Surface (Detailed)

### 7.1 Standard Response Format
- Success:
  - `200/201`: `{ "data": ... }`
- Error:
  - `{ "error": { "code": "FORBIDDEN", "message": "...", "details": {...} } }`

### 7.2 Workspaces
- `POST /api/v1/workspaces`
  - Body: `{ "name": "Acme" }`
  - Response: `{ "data": { "id", "name", "created_at" } }`
- `GET /api/v1/workspaces`
  - Response: list of memberships.

### 7.3 Members
- `GET /api/v1/workspaces/{id}/members`
- `POST /api/v1/workspaces/{id}/members`
  - Body: `{ "user_id": "...", "apply_defaults": true }`
- `PATCH /api/v1/workspaces/{id}/members/{member_id}/permissions`
  - Body: `{ "assignments": [{ "permission_id": "...", "effect": "allow",
  "scope_type": null, "scope_id": null }] }`
- `DELETE /api/v1/workspaces/{id}/members/{member_id}`

### 7.4 API Keys
- `POST /api/v1/workspaces/{id}/keys`
  - Body: `{ "name": "CI key" }`
  - Response includes `plain_key` only once.
- `GET /api/v1/workspaces/{id}/keys`
- `DELETE /api/v1/workspaces/{id}/keys/{key_id}`

### 7.5 Forms
- `POST /api/v1/forms`
  - Body: `{ "workspace_id": "...", "name": "Contact" }`
- `PATCH /api/v1/forms/{id}`
  - Body: `{ "name": "...", "status": "active" }`
- `GET /api/v1/workspaces/{id}/forms`
- `POST /api/v1/forms/{id}/versions`
  - Body contains full field schema (relational form).
- `POST /api/v1/forms/{id}/publish`
  - Body: `{ "version": 3 }`
- `GET /api/v1/forms/{id}/schema`
  - Returns compiled schema for renderer.

### 7.6 Submissions
- `POST /api/v1/f/{form_id}`
  - Content-Type: `application/json` or `multipart/form-data`.
  - Body: field key/value pairs + file refs.
  - Response: `{ "data": { "submission_id": "...", "redirect_url": null } }`
- `GET /api/v1/forms/{id}/submissions`
  - Supports pagination and filters.

### 7.7 Files (R2)
- `POST /api/v1/forms/{id}/files/presign`
  - Body: `{ "field_key": "...", "filename": "...", "mime": "..." }`
  - Response: `{ "data": { "upload_url": "...", "storage_key": "..." } }`

### 7.8 Webhooks
- `POST /api/v1/forms/{id}/webhooks`
  - Body: `{ "url": "...", "events": ["submission.created"] }`
- `GET /api/v1/forms/{id}/webhooks`
- `DELETE /api/v1/forms/{id}/webhooks/{webhook_id}`

### 7.9 Analytics
- `GET /api/v1/forms/{id}/analytics?range=7d`

### 7.10 Retention
- `GET/POST /api/v1/workspaces/{id}/retention`
- `GET/POST /api/v1/forms/{id}/retention`

## 8) Submission Processing Pipeline
1. Resolve form and published version.
2. Load fields, validations, options, condition groups, conditions, redirects.
3. Apply conditional visibility and requirement.
4. Validate and cast types.
5. Persist `submissions`, `submission_values`, `submission_multi_values`.
6. Persist files metadata if provided.
7. Create webhook deliveries.
8. Write analytics events.

## 9) Webhook Delivery
- Signed with HMAC using webhook secret.
- Headers:
  - `X-FormEngine-Signature`
  - `X-FormEngine-Event`
  - `X-FormEngine-Delivery`
- Retry with exponential backoff (e.g., 5 attempts, 5s/30s/2m/10m/30m).
- Record each attempt in `webhook_deliveries`.

## 10) Retention
- Daily sweep job.
- Policy lookup:
  - Use per-form policy if exists.
  - Else use workspace policy.
  - Else do nothing.

## 11) Analytics
- Write `form_events` for view/start/complete.
- Aggregate into `analytics_daily`.
- Queries served from `analytics_daily` only.

## 12) Rate Limiting
- Redis token bucket per workspace and per form.
- Submission endpoint has stricter limit.

## 13) Configuration
- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`