# AI Storybook Builder

## Overview
AI Storybook Builder is a web application designed for creating personalized, AI-illustrated children's storybooks. It allows users to generate 3-page storybooks with custom illustrations based on a story prompt and optional images. The platform utilizes Google Gemini AI for both story generation and image creation, aiming to provide an engaging and customizable experience in children's literature with significant market potential in personalized content.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a minimalist design with a soft white and purple color palette, supporting light/dark modes and a mobile-first approach. The storybook viewer offers a 3D flipbook experience on desktop and a single-page view with swipe gestures on mobile. User authentication includes email/password and Replit Auth. A personal library manages created storybooks, and the homepage dynamically showcases generated storybook covers. The flipbook viewer adapts dimensions based on storybook orientation (landscape or portrait). A unified "My Orders" page consolidates digital and print purchases with filtering options. Accessibility is ensured through proper color contrast in both light and dark modes, and explicit color classes for UI components to prevent visibility issues. The flipbook viewer uses static viewport height on iOS Safari to prevent resizing issues and hides the fullscreen button due to lack of Safari support. The 3D book CSS architecture uses scoped CSS to prevent conflicts between the homepage carousel (`.stacked-carousel-wrapper`) and loading state widget (`.magical-book-container`), with all 3D geometry derived from a single CSS variable (`--book-depth: 32px`). 3D pipeline hardening ensures cross-browser depth rendering by propagating `transform-style: preserve-3d` up the entire container chain, applying perspective directly in transforms via `perspective(1500px)`, and using `isolation: isolate` with `overflow: visible` to prevent ancestor-induced flattening.

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui, Radix UI, and Tailwind CSS. The backend uses Node.js Express.js with TypeScript, Drizzle ORM for PostgreSQL, and a middleware-chain. Key features include an Admin Platform, email/password authentication via Passport.js, multilingual support (5 languages), a three-act story structure, and a Progressive Visual Reference Chain for character consistency across illustrations. Users can provide text descriptions for uploaded reference images to enhance character consistency in AI-generated illustrations. AI-generated cover text uses a two-phase generation process: first, a clean cover without text for interior page reference, then a regeneration with explicit title and author text. The platform includes an e-commerce system with Stripe payments, EPUB e-book download, print-ready PDF generation, and integration with the Prodigi Print API for physical hardcover book production, including a 3-step checkout and secure webhooks. Error handling with retry logic, persistent image storage in Replit Object Storage, sample story prompts, analytics, social sharing, user feedback, and individual page regeneration are also included. Enhanced admin analytics are provided via a dashboard, and professional sound effects are integrated with an AudioManager. Security measures include bcryptjs, rate limiting, secure session storage, Zod validation, and an Admin Bootstrap System. Anonymous story creation is protected by IP rate limiting, reCAPTCHA v3, and email-gated downloads. Production monitoring leverages Replit Analytics, and the application includes SEO and accessibility features. Print orders trigger two sequential customer emails ("Order Being Processed" and "Payment Processed - In Production"). Each user has a linked Stripe customer ID for payment method reuse. A comprehensive refund system handles full and partial refunds with automatic webhook processing, tracking details, and email notifications.

### Prodigi Print API Integration
The system generates print-ready PDFs following Prodigi's hardcover photo book specifications (300 DPI, 10mm safety margins, RGB color profile, 24-300 total pages including Prodigi's additions, minimum 18 pages in our PDF). An attribution page ("Created on www.vesabooks.com") is included before the back cover. Prodigi API order status is tracked through top-level stages (`InProgress`, `Complete`, `Cancelled`) and detailed process stages (`downloadAssets`, `printReadyAssetsPrepared`, `allocateProductionLocation`, `inProduction`, `shipping`). The webhook handler supports batch orders, updating all print order records sharing the same Prodigi order ID to ensure consistent status updates for multiple items.

### System Design Choices
Data is stored in PostgreSQL via Drizzle ORM, with file uploads using Replit Object Storage. The frontend uses React 18, TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui, Radix UI, and Tailwind CSS. The backend employs Node.js, Express.js, TypeScript, and Drizzle ORM. Express routes follow strict ordering. Performance optimizations include centralized image optimization, combined API calls for purchase checks (reducing network requests by 50% for storybook views and significantly improving library page load), query caching for pricing data, batch fetching for storybooks, combining multiple print books into a single Prodigi order, and lazy loading/code splitting.

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