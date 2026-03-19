# FormEngine Backend

This repository now contains a working NestJS backend scaffold aligned with the project specification in `BACKEND_SPEC.md` and the phased delivery plan in `IMPLEMENTATION_PLAN.md`.

## Included MVP capabilities
- Standardized `/api/v1` JSON API envelope.
- Workspace create/list endpoints.
- Form create/update/list endpoints.
- Form version save with conditional dependency cycle detection.
- Form publish and compiled schema retrieval.
- Public submission creation with conditional visibility/required logic.
- Submission listing for a form.

## Quick start
```bash
pnpm install
pnpm run start:dev
```

## Test
```bash
pnpm run test
pnpm run test:e2e
```

## Notes
- Persistence is currently implemented as an in-memory store to provide a usable, testable baseline without introducing incomplete database plumbing.
- The next implementation step is replacing the in-memory store with Drizzle/PostgreSQL and adding auth, permissions, API keys, files, webhooks, analytics, and retention services from the spec.
