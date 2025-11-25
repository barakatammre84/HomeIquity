# MortgageAI - AI-Powered Mortgage Lending Platform

## Overview

MortgageAI is a digital-first mortgage lending platform that leverages AI to streamline the home loan application process. The platform provides instant pre-approvals, automated underwriting, and transparent loan comparisons across conventional, FHA, and VA loan products. Inspired by Better.com's approach, it emphasizes speed, transparency, and user experience with a goal of reducing approval times from weeks to minutes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type safety
- Vite as build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management
- Shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for styling with custom design system

**Design System:**
- Custom Tailwind configuration with extended color palette based on HSL variables
- Support for light/dark themes via CSS custom properties
- Typography using Inter/Work Sans font families via Google Fonts
- Consistent spacing primitives (2, 4, 6, 8, 12, 16 Tailwind units)
- Component-based architecture with reusable UI primitives

**Key Pages:**
- Landing page for unauthenticated users with marketing content
- Pre-approval form with multi-step wizard interface
- Dashboard for authenticated users showing application status and metrics
- Loan options comparison page displaying AI-generated scenarios
- Properties marketplace for browsing available real estate
- Admin dashboard for platform management and analytics

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js framework
- TypeScript for type safety across the stack
- PostgreSQL database via Neon serverless
- Drizzle ORM for database operations and type-safe queries
- Passport.js for authentication with session-based auth
- Express sessions stored in PostgreSQL via connect-pg-simple

**API Design:**
- RESTful API endpoints under `/api` prefix
- Session-based authentication with HTTP-only cookies
- Role-based access control (borrower, broker, admin, lender roles)
- Request/response logging middleware for debugging
- Structured error handling with appropriate HTTP status codes

**Authentication System:**
- Local authentication strategy via Passport.js
- User sessions persisted in PostgreSQL sessions table
- Serialization/deserialization for user objects
- Protected routes with `isAuthenticated` and `isAdmin` middleware
- 7-day session lifetime with secure cookie settings

### Database Schema

**Core Entities:**
- **Users**: Stores user profiles with role-based permissions (borrower, broker, admin, lender)
- **Loan Applications**: Tracks mortgage applications with financial details and status workflow
- **Loan Options**: AI-generated loan scenarios (conventional, FHA, VA) with rates and terms
- **Documents**: File metadata for uploaded user documents linked to applications
- **Properties**: Real estate listings with details, images, and search metadata
- **Deal Activities**: Activity log for tracking application progress and changes
- **Saved Properties**: User bookmarks for favorite property listings
- **Sessions**: PostgreSQL-based session storage for authentication

**Key Design Decisions:**
- UUIDs as primary keys via PostgreSQL's `gen_random_uuid()`
- Timestamps (createdAt, updatedAt) on all major entities
- JSONB fields for flexible data like property features and analysis results
- Indexed fields for common queries (email, userId, applicationId)
- Enum-like varchar fields with validation for statuses and types

### AI Integration

**Google Gemini API:**
- Primary AI service for loan analysis via `@google/genai` SDK
- Analyzes borrower financial profiles against loan product criteria
- Generates multiple loan scenarios with interest rates, payments, and terms
- Provides strengths/concerns/recommendations in natural language
- Calculates DTI (debt-to-income) and LTV (loan-to-value) ratios
- Determines pre-approval amounts based on creditworthiness

**Analysis Process:**
1. Collect borrower input (income, debts, credit score, property details)
2. Send structured prompt to Gemini with loan product specifications
3. Parse AI response into typed loan scenarios and analysis
4. Store results in database linked to loan application
5. Present options to user with comparison interface

## External Dependencies

### Third-Party Services

**Neon Database:**
- Serverless PostgreSQL hosting
- WebSocket-based connection pooling via `@neondatabase/serverless`
- Configured via `DATABASE_URL` environment variable
- Used for all persistent data storage

**Google Gemini AI:**
- Generative AI for loan analysis and underwriting automation
- Accessed via `GEMINI_API_KEY` environment variable
- Processes loan applications to generate approval decisions
- Returns structured financial scenarios and recommendations

### UI Component Libraries

**Radix UI:**
- Headless, accessible component primitives
- Includes: Dialog, Dropdown Menu, Select, Radio Group, Checkbox, Tabs, Toast, Tooltip, Progress, Slider, Accordion, and more
- Provides WAI-ARIA compliant interactive components
- Customized with Tailwind CSS via Shadcn/ui wrapper patterns

**Additional UI Dependencies:**
- `cmdk` - Command palette component
- `react-day-picker` - Calendar/date picker
- `recharts` - Data visualization and charting library
- `embla-carousel-react` - Carousel/slider component
- `vaul` - Drawer component for mobile interfaces
- `class-variance-authority` - Type-safe variant styling
- `lucide-react` - Icon library

### Development Tools

**Build & Development:**
- Vite for fast development server and optimized production builds
- esbuild for server-side code bundling
- tsx for running TypeScript in development
- Tailwind CSS with PostCSS for styling

**Type Safety:**
- Zod for runtime schema validation
- Drizzle-Zod for generating schemas from database models
- React Hook Form with Zod resolver for form validation
- TypeScript strict mode across entire codebase

**Replit Integration:**
- `@replit/vite-plugin-runtime-error-modal` - Error overlay in development
- `@replit/vite-plugin-cartographer` - Code mapping tool
- `@replit/vite-plugin-dev-banner` - Development environment banner