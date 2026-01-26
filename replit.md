# Baranest - Clear Answers. Confident Approvals.

## Overview
Baranest is a modern mortgage platform designed to make mortgage decisions clear and trustworthy. Built on MISMO 3.4 standards with graph-based underwriting logic, Baranest automates and streamlines the mortgage process for 3-minute pre-approvals. The platform uses document intelligence for data extraction, with all underwriting decisions based on deterministic rules to ensure regulatory compliance and mitigate Fair Lending risks. Key capabilities include MISMO 3.4 and ULAD compliant underwriting, graph-based data models, advanced income/property eligibility, LLPA pricing, and multi-tenant support.

## Brand Identity — Premium & Distinctive
**Brand Promise:** Clear answers. Confident approvals.
**Personality:** Trustworthy, Confident, Modern (premium feel, not generic)
**Voice:** Authoritative, direct, professional - plain English, no jargon, no marketing hype.
**Taglines:** "Mortgage decisions, made clear." / "Built for certainty, not guesswork." / "Pre-approvals you can trust."

### Color Palette (Vibrant & Professional)
**Primary Palette:**
- **Deep Navy (Primary):** #1e3a5f - hsl(213, 52%, 24%) - Rich, confident navy for CTAs and hero sections
- **Pure White (Background):** #ffffff - Clean, bright background
- **Light Border:** hsl(220, 15%, 90%) - Subtle borders
- **Rich Charcoal (Text):** hsl(220, 25%, 10%) - Strong contrast
- **Warm Gray (Secondary Text):** hsl(220, 10%, 45%) - Softer hierarchy

**Accent Palette (Eye-catching):**
- **Vibrant Emerald:** #10b981 - hsl(160, 84%, 39%) - Primary CTA buttons, success states, key highlights
- **Warm Amber:** hsl(38, 92%, 50%) - Warning states, attention
- **Ocean Blue:** hsl(200, 80%, 50%) - Info states

**Status Colors:**
- **Success:** Vibrant Emerald #10b981
- **Warning:** Rich Amber hsl(38, 92%, 50%)
- **Error:** Refined Red hsl(0, 72%, 51%)
- **Info:** Ocean Blue hsl(200, 80%, 50%)

**Dark Mode (Rich & Premium):**
- Background: hsl(222, 47%, 8%) - Rich dark blue
- Surface: hsl(222, 40%, 12%) - Elevated cards
- Primary: hsl(213, 70%, 50%) - Brighter navy
- Accent: hsl(160, 84%, 45%) - Vibrant emerald
- Text: 98% white
- Borders: hsl(220, 30%, 18%)

### Typography
**Primary Font:** Inter
- H1: 36-60px, weight 700 (bold for impact)
- H2: 28-40px, weight 700
- H3: 20-24px, weight 600
- Body: 16-18px, weight 400
- Line Height (Body): 1.6

### UI Style (Premium)
- **Hero Sections:** Gradient backgrounds (from-primary via-primary to-darker), decorative blur orbs
- **Cards:** Clean white with subtle shadows, shadow-lg for emphasis
- **Buttons:** Emerald green CTAs with shadow-lg shadow-emerald-500/25, outline variants for secondary
- **Button Shape:** Rounded (12px)
- **Input Height:** 44-48px
- **Shadows:** Colored shadows for premium feel: `shadow-primary/25` or `shadow-emerald-500/25`
- **Motion:** 150ms ease-in-out
- **Footer:** Dark navy background matching primary color

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite, Wouter, and TanStack Query. It features a custom design system with Shadcn/ui (Radix UI) and Tailwind CSS, supporting light/dark themes. Key UI components include a conversational pre-approval form, a user dashboard, loan options comparison, a properties marketplace with "Can I buy?" checks, and various compliance forms.

### Technical Implementations
The backend is built with Node.js, Express.js, and TypeScript, utilizing PostgreSQL (Neon serverless) with Drizzle ORM. Passport.js provides session-based authentication with role-based access control. The API is RESTful with structured error handling and robust logging.

**Database Schema:** Core entities include Users, Loan Applications, Loan Options, Documents, Properties, and Deal Activities, integrating MISMO 3.4 graph entities and XLink-style foreign key relationships.

**Deterministic Underwriting Engine:** This engine makes all eligibility decisions based on hard-coded Fannie Mae/Freddie Mac aligned rules for Income, Assets, Liabilities, DTI, Property Eligibility, and includes a Pricing Engine (LLPA, PMI). It uses a DTI/DSCR Engine for institutional-grade underwriting, eliminating manual calculations and ensuring consistency. This engine includes features like income stream enhancement, seasoning rules, cash flow adjustments, portfolio stress testing, product rules, structured explanations, confidence decomposition, what-if scenarios, and decision freezing with versioning. An Underwriting Rules DSL allows non-engineers to manage and update guidelines.

**AI Integration:** Google Gemini API is used exclusively for document data extraction (e.g., from tax returns, pay stubs, bank statements) to feed the deterministic underwriting engine, without influencing decision-making.

**MISMO 3.4 GSE Compliance:** Supports MISMO 3.4 XML export with a hierarchical structure and XLink graph model for ULAD compliance and MERS MIN generation.

**Document Management System:** Features custom document requests, a document package builder, and a Document Intelligence Engine for underwriting-aware OCR, page-level classification, field extraction, completeness checks, and a MISMO-canonical data model. It also includes an Underwriting Event Engine for rules-based automation and fraud/anomaly detection.

**Loan Pipeline & Borrower Dashboards:** Implements a rules-driven loan processing pipeline across 7 stages, a Document Requirements Engine, Condition/Stips System, and Milestone Tracking. Borrower dashboards provide progress tracking and interactive checklists.

**Property Search & Qualification:** Offers a Zillow-style property marketplace with affordability matching ("Qualified," "Stretch," "Over Budget") and a detailed PropertyDetail Qualification View.

**Compliance & Security:** Features a MISMO/ULAD Validation Service, a TRID-compliant Loan Estimate Generator, a Broker Compliance Dashboard, and an enterprise-grade Credit & FCRA Compliance Module with encrypted storage, cryptographic audit trails, multi-step consent flows, and enhanced adverse action templates. Security includes CSRF protection, session-based authentication, role-based access control, and ownership-scoped queries.

**Pre-Approval Letter Generator:** Generates controlled, lender-grade, broker-safe pre-approval letters based on frozen underwriting snapshots, never live data. It includes versioned legal disclaimers, auto-generated conditions, and comprehensive audit logs. The system enforces strict rules against manual edits, backdating, and silent re-underwriting.

**Institutional Platform Features:**
- **Confidence Score:** Provides agents and staff with a decomposed confidence score (Overall, Income, Assets, Credit, Documentation, Stability) and risk flags, displayed as Strong, Solid with Review, or Fragile. This score is hidden from borrowers.
- **Auto-Expiration + Credit Re-Pull Workflows:** Manages expiration policies for pre-approvals, credit, and documents. It orchestrates soft vs. hard credit pulls based on consent and liability changes, ensuring every refresh generates a new underwriting snapshot.
- **Lender-Specific Pre-Approval Formats:** Allows for different presentation formats of the same underwriting decision per lender, including field visibility, required fields validation, disclaimer overrides, branding rules, and field ordering, without altering the underlying underwriting snapshot.

**Staff & Partner Tools:** Includes a Staff Pipeline Queue, a Unified Borrower File Workspace, a Broker Referral Dashboard, and Admin Content/User Management systems.

**Mortgage Industry Role System:** Implements comprehensive role-based access control for 6 staff roles (Admin, LO, LOA, Processor, Underwriter, Closer) and 2 client roles (Aspiring Owner, Active Buyer).

**Aspiring Owner Journey:** A gamified program for renters, featuring a Gap Calculator Dashboard, Financial Snapshot Onboarding, Credit Coach, Savings Vault, 30-Day Roadmap, and Achievements & Milestones.

**Policy Operations Admin UI:** A production-grade admin interface for non-technical compliance, ops, and capital-markets staff to safely maintain policy without engineering involvement. Features include:
- **Policy Dashboard:** Shows active policy profiles (Fannie Mae, Freddie Mac, FHA, VA, Broker Overlay) with status, loan counts, and alerts panel
- **Safe Parameter Rule Editor:** 10 rule categories (Credit, Income, Assets, Liabilities, DTI/DSCR, Property, Occupancy, COC, Pre-Approval, Broker Overlay) with sliders, toggles, and dropdowns - NO formulas visible
- **COC Rule Builder:** Visual builder for Change-of-Circumstance rules with trigger events (credit drop, new tradeline, income change, asset decrease, employment change), severity levels, and GSE-specific applicability
- **Materiality Threshold Matrix:** Editable matrix showing thresholds by GSE with tooltips for guideline sources
- **Versioning & Publish Workflow:** Impact summary showing affected loans, required justification, immutable policy versions
- **Audit Trail:** Complete change history with who/when/what/why/policy reference

**Offer Bridge Architecture:** This marketplace layer connects borrower ↔ broker ↔ lender, orchestrating the shopping experience.
- **Core Principle:** Eligibility is controlled by deterministic underwriting, lenders control pricing, and clients control selection. The system orchestrates without making credit or pricing decisions.
- **Lender Integration Strategy:** Supports Manual, Semi-Automated, and API integrations with lenders.
- **Change-of-Circumstance Protection:** Invalidates existing offers and alerts lenders if borrower's credit, income, or assets change, requiring a re-shop with a new snapshot.

**Materiality Rules DSL Engine:** Detects material vs. non-material changes, triggers actions (not decisions), and is versioned, explainable, and auditable. It never recalculates income, issues approvals, or modifies snapshots.

**Policy Profile Service:** The foundation for policy-driven underwriting where underwriting logic is fixed code, guidelines are editable data, and decisions are frozen, explainable, and auditable. It ensures no future guideline change requires code changes. Ops can change threshold values within bounds, toggles, effective dates, and lender overlays, but cannot edit formulas or conditional logic, delete history, make retroactive edits, or change active profiles directly.

**Task Engine:** Event-driven task management system ensuring nothing stalls, nothing is forgotten, and humans only work exceptions.
- **Event-Driven Task Creation:** Tasks auto-created from Document Intelligence (OCR issues), Change-of-Circumstance events (credit changes, new tradelines), Workflow state transitions, and Lender interactions - never manually unless explicitly allowed.
- **SLA Classes (S0-S5):** S0 Immediate (1 hour), S1 Critical (4 hours), S2 High (12 hours), S3 Standard (48 hours), S4 Low (72 hours), S5 Informational (no SLA). Only S0-S3 block loan progression.
- **SLA Status Colors:** Green (on track), Amber (75% elapsed), Red (breached) - displayed everywhere in UI.
- **Task Type SLA Mappings:** Each task type (INTAKE_*, DOC_*, OCR_*, INC_*, AST_*, CRD_*, ELIG_*, PA_*, LND_*, CMP_*) mapped to appropriate SLA class and default owner role.
- **Escalation Engine:** 5 progressive levels (0-4): Level 0 = Owner notified, Level 1 = Owner + Manager, Level 2 = Reassign task, Level 3 = Freeze loan state, Level 4 = Compliance alert. Configurable without code.
- **Auto-Resolution:** Tasks close themselves when conditions are met (e.g., borrower uploads requested doc, credit refreshed, lender clears condition).
- **Task Prioritization:** Sorted by SLA breach risk, loan stage criticality, revenue impact, lock expiration - no custom sorting.
- **Borrower-Facing Requests:** Borrowers see simplified "requests" (not internal tasks) with friendly language, without SLA timers, internal notes, or risk flags.
- **Compliance & Audit:** Every task has trigger reason, timestamps, resolution proof - full audit trail for defensible timelines.
- **Staff Task Operations Dashboard:** SLA heatmap by role, bottleneck visibility, task table with time remaining, escalation controls.

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