# MortgageAI - Next-Generation MISMO 3.4 Mortgage Brokerage Platform

## Overview

MortgageAI is a **deterministic mortgage brokerage platform** built on MISMO 3.4 standards, utilizing graph-based underwriting logic. It employs AI solely for data extraction (e.g., from tax returns, pay stubs) while relying on **hard-coded deterministic rules** for all underwriting decisions, ensuring regulatory compliance and mitigating Fair Lending risks. The platform aims to automate income qualification, asset verification, liability assessment, and pricing to deliver **3-minute pre-approvals** and enhance efficiency in the mortgage process.

Key capabilities include:
- Deterministic underwriting with MISMO 3.4 and ULAD compliance.
- Graph-based data models (XLink) to prevent orphaned financial data.
- Advanced income qualification and property eligibility algorithms.
- LLPA pricing matrix with first-time homebuyer waivers.
- Multi-tenant support for various user roles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend is built with **React 18 and TypeScript**, using **Vite** for tooling, **Wouter** for routing, and **TanStack Query** for server state management. It features a custom design system with **Shadcn/ui (Radix UI)** components and **Tailwind CSS**, supporting light/dark themes and consistent typography. Key pages include a conversational pre-approval form with a Live Advisory Panel, a user dashboard, loan options comparison, a properties marketplace with "Can I buy?" checks, and various compliance-related forms and dashboards.

### Technical Implementations

The backend is developed with **Node.js, Express.js, and TypeScript**. It uses **PostgreSQL (Neon serverless)** with **Drizzle ORM** for data persistence. **Passport.js** handles session-based authentication with **role-based access control** and ownership-scoped queries. The API is RESTful, with structured error handling and robust logging.

**Database Schema:** Core entities include Users, Loan Applications, Loan Options, Documents, Properties, and Deal Activities. It incorporates MISMO 3.4 graph entities like UrlaPersonalInfo, EmploymentHistory, UrlaAssets, UrlaLiabilities, and UrlaPropertyInfo, utilizing UUIDs as primary keys, JSONB for flexible data, and XLink-style foreign key relationships for MISMO compliance.

**Deterministic Underwriting Engine:** This engine is central to the platform, making all eligibility decisions based on hard-coded rules aligned with Fannie Mae/Freddie Mac guidelines. It includes modules for:
- **Income Qualification:** Base, variable (2-year average), and self-employment (Form 1084) income calculations.
- **Asset Verification:** Rules for various asset types and reserve requirements.
- **Liability Assessment:** Rules for installment debts, leases, student loans, and credit cards.
- **DTI Calculation:** Front-end and back-end ratios with program-specific adjustments.
- **Property Eligibility:** "Can I buy this house?" algorithm, LTV calculation, and PITI synthesis.
- **Pricing Engine:** LLPA matrix lookup, PMI calculation, and first-time homebuyer waivers.

**AI Integration:** **Google Gemini API** is used exclusively for **document data extraction** (e.g., from tax returns, pay stubs, bank statements). Extracted data is then fed into the deterministic underwriting engine, ensuring AI is not used for decision-making.

**MISMO 3.4 GSE Compliance:** The platform supports MISMO 3.4 XML export with a hierarchical structure and **XLink graph model** to link all financial data to borrower roles, preventing orphaned data. It is ULAD compliant for GSE submission and includes MERS MIN generation.

**Borrower Declarations (URLA Section 5):** A dedicated system manages borrower declarations, including property occupancy intent, financial disclosures, transaction disclosures, and citizenship status, with API endpoints for retrieval and updates.

**Data Quality Scoring System:** Provides completeness scoring across URLA sections for broker dashboards, tracking personal information, employment history, assets, liabilities, and document requirements.

**Task Management System:** Staff can create document request tasks for borrowers, allowing document uploads, verification/rejection workflows, and tracking AI analysis results per task.

**Real Estate Agent Platform:** Integrated agent profile and property listing system allowing real estate agents to:
- Create and manage professional profiles (bio, license info, specialties, service areas)
- List properties with full details (address, price, bedrooms, bathrooms, square feet)
- Track listing stats (active listings, properties sold, ratings)
- Public agent profile pages for buyers to view agent information and listings
- Routes: `/agent/dashboard`, `/agent/edit`, `/agent/:agentId`, `/property/new`, `/property/:id/edit`
- API endpoints: `/api/agents`, `/api/me/agent-profile`, `/api/me/listings`, property CRUD

**Buyer Property Search (Zillow-style):** Property marketplace with smart affordability matching:
- Pre-approved buyers see affordability badges on every property (Qualified, Stretch, Over Budget)
- Stats dashboard showing count of qualified, stretch, and over-budget properties
- "Only show affordable" toggle to filter by qualification status
- Property cards show estimated monthly payments based on real loan data
- Non-pre-approved users see full inventory with CTAs to get pre-approved
- Routes: `/buy` (buyer search), `/property/:id` (detail with qualification breakdown)
- API: `/api/properties/:id/affordability` (calculates qualification using underwriting engine)

**PropertyDetail Qualification View:** Comprehensive affordability analysis per property:
- PITI breakdown (Principal, Interest, Taxes, Insurance, PMI, HOA)
- DTI impact calculation showing front-end and back-end ratios
- Down payment requirements with reserve adequacy check
- Eligibility status with clear pass/fail indicators
- Recommended loan terms and rate estimates
- "Get Pre-Approved" CTA for non-qualified users

**Loan Pipeline Engine:** Rules-driven loan processing pipeline for fastest closing times:
- **LoanStage Tracking:** 7-stage workflow from Application → Pre-Approval → Processing → Underwriting → Conditional Approval → Clear to Close → Funded
- **Document Requirements Engine:** Auto-generates required documents based on borrower profile (employment type, loan purpose, property type, veteran status)
- **Condition/Stips System:** Tracks conditions with priorities (prior_to_approval, prior_to_docs, prior_to_funding) and statuses (outstanding, submitted, cleared, waived)
- **Milestone Tracking:** Timestamps for each stage transition with SLA monitoring
- Routes: `/pipeline/:id` (borrower view), `/pipeline-queue` (staff queue)
- API: `/api/loan-applications/:id/pipeline`, `/api/loan-applications/:id/conditions`, `/api/loan-applications/:id/advance-stage`, `/api/pipeline/queue`

**Borrower Pipeline Dashboard:** Visual progress tracking for borrowers:
- Stage timeline showing completion progress
- Outstanding conditions with upload CTAs
- Document submission tracking
- Estimated closing timeline
- Contact loan officer CTA

**Staff Pipeline Queue:** Broker/lender workflow management:
- Priority-sorted loan queue (urgent/high/normal based on SLA)
- Stage distribution filters
- Condition clearing dialog with notes
- Stage advancement with blocker checking
- Real-time refresh

## External Dependencies

### Third-Party Services

-   **Neon Database:** Serverless PostgreSQL hosting for all persistent data storage.
-   **Google Gemini AI:** Used for document data extraction from financial documents.

### UI Component Libraries

-   **Radix UI:** Headless, accessible component primitives, customized via Shadcn/ui and Tailwind CSS.
-   **cmdk:** Command palette component.
-   **react-day-picker:** Calendar/date picker.
-   **recharts:** Data visualization and charting library.
-   **embla-carousel-react:** Carousel component.
-   **vaul:** Drawer component.
-   **lucide-react:** Icon library.
-   **framer-motion:** Animation library.

### Development Tools

-   **Vite:** Fast development server and optimized production builds.
-   **esbuild:** Server-side code bundling.
-   **tsx:** Running TypeScript in development.
-   **Tailwind CSS:** For styling.
-   **Zod:** Runtime schema validation and Drizzle-Zod for generating schemas.
-   **React Hook Form:** With Zod resolver for form validation.
-   **TypeScript:** Strict mode across the codebase.