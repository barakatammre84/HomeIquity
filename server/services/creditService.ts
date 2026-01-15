import { db } from "../db";
import { 
  creditConsents, 
  creditPulls, 
  adverseActions, 
  creditAuditLog,
  loanApplications,
  users,
  type InsertCreditConsent,
  type InsertCreditPull,
  type InsertAdverseAction,
  type InsertCreditAuditLog,
  type CreditConsent,
  type CreditPull,
  type AdverseAction,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const CURRENT_DISCLOSURE_VERSION = "FCRA-2025-v1";

const FCRA_DISCLOSURE_TEXT = `CONSUMER CREDIT AUTHORIZATION AND DISCLOSURE

By providing your consent below, you authorize MortgageAI and its designated agents to:

1. OBTAIN YOUR CREDIT REPORT: We will request a consumer credit report from one or more consumer reporting agencies (Experian, Equifax, and/or TransUnion) in connection with your mortgage loan application.

2. CREDIT INQUIRY TYPE: This authorization permits both "soft" inquiries (which do not affect your credit score) and "hard" inquiries (which may temporarily lower your credit score) as necessary for loan processing.

3. USE OF INFORMATION: Credit information obtained will be used solely for the purpose of evaluating your mortgage loan application and determining appropriate loan terms.

4. YOUR RIGHTS UNDER THE FAIR CREDIT REPORTING ACT (FCRA):
   - You have the right to obtain a free copy of your credit report from each credit bureau once every 12 months at www.annualcreditreport.com
   - If credit is denied or terms are changed based on credit information, you will receive an adverse action notice
   - You have the right to dispute inaccurate information on your credit report
   - You may request that your credit file be "frozen" to prevent access

5. MULTIPLE INQUIRIES: Multiple credit inquiries for mortgage loans made within a 45-day period are typically counted as a single inquiry for scoring purposes.

6. RETENTION: This authorization remains valid for 120 days from the date of your consent unless revoked in writing.

By clicking "I Authorize" you confirm that:
- You are the individual named on this application
- The information you provided is accurate
- You authorize the credit inquiry described above`;

const ADVERSE_ACTION_REASONS = {
  credit_score_low: "Credit score does not meet minimum requirements",
  dti_high: "Debt-to-income ratio exceeds maximum threshold",
  insufficient_credit_history: "Insufficient credit history to evaluate",
  derogatory_items: "Derogatory items on credit report",
  recent_late_payments: "Recent late payment history",
  high_credit_utilization: "High credit utilization ratio",
  bankruptcy_recent: "Recent bankruptcy on credit report",
  foreclosure_recent: "Recent foreclosure on credit report",
  collections_active: "Active collection accounts",
  insufficient_income: "Insufficient income for requested loan amount",
};

const BUREAU_CONTACT_INFO = {
  experian: {
    name: "Experian",
    address: "P.O. Box 4500, Allen, TX 75013",
    phone: "1-888-397-3742",
    website: "www.experian.com",
  },
  equifax: {
    name: "Equifax",
    address: "P.O. Box 740241, Atlanta, GA 30374",
    phone: "1-800-685-1111",
    website: "www.equifax.com",
  },
  transunion: {
    name: "TransUnion",
    address: "P.O. Box 1000, Chester, PA 19016",
    phone: "1-800-916-8800",
    website: "www.transunion.com",
  },
};

export async function createCreditConsent(
  data: {
    applicationId: string;
    userId: string;
    consentType: string;
    borrowerFullName: string;
    borrowerSSNLast4?: string;
    borrowerDOB?: string;
    consentGiven: boolean;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<CreditConsent> {
  const consent: InsertCreditConsent = {
    applicationId: data.applicationId,
    userId: data.userId,
    consentType: data.consentType,
    disclosureVersion: CURRENT_DISCLOSURE_VERSION,
    disclosureText: FCRA_DISCLOSURE_TEXT,
    consentGiven: data.consentGiven,
    consentTimestamp: new Date(),
    borrowerFullName: data.borrowerFullName,
    borrowerSSNLast4: data.borrowerSSNLast4,
    borrowerDOB: data.borrowerDOB,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    signatureType: "electronic",
    isActive: true,
  };

  const [result] = await db.insert(creditConsents).values(consent).returning();

  await logCreditAction({
    applicationId: data.applicationId,
    userId: data.userId,
    consentId: result.id,
    action: data.consentGiven ? "consent_given" : "consent_declined",
    actionDetails: {
      consentType: data.consentType,
      disclosureVersion: CURRENT_DISCLOSURE_VERSION,
    },
    performedBy: data.userId,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });

  return result;
}

export async function getActiveConsent(applicationId: string): Promise<CreditConsent | null> {
  const [consent] = await db
    .select()
    .from(creditConsents)
    .where(
      and(
        eq(creditConsents.applicationId, applicationId),
        eq(creditConsents.isActive, true),
        eq(creditConsents.consentGiven, true)
      )
    )
    .orderBy(desc(creditConsents.consentTimestamp))
    .limit(1);

  return consent || null;
}

export async function revokeConsent(
  consentId: string,
  reason: string,
  performedBy: string,
  ipAddress?: string
): Promise<void> {
  const [consent] = await db
    .select()
    .from(creditConsents)
    .where(eq(creditConsents.id, consentId));

  if (!consent) {
    throw new Error("Consent not found");
  }

  await db
    .update(creditConsents)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(creditConsents.id, consentId));

  await logCreditAction({
    applicationId: consent.applicationId,
    userId: consent.userId,
    consentId: consentId,
    action: "consent_revoked",
    actionDetails: { reason },
    performedBy,
    ipAddress,
  });
}

export async function requestCreditPull(
  data: {
    applicationId: string;
    consentId: string;
    requestedBy: string;
    pullType: "soft" | "hard" | "tri_merge";
    bureaus: string[];
    ipAddress?: string;
  }
): Promise<CreditPull> {
  const consent = await getActiveConsent(data.applicationId);
  if (!consent || consent.id !== data.consentId) {
    throw new Error("Valid consent required before credit pull");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 120);

  const pull: InsertCreditPull = {
    applicationId: data.applicationId,
    consentId: data.consentId,
    requestedBy: data.requestedBy,
    pullType: data.pullType,
    bureaus: data.bureaus,
    status: "pending",
    requestedAt: new Date(),
    expiresAt,
  };

  const [result] = await db.insert(creditPulls).values(pull).returning();

  await logCreditAction({
    applicationId: data.applicationId,
    creditPullId: result.id,
    consentId: data.consentId,
    action: "pull_requested",
    actionDetails: {
      pullType: data.pullType,
      bureaus: data.bureaus,
    },
    performedBy: data.requestedBy,
    ipAddress: data.ipAddress,
  });

  return result;
}

export async function simulateCreditPullCompletion(
  creditPullId: string,
  simulatedScores?: {
    experian?: number;
    equifax?: number;
    transunion?: number;
  }
): Promise<CreditPull> {
  const [pull] = await db
    .select()
    .from(creditPulls)
    .where(eq(creditPulls.id, creditPullId));

  if (!pull) {
    throw new Error("Credit pull not found");
  }

  const experian = simulatedScores?.experian || Math.floor(Math.random() * 200) + 600;
  const equifax = simulatedScores?.equifax || Math.floor(Math.random() * 200) + 600;
  const transunion = simulatedScores?.transunion || Math.floor(Math.random() * 200) + 600;

  const scores = [experian, equifax, transunion].sort((a, b) => a - b);
  const representativeScore = scores[1];

  const totalDebt = Math.floor(Math.random() * 50000) + 5000;
  const monthlyPayments = Math.floor(totalDebt * 0.03);

  const [updated] = await db
    .update(creditPulls)
    .set({
      status: "completed",
      experianScore: experian,
      equifaxScore: equifax,
      transunionScore: transunion,
      representativeScore,
      totalTradelines: Math.floor(Math.random() * 15) + 3,
      openTradelines: Math.floor(Math.random() * 8) + 2,
      totalDebt: totalDebt.toString(),
      monthlyPayments: monthlyPayments.toString(),
      derogatoryCount: Math.floor(Math.random() * 3),
      inquiryCount30Days: Math.floor(Math.random() * 3),
      inquiryCount90Days: Math.floor(Math.random() * 5),
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creditPulls.id, creditPullId))
    .returning();

  await logCreditAction({
    applicationId: pull.applicationId,
    creditPullId: creditPullId,
    consentId: pull.consentId,
    action: "pull_completed",
    actionDetails: {
      representativeScore,
      bureausReturned: pull.bureaus,
    },
  });

  return updated;
}

export async function getCreditPullsByApplication(applicationId: string): Promise<CreditPull[]> {
  return db
    .select()
    .from(creditPulls)
    .where(eq(creditPulls.applicationId, applicationId))
    .orderBy(desc(creditPulls.requestedAt));
}

export async function getLatestCreditPull(applicationId: string): Promise<CreditPull | null> {
  const [pull] = await db
    .select()
    .from(creditPulls)
    .where(
      and(
        eq(creditPulls.applicationId, applicationId),
        eq(creditPulls.status, "completed")
      )
    )
    .orderBy(desc(creditPulls.completedAt))
    .limit(1);

  return pull || null;
}

export async function generateAdverseAction(
  data: {
    applicationId: string;
    creditPullId?: string;
    userId: string;
    actionType: "denial" | "counteroffer" | "rate_adjustment" | "terms_change";
    primaryReason: keyof typeof ADVERSE_ACTION_REASONS;
    secondaryReasons?: (keyof typeof ADVERSE_ACTION_REASONS)[];
    creditScoreUsed?: number;
    creditScoreSource?: "experian" | "equifax" | "transunion";
    generatedBy: string;
  }
): Promise<AdverseAction> {
  const bureau = data.creditScoreSource 
    ? BUREAU_CONTACT_INFO[data.creditScoreSource]
    : BUREAU_CONTACT_INFO.experian;

  const noticeText = generateAdverseActionNotice({
    actionType: data.actionType,
    primaryReason: ADVERSE_ACTION_REASONS[data.primaryReason],
    secondaryReasons: data.secondaryReasons?.map(r => ADVERSE_ACTION_REASONS[r]),
    creditScoreUsed: data.creditScoreUsed,
    bureau,
  });

  const adverseAction: InsertAdverseAction = {
    applicationId: data.applicationId,
    creditPullId: data.creditPullId,
    userId: data.userId,
    actionType: data.actionType,
    primaryReason: ADVERSE_ACTION_REASONS[data.primaryReason],
    secondaryReasons: data.secondaryReasons?.map(r => ADVERSE_ACTION_REASONS[r]),
    creditScoreUsed: data.creditScoreUsed,
    creditScoreSource: data.creditScoreSource,
    scoreRangeLow: 300,
    scoreRangeHigh: 850,
    bureauName: bureau.name,
    bureauAddress: bureau.address,
    bureauPhone: bureau.phone,
    bureauWebsite: bureau.website,
    noticeText,
    noticeDate: new Date(),
    fcraCompliant: true,
    generatedBy: data.generatedBy,
  };

  const [result] = await db.insert(adverseActions).values(adverseAction).returning();

  await logCreditAction({
    applicationId: data.applicationId,
    creditPullId: data.creditPullId,
    adverseActionId: result.id,
    userId: data.userId,
    action: "adverse_action_generated",
    actionDetails: {
      actionType: data.actionType,
      primaryReason: data.primaryReason,
    },
    performedBy: data.generatedBy,
  });

  return result;
}

function generateAdverseActionNotice(data: {
  actionType: string;
  primaryReason: string;
  secondaryReasons?: string[];
  creditScoreUsed?: number;
  bureau: typeof BUREAU_CONTACT_INFO.experian;
}): string {
  const actionTypeText = {
    denial: "DENIAL OF CREDIT",
    counteroffer: "COUNTEROFFER OF CREDIT TERMS",
    rate_adjustment: "INTEREST RATE ADJUSTMENT",
    terms_change: "MODIFICATION OF CREDIT TERMS",
  }[data.actionType] || "ADVERSE ACTION NOTICE";

  let notice = `
NOTICE OF ${actionTypeText}

Date: ${new Date().toLocaleDateString()}

Dear Applicant,

This notice is to inform you that action has been taken on your mortgage loan application. The decision was based, in whole or in part, on information obtained from a consumer reporting agency.

ACTION TAKEN: ${data.actionType.replace(/_/g, " ").toUpperCase()}

PRINCIPAL REASON(S) FOR THIS DECISION:

1. ${data.primaryReason}
`;

  if (data.secondaryReasons && data.secondaryReasons.length > 0) {
    data.secondaryReasons.forEach((reason, index) => {
      notice += `${index + 2}. ${reason}\n`;
    });
  }

  if (data.creditScoreUsed) {
    notice += `
CREDIT SCORE INFORMATION:
Your credit score: ${data.creditScoreUsed}
Credit scores range from 300 to 850.
Key factors that adversely affected your credit score are listed above.
`;
  }

  notice += `
YOUR RIGHTS UNDER THE FAIR CREDIT REPORTING ACT:

You have the right to obtain a free copy of your credit report from the consumer reporting agency named below within 60 days of receiving this notice. The consumer reporting agency did not make the decision to take this action and cannot provide specific reasons for it.

You have the right to dispute the accuracy or completeness of any information in your credit report.

CONSUMER REPORTING AGENCY:
${data.bureau.name}
${data.bureau.address}
Phone: ${data.bureau.phone}
Website: ${data.bureau.website}

For questions about this notice, please contact us at:
MortgageAI
support@mortgageai.com

This notice is required by the Fair Credit Reporting Act.
`;

  return notice;
}

export async function getAdverseActionsByApplication(applicationId: string): Promise<AdverseAction[]> {
  return db
    .select()
    .from(adverseActions)
    .where(eq(adverseActions.applicationId, applicationId))
    .orderBy(desc(adverseActions.noticeDate));
}

export async function markAdverseActionDelivered(
  adverseActionId: string,
  deliveryMethod: string,
  deliveryConfirmation?: string
): Promise<void> {
  await db
    .update(adverseActions)
    .set({
      deliveryMethod,
      deliveredAt: new Date(),
      deliveryConfirmation,
      updatedAt: new Date(),
    })
    .where(eq(adverseActions.id, adverseActionId));

  const [action] = await db
    .select()
    .from(adverseActions)
    .where(eq(adverseActions.id, adverseActionId));

  if (action) {
    await logCreditAction({
      applicationId: action.applicationId,
      adverseActionId,
      userId: action.userId,
      action: "adverse_action_delivered",
      actionDetails: { deliveryMethod, deliveryConfirmation },
    });
  }
}

async function logCreditAction(data: {
  applicationId?: string;
  userId?: string;
  consentId?: string;
  creditPullId?: string;
  adverseActionId?: string;
  action: string;
  actionDetails?: Record<string, unknown>;
  performedBy?: string;
  performedByRole?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const log: InsertCreditAuditLog = {
    applicationId: data.applicationId,
    userId: data.userId,
    consentId: data.consentId,
    creditPullId: data.creditPullId,
    adverseActionId: data.adverseActionId,
    action: data.action,
    actionDetails: data.actionDetails,
    performedBy: data.performedBy,
    performedByRole: data.performedByRole,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    timestamp: new Date(),
  };

  await db.insert(creditAuditLog).values(log);
}

export async function getCreditAuditLog(
  applicationId: string,
  limit: number = 100
): Promise<typeof creditAuditLog.$inferSelect[]> {
  return db
    .select()
    .from(creditAuditLog)
    .where(eq(creditAuditLog.applicationId, applicationId))
    .orderBy(desc(creditAuditLog.timestamp))
    .limit(limit);
}

export function getDisclosureText(): string {
  return FCRA_DISCLOSURE_TEXT;
}

export function getDisclosureVersion(): string {
  return CURRENT_DISCLOSURE_VERSION;
}

export function getAdverseActionReasons(): typeof ADVERSE_ACTION_REASONS {
  return ADVERSE_ACTION_REASONS;
}
