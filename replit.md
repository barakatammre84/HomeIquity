# Baranest - Clear Answers. Confident Approvals.

## Overview
Baranest is a mortgage platform built on MISMO 3.4 standards that automates and streamlines the mortgage process, aiming for 3-minute pre-approvals. It uses graph-based underwriting logic and document intelligence for data extraction. All underwriting decisions are based on deterministic rules to ensure regulatory compliance and mitigate Fair Lending risks. The platform focuses on providing clear mortgage decisions and trustworthy pre-approvals.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite, Wouter, and TanStack Query. It incorporates a custom design system with Shadcn/ui (Radix UI) and Tailwind CSS, supporting both light and dark themes. Key UI elements include a conversational pre-approval form, a user dashboard, loan options comparison, a properties marketplace with affordability checks, and various compliance forms. The brand identity emphasizes a premium and distinctive feel with a specific color palette (Deep Navy, Vibrant Emerald, Warm Amber, Ocean Blue), Inter as the primary font, and UI styles featuring rounded buttons, subtle shadows, and gradient backgrounds.

### Technical Implementations
The backend is developed with Node.js, Express.js, and TypeScript, using PostgreSQL (Neon serverless) with Drizzle ORM. Authentication is session-based with Passport.js (Replit OIDC) and includes role-based access control. The API is RESTful, designed with structured error handling and robust logging. Security middleware includes Helmet (HTTP security headers), CSRF origin/referer checking, and express-rate-limit with tiered limits (auth: 20/15min, uploads: 50/15min, general: 500/15min). Audit logging tracks sensitive actions (document access, role changes, loan applications) via the audit_logs table. A /api/health endpoint is available for monitoring. Frontend session expiry detection redirects users to login on 401 responses.

**Core Features:**
- **Deterministic Underwriting Engine:** Implements hard-coded Fannie Mae/Freddie Mac aligned rules for eligibility (Income, Assets, Liabilities, DTI, Property Eligibility) and includes a Pricing Engine (LLPA, PMI). It features income stream enhancement, seasoning rules, cash flow adjustments, portfolio stress testing, product rules, structured explanations, confidence decomposition, what-if scenarios, and decision freezing with versioning. An Underwriting Rules DSL allows non-engineers to manage guidelines.
- **AI Integration:** Google Gemini API is used solely for document data extraction to feed the deterministic underwriting engine, not for decision-making.
- **MISMO 3.4 GSE Compliance:** Supports MISMO 3.4 XML export with a hierarchical structure and XLink graph model for ULAD compliance and MERS MIN generation.
- **Document Management System:** Provides custom document requests, a document package builder, and a Document Intelligence Engine for underwriting-aware OCR, classification, field extraction, completeness checks, and a MISMO-canonical data model. It also includes an Underwriting Event Engine for rules-based automation and fraud/anomaly detection.
- **Loan Pipeline & Borrower Dashboards:** Manages a rules-driven loan processing pipeline across 7 stages, a Document Requirements Engine, Condition/Stips System, and Milestone Tracking. Borrower dashboards show progress and interactive checklists.
- **Property Search & Qualification:** Features a Zillow-style property marketplace with affordability matching and a detailed Property Detail Qualification View.
- **Compliance & Security:** Includes a MISMO/ULAD Validation Service, TRID-compliant Loan Estimate Generator, Broker Compliance Dashboard, and an enterprise-grade Credit & FCRA Compliance Module. Security measures encompass CSRF protection, session-based authentication, role-based access control, and ownership-scoped queries.
- **Pre-Approval Letter Generator:** Creates controlled, lender-grade pre-approval letters based on frozen underwriting snapshots, with versioned legal disclaimers, auto-generated conditions, and audit logs.
- **Institutional Platform Features:** Offers a decomposed Confidence Score for staff, Auto-Expiration + Credit Re-Pull Workflows, and Lender-Specific Pre-Approval Formats for flexible presentation without altering the underlying underwriting.
- **Digital Onboarding Experience:** Provides fully digital onboarding with instant identity verification and automated compliance checks (simulated KYC/AML).
- **Staff & Partner Tools:** Includes a Staff Pipeline Queue, Unified Borrower File Workspace, Broker Referral Dashboard, and Admin Content/User Management.
- **Mortgage Industry Role System:** Implements comprehensive role-based access control for various staff and client roles.
- **Aspiring Owner Journey:** A gamified program for renters with financial tools and educational resources.
- **Policy Operations Admin UI:** A production-grade admin interface for non-technical staff to maintain policy, featuring a dashboard, a safe parameter rule editor, a COC rule builder, a materiality threshold matrix, versioning, and an audit trail.
- **Agent Co-Branding Portal:** Allows referral partners to create co-branded landing pages with referral tracking and a Deal Desk for communication. Includes co-branded pre-approval letter generation.
- **Borrower Education Funnels:** Includes a First-Time Buyer Hub and a Down Payment Assistance Finder.
- **Realtor Revenue Engine:** Comprehensive agent enablement platform with Client Pipeline View (real-time status tracking for referred borrowers), Scenario Calculator (instant mortgage payment estimates for Conventional/FHA/VA/USDA), Deal Rescue Hotline (urgent escalation system with SLA deadlines), Agent Strategy Sessions (scheduling and tracking for agent-LO recurring meetings), and Zero-Stress Closing Guarantee (SLA-driven closing commitments with countdown timers).
- **Homebuyer Accelerator Program:** Structured coaching program for first-time buyers, self-employed borrowers, and credit builders. Features 6-phase action plans with milestones (Financial Assessment, Credit Optimization, Savings Plan, Debt Reduction, Pre-Approval Ready, Home Shopping), progress tracking, and coaching session scheduling.
- **Lifetime Homeowner Value Dashboard:** Post-close borrower engagement with property financial tracking (equity growth, loan balance), automated refi opportunity alerts (rate comparison with savings calculations), annual mortgage review scheduling, and equity snapshot history.
- **Offer Bridge Architecture:** A marketplace layer connecting borrower, broker, and lender, orchestrating the shopping experience. It supports various lender integration strategies and ensures Change-of-Circumstance protection.
- **Materiality Rules DSL Engine:** Detects material vs. non-material changes and triggers actions.
- **Policy Profile Service:** Provides policy-driven underwriting where guidelines are editable data, ensuring no future guideline changes require code modifications.
- **Task Engine:** An event-driven task management system with auto-creation, SLA classes, an escalation engine, auto-resolution, prioritization, and a comprehensive audit trail.

## Project Structure (Domain-Based Modules)

### Server Routes (server/routes/)
Routes are organized into domain-based modules for team ownership:
- `server/routes.ts` - Central registration file (imports and registers all domain modules)
- `server/routes/lending.ts` - Loan applications, pre-approval, pricing, MISMO export
- `server/routes/borrower.ts` - Borrower portal, rate locks, consents, messaging, partner services
- `server/routes/documents.ts` - Document upload, intelligence, package builder
- `server/routes/property.ts` - Property CRUD, marketplace, affordability
- `server/routes/agent-broker.ts` - Agent co-branding, referral tracking, deal desk
- `server/routes/admin.ts` - Admin content, rates, users, policy operations
- `server/routes/task-engine.ts` - Task management, SLA, escalation
- `server/routes/underwriting.ts` - Underwriting engine, rules DSL, what-if scenarios
- `server/routes/compliance.ts` - MISMO validation, TRID, broker compliance
- `server/routes/notifications.ts` - In-app notification CRUD (list, unread count, mark read)
- `server/routes/staff-invites.ts` - Staff invite code generation, validation, redemption
- `server/routes/utils.ts` - Shared utilities (multer config)

### Client Pages (client/src/pages/)
Pages organized into 12 domain folders with barrel exports (index.ts):
- `lending/` - PreApproval, LoanOptions, LoanPipeline, LoanEstimate, ApplicationSummary, BorrowerDealComparison
- `borrower/` - Dashboard, Documents, Tasks, TaskDetail, Messages, URLAForm, CreditConsent, Verification, IdentityVerification, OnboardingJourney, EConsent, GapCalculator, BuyerProperties
- `staff/` - StaffDashboard, PipelineQueue, BorrowerFile, ComplianceDashboard, PolicyOps, TaskOperations, Staff
- `agent-broker/` - AgentCoBranding, AgentDashboard, AgentEdit, AgentPipeline, BrokerDashboard, InviteGenerator, AnalyticsDashboard, PartnerServices, ReferralLanding, PartnerLanding, ApplyInvite
- `realtor-engine/` - ScenarioDesk, DealRescue, StrategySessions, ClosingGuarantee
- `property/` - Properties, PropertyDetail, PropertyForm
- `education/` - FirstTimeBuyerHub, DownPaymentWizard, LearningCenter, ArticleDetail, FAQ, Resources, AcceleratorProgram
- `homeowner/` - HomeownerDashboard
- `rates/` - MortgageRates, PurchaseRates, RefinanceRates, CashOutRates, HelocRates, VaRates
- `calculators/` - RentVsBuyCalculator, AffordabilityCalculator, MortgageCalculator
- `admin/` - AdminDashboard, AdminRates, AdminContent, AdminUsers
- `public/` - Landing, Privacy, TestLogin, RedeemInvite

## External Dependencies

### Third-Party Services
-   **Neon Database:** Serverless PostgreSQL hosting.
-   **Google Gemini AI:** Used for document data extraction.
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