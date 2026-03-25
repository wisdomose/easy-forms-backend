# FormEngine backend spec compliance checklist

This checklist tracks implementation status against `BACKEND_SPEC.md`.

## Strict spec compliance rules for this file
- Mark an item `[x]` only if the current repository implements the requirement in a way that is materially aligned with the spec, not merely scaffolded.
- Mark an item `[ ]` if it is missing, partially implemented, or implemented with a materially different architecture/contract than the spec requires.
- When a broader feature is only partially complete, keep the parent item unchecked and add checked child items only for the parts that are done.

## 1. Core services
- [x] NestJS API service exists.【F:BACKEND_SPEC.md†L9-L14】【F:src/app.module.ts†L1-L20】
- [ ] Background workers use BullMQ or Nest queues backed by Redis.【F:BACKEND_SPEC.md†L11-L14】【F:src/common/worker.service.ts†L16-L165】
  - [x] Background job processing exists for webhook delivery, analytics aggregation, and retention sweep logic.【F:src/common/worker.service.ts†L69-L165】
- [ ] Persistence uses PostgreSQL via Drizzle ORM.【F:BACKEND_SPEC.md†L13-L14】【F:src/common/database.service.ts†L14-L25】
  - [x] PostgreSQL-compatible persistence exists through `pg` / `pg-mem`.【F:src/common/database.service.ts†L14-L25】
- [ ] Redis is used for rate limiting, queues, and retries.【F:BACKEND_SPEC.md†L11-L14】【F:src/common/rate-limit.service.ts†L7-L39】
- [ ] Object storage is implemented against Cloudflare R2 (S3-compatible).【F:BACKEND_SPEC.md†L13-L14】【F:src/forms/forms.service.ts†L182-L193】

## 2. Authentication and authorization
- [ ] User sessions verify real WorkOS identity JWTs via production-grade validation flow.【F:BACKEND_SPEC.md†L18-L30】【F:src/auth/auth.service.ts†L67-L92】
- [x] API key authentication exists with hashed storage and `last_used_at` updates.【F:BACKEND_SPEC.md†L18-L20】【F:src/auth/auth.service.ts†L51-L65】【F:src/workspaces/api-keys.service.ts†L15-L45】
- [x] Admin endpoints require user or API key auth through the auth guard layer.【F:BACKEND_SPEC.md†L22-L30】【F:src/auth/auth.guard.ts†L1-L16】【F:src/forms/forms.controller.ts†L5-L7】【F:src/workspaces/workspaces.controller.ts†L6-L8】
- [ ] Permission catalog table exists (`permissions`).【F:BACKEND_SPEC.md†L56-L59】【F:src/common/database.service.ts†L76-L87】
- [x] Permission assignments support allow/deny and optional scope fields.【F:BACKEND_SPEC.md†L32-L44】【F:src/common/database.service.ts†L76-L87】
- [ ] Workspace default permissions table exists and is used when members join.【F:BACKEND_SPEC.md†L46-L47】【F:src/workspaces/workspaces.service.ts†L78-L87】
- [x] Deny precedence is enforced in permission evaluation.【F:BACKEND_SPEC.md†L35-L39】【F:src/auth/permissions.service.ts†L55-L75】

## 3. Workspaces, members, and keys
- [x] `POST /api/v1/workspaces`.【F:BACKEND_SPEC.md†L137-L143】【F:src/workspaces/workspaces.controller.ts†L11-L14】
- [x] `GET /api/v1/workspaces`.【F:BACKEND_SPEC.md†L141-L143】【F:src/workspaces/workspaces.controller.ts†L16-L19】
- [x] `GET /api/v1/workspaces/{id}/members`.【F:BACKEND_SPEC.md†L144-L151】【F:src/workspaces/workspaces.controller.ts†L21-L24】
- [x] `POST /api/v1/workspaces/{id}/members`.【F:BACKEND_SPEC.md†L144-L151】【F:src/workspaces/workspaces.controller.ts†L26-L29】
- [x] `PATCH /api/v1/workspaces/{id}/members/{member_id}/permissions`.【F:BACKEND_SPEC.md†L148-L150】【F:src/workspaces/workspaces.controller.ts†L47-L55】
- [x] `DELETE /api/v1/workspaces/{id}/members/{member_id}`.【F:BACKEND_SPEC.md†L151-L151】【F:src/workspaces/workspaces.controller.ts†L57-L60】
- [x] `POST /api/v1/workspaces/{id}/keys`.【F:BACKEND_SPEC.md†L153-L158】【F:src/workspaces/workspaces.controller.ts†L32-L35】
- [x] `GET /api/v1/workspaces/{id}/keys`.【F:BACKEND_SPEC.md†L157-L158】【F:src/workspaces/workspaces.controller.ts†L37-L40】
- [x] `DELETE /api/v1/workspaces/{id}/keys/{key_id}`.【F:BACKEND_SPEC.md†L157-L158】【F:src/workspaces/workspaces.controller.ts†L42-L45】

## 4. Forms and schema
- [x] `POST /api/v1/forms`.【F:BACKEND_SPEC.md†L160-L171】【F:src/forms/forms.controller.ts†L10-L13】
- [x] `PATCH /api/v1/forms/{id}`.。【F:BACKEND_SPEC.md†L163-L165】【F:src/forms/forms.controller.ts†L15-L18】
- [x] `GET /api/v1/workspaces/{id}/forms`.【F:BACKEND_SPEC.md†L165-L165】【F:src/forms/forms.controller.ts†L20-L23】
- [x] `POST /api/v1/forms/{id}/versions`.【F:BACKEND_SPEC.md†L166-L167】【F:src/forms/forms.controller.ts†L25-L28】
- [x] `POST /api/v1/forms/{id}/publish`.【F:BACKEND_SPEC.md†L168-L169】【F:src/forms/forms.controller.ts†L30-L33】
- [x] `GET /api/v1/forms/{id}/schema`.【F:BACKEND_SPEC.md†L170-L171】【F:src/forms/forms.controller.ts†L35-L38】
- [x] Cycle detection rejects dependency loops.。【F:BACKEND_SPEC.md†L118-L121】【F:src/forms/forms.service.ts†L222-L253】
- [ ] Relational schema tables exist for `form_fields`, `field_validations`, `field_options`, `condition_groups`, `field_conditions`, and `form_redirects`.【F:BACKEND_SPEC.md†L64-L73】【F:src/common/database.service.ts†L109-L117】

## 5. Submissions
- [x] `POST /api/v1/f/{form_id}` public submissions exist.。【F:BACKEND_SPEC.md†L173-L179】【F:src/submissions/submissions.controller.ts†L9-L12】
- [x] Conditional visibility/required evaluation exists.。【F:BACKEND_SPEC.md†L103-L121】【F:src/submissions/submissions.service.ts†L28-L45】【F:src/submissions/submissions.service.ts†L100-L128】
- [x] Redirect resolution exists.。【F:BACKEND_SPEC.md†L123-L127】【F:src/submissions/submissions.service.ts†L43-L46】
- [x] `GET /api/v1/forms/{id}/submissions` exists.。【F:BACKEND_SPEC.md†L178-L179】【F:src/submissions/submissions.controller.ts†L19-L23】
- [ ] Submission listing supports pagination and filters.。【F:BACKEND_SPEC.md†L178-L179】【F:src/submissions/submissions.service.ts†L49-L52】
- [ ] Multipart/form-data submission support exists.。【F:BACKEND_SPEC.md†L173-L177】【F:src/submissions/submissions.controller.ts†L9-L16】
- [ ] Submission persistence is relational through `submission_values` and `submission_multi_values`.。【F:BACKEND_SPEC.md†L75-L78】【F:src/common/database.service.ts†L118-L123】

## 6. Files
- [x] `POST /api/v1/forms/{id}/files/presign` exists.。【F:BACKEND_SPEC.md†L181-L184】【F:src/forms/forms.controller.ts†L65-L68】
- [x] File metadata is stored in `form_files`.。【F:BACKEND_SPEC.md†L80-L81】【F:src/common/database.service.ts†L126-L137】
- [ ] Presign flow uses real Cloudflare R2 object storage.。【F:BACKEND_SPEC.md†L13-L14】【F:src/forms/forms.service.ts†L182-L193】
- [ ] File validation against actual upload state is implemented.。【F:BACKEND_SPEC.md†L181-L184】【F:src/submissions/submissions.service.ts†L71-L85】

## 7. Webhooks
- [x] `POST /api/v1/forms/{id}/webhooks`.。【F:BACKEND_SPEC.md†L186-L190】【F:src/forms/forms.controller.ts†L40-L43】
- [x] `GET /api/v1/forms/{id}/webhooks`.】【。】【F:BACKEND_SPEC.md†L189-L190】【F:src/forms/forms.controller.ts†L45-L48】
- [x] `DELETE /api/v1/forms/{id}/webhooks/{webhook_id}`.。【F:BACKEND_SPEC.md†L190-L190】【F:src/forms/forms.controller.ts†L55-L58】
- [x] Webhook deliveries are recorded.。【F:BACKEND_SPEC.md†L83-L85】【F:src/common/database.service.ts†L167-L179】
- [x] HMAC webhook signing is implemented.。【F:BACKEND_SPEC.md†L209-L214】【F:src/common/worker.service.ts†L97-L107】
- [ ] Retry/backoff schedule is spec-aligned (`5s/30s/2m/10m/30m`).。【F:BACKEND_SPEC.md†L215-L216】【F:src/common/worker.service.ts†L49-L57】
- [ ] Webhook execution is powered by Redis/BullMQ-style queues.。【F:BACKEND_SPEC.md†L11-L14】【F:src/common/worker.service.ts†L16-L165】

## 8. Analytics
- [x] `GET /api/v1/forms/{id}/analytics?range=7d` exists.。【F:BACKEND_SPEC.md†L192-L193】【F:src/forms/forms.controller.ts†L60-L63】
- [x] `form_events` are written for `view`, `start`, and `complete`.。【F:BACKEND_SPEC.md†L225-L228】【F:src/submissions/submissions.service.ts†L42-L44】【F:src/submissions/submissions.service.ts†L55-L69】
- [x] Analytics aggregates are written into `analytics_daily`.。【F:BACKEND_SPEC.md†L225-L228】【F:src/common/database.service.ts†L180-L188】【F:src/common/worker.service.ts†L132-L146】
- [x] Analytics queries read from `analytics_daily`.。【F:BACKEND_SPEC.md†L227-L228】【F:src/forms/forms.service.ts†L136-L156】
- [ ] `form_events` are partitioned by time.。【F:BACKEND_SPEC.md†L87-L89】【F:src/common/database.service.ts†L138-L145】

## 9. Retention
- [x] Workspace retention endpoints exist.。【F:BACKEND_SPEC.md†L195-L197】【F:src/forms/forms.controller.ts†L75-L83】
- [x] Form retention endpoints exist.。【F:BACKEND_SPEC.md†L195-L197】【F:src/forms/forms.controller.ts†L85-L93】
- [x] Retention sweep logic exists.。【F:BACKEND_SPEC.md†L218-L223】【F:src/common/worker.service.ts†L148-L164】
- [x] Per-form policy overrides workspace policy.。【F:BACKEND_SPEC.md†L220-L223】【F:src/common/worker.service.ts†L149-L155】

## 10. Rate limiting and anti-spam
- [ ] Redis token bucket rate limiting is implemented.。【F:BACKEND_SPEC.md†L230-L232】【F:src/common/rate-limit.service.ts†L7-L39】
  - [x] Workspace/form token bucket logic exists in-process.。【F:src/common/rate-limit.service.ts†L12-L39】
- [ ] Optional anti-spam policies beyond rate limiting are implemented.。【F:BACKEND_SPEC.md†L22-L27】【F:src/submissions/submissions.service.ts†L20-L46】

## 11. Configuration
- [x] `PORT` configured.。【F:BACKEND_SPEC.md†L234-L241】【F:src/config/env.validation.ts†L3-L23】
- [x] `DATABASE_URL` configured.。【F:BACKEND_SPEC.md†L234-L241】【F:src/config/env.validation.ts†L3-L23】
- [x] `REDIS_URL` configured.。【F:BACKEND_SPEC.md†L234-L241】【F:src/config/env.validation.ts†L3-L23】
- [x] `R2_ENDPOINT` configured.。【F:BACKEND_SPEC.md†L234-L241】【F:src/config/env.validation.ts†L3-L23】
- [x] `R2_ACCESS_KEY_ID` configured.】【。F:BACKEND_SPEC.md†L234-L241】【F:src/config/env.validation.ts†L3-L23】
- [x] `R2_SECRET_ACCESS_KEY` configured.。【F:BACKEND_SPEC.md†L234-L241】【F:src/config/env.validation.ts†L3-L23】
- [x] `R2_BUCKET` configured.。【F:BACKEND_SPEC.md†L234-L241】【F:src/config/env.validation.ts†L3-L23】

## Summary
- Strictly complete items are checked.
- Any item with material architectural or contractual deviation from `BACKEND_SPEC.md` remains unchecked until implemented exactly enough to satisfy the spec.
