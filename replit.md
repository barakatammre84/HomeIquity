# MortgageAI - Next-Generation MISMO 3.4 Mortgage Brokerage Platform

## Overview

MortgageAI is a **deterministic mortgage brokerage platform** built on MISMO 3.4 standards, utilizing graph-based underwriting logic. Its core purpose is to automate and streamline the mortgage process, delivering **3-minute pre-approvals**. The platform uses AI exclusively for data extraction, while all underwriting decisions are based on **hard-coded deterministic rules** to ensure regulatory compliance and mitigate Fair Lending risks. Key capabilities include deterministic underwriting with MISMO 3.4 and ULAD compliance, graph-based data models to prevent orphaned financial data, advanced income qualification, property eligibility algorithms, LLPA pricing, and multi-tenant support.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend is built with **React 18, TypeScript, Vite, Wouter, and TanStack Query**. It features a custom design system using **Shadcn/ui (Radix UI)** components and **Tailwind CSS**, supporting light/dark themes. Key UI components include a conversational pre-approval form with a Live Advisory Panel, a user dashboard, loan options comparison, a properties marketplace with "Can I buy?" checks, and various compliance-related forms.

### Technical Implementations

The backend is developed with **Node.js, Express.js, and TypeScript**. It uses **PostgreSQL (Neon serverless)** with **Drizzle ORM** for data persistence. **Passport.js** handles session-based authentication with **role-based access control** and ownership-scoped queries. The API is RESTful and includes structured error handling and robust logging.

**Database Schema:** Core entities include Users, Loan Applications, Loan Options, Documents, Properties, and Deal Activities, incorporating MISMO 3.4 graph entities and XLink-style foreign key relationships.

**Deterministic Underwriting Engine:** This central engine makes all eligibility decisions based on hard-coded rules aligned with Fannie Mae/Freddie Mac guidelines. It includes modules for Income Qualification, Asset Verification, Liability Assessment, DTI Calculation, Property Eligibility ("Can I buy this house?" algorithm), and a Pricing Engine (LLPA matrix, PMI calculation, first-time homebuyer waivers).

**AI Integration:** **Google Gemini API** is used exclusively for **document data extraction** (e.g., from tax returns, pay stubs, bank statements). This extracted data feeds into the deterministic underwriting engine, ensuring AI is not used for decision-making.

**MISMO 3.4 GSE Compliance:** The platform supports MISMO 3.4 XML export with a hierarchical structure and **XLink graph model** for linking financial data, ensuring ULAD compliance and MERS MIN generation.

**Borrower Declarations (URLA Section 5):** Manages borrower declarations, including property occupancy intent, financial disclosures, and citizenship status.

**Data Quality Scoring System:** Provides completeness scoring for URLA sections.

**Task Management System:** Allows staff to create document request tasks for borrowers, including upload, verification, and AI analysis tracking.

**Real Estate Agent Platform:** Integrates agent profiles and property listings, allowing agents to manage their profiles and properties, with public profile pages for buyers.

**Buyer Property Search (Zillow-style):** A property marketplace providing smart affordability matching for pre-approved buyers, showing "Qualified," "Stretch," or "Over Budget" badges and estimated monthly payments.

**PropertyDetail Qualification View:** Offers comprehensive affordability analysis per property, including PITI breakdown, DTI impact, down payment requirements, and eligibility status.

**Loan Pipeline Engine:** A rules-driven loan processing pipeline with 7 stages (Application to Funded), a Document Requirements Engine, a Condition/Stips System, and Milestone Tracking.

**Borrower Pipeline Dashboard:** Provides visual progress tracking for borrowers, showing stage timelines, outstanding conditions, and document submission status.

**Staff Pipeline Queue:** A management tool for brokers/lenders to view and manage priority-sorted loan queues, condition clearing, and stage advancement.

**MISMO/ULAD Validation Service:** Checks GSE submission readiness, providing URLA section completeness scoring and field-level validation.

**Loan Estimate Generator:** Creates TRID-compliant disclosures with APR calculation, fee breakdowns, and payment schedules, integrated with the LLPA pricing engine.

**Unified Borrower File Workspace:** A single-view profile for staff, including application details, document management, condition tracking, and activity history.

**Broker Compliance Dashboard:** Tracks TRID timing, MISMO validation, and audit logs.

**Multi-Property Support:** Enables borrowers to manage multiple properties within an application, tracking property status and switching without losing pre-approval.

**Dynamic Rate Pages with Auto-Search:** Location-aware mortgage rate discovery pages for various loan types, featuring auto-refresh on ZIP code entry, smart auto-population of property values, and state detection.

**Plaid Verification Integration:** Provides automated employment, identity, income, and asset verification, with a fallback to manual verification.

**Learning Center & FAQ System:** Manages educational content, including category-based articles with markdown support and searchable FAQs with feedback systems.

**Security Features:** Includes CSRF protection, session-based authentication, role-based access control, ownership-scoped queries, and authenticated API routes.

**Credit & FCRA Compliance Module:** Enterprise-grade credit compliance system with:
-   **Encrypted Storage:** AES-256-GCM encryption for raw bureau responses with PII protection
-   **Cryptographic Audit Trails:** SHA-256 hashes with chained previous-hash linking for tamper-evidence
-   **Exportable Compliance Packages:** CSV/PDF audit exports for regulatory exams
-   **Multi-Step Consent Flows:** Save/resume capability with state-specific disclosures and fee policies
-   **Enhanced Adverse Action Templates:** Bureau-specific reason codes (Experian, Equifax, TransUnion, FICO) with category classification and severity levels
-   **Data Retention Policies:** FCRA/ECOA/GLBA-compliant retention with automated archival tracking
-   **Compliance Monitoring Dashboard:** Real-time metrics, retention status, and actionable alerts
-   **API Validation:** Zod schema validation enforcing catalog key usage for adverse action reasons

## External Dependencies

### Third-Party Services

-   **Neon Database:** Serverless PostgreSQL hosting.
-   **Google Gemini AI:** For document data extraction.
-   **Plaid:** For automated employment, identity, income, and asset verification (optional).

### UI Component Libraries

-   **Radix UI:** Headless, accessible component primitives.
-   **cmdk:** Command palette component.
-   **react-day-picker:** Calendar/date picker.
-   **recharts:** Data visualization.
-   **embla-carousel-react:** Carousel component.
-   **vaul:** Drawer component.
-   **lucide-react:** Icon library.
-   **framer-motion:** Animation library.