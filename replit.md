# AI Storybook Builder

## Overview
AI Storybook Builder is a web application for creating personalized, AI-illustrated children's storybooks. It allows users to generate 3-page storybooks with custom illustrations by providing a story prompt and optional images. The platform leverages Google Gemini AI for both story generation and image creation, aiming to offer an engaging and customizable experience for children's literature. The project envisions an engaging and customizable platform for children's literature with market potential in personalized content.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a minimalist design with a soft white and purple color palette, supporting light/dark modes and a mobile-first approach. The storybook viewer provides a 3D flipbook experience on desktop and a single-page view with swipe gestures on mobile. User authentication supports traditional email/password and Replit Auth. A personal library manages created storybooks, and the homepage hero section dynamically showcases generated storybook covers.

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Wouter for routing, TanStack Query for state management, Shadcn/ui, Radix UI, and Tailwind CSS. The backend uses Node.js Express.js with TypeScript, Drizzle ORM for PostgreSQL, and a middleware-chain for request processing and error handling.

Key features include:
- **Admin Platform**: Dashboard for site management, including dynamic page count, pricing, hero section storybook selection, featured content curation, and audit logging.
- **Authentication**: Email/password authentication with Passport.js, bcryptjs, email validation, and session management. Secure token-based password recovery.
- **Multilingual Support (i18n)**: Internationalization for 5 languages (English, Spanish, French, German, Chinese Simplified) with automatic detection and persistent preferences.
- **Story Structure System**: Enforces a three-act narrative arc (beginning/middle/end) for all stories, with dynamic page distribution and continuity.
- **Character Consistency System**: Maintains visual consistency of characters across all pages using a **Progressive Visual Reference Chain**:
  - **Cover Image as Visual Anchor**: After generating the cover using uploaded photo references, the cover image itself is included as an additional reference for ALL subsequent images (pages, back cover)
  - **Multi-Reference Image Generation**: Each page receives BOTH the original uploaded photo(s) AND the cover image, ensuring Gemini sees the established visual appearance from the cover
  - **Text-Based Consistency**: Separates and prepends `mainCharacterDescription` and `defaultClothing` to image prompts. Clothing changes only occur when contextually required.
  - **Page Regeneration**: When regenerating individual pages, the system downloads both the inspiration photo(s) and cover image from Object Storage to maintain the same visual reference chain
  - This multi-layered approach ensures characters remain visually identical across all illustrations, solving the consistency issue that occurred with single-reference generation
- **Image Style Consistency**: Detects and consistently applies art style from the user's prompt to all illustrations, defaulting to "vibrant and colorful children's book illustration" if not specified.
- **E-Commerce System**: Integrated online store with Stripe payments, shopping cart, dual pricing (digital/print), and server-side price validation.
- **EPUB E-book Download**: Allows downloading storybooks as EPUBs with composite covers, embedded illustrations, and mobile-responsive layouts.
- **Print-Ready PDF Download**: Generates professional PDFs for print orders, adhering to commercial printing specifications.
- **Error Handling & Retry Logic**: Automatic retry mechanisms for generation processes and a manual "Try Again" option.
- **Persistent Image Storage**: Images are stored in Replit Object Storage with automatic optimization (JPEG compression, resized to 1200px max width) and organized in date-based folders.
- **Sample Story Prompts**: Pre-populated, admin-manageable prompts with character placeholders for user inspiration.
- **Analytics & User Insights**: Tracks story creation, completion, page regeneration, shares, and views. Provides completion rates and popular prompt analysis in the admin API.
- **Social Sharing Features**: Allows sharing storybooks on Facebook, Twitter, WhatsApp, and a public gallery for opt-in sharing with Open Graph meta tags.
- **User Feedback & Rating System**: 1-5 star rating with optional text feedback, displayed as average ratings and counts.
- **Page Regeneration**: Allows individual page regeneration for storybook owners while maintaining character and story continuity.
- **Enhanced Admin Analytics Dashboard**: Comprehensive dashboard showing revenue, active users, completion rates, average ratings, popular themes, and user retention metrics using Recharts.
- **Sound Effects**: Professional sound effects (book-open, page-turn) from Epidemic Sound library with volume controls and persistence. AudioManager handles deferred initialization with polling mechanism to apply persisted volume preferences after user interaction.

### Security & Monitoring
- **Security Measures**: bcryptjs for password hashing (12 salt rounds), rate limiting for authentication and password reset endpoints, secure session storage (PostgreSQL), and Zod schema validation for all API endpoints.
- **Anonymous Story Creation Protection**: 
  - **IP Rate Limiting**: Anonymous users limited to 3 story creations per day per IP address, with automatic daily reset at midnight
  - **reCAPTCHA v3**: Bot protection with 0.5 minimum score threshold for anonymous story creation
  - **Email-Gated Downloads**: Anonymous storybooks require email verification (6-digit code, 15-minute expiry) before EPUB/PDF download
  - **Database Tables**: `ipRateLimits` (tracks IP usage) and `downloadVerifications` (manages email verification codes)
  - Authenticated users bypass all anonymous restrictions
  - **Development Bypass**: For local testing only, set `VITE_DEV_RECAPTCHA_BYPASS=true` (frontend) and `DEV_RECAPTCHA_BYPASS=true` (backend) as environment variables to skip reCAPTCHA validation. The bypass only works when `NODE_ENV=development` to prevent accidental production usage. Never commit these values to `.env` files.
- **Production Monitoring**: Utilizes Replit Analytics Dashboard and application logs to track HTTP 429 errors, request patterns, and identify problematic IPs. Best practices for monitoring and adjusting thresholds are defined.
- **SEO & Accessibility**: Complete meta tags, sitemap at `/sitemap.xml`, robots.txt, and ARIA labels for accessibility.

### System Design Choices
- **Data Storage**: PostgreSQL via Drizzle ORM for users, storybooks, purchases, sessions, password_reset_tokens, and admin data. File uploads use Replit Object Storage.
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

### Testing & Quality Assurance
- **Vitest**: Unit and integration testing framework.
- **@testing-library/react**: React component testing utilities.
- **Supertest**: HTTP integration testing.

### Performance Optimizations
- **Image Optimization**: Centralized utility with preset-aware sizing.
- **Lazy Loading**: `loading="lazy"` for all images and `React.lazy()` for route-based code splitting.
- **Code Splitting**: Route-based code splitting to reduce initial bundle size.