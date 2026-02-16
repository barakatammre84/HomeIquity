# Homiquity - Clarity for Every Stage of Homeownership

## Overview
Homiquity is a mortgage platform designed to automate and streamline the mortgage process, aiming for 3-minute pre-approvals. It provides clear mortgage decisions and trustworthy pre-approvals through a conversational pre-approval form, a properties marketplace with affordability checks, and comprehensive tools for borrowers and staff. The platform leverages graph-based underwriting logic and document intelligence for data extraction, ensuring deterministic underwriting rules for regulatory compliance and Fair Lending risk mitigation. Homiquity is envisioned as a full-stack homeownership ecosystem with modules for mortgage origination (Homiquity Lend), property search (Homiquity Listings), and AI guidance (Homiquity Coach), with future plans for Title, Protect, and Invest modules.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite, Wouter, and TanStack Query, featuring a custom design system based on Shadcn/ui (Radix UI) and Tailwind CSS, supporting light and dark themes. The brand identity is premium and distinctive, utilizing a color palette of Deep Navy, Vibrant Emerald, Warm Amber, and Ocean Blue, with Inter as the primary font. UI elements emphasize rounded buttons, subtle shadows, and gradient backgrounds. Core UI components include a conversational pre-approval form, a user dashboard, loan options comparison, and a properties marketplace.

### Technical Implementations
The backend uses Node.js, Express.js, and TypeScript, with PostgreSQL (Neon serverless) and Drizzle ORM. Authentication is session-based via Passport.js (Replit OIDC) with role-based access control. The API is RESTful, includes structured error handling, and robust logging, with security measures like Helmet, CSRF protection, and rate limiting. An email notification service uses Nodemailer, and PDFKit generates branded pre-approval and pre-qualification letters.

An AI Homebuyer Coach, powered by OpenAI GPT-5-mini, offers conversational mortgage readiness advice. It uses a 3-tier data quality hierarchy for accuracy and pre-fills application forms with structured intake data. The platform's core includes a Deterministic Underwriting Engine aligned with Fannie Mae/Freddie Mac rules, a Pricing Engine, and an Underwriting Rules DSL. AI Integration is solely for document data extraction to feed the underwriting engine, not for decision-making. MISMO 3.4 GSE Compliance is supported via XML export. A Document Management System provides OCR, classification, and data extraction. Other features include a rules-driven Loan Pipeline & Borrower Dashboards, Property Search & Qualification with an affordability marketplace, Compliance & Security features (MISMO/ULAD Validation, TRID-compliant Loan Estimates), a Pre-Approval Letter Generator, a Policy Operations Admin UI, a Realtor Revenue Engine, and a Lifetime Homeowner Value Dashboard.

### System Design Choices
The project adopts a domain-based modular structure for both server routes (e.g., `lending`, `borrower`, `documents`, `property`) and client pages (e.g., `lending`, `borrower`, `staff`, `agent-broker`) to enhance maintainability and scalability. The database schema is similarly modularized into domain-specific files (e.g., `core.ts`, `lending.ts`, `underwriting.ts`), which are re-exported through a central `shared/schema.ts` file.

### Borrower Graph (Unified Intelligence Layer)
The `BorrowerGraph` service (`server/services/borrowerGraph.ts`) aggregates all user data into a single queryable profile. It provides a `GET /api/borrower-graph` endpoint for a full profile and `GET /api/borrower-graph/affordability?price=N` for property affordability assessments. It leverages a 3-tier data trust model (document-verified > application data > chat/unverified) to determine eligibility signals, a readiness snapshot, and predictive signals. This powers dashboard integrations like the `FinancialSnapshot` and `HomeReadinessPassport` components, and property intelligence features like `AffordabilityBadge` and `AffordabilityDetail`.

## External Dependencies

### Third-Party Services
-   **Neon Database:** Serverless PostgreSQL hosting.
-   **Google Gemini AI:** Used for document data extraction.
-   **OpenAI (via Replit AI Integrations):** Powers the AI Homebuyer Coach (GPT-5-mini).
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