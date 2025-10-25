# AI Storybook Builder

## Overview
AI Storybook Builder is a web application for creating personalized, AI-illustrated children's storybooks. It enables users to generate 3-page storybooks with custom illustrations by providing a story prompt and optional images. The platform leverages Google Gemini AI for both story generation and image creation, aiming to offer an engaging and customizable experience for children's literature with market potential in personalized content.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a minimalist design with a soft white and purple color palette, supporting light/dark modes and a mobile-first approach. The storybook viewer provides a 3D flipbook experience on desktop and a single-page view with swipe gestures on mobile. User authentication supports traditional email/password and Replit Auth. A personal library manages created storybooks, and the homepage hero section dynamically showcases generated storybook covers. The flipbook viewer dynamically adapts container dimensions based on storybook orientation using binary detection: images with aspect ratio ≥ 1.0 are landscape, otherwise portrait.

**Accessibility & Contrast**: All UI components maintain proper color contrast in both light and dark modes. Dialog/Sheet close buttons explicitly use `text-gray-900 dark:text-gray-100` to ensure visibility on all backgrounds. Button variants (outline, ghost) include explicit `text-foreground` color classes to prevent white-on-white or invisible icon issues.

**iOS Safari Stability**: The flipbook viewer uses static viewport height (`vh`) instead of dynamic viewport height (`dvh`) on mobile to prevent container resizing when Safari's address bar hides/shows during page navigation. The fullscreen button is conditionally hidden on iOS devices as the Fullscreen API is not supported by Safari. Image and text pages use consistent vertical centering to prevent alignment shifts during page transitions.

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui, Radix UI, and Tailwind CSS. The backend uses Node.js Express.js with TypeScript, Drizzle ORM for PostgreSQL, and a middleware-chain. Key features include an Admin Platform, email/password authentication with Passport.js, multilingual support (5 languages), a three-act story structure system, and a Progressive Visual Reference Chain for character consistency across illustrations. Image style consistency is maintained through user selection from 10 professional illustration styles.

**AI-Generated Cover Text**: To prevent title/author text from appearing on interior pages, the system uses a two-phase cover generation: (1) Generate clean cover without text to use as reference for interior pages, (2) After all pages are complete, regenerate cover with explicit AI instruction to include title and author text. This ensures beautiful AI-generated typography on the cover while keeping interior illustrations text-free.

The platform includes an e-commerce system with Stripe payments, EPUB e-book download, and print-ready PDF generation. Integration with Prodigi Print API enables physical hardcover book production with margin-based pricing, a 3-step checkout flow, and secure webhook integration. Other features include error handling with retry logic, persistent image storage in Replit Object Storage, sample story prompts, analytics, social sharing, user feedback, and individual page regeneration. Enhanced admin analytics are provided via a dashboard, and professional sound effects are integrated with an AudioManager. Security measures include bcryptjs, rate limiting, secure session storage, and Zod validation. An Admin Bootstrap System facilitates initial admin user creation. Anonymous story creation is protected by IP rate limiting, reCAPTCHA v3, and email-gated downloads. Production monitoring leverages Replit Analytics, and the application includes SEO and accessibility features.

**Stripe Customer Management**: Each user has a linked Stripe customer ID stored in `stripeCustomerId` field. The `getOrCreateStripeCustomer()` helper function retrieves existing customer IDs or creates new Stripe customers on demand, enabling proper payment method reuse for direct purchases from the library. Payment methods are attached to customers before creating PaymentIntents with `off_session: true`, ensuring compliance with Stripe's requirements for saved payment method usage.

### Prodigi Print API Integration

#### Print-Ready PDF Structure
The system generates PDFs following Prodigi's hardcover photo book specifications exactly:

**Our PDF Structure:**
- Page 1: Front cover
- Page 2+: Content pages (foreword if present, then image/text pairs, attribution page)
- Last page: Back cover

**Prodigi Automatically Adds (~6 pages):**
- Inside front cover (blank)
- Front binding sheet (2 blank pages)
- Back binding sheet (2 blank pages)
- Inside back cover (blank)

**Key Requirements:**
- 300 DPI resolution
- 10mm safety margins on all pages
- RGB color profile
- Final book: 24-300 pages total (including Prodigi's automatic additions)
- Our PDF: Minimum 18 pages (becomes 24 with Prodigi's 6 binding pages)
- No blank pages in our PDF - Prodigi handles all binding pages

**Attribution:** "Created on www.vesabooks.com" appears as a dedicated page with soft cream background before the back cover in all formats (PDF, EPUB, Flipbook).

#### Order Status & Shipment Stages
Prodigi API tracks orders through multiple stages:

**Top-Level Status (`status.stage`)**:
- `InProgress` - Order submitted and in fulfillment
- `Complete` - All shipments have been sent
- `Cancelled` - Order production cancelled

**Detailed Process Stages (`status.details`)**:
1. `downloadAssets` - Asset download from URLs
2. `printReadyAssetsPrepared` - Files prepared for printing
3. `allocateProductionLocation` - Print facility assigned
4. `inProduction` - Actively being produced
5. `shipping` - Items shipped

Each stage can have: `NotStarted`, `InProgress`, `Complete`, or `Error`.

#### Webhook Batch Handling
The webhook handler supports batch orders (multiple storybooks in one Prodigi order) using `getPrintOrdersByProdigiId()` to update ALL print order records sharing the same Prodigi order ID. This ensures that when multiple items are combined into a single Prodigi order, all database records are updated together when the webhook fires, preventing individual items from getting stuck at old statuses.

### System Design Choices
Data is stored in PostgreSQL via Drizzle ORM, with file uploads using Replit Object Storage. The frontend utilizes React 18, TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui, Radix UI, and Tailwind CSS. The backend employs Node.js, Express.js, TypeScript, and Drizzle ORM. Express routes follow strict ordering to prevent incorrect parameter matching.

## External Dependencies

### AI Services
- **Google Gemini AI (@google/genai)**: Story generation, style analysis, and illustration creation.

### Database & Infrastructure
- **Neon Serverless Postgres (@neondatabase/serverless)**: Serverless PostgreSQL.
- **Drizzle ORM**: Type-safe ORM.
- **Google Cloud Storage**: Backend for Replit Object Storage.

### File Handling
- **Multer**: Multipart/form-data and image uploads.
- **Sharp**: High-performance image processing.
- **Pako**: Data compression for URLs.
- **epub-gen-memory**: EPUB generation.
- **jsPDF**: PDF generation.

### UI Component Libraries
- **Radix UI**: Headless component primitives.
- **Shadcn/ui**: Component system.
- **CMDK**: Command menu.
- **Embla Carousel**: Carousel.
- **React Day Picker**: Date picker.
- **Vaul**: Drawer.

### Payment Processing
- **Stripe**: Payment processing.
- **Resend**: Transactional email service.

### Authentication & State Management
- **Passport.js**: Authentication middleware.
- **bcryptjs**: Password hashing.
- **Connect-pg-simple**: PostgreSQL session store.
- **TanStack Query (React Query)**: Client-side data fetching.

### Internationalization
- **react-i18next**: React integration for i18next.
- **i18next**: Core internationalization library.
- **i18next-browser-languagedetector**: Automatic language detection.

### Testing & Quality Assurance
- **Vitest**: Unit and integration testing framework.
- **@testing-library/react**: React component testing.
- **Supertest**: HTTP integration testing.

### Performance Optimizations
- **Image Optimization**: Centralized utility with preset-aware sizing.
- **Combined Purchase Check**: Storybook view page uses `/api/purchases/check-combined` endpoint to check both digital and print ownership in a single API call, reducing network requests by 50% per page view.
- **Query Caching**: Pricing data cached with 5-minute staleTime since prices rarely change, reducing unnecessary database queries.
- **Batch Purchase Checking**: Library page uses `/api/purchases/check-batch` endpoint to check ownership for all storybooks in 2 API calls (digital + print) instead of 50+ individual requests, significantly improving page load performance.
- **Batch Storybook Fetching**: Purchases page uses `/api/storybooks/batch` POST endpoint to fetch storybook details for all purchases in chunked batches (max 100 IDs per request), eliminating N+1 query problems. Previously made 50+ individual storybook requests; now makes 1-2 batch requests regardless of purchase count. Automatically chunks requests for users with >100 unique storybooks to stay within server limits while maintaining parallel fetching for optimal performance.
- **Batch Prodigi Orders**: When ordering multiple print books, the system combines all items into a single Prodigi order instead of creating separate orders for each book, reducing shipping costs and order management complexity.
- **Lazy Loading**: `loading="lazy"` for images and `React.lazy()` for code splitting.
- **Code Splitting**: Route-based code splitting.