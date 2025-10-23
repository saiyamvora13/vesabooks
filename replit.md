# AI Storybook Builder

## Overview
AI Storybook Builder is a web application for creating personalized, AI-illustrated children's storybooks. It enables users to generate 3-page storybooks with custom illustrations by providing a story prompt and optional images. The platform leverages Google Gemini AI for both story generation and image creation, aiming to offer an engaging and customizable experience for children's literature with market potential in personalized content.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a minimalist design with a soft white and purple color palette, supporting light/dark modes and a mobile-first approach. The storybook viewer provides a 3D flipbook experience on desktop and a single-page view with swipe gestures on mobile. User authentication supports traditional email/password and Replit Auth. A personal library manages created storybooks, and the homepage hero section dynamically showcases generated storybook covers. The flipbook viewer dynamically adapts container dimensions based on storybook orientation (portrait/landscape/square).

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui, Radix UI, and Tailwind CSS. The backend uses Node.js Express.js with TypeScript, Drizzle ORM for PostgreSQL, and a middleware-chain. Key features include an Admin Platform, email/password authentication with Passport.js, multilingual support (5 languages), a three-act story structure system, and a Progressive Visual Reference Chain for character consistency across illustrations. Image style consistency is maintained through user selection from 10 professional illustration styles. The platform includes an e-commerce system with Stripe payments, EPUB e-book download, and print-ready PDF generation. Integration with Prodigi Print API enables physical hardcover book production with margin-based pricing, a 3-step checkout flow, and secure webhook integration. Other features include error handling with retry logic, persistent image storage in Replit Object Storage, sample story prompts, analytics, social sharing, user feedback, and individual page regeneration. Enhanced admin analytics are provided via a dashboard, and professional sound effects are integrated with an AudioManager. Security measures include bcryptjs, rate limiting, secure session storage, and Zod validation. An Admin Bootstrap System facilitates initial admin user creation. Anonymous story creation is protected by IP rate limiting, reCAPTCHA v3, and email-gated downloads. Production monitoring leverages Replit Analytics, and the application includes SEO and accessibility features.

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
- **Batch Purchase Checking**: Library page uses `/api/purchases/check-batch` endpoint to check ownership for all storybooks in 2 API calls (digital + print) instead of 50+ individual requests, significantly improving page load performance.
- **Batch Prodigi Orders**: When ordering multiple print books, the system combines all items into a single Prodigi order instead of creating separate orders for each book, reducing shipping costs and order management complexity.
- **Lazy Loading**: `loading="lazy"` for images and `React.lazy()` for code splitting.
- **Code Splitting**: Route-based code splitting.