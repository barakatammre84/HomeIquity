# MortgageAI - Next-Generation MISMO 3.4 Mortgage Brokerage Platform

## Overview
MortgageAI is a deterministic mortgage brokerage platform designed to automate and streamline the mortgage process, aiming for 3-minute pre-approvals. It is built on MISMO 3.4 standards and leverages graph-based underwriting logic. The platform uses AI solely for data extraction, with all underwriting decisions based on hard-coded deterministic rules to ensure regulatory compliance and mitigate Fair Lending risks. Key capabilities include MISMO 3.4 and ULAD compliant deterministic underwriting, graph-based data models, advanced income/property eligibility, LLPA pricing, and multi-tenant support. The project's vision is to provide an institutional-grade platform that transforms the mortgage brokerage industry, offering rapid, compliant, and transparent mortgage processing.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite, Wouter, and TanStack Query, featuring a custom design system with Shadcn/ui (Radix UI) and Tailwind CSS, supporting light/dark themes. Key UI components include a conversational pre-approval form, a user dashboard, loan options comparison, a properties marketplace with "Can I buy?" checks, and various compliance forms.

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

## MATERIALITY RULES DSL ENGINE

The Materiality Rules DSL answers ONE question: "Does this change require action to preserve pre-approval validity?"

### Design Goals
- Detect material vs non-material changes
- Be guideline-aligned but broker-safe
- Trigger actions, not decisions
- Be versioned, explainable, and auditable
- Never silently re-underwrite

### Core Principle
The DSL NEVER: recalculates income, issues approvals, or modifies snapshots.

### Database Tables (4 tables)

**1. `materiality_rule_sets`** - Versioned rule containers:
- Rule set ID (e.g., "CONV_BASELINE_COC")
- Product type (CONV, FHA, VA, HELOC)
- Authority (BROKER_PRE_APPROVAL, LENDER_SPECIFIC, REGULATORY)
- Version control with effective/expiration dates (legal compliance)
- Draft vs published status

**2. `materiality_rules`** - Individual rules with full DSL schema:
- Category: INCOME, EMPLOYMENT, CREDIT, ASSETS, LIABILITIES
- AppliesTo filters: incomeType, occupancy, productType
- When condition: metric, change type (PERCENT_DECREASE, ABSOLUTE_DECREASE, BOOLEAN_CHANGE, NEW_ENTRY)
- Materiality declaration: isMaterial (true/false), severity (LOW, MEDIUM, HIGH)
- Required action: NONE, BORROWER_ATTESTATION, DOCUMENT_REFRESH, CREDIT_REFRESH, REUNDERWRITE
- Explanation with guideline reference

**3. `change_events`** - Normalized delta inputs:
- Snapshot vs current state comparison
- Metric changes with previous/current values
- Change type and computed deltas (absolute, percent)
- Source tracking (PLAID_REFRESH, DOCUMENT_UPLOAD, CREDIT_REFRESH)

**4. `materiality_evaluations`** - Audit-complete decision logs:
- Every rule evaluated (NO short-circuiting for audit)
- Rule matched status, materiality, severity, required action
- Evaluation context with all values compared
- Aggregated result across all rules
- Action taken tracking with timestamps

### Example Rules

**Income 10% Decrease (Material):**
```
category: INCOME
metric: income.qualifying
changeType: PERCENT_DECREASE
value: 10
isMaterial: true
severity: HIGH
requiredAction: REUNDERWRITE
guidelineReference: "Fannie Mae B3-3.1-01"
```

**New Credit Account (Material):**
```
category: CREDIT
metric: credit.newTradeline
changeType: NEW_ENTRY
isMaterial: true
severity: MEDIUM
requiredAction: CREDIT_REFRESH
```

**Asset Fluctuation <$2K (Non-Material):**
```
category: ASSETS
metric: assets.total
changeType: ABSOLUTE_DECREASE
value: 2000
isMaterial: false
severity: LOW
requiredAction: NONE
```

### Execution Semantics

1. Compare snapshot metrics vs current metrics
2. Normalize deltas into ChangeEvents
3. Evaluate ALL applicable rules (no short-circuiting)
4. If any rule returns REUNDERWRITE: freeze pre-approval, require new snapshot
5. Log every decision

### Hard Guardrails (DO NOT BREAK)
- No silent re-underwriting
- No borrower-hidden actions
- No LO overrides of materiality
- No mutable snapshots
- No unversioned rules
- Old snapshots reference old rule versions
- New rules never retroactively apply