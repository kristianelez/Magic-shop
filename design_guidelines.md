# Design Guidelines: Greentime Sales Management Application

## Design Approach

**Selected Approach:** Design System (Productivity-Focused)

**Primary Reference:** Linear + Notion patterns
- Linear's clean typography and interaction models for professional productivity
- Notion's data organization and hierarchy patterns
- Material Design's data visualization components

**Rationale:** This is a utility-focused CRM tool where efficiency, data clarity, and daily usability are paramount. Sales representatives need quick access to customer information, clear action items, and distraction-free workflows.

---

## Core Design Elements

### A. Typography

**Font Families:**
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for product codes, IDs)

**Hierarchy:**
- Page Titles: text-2xl font-semibold (32px)
- Section Headers: text-xl font-semibold (24px)
- Card Titles: text-lg font-medium (20px)
- Body Text: text-base font-normal (16px)
- Meta Info: text-sm text-gray-600 (14px)
- Labels: text-xs font-medium uppercase tracking-wide (12px)

### B. Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 or p-6
- Card spacing: space-y-4
- Section gaps: gap-6 or gap-8
- Page margins: p-8

**Grid Structure:**
- Dashboard: 12-column responsive grid
- Customer cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Sidebar: Fixed width 256px (w-64) on desktop, collapsible on mobile

### C. Component Library

**Navigation:**
- Left sidebar with icon + label navigation items
- Top bar with search, notifications badge, user profile dropdown
- Breadcrumbs for deep navigation (Home > Customers > Customer Name)

**Dashboard Elements:**
- Stat cards: Display key metrics (customers contacted today, pending calls, conversion rate)
- Activity timeline: Chronological feed of sales activities
- Upcoming tasks widget: AI-recommended contacts with countdown timers
- Quick action buttons: floating action button for "Log Call" or "Add Customer"

**Customer Management:**
- Customer card: Avatar/initials, name, company, last contact date, product preferences
- Purchase history table: Sortable columns (Date, Product, Quantity, Amount)
- Contact log: Timeline view with call notes, outcomes, next steps
- Product recommendation panel: AI-suggested products with reasoning ("Usually reorders every 30 days")

**Forms & Inputs:**
- Floating labels for text inputs
- Dropdown selects with search functionality for product catalog
- Date pickers for scheduling follow-ups
- Rich text editor for call notes (simple toolbar)
- Toggle switches for notification preferences
- Bilingual toggle (BA/EN flag icons in top-right)

**Data Display:**
- Tables: Sticky headers, alternating row backgrounds, hover states
- Badges: Pill-shaped status indicators (Hot Lead, Regular Customer, Overdue)
- Progress bars: For sales targets and reorder cycles
- Charts: Line graphs for sales trends, bar charts for product performance (using Chart.js)

**Notifications:**
- Toast notifications: Slide in from top-right for system messages
- Notification center: Dropdown panel with categorized alerts
- In-app alerts: Prominent banner for urgent customer follow-ups
- Smart reminders: Card-based with customer photo, suggested products, and action buttons

**Modals & Overlays:**
- Customer detail modal: Full-screen on mobile, centered overlay on desktop
- Quick action sheets: Bottom drawer for "Log Call" with pre-filled customer context
- Confirmation dialogs: For critical actions (delete customer, mark as inactive)

### D. Visual Patterns

**Cards:**
- Rounded corners: rounded-lg (8px)
- Subtle shadows: shadow-sm with shadow-md on hover
- White background with border: border border-gray-200

**Buttons:**
- Primary: Solid background, medium weight text, px-4 py-2
- Secondary: Outlined with transparent background
- Ghost: Text-only for tertiary actions
- Icon buttons: Circular or square with p-2

**Icons:**
- Use Heroicons via CDN (outline style for navigation, solid for active states)
- Icon sizes: w-5 h-5 for buttons, w-6 h-6 for headers

**Interaction States:**
- Hover: Subtle background change, no dramatic effects
- Active: Slight scale reduction (scale-95) for tactile feedback
- Focus: Visible outline ring for keyboard navigation
- Disabled: Reduced opacity (opacity-50)

### E. Key Screens Structure

**Dashboard:**
- Top stats row (4 metric cards)
- Two-column layout: Main area (activity feed + upcoming tasks) + Sidebar (top products, quick actions)

**Customer List:**
- Filter/search bar at top
- Grid of customer cards with pagination
- Sidebar filters: Product category, last contact date, customer status

**Customer Detail:**
- Header: Customer info + action buttons (Call, Email, Edit)
- Tabs: Overview, Purchase History, Contact Log, AI Recommendations
- Right panel: Quick stats and upcoming reminders

**Product Catalog:**
- Category sidebar navigation (matches Greentime.ba structure)
- Product grid with images, names, stock status
- Quick add to customer offer sheet

**AI Recommendations View:**
- Priority queue of customers to contact
- Each card shows: Customer name, suggested products, reasoning, optimal contact time
- Action buttons: Schedule Call, Mark as Done, Snooze

---

## Images

**Dashboard:** No hero image needed (utility app)

**Customer Cards:** Use initials in colored circles as avatars (no actual photos needed initially)

**Product Catalog:** Product images pulled from Greentime.ba website - display in grid format with 1:1 aspect ratio, rounded corners

**Empty States:** Simple illustrations for "No customers yet" or "No calls logged today" (use undraw.co illustrations)

---

## Performance Notes

- Lazy load customer images and product photos
- Implement virtual scrolling for long customer lists
- Cache frequently accessed data (product catalog, customer list)
- Optimize table rendering for large datasets