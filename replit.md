# Magic Shop Sales Management Application

## Overview

Magic Shop is a CRM sales management application designed for B2B sales operations. It enables sales representatives to manage customers, track products, record sales, and receive AI-powered recommendations for customer outreach. The application is a full-stack web solution built with React, Express, PostgreSQL, and integrates with OpenAI for intelligent recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend uses **React 18** with TypeScript, **Vite** for building, and **Wouter** for routing. The UI is built with **shadcn/ui** (Radix UI primitives) and styled using **Tailwind CSS**. **Brand redesign:** color system uses navy + copper/gold derived from the Magic Cosmetic Shop logo (`@assets/images-2_1777763980088.jpeg`) — primary `28 75% 48%` (copper), sidebar `220 55% 11%` (deep navy) with copper highlights. Reusable `<Logo />` component (`client/src/components/Logo.tsx`) renders the circular brand mark; `<SplashScreen />` shows it on initial auth check and on a navy radial-gradient. Login page is a full-screen branded splash with the logo, copper headline, and translucent card. The sidebar has the logo + "Magic Cosmetic" header and a light copper-tinted active state. The top header includes a larger hamburger trigger (h-11 w-11 with 24px icon) for easier mobile use, plus a small logo next to the user info on >=sm screens. Inter and JetBrains Mono typography, fully responsive mobile-first. **TanStack Query** manages server state with disabled auto-refetching. Key functionalities include comprehensive customer and product management, AI recommendation displays, and specialized "Customer Analysis" and "Create Order" pages.

### Backend Architecture

The backend is built with **Express.js** on Node.js and TypeScript, exposing a RESTful API. It uses a storage abstraction pattern to decouple business logic from the database, which is accessed via **Drizzle ORM** and **Neon serverless PostgreSQL**. Performance is optimized through batch loading, database indexing, in-memory aggregation for customer stats, and HTTP gzip compression.

### Data Storage Solutions

**PostgreSQL** (via Neon) is the primary database. The schema, defined with Drizzle ORM and validated by Zod, includes tables for users, customers, products, sales, activities, and AI recommendation caching. The database is automatically seeded with sample data on first run.

### Authentication and Authorization

The application uses **session-based authentication** with bcrypt for password hashing and `express-session` with PostgreSQL-backed storage. Secure session cookies are configured for production and Replit environments. Role-Based Access Control (RBAC) is implemented with `admin`, `sales_director`, and `sales_manager` roles. Sales managers have restricted access to their own sales data, while admins and sales directors have broader permissions, including the ability to edit order dates. Default users are provided for testing. Security features include hashed passwords, environment variable-based session secrets, and proper session management.

### Security Features

Passwords are hashed using bcrypt. Session secrets are stored in `SESSION_SECRET` environment variable. `requireAuth` middleware protects API endpoints and loads user data. Stale sessions are destroyed. Frontend manages authentication state with `AuthContext` and TanStack Query. Session cookies are configured with `httpOnly`, `sameSite: "lax"` (or `"none"` on Replit), and `secure` flags. Trust proxy is enabled on Replit. Login awaits `req.session.save()` for robust session handling. The `session` table is explicitly defined in `shared/schema.ts` and ensured to exist on startup.

## External Dependencies

**AI Integration:** A hybrid AI system uses **OpenAI API** (GPT-5) for top customer recommendations (with a 24-hour cache for cost efficiency) and a **Local AI Engine** for instant, cost-free recommendations based on seasonal forecasting, stock prediction, customer type targeting, and purchase pattern analysis.

**Email notifications (Nodemailer + Gmail SMTP):** On every successful order creation (`POST /api/sales`), an HTML+text email is sent to the owner (default `kristinapopovic112@gmail.com`) as a fire-and-forget call so the API response never waits on SMTP. Email failures are only logged — they never fail the order. Configured via `GMAIL_USER`, `GMAIL_APP_PASSWORD` (Gmail App Password, requires 2FA), and `OWNER_EMAIL` env vars; if any are missing, notifications are silently disabled and the server logs the disabled status at startup. See `server/email.ts` and `.env.example`.

**Database Service:** **Neon Database** provides serverless PostgreSQL, configured via `DATABASE_URL`, utilizing WebSocket connections and connection pooling.

**UI Component Libraries:** **Radix UI** primitives are used for accessible and unstyled components.

**Development Tools:** **Replit-specific plugins** are integrated for development environments.

**Date Handling:** **date-fns** library is used for date formatting and manipulation, including Bosnian locale support.

**Form Management:** **React Hook Form** with `@hookform/resolvers` and Zod schemas handles form validation.

**Utility Libraries:** **clsx**, **tailwind-merge**, **class-variance-authority**, **cmdk**, and **nanoid** are used for CSS class management, command palette functionality, and ID generation.