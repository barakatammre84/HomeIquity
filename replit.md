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

## DTI/DSCR ENGINE - Institutional Grade Underwriting

The DTI/DSCR Engine is a financial decision engine that calculates Debt-to-Income and Debt Service Coverage Ratios using normalized income streams (not raw documents). This engine implements underwriting logic as software rules, replacing manual calculations and junior underwriter labor.

### Core Formulas
- **DTI** = Total Monthly Liabilities / Total Qualifying Monthly Income
- **DSCR** = Net Rental Income / Property PITIA

### Engine Components

**Income Stream Enhancement:**
- Trend & Volatility Analyzer: YoY % change (slope), standard deviation, trend direction
- Reliability Scoring: 0-100 score based on income source type and consistency
- Seasoning Tracking: Months of income history, qualification status

**Seasoning Rules (`seasoning_rules`):**
Time-based qualification logic per income type and product. Actions: include, exclude, cap, prorate, flag_review.

**Cash Flow Adjustments (`cash_flow_adjustments`):**
Self-employed edge cases: depreciation addbacks, amortization, meals disallowance, one-time expenses/income, owner compensation adjustments, K-1/S-Corp distributions.

**Portfolio Stress Testing (`portfolio_stress_tests`):**
Multi-property DSCR analysis with vacancy shock, rate shock, and combined stress scenarios.

**Product Rules (`product_rules`):**
Data-driven FHA/VA/Conventional/HELOC/DSCR abstraction with DTI limits, rental income treatment, student loan rules, self-employment minimums, and reserve requirements. NO HARDCODING.

**Structured Explanations (`underwriting_explanations`):**
Every calculation produces structured explanations with ruleId, input, output, reasoning, and DTI/DSCR impact for regulators and lenders.

**Confidence Decomposition (`confidence_breakdowns`):**
Breaks overall confidence into: income, document, stability, asset, liability, property components. Identifies weakest component and remediation suggestions. Thresholds: ≥90% auto-approve, 80-89% LO review, <80% manual underwriting.

**What-If Scenarios (`what_if_scenarios`):**
Hypothetical calculations without mutating loan data. Supports income changes, liability payoffs, down payment changes, rate changes. Shows resulting DTI/DSCR/payment deltas and qualification status.

**Decision Freeze & Versioning (`underwriting_decisions`):**
Immutable decision records with SHA-256 input hash, frozen metrics (DTI/DSCR/LTV/credit score), full input JSON, and hash chain for audit trail. Required for disputes, audits, and lawsuits.

**Underwriting Rules DSL (`underwriting_rules_dsl`):**
Data-driven guideline management so non-engineers can add rules, toggle FHA/VA/Conv settings, and update guidelines without code deploys. Features:
- Trigger types: income_evaluated, liability_evaluated, dti_calculated, dscr_calculated, document_processed, field_extracted, threshold_exceeded, seasoning_checked, stability_assessed, portfolio_analyzed
- Action types: set_qualification_status, apply_cap, apply_proration, require_document, flag_for_review, trigger_recalculation, add_condition, adjust_confidence, log_explanation, escalate_to_underwriter
- DSL syntax stored as structured JSONB for flexible condition evaluation

**Rule Execution Log (`rule_execution_log`):**
Tracks every rule that fired, including trigger context, conditions met, actions executed, and impacted entities.

### What This Eliminates
- Spreadsheets for DTI calculation
- Junior underwriter math
- Inconsistent DTI across LOs
- Human math errors
- Lender disputes over calculations

## PRE-APPROVAL LETTER GENERATOR (Lender-Grade, Broker-Safe)

A controlled credit artifact system that generates credible pre-approvals trusted by real estate agents, survives wholesale lender review, and does not expose the broker to lender liability.

### Core Principle
**The letter references a frozen underwriting snapshot — never live data.**

### Components

**Disclaimer Versions (`disclaimer_versions`):**
Versioned legal text with counsel approval tracking. Every letter stores which disclaimer version was used (critical for legal defense). Disclaimer types:
- Primary: "This pre-approval is not a commitment to lend..."
- Broker Role: "We are acting as a mortgage broker and not as the lender..."
- Document Reliance: "This determination is based on documentation and information provided..."
- Change-in-Circumstance: "This pre-approval is contingent upon no material change..."
- System-Generated: "This pre-approval was generated using automated underwriting analysis..."

**Pre-Approval Letters (`pre_approval_letters`):**
The main letter artifact with:
- Frozen borrower info and loan terms (non-binding)
- Reference to immutable underwriting snapshot (via `underwriting_decisions`)
- All 5 disclaimer version references
- PDF storage with watermark: "Pre-Approval — Subject to Lender Review"
- Lock against edits once issued
- Status tracking: draft, issued, superseded, expired, revoked

**Pre-Approval Conditions (`pre_approval_conditions`):**
Auto-generated conditions from the rules engine. Standard conditions always included:
1. Final lender underwriting approval
2. Satisfactory appraisal of the subject property
3. Verification of unchanged financial condition prior to closing
4. Receipt of additional documentation as requested by lender
5. Clear and marketable title
6. Proof of adequate homeowner's insurance

**Letter Generation Logs (`letter_generation_logs`):**
Complete audit trail of letter creation events with:
- Trigger conditions evaluation
- Failed conditions tracking
- Reanalysis triggers (new document, credit expired, employment change, LO request)
- Previous/new snapshot references for re-analysis events

### Decision Freeze Rules
No recalculation unless:
1. Borrower uploads new document
2. Credit expires (typically 90-120 days)
3. Borrower reports change in employment, income, or liabilities
4. LO explicitly requests re-analysis (logged)

Every re-run = new snapshot + new letter

### Hard Rules (DO NOT BREAK)
- Never say "approved" without "subject to lender underwriting"
- Never change a pre-approval without generating a new snapshot
- Never let LOs edit letters manually
- Never backdate or overwrite snapshots
- Never hide conditions