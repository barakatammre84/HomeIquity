import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const genAI = apiKey ? new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) }) : null;

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

export interface CoachResponse {
  message: string;
  profile?: CoachingProfile;
  actionPlan?: ActionPlanItem[];
  documentChecklist?: DocumentRequirement[];
}

const SYSTEM_PROMPT = `You are Baranest AI Coach, a friendly and knowledgeable mortgage readiness advisor. Your role is to help potential homebuyers understand where they stand financially, what they need to do to become mortgage-ready, and exactly which documents they'll need.

CORE PRINCIPLES:
- Be warm, encouraging, and honest. Never oversell or give false hope.
- Use plain language. Avoid jargon. Explain terms when you must use them.
- Base advice on real mortgage industry guidelines (Fannie Mae, FHA, VA, USDA).
- Be specific about numbers and timelines.
- Always tailor advice to the person's unique situation.

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

When responding, always provide your answer as conversational text. When you have enough information to assess the user's situation, also include structured data in a JSON block at the end of your message wrapped in <coach_data> tags.

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

Only include the structured data when you have gathered enough information about the user's financial situation (at minimum: income, debts, credit score range, employment situation). If you're still asking questions, just respond conversationally without the data block.

Start conversations by warmly greeting the user and asking about their homeownership goals. Then naturally gather information about their:
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
): Promise<CoachResponse> {
  if (!genAI) {
    return generateFallbackResponse(userMessage, conversationHistory);
  }

  const history = buildConversationHistory(conversationHistory);
  const contextNote = existingProfile
    ? `\n\nExisting financial profile from previous assessment:\n${JSON.stringify(existingProfile, null, 2)}\n\nUse this as context but update if the user provides new information.`
    : "";

  const prompt = `${SYSTEM_PROMPT}${contextNote}

CONVERSATION SO FAR:
${history}

User: ${userMessage}

Respond as the AI Coach:`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    return parseCoachResponse(text);
  } catch (error) {
    console.error("[Coach] Gemini API error:", error);
    return generateFallbackResponse(userMessage, conversationHistory);
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
): CoachResponse {
  const isFirstMessage = history.length <= 1;

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
    return {
      message: `Great that you're thinking ahead about documents! The specific documents you'll need depend on your situation, but here are the basics most lenders require:

**For everyone:**
- Government-issued photo ID
- Social Security card
- Bank statements (last 2 months, all pages)

**For W-2 employees:**
- Recent pay stubs (last 30 days)
- W-2 forms (last 2 years)
- Federal tax returns (last 2 years)

**For self-employed borrowers:**
- Federal tax returns (last 2 years, personal AND business)
- Profit & loss statements
- Business license

**Additional (if applicable):**
- VA borrowers: DD-214 and Certificate of Eligibility
- Gift funds: Gift letter from the donor
- Divorce: Divorce decree and settlement agreement

Tell me more about your employment situation and I can give you a precise checklist tailored to your needs.`,
    };
  }

  return {
    message: `Thanks for sharing that! To give you the most personalized guidance, I still need to learn a bit more about your financial picture. Could you share:

- **Your approximate monthly debts** (car payments, student loans, credit cards, etc.)
- **Your credit score range** (if you know it — even a rough idea helps)
- **Your savings situation** (how much you've set aside for a down payment)

This will help me determine your readiness tier and create a tailored action plan just for you.`,
  };
}
