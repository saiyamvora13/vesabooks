# AI Storybook Builder

## Overview
AI Storybook Builder is a web application that enables users to create personalized, illustrated children's storybooks using AI. Users provide a story prompt and optional inspiration images, and the system generates a 3-page storybook with custom illustrations. The platform leverages Google Gemini AI for both story generation and image creation, aiming to provide an engaging and customizable platform for children's literature.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a minimalist color palette (soft white, purple primary/secondary), supports light/dark modes, and is designed with a mobile-first approach. The storybook viewer offers a 3D flipbook experience on desktop and a single-page view with swipe gestures on mobile. User authentication supports traditional email/password and Replit Auth. A personal library manages created storybooks, and the homepage hero section dynamically showcases generated storybook covers.

### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Wouter for routing, TanStack Query for state, Shadcn/ui, Radix UI, and Tailwind CSS. The backend is a Node.js Express.js server with TypeScript, Drizzle ORM for PostgreSQL, and implements a middleware-chain for request processing and error handling.

Key features include:
- **Admin Platform**: A comprehensive dashboard with separate authentication for site management, including dynamic page count, pricing, hero section storybook selection, featured content curation, and audit logging.
- **Email/Password Authentication**: Traditional authentication with Passport.js, bcryptjs hashing, email validation, and unified session management.
- **Password Reset**: Secure token-based password recovery via email with 1-hour expiration and single-use enforcement.
- **Multilingual Support (i18n)**: Full internationalization for 5 languages (English, Spanish, French, German, Chinese Simplified) using `react-i18next`, with automatic language detection and persistent preferences.
- **Story Structure System**: Enforces a three-act narrative arc (beginning/middle/end) for all generated stories, with dynamic page distribution and continuity across pages.
- **Character Consistency System**: Ensures visual consistency of characters across all pages by focusing on permanent physical features (hair, eyes, skin, marks, build) while allowing contextual clothing changes (pajamas, swimsuit, costume). The `mainCharacterDescription` contains only unchanging features and is programmatically prepended to all image prompts. The cover image serves as a visual reference for character consistency across all subsequent illustrations.
- **Image Style Consistency**: Detects art style from the user's prompt once during story generation and applies it consistently to all images (cover, all pages, back cover). Supports custom styles (realistic, photorealistic, cartoon, anime, watercolor, oil painting, etc.) or defaults to "vibrant and colorful children's book illustration" when no style is specified. Prevents style inconsistency across pages by using a flag-based approach.
- **E-Commerce System**: Full online store with embedded Stripe payments, a shopping cart, dual pricing (digital/print), and server-side price validation.
- **EPUB E-book Download**: Allows users to download storybooks as EPUB files with composite cover images and embedded illustrations for offline reading.
- **Print-Ready PDF Download**: Generates professional PDFs for print orders, adhering to commercial printing specifications with precise trim, bleed, and safe margins, using `pdf-lib`.
- **Error Handling & Retry Logic**: Includes automatic retry mechanisms for failed generation processes and a manual "Try Again" option.
- **Persistent Image Storage**: All images are stored in Replit Object Storage with automatic optimization (JPEG compression at 90% quality, resized to 1200px max width) for ~90% file size reduction without visible quality loss. Images are organized in date-based folders (YYYY/MM/DD) based on storybook creation date for efficient management and scalability.
- **Storage Management Tools**: Admin endpoints for storage analysis and cleanup:
  - `/api/admin/storage-analysis` - Analyze all files, identify large files (>1.5MB), PNG vs JPG distribution, and potential duplicates
  - `/api/admin/migrate-images` - Test migration (2 books) to convert PNG images to optimized JPEGs
  - `/api/admin/migrate-all-images` - Full migration of ALL remaining PNG storybooks to optimized JPEGs with date-based organization
  - `/api/admin/cleanup-orphaned-pngs` - Safely delete orphaned PNG files not referenced in database

### System Design Choices
- **Data Storage**: PostgreSQL via Drizzle ORM for `users`, `storybooks`, `purchases`, `sessions`, and `password_reset_tokens`. `storybooks` includes `mainCharacterDescription` and `storyArc`. Admin data is stored in `admin_users`, `site_settings`, `hero_storybook_slots`, `featured_storybooks`, and `admin_audit_logs`. File uploads are stored in Replit Object Storage.
- **Frontend Frameworks**: React 18, TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui, Radix UI, Tailwind CSS.
- **Backend Frameworks**: Node.js, Express.js, TypeScript, Drizzle ORM.

## External Dependencies

### AI Services
- **Google Gemini AI (@google/genai)**: For story generation, style analysis, and illustration creation.

### Database & Infrastructure
- **Neon Serverless Postgres (@neondatabase/serverless)**: Serverless PostgreSQL.
- **Drizzle ORM**: Type-safe ORM.
- **Google Cloud Storage**: Backend for Replit Object Storage.

### File Handling
- **Multer**: For multipart/form-data and image uploads.
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
- **Stripe**: Payment processing for purchases.
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