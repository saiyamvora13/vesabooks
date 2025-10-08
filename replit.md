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
The primary database is PostgreSQL (Neon serverless driver) managed by Drizzle ORM. The schema includes `users` for authentication data, `storybooks` for story content (title, prompt, pages, inspiration images), and `sessions` for user authentication. File uploads (inspiration images and generated illustrations) are stored in Replit Object Storage, ensuring persistence. Generation progress is tracked in-memory during the multi-step AI process.

### UI/UX Decisions
The application features a playful color palette, supports light/dark modes, and is designed with a mobile-first approach. The storybook viewer is responsive, offering a 3D flipbook experience on desktop and a single-page view with swipe gestures on mobile. User authentication is integrated with Replit Auth, and a personal library feature allows authenticated users to manage their created storybooks.

### Technical Implementations
- **Image Style Control**: The system detects style keywords in user prompts (e.g., "realistic," "watercolor") to guide AI image generation, defaulting to "vibrant and colorful children's book illustration" if no style is specified.
- **EPUB E-book Download**: Users can download storybooks as EPUB files with a composite cover image (illustration + title/author overlay), no Table of Contents for immediate reading, and a two-page spread layout (image left, text right). The external cover uses a dynamically generated composite image created with Sharp, combining the cover illustration with title/author text. Each download generates a uniquely named temporary file (using randomUUID) to prevent race conditions during concurrent downloads. All images are embedded for offline reading on any e-reader.
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

### UI Component Libraries
- **Radix UI**: Headless, accessible component primitives.
- **Shadcn/ui**: Pre-styled component system built on Radix UI.
- **CMDK**: Command menu component.
- **Embla Carousel**: Carousel functionality.
- **React Day Picker**: Date picker component.
- **Vaul**: Drawer component.

### Authentication & State Management
- **Connect-pg-simple**: PostgreSQL session store for `express-session`.
- **TanStack Query (React Query)**: Client-side data fetching, caching, and synchronization.