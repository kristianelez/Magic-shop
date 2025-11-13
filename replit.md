# Greentime Sales Management Application

## Overview

Greentime is a CRM (Customer Relationship Management) sales management application designed for B2B sales operations in Bosnia and Herzegovina. The application helps sales representatives manage customers, track products, record sales, and receive AI-powered recommendations for customer outreach based on purchasing patterns.

The application is built as a full-stack web application with a React frontend and Express backend, utilizing PostgreSQL for data persistence and OpenAI's GPT-5 for intelligent customer recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server for fast hot module replacement
- **Wouter** for lightweight client-side routing (instead of React Router)

**UI Component Strategy:**
- **shadcn/ui** component library (Radix UI primitives) configured in "new-york" style
- **Tailwind CSS** for utility-first styling with custom design tokens
- Components are aliased via path mapping (`@/components`, `@/lib`, etc.)

**Design System:**
- Follows Linear + Notion design patterns for productivity-focused interfaces
- Typography: Inter font family for general UI, JetBrains Mono for monospace elements
- Custom color system with CSS variables for light/dark theme support
- Spacing based on Tailwind's 4-point grid system (multiples of 4px)

**State Management:**
- **TanStack Query (React Query)** for server state management and data fetching
- Query client configured with infinite stale time and disabled auto-refetching for optimal performance
- No global client state library - relies on server state and component-local state

**Key Pages:**
- Dashboard - Overview with stats and recent activities
- Customers - Customer list and management
- Products - Product catalog with inventory tracking
- AI Recommendations - Smart customer outreach suggestions
- Sales - Sales history and analytics

### Backend Architecture

**Server Framework:**
- **Express.js** with TypeScript running on Node.js
- Custom middleware for request logging and JSON body parsing
- Development mode uses Vite middleware for SSR and HMR

**API Design:**
- RESTful API endpoints under `/api/*` namespace
- JSON request/response format
- Endpoints include customers, products, sales, activities, and AI recommendations

**Storage Layer:**
- **Storage abstraction pattern** - `IStorage` interface in `server/storage.ts` defines all data operations
- Decouples business logic from database implementation
- All database queries go through the storage layer

**Database Access:**
- **Drizzle ORM** for type-safe database queries
- **Neon serverless PostgreSQL** driver with WebSocket support
- Schema-first approach with validation using Zod
- Migration files stored in `./migrations` directory

### Data Storage Solutions

**Database:**
- **PostgreSQL** via Neon serverless platform
- Connection pooling enabled for scalability
- Schema defined in `shared/schema.ts` with the following core tables:
  - `users` - User authentication (UUID primary key)
  - `customers` - Customer information with status tracking (active/inactive/vip)
  - `products` - Product catalog with pricing, stock, and categorization
  - `sales` - Sales transactions linking customers and products
  - `activities` - Customer interaction tracking

**Schema Validation:**
- **drizzle-zod** generates Zod schemas from Drizzle table definitions
- Insert schemas omit auto-generated fields (id, timestamps)
- Type inference ensures consistency between database and application types

**Data Seeding:**
- Automatic database seeding on first run via `server/seed.ts`
- Populates initial products (cleaning supplies, equipment, air fresheners)
- Creates sample customers (hotels, hospitals, restaurants)
- Generates historical sales data for testing

### Authentication and Authorization

**Current Implementation:**
- User schema exists in database with username/password fields
- Authentication logic not yet implemented in routes
- Sessions would use `connect-pg-simple` for PostgreSQL-backed session storage

**Future Considerations:**
- Password hashing (likely bcrypt or argon2)
- Session-based authentication with secure cookies
- Role-based access control for different user types

### External Dependencies

**AI Integration:**
- **OpenAI API** (GPT-5 model) for generating customer recommendations
- Analyzes customer purchase patterns, frequency, and favorite products
- Generates personalized product suggestions with reasoning and priority levels
- Recommends optimal contact times based on historical patterns
- API key configured via `OPENAI_API_KEY` environment variable

**Database Service:**
- **Neon Database** - Serverless PostgreSQL platform
- Configured via `DATABASE_URL` environment variable
- Uses WebSocket connections for serverless compatibility
- Connection pooling through `@neondatabase/serverless` package

**UI Component Libraries:**
- **Radix UI** primitives (accordion, dialog, dropdown, tooltip, etc.)
- Provides accessible, unstyled component primitives
- Over 30 Radix components integrated for comprehensive UI coverage

**Development Tools:**
- **Replit-specific plugins** for development banner, error overlay, and cartographer (source mapping)
- These only load in development mode when `REPL_ID` is present

**Date Handling:**
- **date-fns** library for date formatting and manipulation (Bosnian locale support)

**Form Management:**
- **React Hook Form** with `@hookform/resolvers` for form validation
- Zod schemas used for validation rules

**Utility Libraries:**
- **clsx** and **tailwind-merge** combined in `cn()` helper for conditional CSS classes
- **class-variance-authority** for creating variant-based component APIs
- **cmdk** for command palette functionality
- **nanoid** for generating unique IDs