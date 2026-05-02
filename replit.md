# Magic Shop Sales Management Application

## Overview

Magic Shop is a CRM (Customer Relationship Management) sales management application designed for B2B sales operations in Bosnia and Herzegovina. The application helps sales representatives manage customers, track products, record sales, and receive AI-powered recommendations for customer outreach based on purchasing patterns.

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
- **Sticky Header**: Fixed header with backdrop blur that remains visible during scrolling
- **Fully Responsive**: Mobile-first design with breakpoints (sm: 640px, md: 768px, lg: 1024px)
  - Header adapts: responsive padding, truncated text, icon-only buttons on mobile
  - Content grids adjust from stacked (mobile) to multi-column (desktop)
  - Sidebar collapses automatically on mobile devices

**State Management:**
- **TanStack Query (React Query)** for server state management and data fetching
- Query client configured with infinite stale time and disabled auto-refetching for optimal performance
- No global client state library - relies on server state and component-local state

**Key Pages:**
- Dashboard - Overview with stats and recent activities
- Customers - Customer list and management
  - **Customer Deletion**: Delete button in edit mode with AlertDialog confirmation
  - **Cascading Delete**: Automatically removes all related activities and sales in a single database transaction
  - Permanent deletion with warning message showing customer name
  - Atomic operation ensures no orphaned records remain
  - Automatic cache invalidation and UI update after deletion
- Products - Product catalog with inventory tracking
  - **Edit/Delete artikala**: olovka-ikonica na karticama proizvoda otvara EditProductDialog (samo admin/sales_director, gumb sakriven za sales_manager)
  - Backend PATCH/DELETE `/api/products/:id` vraćaju 403 za sales_manager
- AI Recommendations - Smart customer outreach suggestions
- Sales - Sales history and analytics
- **Customer Analysis** (Analiza kupca) - Individual customer purchase analytics:
  - Searchable customer dropdown (Popover + Command pattern) supporting both selection and free-text typing
  - Once a customer is chosen: shows summary stats (total spent, order count, unique products, total quantity)
  - Per-product breakdown sorted by revenue with category, quantity, and last purchase date
  - Full purchase chronology sorted newest first
  - Reuses `/api/customers`, `/api/sales`, `/api/products` (sales already role-filtered server-side)
- **Create Order** (Nova narudžba) - Order creation with smart product selection:
  - Displays **Top 10 preporučenih proizvoda** (suggested products based on sales volume)
  - Enables **search through products** via searchable dropdown
  - Two-group product selector: "Preporučeni proizvodi (Top 10)" and "Svi proizvodi"
  - Real-time search filtering across both groups
  - Automatic price population on product selection

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

**Performance Optimizations:**
- **Batch Loading for Customers** - `getCustomersWithStats()` method loads all customer data, activities, sales, and products in just 4 parallel queries instead of N+1 queries per customer
- **Database Indexes** - Added for faster query performance:
  - `idx_activities_customer_id` - Fast activity lookups by customer
  - `idx_sales_customer_id` - Fast sales lookups by customer  
  - `idx_sales_product_id` - Fast product-based queries
  - `idx_activities_created_at` - Fast ordering by date
- **In-memory Aggregation** - Customer stats (totalPurchases, favoriteProducts, lastContact) computed using Maps for O(1) lookups

### Data Storage Solutions

**Database:**
- **PostgreSQL** via Neon serverless platform
- Connection pooling enabled for scalability
- Schema defined in `shared/schema.ts` with the following core tables:
  - `users` - User authentication (UUID primary key)
  - `customers` - Customer information with status tracking (active/inactive/vip) and customerType enum (hotel/pekara/kafic/restoran/fabrika)
  - `products` - Product catalog with pricing, stock, categorization, and recommendedFor array for customer type targeting
  - `sales` - Sales transactions linking customers and products
  - `activities` - Customer interaction tracking
  - `ai_recommendations_cache` - Caches OpenAI recommendations for 24 hours to minimize API costs

**Schema Validation:**
- **drizzle-zod** generates Zod schemas from Drizzle table definitions
- Insert schemas omit auto-generated fields (id, timestamps)
- Type inference ensures consistency between database and application types

**Data Seeding:**
- Automatic database seeding on first run via `server/seed.ts`
- Creates sample customers
- Generates historical sales data for testing
- Replaces all existing products to ensure catalog stays up-to-date

### Authentication and Authorization

**Authentication System:**
- **Full session-based authentication** implemented with bcrypt password hashing
- **Session Management** using `express-session` with PostgreSQL-backed storage (`connect-pg-simple`)
- **Secure session cookies**: httpOnly, sameSite: "lax", 30-day rolling expiration, secure flag in production
- **Login page** with username/password form at `/login` route
- **Protected routes**: All API endpoints require authentication via `requireAuth` middleware
- **Auto-redirect**: Unauthenticated users automatically redirected to login page

**User Roles:**
- **admin**: Full access to all data and operations
- **sales_director**: Can view and manage all sales across all sales managers
- **sales_manager**: Can only view and manage their own sales (filtered by salesPersonId)

**Role-Based Access Control:**
- Sales data filtered based on user role:
  - `sales_manager` sees only sales where `salesPersonId` matches their user ID
  - `sales_director` and `admin` see all sales from all sales persons
- Sales creation automatically assigns current user's ID to `salesPersonId` field
- All other resources (customers, products, activities, recommendations) accessible to all authenticated users

**Default Users (seeded automatically):**
- **Kristina** (username: Kristina, password: 1234, role: sales_director)
- **Mladen** (username: Mladen, password: 1234, role: sales_manager)
- **Andrea** (username: Andrea, password: 1234, role: sales_manager)

**Security Features:**
- Passwords hashed using bcrypt with salt rounds
- Session secrets stored in `SESSION_SECRET` environment variable (REQUIRED - application will fail to start if not set)
- requireAuth middleware loads user from database and attaches to req.user
- Stale sessions (user deleted) automatically destroyed on authentication check
- Frontend AuthContext manages authentication state with TanStack Query
- Logout properly clears both server session and client-side cache
- Session cookies configured with httpOnly, sameSite: "lax", and secure flag in production
- **Trust proxy enabled on every Replit-hosted environment**: Express configured with `trust proxy: 1` whenever `REPL_ID`, `REPLIT_DEPLOYMENT=1`, or `NODE_ENV=production` is set, so secure cookies work behind Replit's HTTPS reverse proxy in both the dev preview and the published app
- **Cross-site session cookie on Replit**: cookie is set with `sameSite: "none"` + `secure: true` whenever the app runs on Replit (dev preview is loaded inside the workspace's cross-origin iframe, which would otherwise drop a `sameSite: "lax"` cookie and cause an immediate redirect back to the login page). Local non-Replit dev still uses `sameSite: "lax"` + `secure: false`.

**Required Environment Variables:**
- `SESSION_SECRET`: Strong random secret for session management (REQUIRED)
- `DATABASE_URL`: PostgreSQL connection string (auto-configured in Replit)
- `OPENAI_API_KEY`: OpenAI API key for AI recommendations (optional - falls back to local AI)

### External Dependencies

**AI Integration:**
- **Hybrid AI System** - Combines local algorithms (90%) with OpenAI API calls (10%) for cost-effective recommendations
- **OpenAI API** (GPT-5 model) limited to top 5 customers with 24-hour cache to minimize costs
- **Local AI Engine** (`server/local-ai.ts`) provides instant, free recommendations using:
  - Seasonal forecasting (summer/winter patterns for different product categories)
  - Stock depletion prediction based on purchase intervals and average quantity
  - Customer type-based product filtering (recommendedFor matching)
  - Purchase pattern analysis (favorite products, categories, frequencies)
- **Robust Fallback** - System continues serving local recommendations even when OpenAI quota is exceeded
- **Cache Management** - `ai_recommendations_cache` table stores OpenAI responses with 24h validity and automatic cleanup
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