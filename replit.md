# AI Storybook Builder

## Overview

AI Storybook Builder is a web application that enables users to create personalized, illustrated children's storybooks using AI technology. Users provide a story prompt and 1-5 inspiration images, and the system generates a complete 6-page storybook with custom illustrations matching the style of the provided images. The platform is powered by Google Gemini AI for both story generation and image creation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching
- Shadcn/ui with Radix UI primitives for accessible component library
- Tailwind CSS for utility-first styling with custom design tokens

**Key Design Decisions:**
- **Component-based UI**: Leverages reusable Shadcn components (Button, Card, Dialog, Form, etc.) for consistent design language
- **Custom theming**: Uses CSS variables for colors with light/dark mode support, featuring a playful color palette (primary purple, secondary orange, accent blue)
- **Responsive design**: Mobile-first approach with breakpoints handled through Tailwind
- **Form validation**: React Hook Form with Zod schemas for type-safe form handling
- **File handling**: Custom FileUpload component with drag-and-drop support, validation for image types (JPEG/PNG) and size limits (10MB max, 5 files max)

**Routing Structure:**
- `/` - Home page with hero, features, and examples sections
- `/create` - Story creation form with image upload and prompt input (requires authentication)
- `/library` - Personal library showing all user's storybooks (requires authentication)
- `/view/:id` - View storybook by ID
- `/shared/:shareUrl` - View storybook via share URL

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js server
- TypeScript for type safety across the stack
- Drizzle ORM configured for PostgreSQL database operations
- In-memory storage fallback (MemStorage) for development

**Server Design Patterns:**
- **Middleware chain**: JSON parsing, request logging with response time tracking
- **Route organization**: Centralized route registration in `server/routes.ts`
- **Error handling**: Validates file types and sizes before processing
- **Progress tracking**: Real-time generation progress updates via polling mechanism
- **Session-based generation**: Uses UUID sessions to track multi-step story generation

**API Endpoints:**
- `POST /api/storybooks` - Create new storybook (multipart/form-data for image uploads, requires authentication)
- `GET /api/storybooks` - Retrieve all storybooks for authenticated user
- `GET /api/storybooks/:id` - Retrieve storybook by ID
- `GET /api/shared/:shareUrl` - Retrieve storybook by share URL
- `POST /api/storybooks/:id/share` - Generate shareable URL
- `GET /api/generation/:sessionId/progress` - Poll generation progress
- `GET /api/auth/user` - Get current authenticated user
- `GET /api/login` - Initiate OAuth login flow
- `GET /api/logout` - Logout and clear session

### Data Storage Solutions

**Database Schema (PostgreSQL via Drizzle):**
- **users table**: Stores authenticated user data
  - `id` (varchar, primary key) - OAuth subject claim
  - `email` (varchar, unique)
  - `first_name` (varchar, nullable)
  - `last_name` (varchar, nullable)
  - `profile_image_url` (varchar, nullable)
  - `created_at` (timestamp)
  
- **storybooks table**: Stores complete storybook data
  - `id` (UUID, primary key)
  - `user_id` (varchar, foreign key to users.id, ON DELETE CASCADE)
  - `title` (text)
  - `prompt` (text)
  - `pages` (JSON array of page objects with pageNumber, text, imageUrl)
  - `inspiration_images` (JSON array of image filenames)
  - `created_at` (timestamp)
  - `share_url` (text, nullable)
  
- **sessions table**: Stores user sessions for authentication
  - PostgreSQL session store via connect-pg-simple

**Storage Strategy:**
- Primary: PostgreSQL via Neon serverless driver
- Fallback: In-memory Map-based storage for development (MemStorage class)
- File uploads: Local filesystem storage in `uploads/` directory via Multer
- Progress tracking: Separate in-memory Map for generation progress states

**Data Validation:**
- Zod schemas for runtime validation (createStorybookSchema, insertStorybookSchema)
- Type inference from Drizzle schemas for compile-time safety

### External Dependencies

**AI Services:**
- **Google Gemini AI (@google/genai)**: 
  - Story generation from text prompts and image context
  - Style analysis of inspiration images
  - Image generation for storybook illustrations
  - Multimodal capabilities for combining text and image inputs

**Database & Infrastructure:**
- **Neon Serverless Postgres (@neondatabase/serverless)**: Serverless PostgreSQL database with connection pooling
- **Drizzle ORM**: Type-safe database toolkit with schema migrations support

**File Handling:**
- **Multer**: Multipart form data handling for image uploads
- **Pako**: Data compression for shareable URLs

**UI Component Libraries:**
- **Radix UI**: Headless accessible components (@radix-ui/react-*)
- **Shadcn/ui**: Pre-styled component system built on Radix
- **CMDK**: Command menu component
- **Embla Carousel**: Carousel functionality
- **React Day Picker**: Date picker component
- **Vaul**: Drawer component

**Development Tools:**
- **Vite**: Fast build tool with HMR
- **Replit plugins**: Runtime error modal, cartographer, dev banner for Replit environment
- **TSX**: TypeScript execution for development server

**Session & State Management:**
- **Connect-pg-simple**: PostgreSQL session store (configured but not actively used in current implementation)
- **TanStack Query**: Client-side data fetching, caching, and synchronization

**Key Integration Points:**
- Environment variable `GEMINI_API_KEY` required for AI functionality
- Environment variable `DATABASE_URL` required for PostgreSQL connection
- Environment variable `SESSION_SECRET` required for session encryption
- File system access for temporary upload storage
- Client-side polling mechanism for progress updates (2-second intervals)

## Recent Changes (October 2025)

### User Authentication & Authorization
- Implemented Replit Auth (OAuth) for user authentication
- Supports multiple OAuth providers: Google, GitHub, X, Apple, email/password
- Session-based authentication using express-session with PostgreSQL store
- Users table stores OAuth profile data
- Protected endpoints require authentication via isAuthenticated middleware
- Fixed multipart form authentication by adding credentials: "include" to fetch requests

### User-Storybook Association
- Added userId foreign key to storybooks table
- Storybooks are now linked to authenticated users
- Cascade delete: deleting a user removes their storybooks
- POST /api/storybooks requires authentication
- Story generation includes userId in database records
- Unauthorized requests properly return 401 status

### Personal Library Feature
- New /library route displays user's storybooks
- Responsive grid layout (1/2/3 columns)
- Each card shows: cover image, title, prompt, creation date
- Empty state with "Create Your First Storybook" CTA
- Loading skeleton states during data fetch
- Error handling with retry button
- "My Library" link in navigation (visible only when authenticated)
- Integration with TanStack Query for data fetching and caching