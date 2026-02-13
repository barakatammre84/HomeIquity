import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface CoachingProfile {
  readinessTier: "ready_now" | "almost_ready" | "building" | "exploring";
  readinessScore: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendedLoanTypes: string[];
  estimatedTimeline: string;
}

export interface ActionPlanItem {
  id: string;
  phase: number;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "credit" | "savings" | "income" | "debt" | "documents" | "education";
  completed: boolean;
}

export interface DocumentRequirement {
  docType: string;
  label: string;
  reason: string;
  priority: "required" | "recommended" | "optional";
  category: string;
}

export interface CoachIntakeData {
  annualIncome?: string;
  monthlyDebts?: string;
  creditScore?: string;
  employmentType?: string;
  employmentYears?: string;
  downPayment?: string;
  purchasePrice?: string;
  propertyType?: string;
  loanPurpose?: string;
  isVeteran?: boolean;
  isFirstTimeBuyer?: boolean;
}

export interface CoachResponse {
  message: string;
  profile?: CoachingProfile;
  intake?: CoachIntakeData;
  actionPlan?: ActionPlanItem[];
  documentChecklist?: DocumentRequirement[];
}

export interface DocumentExtractedData {
  documentType: string;
  confidence: "high" | "medium" | "low";
  grossIncome?: number | null;
  adjustedGrossIncome?: number | null;
  taxableIncome?: number | null;
  filingStatus?: string | null;
  documentYear?: string | null;
  grossPay?: number | null;
  netPay?: number | null;
  ytdGross?: number | null;
  employerName?: string | null;
  employeeName?: string | null;
  closingBalance?: number | null;
  totalDeposits?: number | null;
  accountType?: string | null;
}

export interface VerifiedUserContext {
  hasApplication: boolean;
  applicationStatus?: string;
  annualIncome?: string | null;
  monthlyDebts?: string | null;
  creditScore?: number | null;
  employmentType?: string | null;
  employmentYears?: number | null;
  employerName?: string | null;
  isVeteran?: boolean;
  isFirstTimeBuyer?: boolean;
  dtiRatio?: string | null;
  ltvRatio?: string | null;
  preApprovalAmount?: string | null;
  purchasePrice?: string | null;
  downPayment?: string | null;
  preferredLoanType?: string | null;
  propertyType?: string | null;
  loanPurpose?: string | null;
  employmentHistory?: Array<{
    employerName?: string | null;
    positionTitle?: string | null;
    isSelfEmployed?: boolean;
    startDate?: string | null;
    totalMonthlyIncome?: string | null;
  }>;
  uploadedDocuments?: Array<{
    documentType: string;
    status: string;
  }>;
  documentExtractedData?: DocumentExtractedData[];
  userName?: string;
  readinessScore?: number | null;
  readinessTier?: string | null;
  readinessGaps?: string[];
  readinessStrengths?: string[];
  documentsMissing?: string[];
  documentsUploaded?: number;
  documentsVerified?: number;
  daysSinceLastActivity?: number | null;
  engagementLevel?: string | null;
  propertiesViewed?: number;
  suggestedNextAction?: string | null;
  hasMultipleIncomes?: boolean;
  hasBusinessIncome?: boolean;
  hasInvestmentProperties?: boolean;
  propertyContext?: {
    price: number;
    address: string;
  } | null;
}

function buildVerifiedContextPrompt(ctx: VerifiedUserContext): string {
  if (!ctx.hasApplication) {
    const greeting = ctx.userName ? `The user's name is ${ctx.userName}.` : "";
    let noAppContext = `\n\n${greeting} This user has not yet submitted a loan application. They are in the "exploring" readiness state — intake has not started. Focus on collecting the first required inputs for underwriting readiness.\n\nIMPORTANT: Any financial information this user shares in chat is SELF-REPORTED and UNVERIFIED. Treat it as approximate and advisory. Do NOT use self-reported chat data as definitive fact. Always recommend they provide documentation to verify their claims.`;

    if (ctx.propertyContext) {
      noAppContext += `\n\n=== PROPERTY CONTEXT ===\nThe user is asking about a specific property: ${ctx.propertyContext.address}\nListed Price: $${ctx.propertyContext.price.toLocaleString()}\nFocus your guidance on this property. Help them understand what inputs are needed to evaluate readiness at this price point.`;
    }

    return noAppContext;
  }

  const lines: string[] = [];

  if (ctx.documentExtractedData && ctx.documentExtractedData.length > 0) {
    lines.push("\n\n=== TIER 1: DOCUMENT-VERIFIED DATA (HIGHEST TRUST) ===");
    lines.push("This data was extracted directly from official documents (tax returns, pay stubs, bank statements). Treat this as the most authoritative and reliable source. This overrides EVERYTHING else — application data AND chat input.");

    const taxReturns = ctx.documentExtractedData.filter(d => d.documentType === "tax_return" || d.documentType === "tax_returns");
    const payStubs = ctx.documentExtractedData.filter(d => d.documentType === "pay_stub" || d.documentType === "pay_stubs");
    const bankStatements = ctx.documentExtractedData.filter(d => d.documentType === "bank_statement" || d.documentType === "bank_statements");

    if (taxReturns.length > 0) {
      lines.push("\nTax Return Data (official IRS filings — HIGHEST quality):");
      for (const tr of taxReturns) {
        const parts = [];
        if (tr.documentYear) parts.push(`Year: ${tr.documentYear}`);
        if (tr.grossIncome) parts.push(`Gross Income: $${tr.grossIncome.toLocaleString()}`);
        if (tr.adjustedGrossIncome) parts.push(`AGI: $${tr.adjustedGrossIncome.toLocaleString()}`);
        if (tr.taxableIncome) parts.push(`Taxable Income: $${tr.taxableIncome.toLocaleString()}`);
        if (tr.filingStatus) parts.push(`Filing Status: ${tr.filingStatus}`);
        parts.push(`Extraction Confidence: ${tr.confidence}`);
        lines.push(`  - ${parts.join(" | ")}`);
      }
    }

    if (payStubs.length > 0) {
      lines.push("\nPay Stub Data (employer-issued — HIGH quality):");
      for (const ps of payStubs) {
        const parts = [];
        if (ps.employerName) parts.push(`Employer: ${ps.employerName}`);
        if (ps.grossPay) parts.push(`Gross Pay: $${ps.grossPay.toLocaleString()}`);
        if (ps.netPay) parts.push(`Net Pay: $${ps.netPay.toLocaleString()}`);
        if (ps.ytdGross) parts.push(`YTD Gross: $${ps.ytdGross.toLocaleString()}`);
        parts.push(`Extraction Confidence: ${ps.confidence}`);
        lines.push(`  - ${parts.join(" | ")}`);
      }
    }

    if (bankStatements.length > 0) {
      lines.push("\nBank Statement Data (financial institution — HIGH quality):");
      for (const bs of bankStatements) {
        const parts = [];
        if (bs.accountType) parts.push(`Account: ${bs.accountType}`);
        if (bs.closingBalance) parts.push(`Balance: $${bs.closingBalance.toLocaleString()}`);
        if (bs.totalDeposits) parts.push(`Total Deposits: $${bs.totalDeposits.toLocaleString()}`);
        parts.push(`Extraction Confidence: ${bs.confidence}`);
        lines.push(`  - ${parts.join(" | ")}`);
      }
    }
  }

  lines.push("\n\n=== TIER 2: APPLICATION DATA (MEDIUM TRUST) ===");
  lines.push("This data comes from the user's loan application form. It is self-reported but formally submitted. Use it when no document-verified data is available for a given field.");
  lines.push(`Application Status: ${ctx.applicationStatus}`);

  if (ctx.userName) lines.push(`Borrower Name: ${ctx.userName}`);
  if (ctx.annualIncome) lines.push(`Annual Income: $${parseFloat(ctx.annualIncome).toLocaleString()}`);
  if (ctx.monthlyDebts) lines.push(`Monthly Debts: $${parseFloat(ctx.monthlyDebts).toLocaleString()}`);
  if (ctx.creditScore) lines.push(`Credit Score: ${ctx.creditScore}`);
  if (ctx.employmentType) lines.push(`Employment Type: ${ctx.employmentType}`);
  if (ctx.employmentYears) lines.push(`Years Employed: ${ctx.employmentYears}`);
  if (ctx.employerName) lines.push(`Employer: ${ctx.employerName}`);
  if (ctx.isVeteran) lines.push(`Veteran Status: Yes (VA loan eligible)`);
  if (ctx.isFirstTimeBuyer) lines.push(`First-Time Buyer: Yes`);
  if (ctx.dtiRatio) lines.push(`DTI Ratio: ${ctx.dtiRatio}%`);
  if (ctx.ltvRatio) lines.push(`LTV Ratio: ${ctx.ltvRatio}%`);
  if (ctx.preApprovalAmount) lines.push(`Pre-Approval Amount: $${parseFloat(ctx.preApprovalAmount).toLocaleString()}`);
  if (ctx.purchasePrice) lines.push(`Target Purchase Price: $${parseFloat(ctx.purchasePrice).toLocaleString()}`);
  if (ctx.downPayment) lines.push(`Down Payment: $${parseFloat(ctx.downPayment).toLocaleString()}`);
  if (ctx.preferredLoanType) lines.push(`Preferred Loan Type: ${ctx.preferredLoanType}`);
  if (ctx.propertyType) lines.push(`Property Type: ${ctx.propertyType}`);
  if (ctx.loanPurpose) lines.push(`Loan Purpose: ${ctx.loanPurpose}`);

  if (ctx.employmentHistory && ctx.employmentHistory.length > 0) {
    lines.push("\nEmployment History:");
    for (const emp of ctx.employmentHistory) {
      const parts = [];
      if (emp.employerName) parts.push(emp.employerName);
      if (emp.positionTitle) parts.push(emp.positionTitle);
      if (emp.isSelfEmployed) parts.push("(Self-Employed)");
      if (emp.startDate) parts.push(`since ${emp.startDate}`);
      if (emp.totalMonthlyIncome) parts.push(`$${parseFloat(emp.totalMonthlyIncome).toLocaleString()}/month`);
      lines.push(`  - ${parts.join(" | ")}`);
    }
  }

  if (ctx.uploadedDocuments && ctx.uploadedDocuments.length > 0) {
    lines.push("\nDocuments Already Uploaded:");
    for (const doc of ctx.uploadedDocuments) {
      lines.push(`  - ${doc.documentType}: ${doc.status}`);
    }
    lines.push("\nWhen recommending documents, acknowledge which ones the user has already provided and focus on what's still missing.");
  }

  lines.push("\n\n=== TIER 3: CHAT INPUT (LOWEST TRUST — TREAT WITH CAUTION) ===");
  lines.push("Anything the user says in this conversation is SELF-REPORTED and UNVERIFIED. It is the LEAST reliable data source.");
  lines.push("RULES FOR HANDLING CHAT INPUT:");
  lines.push("- NEVER treat chat-reported numbers as fact. Always qualify with 'based on what you've shared' or 'according to your estimate'.");
  lines.push("- If chat input CONFLICTS with document-verified data (Tier 1), ALWAYS trust the documents. Politely inform the user of the discrepancy and ask them to explain or update their documents.");
  lines.push("- If chat input CONFLICTS with application data (Tier 2), note the discrepancy and suggest they update their application if their situation has changed.");
  lines.push("- When capturing intake data from chat, mark it as approximate in your assessment. Encourage the user to upload supporting documents to verify.");
  lines.push("- For income: tax returns are the gold standard, pay stubs are strong evidence, chat claims are just estimates.");
  lines.push("- For assets/savings: bank statements are the gold standard, chat claims should be verified with statements.");

  if (ctx.readinessScore !== undefined && ctx.readinessScore !== null) {
    lines.push("\n\n=== READINESS CONTEXT (from Borrower Graph) ===");
    lines.push(`Current Readiness Score: ${ctx.readinessScore}/100`);
    if (ctx.readinessTier) lines.push(`Readiness Tier: ${ctx.readinessTier}`);
    if (ctx.readinessStrengths && ctx.readinessStrengths.length > 0) {
      lines.push(`Strengths: ${ctx.readinessStrengths.join(", ")}`);
    }
    if (ctx.readinessGaps && ctx.readinessGaps.length > 0) {
      lines.push(`Gaps to Address: ${ctx.readinessGaps.join(", ")}`);
    }
    if (ctx.documentsMissing && ctx.documentsMissing.length > 0) {
      lines.push(`Missing Documents: ${ctx.documentsMissing.join(", ")}`);
    }
    if (ctx.documentsUploaded !== undefined) {
      lines.push(`Documents Uploaded: ${ctx.documentsUploaded}${ctx.documentsVerified !== undefined ? ` (${ctx.documentsVerified} verified)` : ""}`);
    }
    lines.push("Use this readiness data to inform your next-required-input recommendation. Reference the user's current score when explaining progress.");
  }

  if (ctx.daysSinceLastActivity !== undefined && ctx.daysSinceLastActivity !== null) {
    lines.push("\n\n=== BEHAVIORAL CONTEXT ===");
    lines.push(`Days Since Last Activity: ${ctx.daysSinceLastActivity}`);
    if (ctx.engagementLevel) lines.push(`Engagement Level: ${ctx.engagementLevel}`);
    if (ctx.propertiesViewed !== undefined) lines.push(`Properties Viewed: ${ctx.propertiesViewed}`);
    if (ctx.suggestedNextAction) lines.push(`System-Suggested Next Action: ${ctx.suggestedNextAction}`);
    if (ctx.daysSinceLastActivity > 7) {
      lines.push("NOTE: This user has been inactive for over a week. Use the behavioral nudge approach: identify the smallest possible next step, frame it as progress not obligation, and reinforce momentum already achieved. Avoid urgency or fear-based language.");
    }
  }

  if (ctx.hasMultipleIncomes || ctx.hasBusinessIncome || ctx.hasInvestmentProperties) {
    lines.push("\n\n=== COMPLEX BORROWER FLAG ===");
    if (ctx.hasMultipleIncomes) lines.push("- User has MULTIPLE income sources");
    if (ctx.hasBusinessIncome) lines.push("- User has BUSINESS income (self-employed or business owner)");
    if (ctx.hasInvestmentProperties) lines.push("- User has INVESTMENT properties");
    lines.push("ACTIVATE AFFLUENT/COMPLEX BORROWER MODE: Shift tone to professional and efficient. Emphasize organization, speed, and clarity. Offer to structure documents into lender-friendly categories. Reduce basic explanations, increase precision.");
  }

  if (ctx.propertyContext) {
    lines.push("\n\n=== PROPERTY CONTEXT ===");
    lines.push(`The user is asking about a specific property: ${ctx.propertyContext.address}`);
    lines.push(`Listed Price: $${ctx.propertyContext.price.toLocaleString()}`);
    lines.push("Focus your guidance on this property. Assess whether the user's financial profile supports this purchase price and what inputs are still needed for underwriting readiness at this price point.");
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are the Homiquity AI Intake and Readiness Assistant.

=== 1. IDENTITY & PRIMARY OBJECTIVE ===
You are a compliance-safe intake, validation, and packaging engine that helps users prepare clean, complete, verified data for underwriting systems.

Your role is to:
- Collect borrower information required by underwriting systems
- Validate completeness and document quality
- Identify missing or inconsistent inputs
- Explain underwriting requirements in plain language
- Prepare structured, lender-ready borrower packages

You do NOT:
- Make credit decisions
- Predict approvals or rates
- Recommend loan products
- Provide financial advice

All guidance must be framed as preparation for underwriting review.
Your tone must be calm, neutral, and supportive.
Your goal is to reduce friction and improve data quality.

You must:
- Be proactive, not reactive. Drive the conversation forward.
- Identify the SINGLE next required input for underwriting readiness at all times. Never present multiple options.
- Reduce user stress and cognitive load. Keep it simple and clear.
- Explain why each input is required by underwriting systems in simple language.
- Avoid hype, pressure, or guarantees.
- Use plain language. Avoid jargon. Explain terms when you must use them.
- Reference real mortgage industry input requirements (Fannie Mae, FHA, VA, USDA guidelines).
- Be specific about what is needed and estimated effort.

Every interaction should move the user closer to:
- A complete borrower profile with all required inputs
- A verified, lender-ready document package
- A clean handoff to underwriting review

=== 2. DATA QUALITY HIERARCHY (CRITICAL — follow strictly) ===
You receive data from three sources, ranked by reliability:

TIER 1 — DOCUMENT-VERIFIED DATA (HIGHEST TRUST):
Data extracted from uploaded official documents: tax returns, pay stubs, W-2s, bank statements.
Machine-read from real documents — closest to ground truth.
Tax returns are the GOLD STANDARD for income verification (IRS filings).
Pay stubs verify current employment and income. Bank statements verify assets and cash flow.
ALWAYS prefer Tier 1 data over anything else. If Tier 1 data is available for a field, use it.

TIER 2 — APPLICATION DATA (MEDIUM TRUST):
Data from the user's formally submitted loan application. Self-reported but formally submitted.
Use when no Tier 1 document data covers that field. Prefer over chat input.

TIER 3 — CHAT INPUT (LOWEST TRUST — TREAT WITH CAUTION):
Anything the user says in conversation is UNVERIFIED. People may misremember, round numbers, or be optimistic.
NEVER treat chat-stated income, assets, or debts as confirmed fact.
When using chat-provided numbers, always qualify: "Based on what you've shared..." or "Your estimate of..."
Always encourage the user to upload documents to verify what they say.
If chat input contradicts Tier 1 or Tier 2 data, ALWAYS trust the higher tier and politely note the discrepancy.

CONFLICT RESOLUTION:
- User says "I make $120K" but tax return shows $95K AGI → trust the tax return. Say: "Your tax return shows an adjusted gross income of $95,000. Lenders will use this figure. If your income has changed recently, your next tax return or current pay stubs would reflect that."
- User says "I have $50K saved" but bank statements show $30K → trust the bank statement. Suggest they may have other accounts and ask them to upload those.
- Application says $80K but tax return says $85K → trust the tax return and note the minor difference.
- NEVER silently accept chat-reported data when document data is available for the same field.

=== 3. NEXT REQUIRED INPUT ENGINE ===
Based on the user's current context, ALWAYS identify the SINGLE next required input for underwriting readiness.

Present it as:
- A clear, decisive recommendation of what to provide next
- One sentence explaining why underwriting systems require this input
- An estimate of time or effort required
- A calm, supportive tone

Frame everything as: "This information is required by underwriting systems to evaluate readiness."
Do NOT present multiple options. Do NOT ask open-ended questions. Guide decisively.

Example: "Uploading your most recent pay stub will move your profile from 40% to 55% ready. Underwriting systems need this to verify your current income. This usually takes about 2 minutes."

Never repeat steps already completed. Never overwhelm the user with multiple inputs.

=== 4. DOCUMENT VALIDATION & COACHING ===
When a document is requested, discussed, or uploaded:
- Explain what the document is in plain language
- Why underwriting systems require it (not "why lenders want it")
- What qualifies as acceptable (recency, completeness, legibility, format)
- Common mistakes to avoid
- If issues are found with uploaded documents: describe the issue, explain the underwriting requirement, and suggest corrective action

Assume the user is not familiar with lending terminology.

DOCUMENT REQUIREMENTS BY SITUATION:
W-2 Employee: Pay stubs (30 days), W-2s (2 years), tax returns (2 years), bank statements (2 months)
Self-Employed: Tax returns (2 years), profit/loss statements, 1099s, business bank statements, business license
Veteran: DD-214, Certificate of Eligibility (COE)
First-Time Buyer: Homebuyer education certificate (recommended)
All: Government ID, Social Security card, proof of residence, gift letters (if receiving gift funds)
Additional: Divorce decree, child support docs, rental history, explanation letters for credit issues

=== 5. BORROWER PACKAGE BUILDER ===
When a user reaches lender-ready status (readiness tier "ready_now"), generate a lender-ready borrower intake summary including:
- Household overview
- Declared income sources (citing verification tier used)
- Asset categories
- Credit and debt signals (if available)
- Property intent
- Readiness score and status
- Document inventory and completeness status

This summary is informational and does NOT imply approval. Format as a clean, professional summary suitable for underwriting review. Do not include speculation or guarantees.

=== 6. BEHAVIORAL NUDGE ENGINE ===
If the user stalls, goes quiet, or seems disengaged:
- Identify the smallest possible next step
- Frame it as progress, not obligation
- Reinforce momentum already achieved
- Be encouraging without being pushy

Avoid urgency language. Avoid fear-based messaging.
Example: "You've already completed 3 of 5 steps. Uploading your bank statement would bring you to 80% — and it only takes a minute."

=== 7. AFFLUENT / COMPLEX BORROWER MODE ===
If the user has multiple income sources, businesses, investment properties, or complex financial situations:
- Shift tone to professional and efficient
- Emphasize organization, speed, and clarity
- Offer to structure documents into lender-friendly categories
- Reduce explanations, increase precision
- Acknowledge their sophistication without being presumptuous

=== 8. UNDERWRITING REVIEW HANDOFF ===
When the user reaches lender-ready status:
- Explain what information will be included in the borrower package for underwriting review
- Explain what will NOT be shared
- Ask for explicit permission before submitting any package
- Confirm all required inputs are present before proceeding
- Position this as a benefit: "Your information is organized and ready for underwriting review"
- Never frame the handoff as a sale or pitch

=== UNDERWRITING READINESS STATES ===
Track and communicate the user's current state:
- "exploring": Intake not started. User is learning about the process. Major inputs missing. 12+ months estimated timeline.
- "building": Intake started. Significant inputs still needed. Credit under 640, high DTI, insufficient savings, or employment gaps. 3-12 month timeline.
- "almost_ready": Intake nearly complete. Close on most criteria, 1-3 months of focused action needed. Minor gaps like small savings shortfall or credit 640-679.
- "ready_now": Intake complete. Documents verified. Package ready for underwriting review. DTI < 43%, credit 680+, stable employment 2+ years, adequate savings.

Use these states as "readinessTier" values. Never say "approved" or "eligible" — say "ready for underwriting review" or "all required inputs are present."

=== STRUCTURED OUTPUT FORMAT ===
When responding, always provide your answer as conversational text first. When you have enough information to assess the user's situation (either from verified data or from conversation), include structured data in a JSON block at the end of your message wrapped in <coach_data> tags.

The JSON should follow this format:
<coach_data>
{
  "profile": {
    "readinessTier": "almost_ready",
    "readinessScore": 72,
    "summary": "Brief assessment summary",
    "strengths": ["list of financial strengths"],
    "gaps": ["list of areas to improve"],
    "recommendedLoanTypes": ["conventional", "fha"],
    "estimatedTimeline": "2-3 months"
  },
  "intake": {
    "annualIncome": "85000",
    "monthlyDebts": "1200",
    "creditScore": "720",
    "employmentType": "employed",
    "employmentYears": "5",
    "downPayment": "50000",
    "purchasePrice": "350000",
    "propertyType": "single_family",
    "loanPurpose": "purchase",
    "isVeteran": false,
    "isFirstTimeBuyer": true
  },
  "actionPlan": [
    {
      "id": "action-1",
      "phase": 1,
      "title": "Action title",
      "description": "Detailed action description",
      "priority": "high",
      "category": "credit",
      "completed": false
    }
  ],
  "documentChecklist": [
    {
      "docType": "pay_stub",
      "label": "Recent Pay Stubs (Last 30 Days)",
      "reason": "Verify current income and employment",
      "priority": "required",
      "category": "Income"
    }
  ],
  "nextBestAction": {
    "action": "Upload your most recent pay stub",
    "reason": "This will verify your current income and move your readiness from 40% to 55%",
    "estimatedTime": "2 minutes",
    "category": "documents"
  },
  "borrowerPackage": null
}
</coach_data>

The "intake" object captures financial details for pre-filling the loan application. Populate intake fields using the DATA QUALITY HIERARCHY:
- PREFER document-verified data (Tier 1) when available — e.g., use AGI from tax returns for annualIncome, gross pay from pay stubs, balances from bank statements.
- Fall back to application data (Tier 2) if no documents cover that field.
- Use chat-reported data (Tier 3) ONLY as a last resort when no Tier 1 or Tier 2 data exists for that field.
ALWAYS include an "intake" object whenever you have gathered any concrete financial data. Only include fields where you have specific numbers or values — do not guess.
Field types:
- annualIncome: string (numeric, no commas)
- monthlyDebts: string (numeric, no commas)
- creditScore: string (use the midpoint of their stated range, e.g. "720" for "Very Good 720-759")
- employmentType: "employed" | "self_employed" | "retired" | "other"
- employmentYears: string (numeric)
- downPayment: string (numeric, no commas)
- purchasePrice: string (numeric, no commas)
- propertyType: "single_family" | "condo" | "townhouse" | "multi_family"
- loanPurpose: "purchase" | "refinance" | "cash_out"
- isVeteran: boolean
- isFirstTimeBuyer: boolean

The "nextBestAction" object should ALWAYS be included. It is the single next required input for underwriting readiness. Include "action" (what to provide), "reason" (why underwriting systems require it), "estimatedTime" (how long), and "category" (documents/credit/savings/income/debt/education).

The "borrowerPackage" should be null unless the user is "ready_now". When ready, generate a clean JSON summary with: householdOverview, incomeSources (with verification tier), assetCategories, creditAndDebt, propertyIntent, readinessScore, documentInventory. This summary is informational and does not imply approval.

IMPORTANT: If you already have verified application data with enough detail (income, credit score, employment, debts), generate the structured assessment immediately in your FIRST response — don't wait to ask questions you already have answers to. Only ask follow-up questions about inputs you're genuinely missing.

If you're still gathering information and don't have enough for an assessment, respond conversationally with a single next-required-input recommendation, without the full data block.

When no verified data is available, warmly greet the user and immediately recommend the single most impactful first input to provide (usually sharing their employment situation or homeownership goal). Don't present a numbered list of questions. Ask one thing at a time.`;

function buildConversationHistory(messages: Array<{ role: string; content: string }>): string {
  return messages.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
}

export async function generateCoachResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  existingProfile?: any,
  verifiedContext?: VerifiedUserContext,
): Promise<CoachResponse> {
  const contextNote = existingProfile
    ? `\n\nExisting financial profile from previous assessment:\n${JSON.stringify(existingProfile, null, 2)}\n\nUse this as context but update if the user provides new information.`
    : "";

  const verifiedNote = verifiedContext ? buildVerifiedContextPrompt(verifiedContext) : "";

  const systemContent = `${SYSTEM_PROMPT}${verifiedNote}${contextNote}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemContent },
  ];

  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  messages.push({ role: "user", content: userMessage });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages,
      max_completion_tokens: 16384,
    });

    const text = response.choices[0]?.message?.content || "";
    return parseCoachResponse(text);
  } catch (error) {
    console.error("[Coach] OpenAI API error:", error);
    return generateFallbackResponse(userMessage, conversationHistory, verifiedContext);
  }
}

function parseCoachResponse(text: string): CoachResponse {
  const dataMatch = text.match(/<coach_data>\s*([\s\S]*?)\s*<\/coach_data>/);
  let message = text.replace(/<coach_data>[\s\S]*?<\/coach_data>/g, "").trim();

  const result: CoachResponse = { message };

  if (dataMatch) {
    try {
      const data = JSON.parse(dataMatch[1]);
      if (data.profile) result.profile = data.profile;
      if (data.intake) result.intake = data.intake;
      if (data.actionPlan) result.actionPlan = data.actionPlan;
      if (data.documentChecklist) result.documentChecklist = data.documentChecklist;
    } catch (e) {
      console.error("[Coach] Failed to parse structured data:", e);
    }
  }

  return result;
}

function generateFallbackResponse(
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  verifiedContext?: VerifiedUserContext,
): CoachResponse {
  const isFirstMessage = history.length <= 1;

  if (isFirstMessage && verifiedContext?.hasApplication) {
    const app = verifiedContext;
    const parts: string[] = [];
    parts.push(`Welcome back! I have your application information on file and can see where things stand.`);

    if (app.annualIncome || app.creditScore || app.employmentType) {
      parts.push("\nHere's what's already verified in your profile:");
      if (app.annualIncome) parts.push(`- **Annual Income:** $${parseFloat(app.annualIncome).toLocaleString()}`);
      if (app.creditScore) parts.push(`- **Credit Score:** ${app.creditScore}`);
      if (app.employmentType) parts.push(`- **Employment:** ${app.employmentType === "self_employed" ? "Self-Employed" : app.employmentType.charAt(0).toUpperCase() + app.employmentType.slice(1)}`);
      if (app.monthlyDebts) parts.push(`- **Monthly Debts:** $${parseFloat(app.monthlyDebts).toLocaleString()}`);
      if (app.isVeteran) parts.push(`- **Veteran:** Yes`);
    }

    if (app.readinessScore !== undefined && app.readinessScore !== null) {
      parts.push(`\nYour current readiness score is **${app.readinessScore}/100**.`);
    }

    const missingInputs: string[] = [];
    if (!app.creditScore) missingInputs.push("credit score range");
    if (!app.annualIncome) missingInputs.push("income verification");
    if (!app.monthlyDebts) missingInputs.push("monthly debt summary");

    if (missingInputs.length > 0) {
      parts.push(`\nThe next input needed for underwriting readiness is your **${missingInputs[0]}**. This is required by underwriting systems to evaluate your profile. It should only take a couple of minutes.`);
    } else if (app.documentsMissing && app.documentsMissing.length > 0) {
      parts.push(`\nYour financial details look good. The next step is uploading your **${app.documentsMissing[0]}**. Underwriting systems require this document to verify your information.`);
    } else {
      parts.push("\nYour profile inputs are complete. The next required step is to **submit your application for underwriting review**. Would you like to proceed?");
    }

    return { message: parts.join("\n") };
  }

  if (isFirstMessage) {
    const hasPropertyContext = verifiedContext?.propertyContext;
    if (hasPropertyContext) {
      return {
        message: `Welcome! I see you're looking at a property listed at **$${verifiedContext.propertyContext!.price.toLocaleString()}** at ${verifiedContext.propertyContext!.address}.

I'll help you organize your financial information so you can see where you stand for this home. The first input underwriting systems need is your **employment type**. What kind of work do you do?`,
      };
    }

    return {
      message: `Welcome! I'm your Homiquity readiness assistant. I'll help you organize your information and prepare everything needed for underwriting review — step by step, at your own pace.

The first input I need is your **employment type**. What kind of work do you do? This determines which documents underwriting systems will require.`,
    };
  }

  const lowerMsg = userMessage.toLowerCase();

  if (lowerMsg.includes("credit") || lowerMsg.includes("score")) {
    return {
      message: `Credit score is one of the key inputs underwriting systems use to evaluate your profile. To move your readiness forward, I need your **approximate credit score range**. Even a rough estimate works — we can verify with a credit pull later.`,
    };
  }

  if (lowerMsg.includes("document") || lowerMsg.includes("paperwork") || lowerMsg.includes("what do i need")) {
    const docResponse = buildDocumentResponse(verifiedContext);
    return { message: docResponse };
  }

  if (verifiedContext?.daysSinceLastActivity && verifiedContext.daysSinceLastActivity > 7) {
    const score = verifiedContext.readinessScore || 0;
    return {
      message: `Good to see you back! You've already made progress — your readiness score is at **${score}/100**. Let's keep that momentum going.

The smallest next step to move forward: **share your approximate monthly debts** (car payments, student loans, credit cards, etc.). Underwriting systems need this to calculate your debt-to-income ratio. It should only take a minute.`,
    };
  }

  return {
    message: `Thanks for sharing that. To continue building your underwriting readiness profile, the next input I need is your **approximate monthly debts** — things like car payments, student loans, or credit card minimums.

Underwriting systems use this alongside your income to calculate your debt-to-income ratio, which is one of the key metrics for readiness. Just a rough estimate is fine for now — we can verify with documents later.`,
  };
}

function buildDocumentResponse(ctx?: VerifiedUserContext): string {
  const parts: string[] = [];

  if (ctx?.hasApplication && ctx.employmentType) {
    parts.push("Based on your profile, here are the documents underwriting systems require to verify your information:\n");

    parts.push("**Required for all borrowers:**");
    parts.push("- Government-issued photo ID");
    parts.push("- Social Security card");
    parts.push("- Bank statements (last 2 months, all pages)\n");

    if (ctx.employmentType === "self_employed") {
      parts.push("**Required for self-employed borrowers (your situation):**");
      parts.push("- Federal tax returns (last 2 years, personal AND business)");
      parts.push("- Profit & loss statements (year-to-date)");
      parts.push("- 1099 forms");
      parts.push("- Business bank statements (last 2 months)");
      parts.push("- Business license\n");
    } else {
      parts.push("**Required for W-2 employees (your situation):**");
      parts.push("- Recent pay stubs (last 30 days)");
      parts.push("- W-2 forms (last 2 years)");
      parts.push("- Federal tax returns (last 2 years)\n");
    }

    if (ctx.isVeteran) {
      parts.push("**Required for VA program evaluation:**");
      parts.push("- DD-214 (Certificate of Release or Discharge)");
      parts.push("- Certificate of Eligibility (COE)\n");
    }

    if (ctx.isFirstTimeBuyer) {
      parts.push("**Recommended for first-time buyers:**");
      parts.push("- Homebuyer education certificate\n");
    }

    if (ctx.uploadedDocuments && ctx.uploadedDocuments.length > 0) {
      const uploaded = ctx.uploadedDocuments.filter(d => d.status === "verified" || d.status === "uploaded");
      if (uploaded.length > 0) {
        parts.push(`You've already uploaded ${uploaded.length} document(s). Let me identify what's still needed so we can move your readiness forward.`);
      }
    }

    if (ctx.documentsMissing && ctx.documentsMissing.length > 0) {
      parts.push(`\nThe next document to upload: **${ctx.documentsMissing[0]}**. This is required before underwriting review can proceed.`);
    }
  } else {
    parts.push("Great that you're thinking ahead about documents! The specific documents needed depend on your situation, but here are the standard inputs required by underwriting systems:\n");
    parts.push("**Required for all borrowers:**");
    parts.push("- Government-issued photo ID");
    parts.push("- Social Security card");
    parts.push("- Bank statements (last 2 months, all pages)\n");
    parts.push("**For W-2 employees:**");
    parts.push("- Recent pay stubs (last 30 days)");
    parts.push("- W-2 forms (last 2 years)");
    parts.push("- Federal tax returns (last 2 years)\n");
    parts.push("**For self-employed borrowers:**");
    parts.push("- Federal tax returns (last 2 years, personal AND business)");
    parts.push("- Profit & loss statements");
    parts.push("- Business license\n");
    parts.push("**Additional (if applicable):**");
    parts.push("- VA borrowers: DD-214 and Certificate of Eligibility");
    parts.push("- Gift funds: Gift letter from the donor");
    parts.push("- Divorce: Divorce decree and settlement agreement\n");
    parts.push("Tell me about your employment situation and I'll build a precise checklist of exactly what underwriting systems will need from you.");
  }

  return parts.join("\n");
}
