# Admin Dashboard Design Guidelines - AI Storybook Builder

## Design Approach
**Selected Framework**: Modern Admin System inspired by Linear, Vercel Dashboard, and Notion workspace
**Rationale**: Utility-focused interface requiring efficiency, data clarity, and professional polish while maintaining subtle brand connection to main site

## Core Design Elements

### A. Color Palette

**Dark Mode Primary** (Default):
- Background Base: `222 15% 11%` (deep charcoal)
- Surface: `222 15% 15%` (elevated cards)
- Surface Elevated: `222 15% 18%` (modals, dropdowns)
- Border: `222 15% 25%` (subtle dividers)
- Text Primary: `222 15% 95%` (high contrast)
- Text Secondary: `222 10% 65%` (muted labels)

**Brand Accent** (Purple connection to main site):
- Primary: `270 70% 65%` (softer purple for admin)
- Primary Hover: `270 70% 60%`
- Success: `142 76% 45%`
- Warning: `38 92% 50%`
- Danger: `0 84% 60%`

**Light Mode**:
- Background: `222 15% 98%`
- Surface: `0 0% 100%`
- Border: `222 15% 88%`
- Text Primary: `222 20% 15%`

### B. Typography
**Font Stack**: Inter (Google Fonts CDN)
- Display/Headers: 600 weight, tight leading
- Body: 400 weight, 1.5 line-height
- Mono (code/IDs): JetBrains Mono, 400 weight
- Sizes: text-xs through text-2xl, semantic scaling

### C. Layout System
**Spacing**: Tailwind units of 2, 4, 6, 8, 12, 16 for consistent rhythm
**Grid**: 12-column responsive grid, 24px gutters
**Sidebar**: Fixed 280px on desktop, collapsible to 64px icon-only
**Content Area**: max-w-7xl with px-6 lg:px-8 padding

### D. Component Library

**Navigation**:
- Sidebar: Collapsible left navigation with icon + label, grouped sections (Dashboard, Content, Settings)
- Top Bar: Breadcrumbs, search, user menu, theme toggle
- Tabs: Underline style for section navigation

**Data Display**:
- Tables: Hover rows, sticky headers, row actions menu, pagination, sortable columns
- Cards: Shadow-sm elevation, rounded-lg, p-6 spacing
- Stats Cards: Large numbers with trend indicators, sparkline charts
- Lists: Drag handles for reordering, checkbox selection

**Forms**:
- Input Groups: Label above, helper text below, error states with red border
- Select/Dropdowns: Custom styled with Headless UI patterns
- Toggle Switches: Purple accent when active
- File Upload: Drag-drop zone with preview thumbnails
- Rich Text Editor: Toolbar with formatting options

**Data Visualization**:
- Chart Library: Chart.js with custom purple/slate theme
- Mini Charts: Sparklines in stat cards
- Progress Bars: Linear indicators for quotas/usage

**Interactive Elements**:
- Drag-and-Drop: Visual feedback with opacity and border highlight
- Modals: Centered overlay with backdrop blur
- Toast Notifications: Top-right positioning, auto-dismiss
- Loading States: Skeleton screens for tables/cards

### E. Dashboard Sections

**Main Dashboard**:
- Stats Grid: 4 cards (Total Stories, Active Users, Storage Used, Featured Content)
- Recent Activity Table: Latest storybook creations/edits
- Quick Actions: Create Story, Manage Featured, Settings buttons
- Analytics Chart: Story creation trends over time

**Hero Storybooks Management**:
- Featured Stories Grid: Drag-to-reorder cards with thumbnails
- Batch Actions: Toolbar for bulk feature/unfeature
- Filters: Status, category, date range
- Table View Toggle: Switch between grid and detailed table

**Content Settings**:
- Form Sections: Site Info, SEO Settings, Email Templates
- Category Management: CRUD table with inline editing
- Media Library: Grid view with upload, search, and tags

**Admin Tools**:
- User Management Table: Role assignment, status badges
- System Logs: Filterable activity feed
- Cache Controls: Clear buttons with confirmation modals

## Images
No hero images in admin dashboard. Use:
- **Storybook Thumbnails**: 300x400px covers in management grids
- **User Avatars**: 40px circular in headers/tables
- **Empty States**: Subtle illustrations (400x300px) for zero-data scenarios
- **Upload Previews**: Dynamic image previews in file upload zones

## Key Interactions
- **Hover States**: Subtle bg-slate-800/50 on interactive rows
- **Active States**: Border-l-4 border-purple-500 for selected sidebar items
- **Focus States**: Ring-2 ring-purple-500/50 for keyboard navigation
- **Animations**: Use sparingly - smooth 150ms transitions for state changes only