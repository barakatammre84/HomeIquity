# MortgageAI - Next-Generation MISMO 3.4 Mortgage Brokerage Platform

## Overview
MortgageAI is a deterministic mortgage brokerage platform built on MISMO 3.4 standards, leveraging graph-based underwriting logic to automate and streamline the mortgage process, aiming for 3-minute pre-approvals. The platform uses AI exclusively for data extraction, while all underwriting decisions are based on hard-coded deterministic rules to ensure regulatory compliance and mitigate Fair Lending risks. Key capabilities include deterministic underwriting with MISMO 3.4 and ULAD compliance, graph-based data models, advanced income/property eligibility, LLPA pricing, and multi-tenant support.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite, Wouter, and TanStack Query. It features a custom design system using Shadcn/ui (Radix UI) components and Tailwind CSS, supporting light/dark themes. Key UI components include a conversational pre-approval form, a user dashboard, loan options comparison, a properties marketplace with "Can I buy?" checks, and various compliance-related forms.

### Technical Implementations
The backend is developed with Node.js, Express.js, and TypeScript, utilizing PostgreSQL (Neon serverless) with Drizzle ORM for data persistence. Passport.js handles session-based authentication with role-based access control. The API is RESTful with structured error handling and robust logging.

**Database Schema:** Core entities include Users, Loan Applications, Loan Options, Documents, Properties, and Deal Activities, incorporating MISMO 3.4 graph entities and XLink-style foreign key relationships.

**Deterministic Underwriting Engine:** This central engine makes all eligibility decisions based on hard-coded Fannie Mae/Freddie Mac aligned rules, covering Income, Assets, Liabilities, DTI, Property Eligibility, and a Pricing Engine (LLPA, PMI).

**AI Integration:** Google Gemini API is exclusively used for document data extraction (e.g., from tax returns, pay stubs, bank statements) to feed the deterministic underwriting engine without influencing decision-making.

**MISMO 3.4 GSE Compliance:** Supports MISMO 3.4 XML export with a hierarchical structure and XLink graph model for ULAD compliance and MERS MIN generation.

**Document Management System:** Features custom document requests by staff, a document package builder for lender submissions, and a robust Document Intelligence Engine for underwriting-aware OCR, page-level classification, field extraction, completeness checks, and a MISMO-canonical data model for income, assets, and liabilities. This engine also includes an Underwriting Event Engine for rules-based automation and fraud/anomaly detection with a comprehensive audit trail.

**Loan Pipeline & Borrower Dashboards:** Includes a rules-driven loan processing pipeline across 7 stages, a Document Requirements Engine, Condition/Stips System, and Milestone Tracking. Borrower dashboards provide visual progress tracking, interactive document checklists, and priority-sorted action items.

**Property Search & Qualification:** Offers a Zillow-style property marketplace with smart affordability matching ("Qualified," "Stretch," "Over Budget"), estimated monthly payments, and a detailed PropertyDetail Qualification View for comprehensive affordability analysis.

**Compliance & Security:** Features a MISMO/ULAD Validation Service, a TRID-compliant Loan Estimate Generator, a Broker Compliance Dashboard, and enterprise-grade Credit & FCRA Compliance Module with encrypted storage, cryptographic audit trails, multi-step consent flows, and enhanced adverse action templates. Security features include CSRF protection, session-based authentication, role-based access control, and ownership-scoped queries.

**Staff & Partner Tools:** Includes a Staff Pipeline Queue for managing loan queues, a Unified Borrower File Workspace for staff, a Broker Referral Dashboard for commission tracking, and Admin Content/User Management systems.

**Mortgage Industry Role System:** Implements comprehensive role-based access control for 6 staff roles (Admin, LO, LOA, Processor, Underwriter, Closer) and 2 client roles (Aspiring Owner, Active Buyer).

**Aspiring Owner Journey:** A gamified program for renters, featuring a Gap Calculator Dashboard, Financial Snapshot Onboarding, Credit Coach, Savings Vault, 30-Day Roadmap, and Achievements & Milestones to guide them towards homeownership.

## External Dependencies

### Third-Party Services
-   **Neon Database:** Serverless PostgreSQL hosting.
-   **Google Gemini AI:** For document data extraction.
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