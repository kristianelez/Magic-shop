# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (via Neon serverless)
- **Validation**: Zod, `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Artifacts

| Artifact | Kind | Preview Path | Description |
|---|---|---|---|
| `artifacts/magic-shop` | web | `/` | Magic Shop CRM — React/Vite frontend |
| `artifacts/api-server` | api | `/api` | Express 5 backend — all API routes |
| `artifacts/mockup-sandbox` | design | `/__mockup` | Design mockup sandbox |

## Key Packages

- `lib/db` — Drizzle schema (schema.ts) + DB connection. Frontend uses `@workspace/db/schema` (schema-only, no DB connection).
- `lib/api-spec` — OpenAPI spec + codegen
- `lib/api-client-react` — generated React Query hooks

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Magic Shop CRM

Full-stack CRM for sales management. Backend in `artifacts/api-server`, frontend in `artifacts/magic-shop`.

- **Auth**: express-session + connect-pg-simple (sessions stored in PostgreSQL)
- **Session secret**: `SESSION_SECRET` env var required
- **Email notifications**: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `OWNER_EMAIL` env vars (optional)
- **Frontend imports schema types** from `@workspace/db/schema` (schema-only export, no DB connection code)
- **Backend** uses Neon serverless WebSocket pool (`@neondatabase/serverless`)

## Notes

- Frontend (magic-shop) imports `@workspace/db/schema` — not `@workspace/db` — to avoid triggering the database connection code in the browser
- The `/*path` wildcard syntax is required for Express 5 middleware (not `/*`)
- `zod/v4` subpath imports are NOT supported by esbuild — use `zod` directly in server code

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
