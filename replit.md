# Magic Shop Sales Management Application

## Overview

Magic Shop is a CRM sales management application designed for B2B sales operations. It enables sales representatives to manage customers, track products, record sales, and receive AI-powered recommendations for customer outreach. The application is a full-stack web solution built with React, Express, PostgreSQL, and integrates with OpenAI for intelligent recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend uses **React 18** with TypeScript, **Vite** for building, and **Wouter** for routing. The UI is built with **shadcn/ui** (Radix UI primitives) and styled using **Tailwind CSS**, following a productivity-focused design inspired by Linear + Notion. It features a custom color system, Inter and JetBrains Mono typography, a sticky header, and is fully responsive with mobile-first design principles. **TanStack Query** manages server state, focusing on performance with disabled auto-refetching. Key functionalities include comprehensive customer and product management, AI recommendation displays, and specialized "Customer Analysis" and "Create Order" pages with smart product selection and filtering.

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

**Database Service:** **Neon Database** provides serverless PostgreSQL, configured via `DATABASE_URL`, utilizing WebSocket connections and connection pooling.

**UI Component Libraries:** **Radix UI** primitives are used for accessible and unstyled components.

**Development Tools:** **Replit-specific plugins** are integrated for development environments.

**Date Handling:** **date-fns** library is used for date formatting and manipulation, including Bosnian locale support.

**Form Management:** **React Hook Form** with `@hookform/resolvers` and Zod schemas handles form validation.

**Utility Libraries:** **clsx**, **tailwind-merge**, **class-variance-authority**, **cmdk**, and **nanoid** are used for CSS class management, command palette functionality, and ID generation.