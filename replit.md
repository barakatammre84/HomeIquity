# Homiquity - Clarity for Every Stage of Homeownership

## Overview
Homiquity is a mortgage platform designed to automate and streamline the mortgage process, aiming for 3-minute pre-approvals. It provides clear mortgage decisions and trustworthy pre-approvals through a conversational pre-approval form, a properties marketplace with affordability checks, and comprehensive tools for borrowers and staff. The platform leverages graph-based underwriting logic and document intelligence for data extraction, ensuring deterministic underwriting rules for regulatory compliance and Fair Lending risk mitigation. Homiquity is envisioned as a full-stack homeownership ecosystem with modules for mortgage origination (Homiquity Lend), property search (Homiquity Listings), and AI guidance (Homiquity Coach), with future plans for Title, Protect, and Invest modules.

### Redfin Listings Integration
`server/routes/listings.ts` provides three endpoints using Redfin's unofficial API (no API key needed):
- `GET /api/listings/search?city=&stateCode=&minPrice=&maxPrice=&beds=&baths=&homeType=&limit=20` — Search listings by city/state with optional filters
- `GET /api/listings/:id` — Full listing detail by Redfin property ID (includes all photos, amenities, tax/price history)
- `GET /api/listings/nearby?lat=&lng=&radiusMiles=5&limit=20` — Nearby listings by coordinates
All routes use in-memory caching with 60-minute TTL. Responses use `{error: boolean, listings: [...]}` or `{error: boolean, listing: {...}}` format. The API strips Redfin's `)]}\'` prefix before JSON parsing. Note: Redfin may block server-side requests via CloudFront; the API works best from environments that allow outbound HTTP to redfin.com.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite, Wouter, and TanStack Query, featuring a custom design system based on Shadcn/ui (Radix UI) and Tailwind CSS, supporting light and dark themes. The brand identity is premium and distinctive, utilizing a color palette of Deep Navy, Vibrant Emerald, Warm Amber, and Ocean Blue, with Inter as the primary font. UI elements emphasize rounded buttons, subtle shadows, and gradient backgrounds. Core UI components include a conversational pre-approval form, a user dashboard, loan options comparison, and a properties marketplace.

The Borrower Portal follows "Calm Path" design principles: one-action-at-a-time dominant CTA, trust layer cards (assigned LO contact + estimated timeline + security microcopy), prominent journey progress stepper with stage time estimates, and collapsible secondary sections (financial snapshot, loan details, activity). First-visit onboarding uses a focused single-step-at-a-time flow with progress dots. Key components: `TrustLayer.tsx` (fetches deal team from `/api/applications/:id/team`), `JourneyTracker.tsx` (6-step stepper with ping animation on current step), `WhatsNext.tsx` (single primary action + secondary "also available" row), `FirstVisitWelcome` (onboarding stepper). "Why is this needed?" tooltips explain regulatory requirements on action items.

The Staff Dashboard (`StaffDashboard.tsx`) is a Unified Command Center combining pipeline, tasks, compliance, data retention, audit log, and automation activity into a single view. Features: (1) 5 KPI cards (Active Loans, My Queue, Awaiting Review, Compliance Score, Auto-tasks), (2) Pipeline stage distribution bar, (3) Role-tailored default tabs (LOs default to Pipeline, underwriters to Conditions, processors to My Queue), (4) Inline compliance checklists per loan with 12 regulatory checkpoints (TRID, ATR/QM, FCRA, FIRREA, MISMO, etc.) that auto-check based on loan stage progression, (5) Automation badges (`AutomationBadge` component) showing tasks triggered by rule engine/document processing/AI extraction, (6) Compliance tab with GSE/ULDD status, Data Retention (FCRA/ECOA/GLBA tracking), Audit Log (cryptographic verification), and automation activity overview, (7) Intelligence tab with conversion funnel, document accuracy, automation metrics, and outcome segments. Data sources: `/api/pipeline/queue`, `/api/tasks`, `/api/task-engine/tasks/by-role`, `/api/compliance/dashboard`, `/api/credit/retention-report`, `/api/credit/retention-policies`. UX cleanup (Feb 2026): Removed redundant standalone pages (PipelineQueue, ComplianceDashboard, AnalyticsDashboard, Staff, Home) that duplicated StaffDashboard tabs. Old URLs redirect to `/staff-dashboard`. Staff sidebar streamlined from 10 items to 7 across 2 sections (Operations + Partners). TaskOperations and OnboardingJourney remain as distinct deeper-dive pages.

### Technical Implementations
The backend uses Node.js, Express.js, and TypeScript, with PostgreSQL (Neon serverless) and Drizzle ORM. Authentication supports email/password (scrypt-hashed, stored in `users.password_hash`) and social OAuth (Google, LinkedIn, Apple) via `server/socialAuth.ts`. The `users.auth_provider` column tracks which method was used (`email`, `google`, `linkedin`, `apple`). Sessions are managed via Passport.js with express-session and PostgreSQL session store. Auth endpoints: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `GET /api/auth/providers` (returns which social providers are configured), `GET /api/auth/{google|linkedin|apple}` (initiates OAuth), `GET|POST /api/auth/{provider}/callback`. Frontend login/signup pages are at `/login` and `/signup` with social login buttons + email form. Social OAuth requires env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`. RBAC enforcement uses `requireRole()` middleware in `server/auth.ts`. All route modules import auth middleware directly from `../auth` (no parameter threading). Role groups: STAFF_ROLES (admin, lo, loa, processor, underwriter, closer, broker, lender), CLIENT_ROLES (aspiring_owner, active_buyer) defined in `shared/schema/core.ts`. The API is RESTful, includes structured error handling, and robust logging, with security measures like Helmet, CSRF protection, and rate limiting. An email notification service uses Nodemailer, and PDFKit generates branded pre-approval and pre-qualification letters.

An AI Homebuyer Coach, powered by OpenAI GPT-5-mini, offers conversational mortgage readiness advice. The platform's core includes a Deterministic Underwriting Engine aligned with Fannie Mae/Freddie Mac rules, a Pricing Engine, and an Underwriting Rules DSL. AI Integration is solely for document data extraction. MISMO 3.4 GSE Compliance is supported via XML export. A Document Management System provides OCR, classification, and data extraction. Other features include a rules-driven Loan Pipeline & Borrower Dashboards, Property Search & Qualification with an affordability marketplace, Compliance & Security features (MISMO/ULAD Validation, TRID-compliant Loan Estimates), a Pre-Approval Letter Generator, a Policy Operations Admin UI, a Realtor Revenue Engine, and a Lifetime Homeowner Value Dashboard.

**Affordability Calculator** (`client/src/pages/calculators/AffordabilityCalculator.tsx`): Better.com-inspired redesign with 3-column inputs + 2-column sticky results layout. Features: debt itemization popup dialog (auto loan, student loan, credit card, personal loan, child support, other), payment breakdown bar chart, comfortable/stretch price ranges, DTI gauges, email-based "Save My Results" lead capture flow via `calculator_profiles` table. Guest-accessible API: POST `/api/calculator-profiles` (upsert by email, returns minimal `{id, email, saved}` — no PII leak), GET `/api/calculator-profiles/check/:email` (returns `{exists, maxHomePrice, updatedAt}` only). Schema: `shared/schema/admin.ts` → `calculatorProfiles` table with email (unique), financial inputs (jsonb), debts (jsonb), results (jsonb), conversion tracking.

**Find an Agent** (`client/src/pages/agent-broker/FindAnAgent.tsx`): Better.com-inspired agent matching page at `/find-an-agent`. Features: hero section with location search, agent directory with filters (location, specialty), agent cards with ratings/stats/specialties, smart referral request dialog (name, email, location, timeline, price range, property type, special needs, pre-approved flag), intelligent agent matching (preferred agent priority, then location-based fallback), success confirmation with matched agent details and pre-approval CTA. Public APIs: GET `/api/agents/search?location=X&specialty=Y` (enriched agent profiles), POST `/api/agent-referral-requests` (creates referral with smart matching). Schema: `agentReferralRequests` table in `shared/schema/admin.ts` with `preferredAgentId` for explicit agent selection and `matchedAgentId` for algorithm-matched agent. Navigation: accessible from "Buy" dropdown in main nav.

### Shared Utilities (Feb 2026)
- **`client/src/lib/formatters.ts`**: Centralized formatting functions (formatCurrency, formatCurrencyDecimal, formatPercent, formatNumber, formatDate, formatTimeRemaining, getLoanTypeLabel, getStatusLabel, getStatusColor). All 24+ consumer files import from here — no local formatter definitions.
- **`client/src/lib/sla.ts`**: Shared SLA types and constants (SlaStatus type, SLA_STATUS_COLORS, SLA_DOT_COLORS, SLA_STATUS_LABELS, SLA_SORT_ORDER). Used by StaffDashboard and TaskOperations.
- **QueryKey convention**: All TanStack Query keys use array segments (`['/api/loan-applications', id, 'pipeline']`) instead of template literals, enabling hierarchical cache invalidation. The default queryFn joins segments with `/`. For query-parameter URLs, use explicit queryFn.
- **Dead code removed**: `authUtils.ts`, `auth-utils.ts`, `use-auth.ts` (re-export), `toast-utils.ts` — all had zero imports.

### System Design Choices
The project adopts a domain-based modular structure for both server routes (e.g., `lending`, `borrower`, `documents`, `property`) and client pages (e.g., `lending`, `borrower`, `staff`, `agent-broker`) to enhance maintainability and scalability. The database schema is similarly modularized into domain-specific files (e.g., `core.ts`, `lending.ts`, `underwriting.ts`), which are re-exported through a central `shared/schema.ts` file.

The `BorrowerGraph` service aggregates all user data into a single queryable profile, leveraging a 3-tier data trust model (document-verified > application data > chat/unverified) to determine eligibility signals, readiness, and predictive signals. This powers dashboard integrations and property intelligence features.

The intelligence layer provides foundational data aggregation, state tracking, and matching infrastructure through a defined schema (`intelligence.ts`) with tables for borrower profiles, real estate owned, lender products, borrower state history, readiness checklist, intent events, lender match results, and anonymized borrower facts. Key services include a borrower state machine, a lender matching engine, and an intent tracker. Data points are collected once and reused across modules with a trust-tier resolution system (tier1 > tier2 > tier3) to ensure data accuracy.

The **Deep Intelligence Layer** extends the platform with closed-loop feedback and predictive signals:
- **Analytics Event Pipeline** (`analyticsEventPipeline.ts`): Structured event emission across all domains (underwriting, document, compliance, borrower, pricing, stage_transition). Supports automation tracking.
- **Outcome Tracker** (`outcomeTracker.ts`): Records stage timestamps per loan, computes conversion funnels, measures estimate accuracy (pre-approval vs. final amounts), and refreshes anonymized cohort insights.
- **Document Confidence** (`documentConfidence.ts`): Scores extraction confidence per document, manages human review workflow, tracks accuracy trends by doc type.
- **Predictive Engine** (`predictiveEngine.ts`): Computes likelihood-to-close, estimated days to fund, risk-of-fallout, and condition delay risk using BorrowerGraph data. Caches snapshots with 4-hour TTL. Provides borrower benchmarking ("borrowers like you" comparisons) using anonymized cohort data.
- **Data Intelligence Routes** (`routes/data-intelligence.ts`): REST API for analytics metrics, conversion funnel, document accuracy, predictions, benchmarks, and platform health dashboard.
- **Staff Intelligence Tab**: New tab in Staff Dashboard showing conversion funnel, document extraction accuracy, automation activity by domain, and outcome segments by credit bucket.
- **Borrower PredictionInsights**: Card on borrower dashboard showing likelihood, timeline, risk/positive factors, and cohort comparisons.

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