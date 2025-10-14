# AI Storybook Builder

## Overview

AI Storybook Builder is a web application that enables users to create personalized, illustrated children's storybooks using AI technology. Users provide a story prompt and optionally 0-5 inspiration images, and the system generates a complete 3-page storybook with custom illustrations. When inspiration images are provided, illustrations match their style; when not provided, Gemini AI generates all images from the text prompt alone. The platform is powered by Google Gemini AI for both story generation and image creation. The project aims to provide a platform for creating engaging and customizable children's literature with AI assistance.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React 18 and TypeScript, using Vite for development and Wouter for routing. State management is handled by TanStack Query, and the UI is constructed with Shadcn/ui components, Radix UI primitives, and Tailwind CSS for styling. Key design decisions include a component-based UI, custom theming with light/dark mode, responsive mobile-first design, form validation with React Hook Form and Zod, and a custom file upload component.

### Backend Architecture
The backend is a Node.js Express.js server written in TypeScript. It uses Drizzle ORM for PostgreSQL database interactions. The server follows a middleware-chain pattern for request processing, centralizes route registration, and incorporates robust error handling. It provides API endpoints for storybook creation, retrieval, sharing, EPUB downloads, and generation progress tracking, alongside user authentication via Replit Auth.

### Data Storage Solutions
The primary database is PostgreSQL (Neon serverless driver) managed by Drizzle ORM. The schema includes `users` for authentication data, `storybooks` for story content (title, prompt, pages, inspiration images), `purchases` for e-commerce transactions, `sessions` for user authentication, and `password_reset_tokens` for secure password recovery tokens with 1-hour expiration. The admin platform uses five dedicated tables: `admin_users` for admin authentication (separate from regular users with bcrypt-hashed passwords and super_admin flag), `site_settings` for key-value configuration storage (pages_per_book, digital_price, print_price), `hero_storybook_slots` for homepage hero section control (3 slots with storybook assignments), `featured_storybooks` for curated content with ranking system, and `admin_audit_logs` for comprehensive action tracking with IP addresses and change payloads. File uploads (inspiration images and generated illustrations) are stored in Replit Object Storage, ensuring persistence. Generation progress is tracked in-memory during the multi-step AI process.

### UI/UX Decisions
The application features a minimalist color palette designed to appeal to both kids and adults. The color scheme includes a clean, soft white background (hsl(0 0% 98%)), purple primary color (hsl(258 90% 58%)), and a soft light purple secondary color (hsl(270 60% 70%)). The app supports light/dark modes and is designed with a mobile-first approach. The storybook viewer is responsive, offering a 3D flipbook experience on desktop and a single-page view with swipe gestures on mobile. User authentication supports both traditional email/password and Replit Auth with unified session management. A personal library feature allows authenticated users to manage their created storybooks. The homepage hero section dynamically showcases actual generated storybook covers from the database (3 most recent) in an attractive overlapping layout, replacing generic stock images with real examples of what users can create.

### Technical Implementations
- **Admin Platform**: Comprehensive administrative dashboard for site management with separate authentication system. Admins access the platform at `/admin/login` with dedicated credentials (separate from regular users for enhanced security). Features include: dynamic page count control (1-10 pages per storybook), pricing management (digital/print), hero section storybook selection (3 slots), featured content curation with ranking, and complete audit logging with IP tracking. All admin actions are logged to admin_audit_logs table for compliance and security monitoring. Super admin privileges required for viewing audit logs. Initial admin account: email `admin@storybook.com`, password `admin123` (change immediately in production).
- **Email/Password Authentication**: Traditional authentication system using Passport.js LocalStrategy with bcryptjs password hashing (10 salt rounds). Emails are normalized to lowercase and validated before storage. Signup automatically logs users in via session creation. Unified Passport serialization handles both email/password users (stores user ID, fetches from database on deserialize), Replit Auth users (stores full user object with tokens), and admin users (stores with isAdminUser flag for session isolation). The `/api/auth/user` endpoint returns 200 with null for anonymous users and 200 with user object for authenticated users. Session management uses PostgreSQL-backed express-session with connect-pg-simple. Frontend includes signup and login pages with form validation using React Hook Form and Zod. Navigation displays appropriate auth state (Sign Up/Log In buttons for anonymous, user menu for authenticated). Database schema includes password field (hashed), authProvider field ('email' or 'replit'), and unique constraints on email (case-insensitive via index on LOWER(email)).
- **Password Reset**: Secure token-based password recovery system integrated with email/password authentication. Users request password reset via /forgot-password page (accessible from login page), which sends a reset email via Resend with a unique cryptographically secure token (crypto.randomBytes(32)). Tokens are stored in the password_reset_tokens table with 1-hour expiration and single-use enforcement (deleted after successful reset). The /reset-password page validates tokens server-side via GET /api/auth/verify-reset-token before displaying the password reset form. Frontend properly handles invalid/expired tokens by showing error messages. Password updates are processed securely with bcrypt hashing, and the system prevents email enumeration by always returning success messages regardless of whether the email exists. All password reset flows are fully tested end-to-end with playwright verification.
- **Multilingual Support (i18n)**: Complete internationalization system supporting 5 languages (English, Spanish, French, German, Chinese Simplified) across the entire application. Implemented with react-i18next and i18next-browser-languagedetector, featuring automatic language detection from localStorage (primary), browser settings (fallback), or default to English. Users can switch languages via a globe-icon dropdown in the navigation that updates all UI text immediately without page reload. Translation coverage includes all pages (home, auth, storybook creation/library/viewer, checkout, cart, purchases), form validation error messages (using reactive Zod schemas with useMemo based on i18n.language), and server-side email templates for password reset and purchase confirmations (language detected from Accept-Language header). Language preference persists across sessions via localStorage. AI-generated story content remains in whatever language the user writes their prompt, while the interface adapts to their selected language. Translation files organized by feature (common, navigation, auth, storybook, checkout) with ~500+ keys per language ensuring consistent multilingual user experience.
- **Image Style Control**: The system detects style keywords in user prompts (e.g., "realistic," "watercolor") to guide AI image generation, defaulting to "vibrant and colorful children's book illustration" if no style is specified.
- **E-Commerce System**: Full-featured online store with embedded Stripe payments (on-site checkout), shopping cart, and dual pricing ($3.99 digital, $24.99 print). Server-side price validation prevents tampering. Hybrid purchase creation ensures immediate user feedback (works in development) with webhook backup for production reliability. Cart persists through checkout flow, only clearing on confirmed purchase. Digital purchases unlock EPUB downloads; print orders trigger automated PDF email delivery via Resend as a placeholder until printing partnership is established.
- **EPUB E-book Download**: Users can download storybooks as EPUB files with a composite cover image (illustration + title/author overlay), no Table of Contents for immediate reading, and a two-page spread layout (image left, text right). The external cover uses a dynamically generated composite image created with Sharp, combining the cover illustration with title/author text. Each download generates a uniquely named temporary file (using randomUUID) to prevent race conditions during concurrent downloads. All images are embedded for offline reading on any e-reader. Download access is protected - requires digital purchase verification.
- **Print-Ready PDF Download**: Professional print-ready PDF generation for users who purchase print versions of storybooks. PDFs are formatted to meet commercial printing specifications with precise trim size (6" × 9"), 0.125" bleed on all sides, and proper safe area margins (0.5" from trim edge, 0.75" on spine for binding). Layout uses spread format with full-bleed images on left pages and text with safe margins on right pages. All measurements are calculated from the trim edge (not page edge) to ensure text and page numbers stay outside the bleed area. Images maintain aspect ratio without stretching. Generated using pdf-lib with @pdf-lib/fontkit for custom font support. Uses Comic Neue font (kid-friendly, ages 6-12) at 16pt with 1.8x line spacing for optimal readability. Text is vertically centered when it fits on the page, otherwise top-aligned to prevent overflow. Handles image-only pages gracefully with blank text areas while maintaining page numbering. Font bytes are cached at module level to prevent blocking the event loop on concurrent requests. PDFs include metadata for print compliance, with notes about optional PDF/X-4 or PDF/X-1a post-processing via Ghostscript for full CMYK conversion and TrimBox/BleedBox definitions. Download button appears in library when user owns print version. Specifications: Trim 6"×9" (432×648pt), Page with bleed 6.25"×9.25" (450×666pt), Safe margins 0.5" outer/0.75" spine, all text positioned ≥36pt from trim, Comic Neue 16pt font, 1.8x line spacing.
- **Error Handling & Retry Logic**: The application includes automatic retry mechanisms for failed generation processes and provides a manual "Try Again" option, preserving form data for a seamless user experience.
- **Persistent Image Storage**: All images are stored in Replit Object Storage, ensuring data persistence across server restarts and deployments.

## External Dependencies

### AI Services
- **Google Gemini AI (@google/genai)**: Used for multimodal AI capabilities, including story generation, style analysis from inspiration images, and the creation of storybook illustrations.

### Database & Infrastructure
- **Neon Serverless Postgres (@neondatabase/serverless)**: Serverless PostgreSQL database solution.
- **Drizzle ORM**: Type-safe ORM for database interactions.
- **Google Cloud Storage**: Backend for Replit Object Storage, used for persistent image storage.

### File Handling
- **Multer**: Middleware for handling multipart/form-data, primarily for image uploads.
- **Sharp**: High-performance image processing library used for generating composite EPUB cover images with text overlays.
- **Pako**: Data compression library used for shareable URLs.
- **epub-gen-memory**: Library for generating EPUB e-book files.
- **jsPDF**: PDF generation library for creating print-ready storybook PDFs sent via email for print orders.

### UI Component Libraries
- **Radix UI**: Headless, accessible component primitives.
- **Shadcn/ui**: Pre-styled component system built on Radix UI.
- **CMDK**: Command menu component.
- **Embla Carousel**: Carousel functionality.
- **React Day Picker**: Date picker component.
- **Vaul**: Drawer component.

### Payment Processing
- **Stripe**: Payment processing for digital and print storybook purchases with secure checkout sessions and webhook verification.
- **Resend**: Transactional email service for delivering print order PDFs to customers.

### Authentication & State Management
- **Passport.js**: Authentication middleware supporting multiple strategies (LocalStrategy for email/password, Replit Auth OIDC).
- **bcryptjs**: Password hashing library (10 salt rounds) for secure password storage.
- **Connect-pg-simple**: PostgreSQL session store for `express-session`.
- **TanStack Query (React Query)**: Client-side data fetching, caching, and synchronization.

### Internationalization
- **react-i18next**: React integration for i18next internationalization framework.
- **i18next**: Core internationalization library for translation management.
- **i18next-browser-languagedetector**: Automatic language detection plugin for browser environments.