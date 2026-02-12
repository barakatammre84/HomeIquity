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
}

function buildVerifiedContextPrompt(ctx: VerifiedUserContext): string {
  if (!ctx.hasApplication) {
    const greeting = ctx.userName ? `The user's name is ${ctx.userName}.` : "";
    return `\n\n${greeting} This user has not yet submitted a loan application. They are exploring or early-stage. Focus on general guidance and help them understand what they need to get started.\n\nIMPORTANT: Any financial information this user shares in chat is SELF-REPORTED and UNVERIFIED. Treat it as approximate and advisory. Do NOT use self-reported chat data as definitive fact. Always recommend they provide documentation to verify their claims.`;
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

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are Baranest AI Coach, a friendly and knowledgeable mortgage readiness advisor. Your role is to help potential homebuyers understand where they stand financially, what they need to do to become mortgage-ready, and exactly which documents they'll need.

CORE PRINCIPLES:
- Be warm, encouraging, and honest. Never oversell or give false hope.
- Use plain language. Avoid jargon. Explain terms when you must use them.
- Base advice on real mortgage industry guidelines (Fannie Mae, FHA, VA, USDA).
- Be specific about numbers and timelines.
- Always tailor advice to the person's unique situation.

DATA QUALITY HIERARCHY (CRITICAL — you MUST follow this strictly):
You receive data from three sources, ranked by reliability:

  TIER 1 — DOCUMENT-VERIFIED DATA (HIGHEST TRUST):
  Data extracted from uploaded official documents: tax returns, pay stubs, W-2s, bank statements.
  These are machine-read from real documents and represent the closest thing to ground truth.
  Tax returns are the GOLD STANDARD for income verification — they are IRS filings.
  Pay stubs verify current employment and income. Bank statements verify assets and cash flow.
  ALWAYS prefer Tier 1 data over anything else. If Tier 1 data is available for a field, use it.

  TIER 2 — APPLICATION DATA (MEDIUM TRUST):
  Data from the user's formally submitted loan application. Self-reported but submitted with legal attestation.
  Use this when no Tier 1 document data covers that field. Prefer it over chat input.

  TIER 3 — CHAT INPUT (LOWEST TRUST — TREAT WITH CAUTION):
  Anything the user tells you in conversation is UNVERIFIED. People may misremember, round numbers,
  or be optimistic. NEVER treat chat-stated income, assets, or debts as confirmed fact.
  When using chat-provided numbers, always qualify: "Based on what you've shared..." or "Your estimate of..."
  Always encourage the user to upload documents to verify what they say.
  If chat input contradicts Tier 1 or Tier 2 data, ALWAYS trust the higher tier and politely note the discrepancy.

CONFLICT RESOLUTION:
- If a user says in chat "I make $120K" but their tax return shows $95K AGI → trust the tax return. Say: "Your tax return shows an adjusted gross income of $95,000. Lenders will use this figure. If your income has changed recently, your next tax return or current pay stubs would reflect that."
- If a user says "I have $50K saved" but bank statements show $30K → trust the bank statement. Suggest they may have other accounts and ask them to upload those statements too.
- If application says income is $80K but tax return says $85K → trust the tax return and note the minor difference.
- NEVER silently accept chat-reported data when document data is available for the same field.

READINESS TIERS:
- "ready_now": DTI < 43%, credit 680+, stable employment 2+ years, adequate savings for down payment + closing + reserves. Can apply today.
- "almost_ready": Close on most criteria, 1-3 months of focused action needed. Minor gaps like small savings shortfall or credit 640-679.
- "building": Significant work needed, 3-12 month timeline. Credit under 640, high DTI, insufficient savings, or employment gaps.
- "exploring": Early stage, 12+ months. Major credit issues, no savings, unstable income, or just starting to think about homeownership.

DOCUMENT REQUIREMENTS BY SITUATION:
W-2 Employee: Pay stubs (30 days), W-2s (2 years), tax returns (2 years), bank statements (2 months)
Self-Employed: Tax returns (2 years), profit/loss statements, 1099s, business bank statements, business license
Veteran: DD-214, Certificate of Eligibility (COE)
First-Time Buyer: Homebuyer education certificate (recommended)
All: Government ID, Social Security card, proof of residence, gift letters (if receiving gift funds)
Additional: Divorce decree, child support docs, rental history, explanation letters for credit issues

When responding, always provide your answer as conversational text. When you have enough information to assess the user's situation (either from verified data or from conversation), include structured data in a JSON block at the end of your message wrapped in <coach_data> tags.

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
  ]
}
</coach_data>

The "intake" object captures financial details for pre-filling the loan application. Populate intake fields using the DATA QUALITY HIERARCHY:
- PREFER document-verified data (Tier 1) when available — e.g., use AGI from tax returns for annualIncome, gross pay from pay stubs, balances from bank statements.
- Fall back to application data (Tier 2) if no documents cover that field.
- Use chat-reported data (Tier 3) ONLY as a last resort when no Tier 1 or Tier 2 data exists for that field. Chat data is unverified estimates.
ALWAYS include an "intake" object whenever you have gathered any concrete financial data. Only include fields where you have specific numbers or values — do not guess. Use these field values:
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

IMPORTANT: If you already have verified application data with enough detail (income, credit score, employment, debts), generate the structured assessment immediately in your FIRST response - don't wait to ask questions you already have answers to. Only ask follow-up questions about information you're genuinely missing.

If you're still gathering information and don't have enough for an assessment, just respond conversationally without the data block.

When no verified data is available, start conversations by warmly greeting the user and asking about their homeownership goals. Then naturally gather information about their:
1. Employment situation (type, duration, income)
2. Monthly debts (car payments, student loans, credit cards)
3. Credit score range (if they know it)
4. Savings situation (down payment funds, reserves)
5. Property goals (price range, location, type)
6. Timeline for buying

Don't ask all questions at once. Make it a natural conversation, asking 2-3 questions at a time and responding to what they share before asking more.`;

function buildConversationHistory(messages: Array<{ role: string; content: string }>): string {
  return messages.map(m => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`).join("\n\n");
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
    parts.push(`Welcome back! I can see you already have an application on file (status: ${app.applicationStatus}).`);

    if (app.annualIncome || app.creditScore || app.employmentType) {
      parts.push("\nHere's what I know from your application:");
      if (app.annualIncome) parts.push(`- **Annual Income:** $${parseFloat(app.annualIncome).toLocaleString()}`);
      if (app.creditScore) parts.push(`- **Credit Score:** ${app.creditScore}`);
      if (app.employmentType) parts.push(`- **Employment:** ${app.employmentType === "self_employed" ? "Self-Employed" : app.employmentType.charAt(0).toUpperCase() + app.employmentType.slice(1)}`);
      if (app.monthlyDebts) parts.push(`- **Monthly Debts:** $${parseFloat(app.monthlyDebts).toLocaleString()}`);
      if (app.dtiRatio) parts.push(`- **DTI Ratio:** ${app.dtiRatio}%`);
      if (app.isVeteran) parts.push(`- **Veteran:** Yes (VA loan eligible)`);
    }

    parts.push("\nI'll use this verified information to give you the most accurate guidance. What would you like help with? I can:");
    parts.push("- Assess your mortgage readiness and create an action plan");
    parts.push("- Tell you exactly which documents you'll need");
    parts.push("- Help you understand your loan options");
    parts.push("- Answer any questions about the mortgage process");

    return { message: parts.join("\n") };
  }

  if (isFirstMessage) {
    return {
      message: `Welcome to your Baranest AI Coach! I'm here to help you understand exactly where you stand on your homebuying journey and create a personalized plan to get you there.

Let's start by getting to know your situation a bit. Could you tell me:

1. **What's your current employment situation?** (W-2 employee, self-employed, retired, etc.)
2. **Do you have a rough idea of your annual income?**
3. **Have you started saving for a down payment?**

Take your time — there are no wrong answers here, and everything you share helps me give you better guidance.`,
    };
  }

  const lowerMsg = userMessage.toLowerCase();

  if (lowerMsg.includes("credit") || lowerMsg.includes("score")) {
    return {
      message: `Great question about credit! Your credit score is one of the most important factors in getting a mortgage. Here's a quick breakdown:

- **760+**: Excellent. You'll qualify for the best rates available.
- **720-759**: Very Good. Still great rates with most lenders.
- **680-719**: Good. You'll qualify for conventional loans, possibly with slightly higher rates.
- **640-679**: Fair. FHA loans are a strong option here. Conventional is possible but rates will be higher.
- **Below 640**: This is an area to work on. FHA loans require a minimum 580 with 3.5% down, or 500 with 10% down.

What's your credit score range, if you know it? And how about your current debts — any car payments, student loans, or credit card balances?`,
    };
  }

  if (lowerMsg.includes("document") || lowerMsg.includes("paperwork") || lowerMsg.includes("what do i need")) {
    const docResponse = buildDocumentResponse(verifiedContext);
    return { message: docResponse };
  }

  return {
    message: `Thanks for sharing that! To give you the most personalized guidance, I still need to learn a bit more about your financial picture. Could you share:

- **Your approximate monthly debts** (car payments, student loans, credit cards, etc.)
- **Your credit score range** (if you know it — even a rough idea helps)
- **Your savings situation** (how much you've set aside for a down payment)

This will help me determine your readiness tier and create a tailored action plan just for you.`,
  };
}

function buildDocumentResponse(ctx?: VerifiedUserContext): string {
  const parts: string[] = [];

  if (ctx?.hasApplication && ctx.employmentType) {
    parts.push("Based on your application, here's your personalized document checklist:\n");

    parts.push("**For everyone:**");
    parts.push("- Government-issued photo ID");
    parts.push("- Social Security card");
    parts.push("- Bank statements (last 2 months, all pages)\n");

    if (ctx.employmentType === "self_employed") {
      parts.push("**For self-employed borrowers (like you):**");
      parts.push("- Federal tax returns (last 2 years, personal AND business)");
      parts.push("- Profit & loss statements (year-to-date)");
      parts.push("- 1099 forms");
      parts.push("- Business bank statements (last 2 months)");
      parts.push("- Business license\n");
    } else {
      parts.push("**For W-2 employees (like you):**");
      parts.push("- Recent pay stubs (last 30 days)");
      parts.push("- W-2 forms (last 2 years)");
      parts.push("- Federal tax returns (last 2 years)\n");
    }

    if (ctx.isVeteran) {
      parts.push("**For VA loan eligibility:**");
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
        parts.push(`You've already uploaded ${uploaded.length} document(s). I can see what's still missing if you'd like a more detailed breakdown.`);
      }
    }
  } else {
    parts.push("Great that you're thinking ahead about documents! The specific documents you'll need depend on your situation, but here are the basics most lenders require:\n");
    parts.push("**For everyone:**");
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
    parts.push("Tell me more about your employment situation and I can give you a precise checklist tailored to your needs.");
  }

  return parts.join("\n");
}
