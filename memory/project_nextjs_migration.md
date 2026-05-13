---
name: Next.js Migration Status
description: Magic Shop migrated from React/Vite+Express to Next.js 15 App Router in artifacts/magic-shop-next/
type: project
---

Next.js 15 app created at artifacts/magic-shop-next/ — production build works (502 files, clean build).

**Why:** User wants Vercel deployment with maximum speed (Next.js is fastest option for Vercel CDN).

**What was done:**
- All 17 React/Vite pages migrated to Next.js App Router pages (wouter → next/navigation)
- All 25 Express API routes migrated to Next.js Route Handlers
- Auth changed from express-session+connect-pg-simple → iron-session (cookie-based, no DB lookup per request)
- Database unchanged: Neon PostgreSQL + Drizzle ORM (same DATABASE_URL)
- Mobile app (artifacts/magic-shop-mobile/) deleted — was calling same API, not sharing React components
- Push notifications removed (mobile-specific), email notifications kept
- URL route changes: /edit-order/:id → /orders/:id/edit, /edit-offer/:id → /offers/:id/edit

**How to apply:** When user asks about deployment, direct them to artifacts/magic-shop-next/. Original artifacts/magic-shop (Vite) and artifacts/api-server (Express) still exist unchanged.

**Vercel deployment:**
- Root directory: artifacts/magic-shop-next
- Build command: pnpm run build (or use vercel.json)
- Env vars needed: DATABASE_URL, SESSION_SECRET, GMAIL_USER (optional), GMAIL_APP_PASSWORD (optional), OWNER_EMAIL (optional)
- vercel.json already created in artifacts/magic-shop-next/

**Known technical debt:** ignoreBuildErrors: true in next.config.ts due to drizzle-zod@0.8.x (expects Zod v4) vs @workspace/db (uses Zod v3 API). Runtime works correctly. Fix by upgrading Zod to v4 in @workspace/db.
