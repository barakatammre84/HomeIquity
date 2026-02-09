# Baranest - Clear Answers. Confident Approvals.

## Overview
Baranest is a mortgage platform built on MISMO 3.4 standards that automates and streamlines the mortgage process, aiming for 3-minute pre-approvals. It uses graph-based underwriting logic and document intelligence for data extraction. All underwriting decisions are based on deterministic rules to ensure regulatory compliance and mitigate Fair Lending risks. The platform focuses on providing clear mortgage decisions and trustworthy pre-approvals.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite, Wouter, and TanStack Query. It incorporates a custom design system with Shadcn/ui (Radix UI) and Tailwind CSS, supporting both light and dark themes. Key UI elements include a conversational pre-approval form, a user dashboard, loan options comparison, a properties marketplace with affordability checks, and various compliance forms. The brand identity emphasizes a premium and distinctive feel with a specific color palette (Deep Navy, Vibrant Emerald, Warm Amber, Ocean Blue), Inter as the primary font, and UI styles featuring rounded buttons, subtle shadows, and gradient backgrounds.

### Technical Implementations
The backend is developed with Node.js, Express.js, and TypeScript, using PostgreSQL (Neon serverless) with Drizzle ORM. Authentication is session-based with Passport.js and includes role-based access control. The API is RESTful, designed with structured error handling and robust logging.

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
- **Agent Co-Branding Portal:** Allows referral partners to create co-branded landing pages with referral tracking and a Deal Desk for communication.
- **Borrower Education Funnels:** Includes a First-Time Buyer Hub and a Down Payment Assistance Finder.
- **Offer Bridge Architecture:** A marketplace layer connecting borrower, broker, and lender, orchestrating the shopping experience. It supports various lender integration strategies and ensures Change-of-Circumstance protection.
- **Materiality Rules DSL Engine:** Detects material vs. non-material changes and triggers actions.
- **Policy Profile Service:** Provides policy-driven underwriting where guidelines are editable data, ensuring no future guideline changes require code modifications.
- **Task Engine:** An event-driven task management system with auto-creation, SLA classes, an escalation engine, auto-resolution, prioritization, and a comprehensive audit trail.

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