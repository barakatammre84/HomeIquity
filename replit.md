# Homiquity - Clarity for Every Stage of Homeownership

## Overview
Homiquity is a mortgage platform designed to automate and streamline the mortgage process, aiming for 3-minute pre-approvals. It leverages graph-based underwriting logic and document intelligence for data extraction, ensuring all underwriting decisions are based on deterministic rules for regulatory compliance and Fair Lending risk mitigation. The platform's core purpose is to provide clear mortgage decisions and trustworthy pre-approvals, focusing on a premium, distinctive user experience. Key capabilities include a conversational pre-approval form, a properties marketplace with affordability checks, and comprehensive tools for both borrowers and staff.

Homiquity is positioned as a full-stack homeownership ecosystem with product modules: Homiquity Lend (mortgage origination), Homiquity Listings (property search), and Homiquity Coach (AI guidance), with future expansion to Title, Protect (insurance), and Invest modules. The platform is military veteran-founded, backed by 15 years of commercial banking experience, and prioritizes honest, transparent messaging. VA loan support is a natural focus area.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite, Wouter, and TanStack Query. It features a custom design system using Shadcn/ui (Radix UI) and Tailwind CSS, supporting light and dark themes. The brand identity is premium and distinctive, utilizing a color palette of Deep Navy, Vibrant Emerald, Warm Amber, and Ocean Blue, with Inter as the primary font. UI elements emphasize rounded buttons, subtle shadows, and gradient backgrounds. Core UI components include a conversational pre-approval form, a user dashboard, loan options comparison, and a properties marketplace.

### Technical Implementations
The backend is developed with Node.js, Express.js, and TypeScript, utilizing PostgreSQL (Neon serverless) and Drizzle ORM. Authentication is session-based with Passport.js (Replit OIDC) and implements role-based access control. The API is RESTful with structured error handling and robust logging. Security measures include Helmet, CSRF protection, and rate limiting. An email notification service uses Nodemailer for transactional emails with branded HTML templates. PDFKit generates branded pre-approval and pre-qualification letters.

An AI Homebuyer Coach, powered by OpenAI GPT-5-mini (via Replit AI Integrations), provides conversational mortgage readiness advice. It uses a 3-tier data quality hierarchy (document-extracted > application form > chat input) to ensure accuracy, prioritizing verified document data for income and financial assessments. This coach also feeds structured intake data into the pre-approval application form for pre-filling.

The platform's core features include a **Deterministic Underwriting Engine** that applies hard-coded Fannie Mae/Freddie Mac aligned rules for eligibility, DTI, and property. It incorporates a Pricing Engine, income stream enhancement, and an Underwriting Rules DSL for non-technical guideline management. **AI Integration** is strictly for document data extraction to feed the deterministic underwriting engine, not for decision-making. **MISMO 3.4 GSE Compliance** is supported with XML export. A **Document Management System** provides underwriting-aware OCR, classification, and data extraction, along with an Underwriting Event Engine. A rules-driven **Loan Pipeline & Borrower Dashboards** manage the loan process, and a **Property Search & Qualification** feature includes an affordability marketplace. **Compliance & Security** features include MISMO/ULAD Validation, TRID-compliant Loan Estimates, and robust access controls. A **Pre-Approval Letter Generator** creates lender-grade letters. Additional features include an **AI Homebuyer Coach**, a **Policy Operations Admin UI** for managing underwriting guidelines, a **Realtor Revenue Engine** for agent enablement, and a **Lifetime Homeowner Value Dashboard** for post-close engagement.

### Engagement & Retention Features
- **PreApproval Form Autosave**: localStorage-based draft persistence (`homiquity_preapproval_draft`, `homiquity_preapproval_step`). Debounced at 800ms, saves form values and current step. Shows restore banner on return. Cleared on successful submission. Header shows "Saved" indicator with checkmark.
- **Email Capture Modal**: `EmailCaptureModal` component in App.tsx for anonymous users. Triggers after 3+ page views (tracked via `homiquity_anon_pageviews`). Backend: POST `/api/email-capture` with dedup and source page tracking. Table: `email_captures`. Rate limited to 5 req/15min.
- **Calm Guided Dashboard**: Redesigned for reduced cognitive load with 4-section layout: (1) Greeting + readiness progress bar, (2) Single dominant Next Step card (centered, large CTA), (3) Quiet tools grid (Listings, Coach, Calculators, Learn), (4) Collapsible insights/activity. Readiness % calculated from application status, verifications, and activity. Personalized by user goal (first-time buyer, refinancing, investing). New users see compact 3-step onboarding card (Coach, Browse, Apply). getDominantAction() selects the single most important action. Behavioral nudges via getProgressNudge().
- **Property Search Persistence**: Filters (location, type, price range, mode) saved to localStorage (`homiquity_property_filters`). Restored on next visit with "last search" banner. 7-day expiry.
- **Activity Tracking**: `useTrackFormStep` and `useTrackCta` hooks in `useActivityTracker.ts` for granular form step and CTA click tracking. Powers PersonalizedNudges data-driven recommendations.
- **Sticky Pre-Approval CTA**: Fixed bottom banner on property search page for unauthenticated users when browsing listings. Encourages conversion from property browsing to pre-approval application.

### System Design Choices
The project utilizes a domain-based modular structure for both server routes and client pages, enhancing maintainability and team ownership. Server routes are organized into modules like `lending`, `borrower`, `documents`, and `property`. Client pages are similarly grouped into domains such as `lending`, `borrower`, `staff`, and `agent-broker`. This approach ensures clear separation of concerns and facilitates scalable development.

## External Dependencies

### Third-Party Services
-   **Neon Database:** Serverless PostgreSQL hosting.
-   **Google Gemini AI:** Used for document data extraction.
-   **OpenAI (via Replit AI Integrations):** Powers the AI Homebuyer Coach (GPT-5-mini). No separate API key needed.
-   **Plaid:** For automated employment, identity, income, and asset verification.

### UI Component Libraries
-   **Radix UI:** Headless, accessible component primitives.
-   **cmdk:** Command palette component.
-   **react-day-picker:** Calendar/date picker.
-   **recharts:** Data visualization.
-   **embla-carousel-react:** Carousel component.
-   **vaul:** Drawer component.
-   **lucide-react:** Icon library.
-   **framer-motion:** Animation library.

### Conversion & Engagement Optimization
- **ConversionCTA Component**: Reusable `client/src/components/ConversionCTA.tsx` providing context-aware dual-action CTAs (Get Pre-Approved + Talk to Coach). Accepts `context`, `purchasePrice`, `state`, `propertyType` props. Used in calculator pages.
- **Property→Apply Bridge**: Property card CTAs pass `price`, `state`, `propertyType` as URL params to `/apply`. PreApproval form reads these params to pre-fill form fields.
- **WhatsNext Expanded Nudges**: `WhatsNext.tsx` supports `hasCreditConsent`, `hasIdVerification`, `hasBankConnected`, `hasRateLocked` boolean props for additional nudge states including credit consent, ID verification, bank connect, rate lock, denied re-engagement, and AI Coach while waiting.
- **AI Coach→Apply Bridge**: Coach readiness panel passes `source=coach` and `readiness` tier as URL params. Non-ready users see "Explore Pre-Approval Anyway" CTA.
- **Enhanced Activity Tracking**: `useTrackFormStart`, `useTrackFormAbandon`, `useTrackCoachSession` hooks integrated into PreApproval form and AI Coach.
