import { db } from "../db";
import { storage } from "../storage";
import {
  users,
  loanApplications,
  documents,
  employmentHistory,
  coachConversations,
  coachMessages,
  userActivities,
  homeownershipGoals,
  creditActions,
  savingsTransactions,
  journeyMilestones,
  tasks,
} from "@shared/schema";
import type { User, LoanApplication } from "@shared/schema";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";

export interface IncomeSource {
  source: "document" | "application" | "coach" | "goal";
  trust: "tier1" | "tier2" | "tier3";
  type: string;
  amount: number;
  period: "annual" | "monthly";
  employerName?: string | null;
  documentYear?: string | null;
  confidence?: string | null;
}

export interface AssetRecord {
  source: "document" | "application" | "goal";
  trust: "tier1" | "tier2" | "tier3";
  type: string;
  balance: number;
  accountType?: string | null;
}

export interface LiabilityRecord {
  source: "application" | "coach" | "goal";
  trust: "tier2" | "tier3";
  monthlyAmount: number;
  description: string;
}

export interface DocumentStatus {
  documentType: string;
  fileName: string;
  status: string;
  hasExtractedData: boolean;
  uploadedAt: string | null;
}

export interface BehaviorSignals {
  totalPageViews: number;
  propertySearches: number;
  propertyViews: number;
  calculatorUses: number;
  coachSessions: number;
  coachMessages: number;
  formStarts: number;
  formAbandons: number;
  ctaClicks: number;
  lastActiveAt: string | null;
  topPages: Array<{ page: string; views: number }>;
  recentPropertyViews: Array<{ propertyId?: string; price?: number; viewedAt: string }>;
}

export interface ReadinessSnapshot {
  completionPercentage: number;
  tier: "ready_now" | "almost_ready" | "building" | "exploring" | "unknown";
  source: "coach" | "calculated";
  completedInputs: string[];
  outstandingInputs: string[];
  estimatedTimeline: string | null;
  lastAssessedAt: string | null;
}

export interface EligibilitySignals {
  estimatedDTI: number | null;
  estimatedLTV: number | null;
  creditTier: "excellent" | "very_good" | "good" | "fair" | "poor" | "unknown";
  creditScore: number | null;
  creditScoreSource: "document" | "application" | "goal" | "coach" | null;
  employmentStable: boolean | null;
  employmentYears: number | null;
  hasAdequateSavings: boolean | null;
  estimatedMaxPurchase: number | null;
  eligibleLoanTypes: string[];
}

export interface GoalProfile {
  goal: string | null;
  targetHomePrice: number | null;
  targetDownPayment: number | null;
  targetCreditScore: number | null;
  targetCity: string | null;
  targetState: string | null;
  currentPhase: string | null;
  savingsProgress: number | null;
  creditScoreChange: number | null;
  journeyDay: number | null;
  milestonesAchieved: number;
}

export interface BorrowerGraph {
  userId: string;
  userName: string | null;
  email: string | null;
  role: string;
  memberSince: string | null;

  applications: Array<{
    id: string;
    status: string;
    loanPurpose: string | null;
    preferredLoanType: string | null;
    purchasePrice: number | null;
    downPayment: number | null;
    preApprovalAmount: number | null;
    isVeteran: boolean;
    isFirstTimeBuyer: boolean;
    createdAt: string | null;
  }>;

  activeApplicationId: string | null;

  income: IncomeSource[];
  bestAnnualIncome: number | null;
  bestIncomeSource: string | null;

  assets: AssetRecord[];
  totalVerifiedAssets: number | null;

  liabilities: LiabilityRecord[];
  totalMonthlyDebts: number | null;

  documents: DocumentStatus[];
  documentsUploaded: number;
  documentsVerified: number;
  documentsMissing: string[];

  readiness: ReadinessSnapshot;
  eligibility: EligibilitySignals;
  goal: GoalProfile;
  behavior: BehaviorSignals;

  actionPlan: Array<{ id: string; title: string; priority: string; category: string; completed: boolean }>;
  documentChecklist: Array<{ docType: string; label: string; priority: string }>;

  predictiveSignals: {
    likelyToApply: boolean;
    likelyToAbandon: boolean;
    engagementLevel: "high" | "medium" | "low" | "dormant";
    daysSinceLastActivity: number | null;
    suggestedNextAction: string;
  };
}

function getCreditTier(score: number | null): EligibilitySignals["creditTier"] {
  if (!score) return "unknown";
  if (score >= 760) return "excellent";
  if (score >= 720) return "very_good";
  if (score >= 680) return "good";
  if (score >= 640) return "fair";
  return "poor";
}

function parseNum(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === "number" ? val : parseFloat(val);
  return isNaN(n) ? null : n;
}

export async function buildBorrowerGraph(userId: string): Promise<BorrowerGraph> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const [
    apps,
    docs,
    coachConvs,
    goalRows,
    recentActivities,
    activityCounts,
  ] = await Promise.all([
    storage.getLoanApplicationsByUser(userId),
    db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt)),
    db.select().from(coachConversations).where(eq(coachConversations.userId, userId)).orderBy(desc(coachConversations.updatedAt)),
    db.select().from(homeownershipGoals).where(eq(homeownershipGoals.userId, userId)).limit(1),
    db.select({
      activityType: userActivities.activityType,
      count: sql<number>`count(*)::int`,
      lastSeen: sql<string>`max(${userActivities.createdAt})`,
    }).from(userActivities)
      .where(and(
        eq(userActivities.userId, userId),
        gte(userActivities.createdAt, sql`now() - interval '30 days'`)
      ))
      .groupBy(userActivities.activityType),
    db.select({
      page: userActivities.page,
      views: sql<number>`count(*)::int`,
    }).from(userActivities)
      .where(and(
        eq(userActivities.userId, userId),
        eq(userActivities.activityType, "page_view"),
        gte(userActivities.createdAt, sql`now() - interval '30 days'`)
      ))
      .groupBy(userActivities.page)
      .orderBy(sql`count(*) desc`)
      .limit(10),
  ]);

  const activeApp = apps.find(a => a.status !== "draft" && a.status !== "denied" && a.status !== "declined") || apps[0] || null;

  let empHistory: any[] = [];
  if (activeApp) {
    try {
      empHistory = await db.select().from(employmentHistory).where(eq(employmentHistory.applicationId, activeApp.id));
    } catch (err) {
      console.warn("[BorrowerGraph] Failed to fetch employment history:", err);
    }
  }

  const incomeSources: IncomeSource[] = [];
  const assetRecords: AssetRecord[] = [];
  const liabilityRecords: LiabilityRecord[] = [];
  const extractedDocs: DocumentStatus[] = [];
  const docsMissing: string[] = [];

  for (const doc of docs) {
    const docStatus: DocumentStatus = {
      documentType: doc.documentType,
      fileName: doc.fileName,
      status: doc.status || "uploaded",
      hasExtractedData: false,
      uploadedAt: doc.createdAt?.toISOString() || null,
    };

    if (doc.notes) {
      try {
        const parsed = JSON.parse(doc.notes as string);
        if (parsed.confidence && parsed.confidence !== "low") {
          docStatus.hasExtractedData = true;

          if (parsed.grossIncome) {
            incomeSources.push({
              source: "document",
              trust: "tier1",
              type: doc.documentType === "tax_return" ? "tax_return_gross" : "document_income",
              amount: parseNum(parsed.grossIncome) || 0,
              period: "annual",
              employerName: parsed.employerName || null,
              documentYear: parsed.documentYear || null,
              confidence: parsed.confidence,
            });
          }
          if (parsed.adjustedGrossIncome) {
            incomeSources.push({
              source: "document",
              trust: "tier1",
              type: "tax_return_agi",
              amount: parseNum(parsed.adjustedGrossIncome) || 0,
              period: "annual",
              documentYear: parsed.documentYear || null,
              confidence: parsed.confidence,
            });
          }
          if (parsed.grossPay) {
            incomeSources.push({
              source: "document",
              trust: "tier1",
              type: "pay_stub",
              amount: parseNum(parsed.grossPay) || 0,
              period: "monthly",
              employerName: parsed.employerName || null,
              confidence: parsed.confidence,
            });
          }
          if (parsed.closingBalance) {
            assetRecords.push({
              source: "document",
              trust: "tier1",
              type: "bank_account",
              balance: parseNum(parsed.closingBalance) || 0,
              accountType: parsed.accountType || null,
            });
          }
        }
      } catch (err) {
        console.warn("[BorrowerGraph] Failed to parse document notes:", doc.fileName, err);
      }
    }

    extractedDocs.push(docStatus);
  }

  if (activeApp) {
    if (activeApp.annualIncome) {
      incomeSources.push({
        source: "application",
        trust: "tier2",
        type: "application_stated",
        amount: parseNum(activeApp.annualIncome) || 0,
        period: "annual",
        employerName: activeApp.employerName || null,
      });
    }
    if (activeApp.monthlyDebts) {
      liabilityRecords.push({
        source: "application",
        trust: "tier2",
        monthlyAmount: parseNum(activeApp.monthlyDebts) || 0,
        description: "Total monthly debts (application)",
      });
    }
  }

  for (const emp of empHistory) {
    if (emp.totalMonthlyIncome) {
      incomeSources.push({
        source: "application",
        trust: "tier2",
        type: "employment_record",
        amount: parseNum(emp.totalMonthlyIncome) || 0,
        period: "monthly",
        employerName: emp.employerName || null,
      });
    }
  }

  const goalData = goalRows[0] || null;
  if (goalData) {
    if (goalData.monthlyIncome) {
      incomeSources.push({
        source: "goal",
        trust: "tier3",
        type: "goal_stated",
        amount: parseNum(goalData.monthlyIncome) || 0,
        period: "monthly",
      });
    }
    if (goalData.currentSavingsBalance) {
      assetRecords.push({
        source: "goal",
        trust: "tier3",
        type: "savings_goal",
        balance: parseNum(goalData.currentSavingsBalance) || 0,
      });
    }
    if (goalData.monthlyDebts) {
      liabilityRecords.push({
        source: "goal",
        trust: "tier3",
        monthlyAmount: parseNum(goalData.monthlyDebts) || 0,
        description: "Monthly debts (goal tracker)",
      });
    }
  }

  const coachConvWithProfile = coachConvs.find(c => c.financialProfile);
  let coachIntake: any = null;
  if (coachConvs.length > 0) {
    try {
      const latestConv = coachConvs[0];
      const msgs = await db.select().from(coachMessages)
        .where(eq(coachMessages.conversationId, latestConv.id))
        .orderBy(desc(coachMessages.createdAt));
      for (const msg of msgs) {
        if (msg.role === "assistant" && msg.structuredData) {
          const sd = msg.structuredData as any;
          if (sd?.intake) {
            coachIntake = sd.intake;
            break;
          }
        }
      }
    } catch (err) {
      console.warn("[BorrowerGraph] Failed to fetch coach intake:", err);
    }
  }

  if (coachIntake?.annualIncome) {
    incomeSources.push({
      source: "coach",
      trust: "tier3",
      type: "coach_stated",
      amount: parseNum(coachIntake.annualIncome) || 0,
      period: "annual",
    });
  }
  if (coachIntake?.monthlyDebts) {
    liabilityRecords.push({
      source: "coach",
      trust: "tier3",
      monthlyAmount: parseNum(coachIntake.monthlyDebts) || 0,
      description: "Monthly debts (coach conversation)",
    });
  }

  const tier1Income = incomeSources.filter(i => i.trust === "tier1" && i.period === "annual");
  const tier2Income = incomeSources.filter(i => i.trust === "tier2" && i.period === "annual");
  const tier1Monthly = incomeSources.filter(i => i.trust === "tier1" && i.period === "monthly");
  const tier2Monthly = incomeSources.filter(i => i.trust === "tier2" && i.period === "monthly");

  let bestAnnualIncome: number | null = null;
  let bestIncomeSource: string | null = null;

  if (tier1Income.length > 0) {
    bestAnnualIncome = Math.max(...tier1Income.map(i => i.amount));
    bestIncomeSource = "document";
  } else if (tier1Monthly.length > 0) {
    bestAnnualIncome = Math.max(...tier1Monthly.map(i => i.amount)) * 12;
    bestIncomeSource = "document";
  } else if (tier2Income.length > 0) {
    bestAnnualIncome = Math.max(...tier2Income.map(i => i.amount));
    bestIncomeSource = "application";
  } else if (tier2Monthly.length > 0) {
    bestAnnualIncome = Math.max(...tier2Monthly.map(i => i.amount)) * 12;
    bestIncomeSource = "application";
  } else {
    const allIncome = incomeSources.filter(i => i.amount > 0);
    if (allIncome.length > 0) {
      const best = allIncome[0];
      bestAnnualIncome = best.period === "monthly" ? best.amount * 12 : best.amount;
      bestIncomeSource = best.source;
    }
  }

  const totalVerifiedAssets = assetRecords
    .filter(a => a.trust === "tier1")
    .reduce((sum, a) => sum + a.balance, 0) || null;

  const totalMonthlyDebts = liabilityRecords.length > 0
    ? liabilityRecords.sort((a, b) => {
        const trustOrder = { tier2: 0, tier3: 1 };
        return (trustOrder[a.trust] || 1) - (trustOrder[b.trust] || 1);
      })[0].monthlyAmount
    : null;

  let creditScore: number | null = null;
  let creditScoreSource: EligibilitySignals["creditScoreSource"] = null;

  if (activeApp?.creditScore) {
    creditScore = activeApp.creditScore;
    creditScoreSource = "application";
  }
  if (goalData?.currentCreditScore) {
    if (!creditScore) {
      creditScore = goalData.currentCreditScore;
      creditScoreSource = "goal";
    }
  }
  if (coachIntake?.creditScore) {
    if (!creditScore) {
      creditScore = parseNum(coachIntake.creditScore);
      creditScoreSource = "coach";
    }
  }

  let estimatedDTI: number | null = null;
  if (activeApp?.dtiRatio) {
    estimatedDTI = parseNum(activeApp.dtiRatio);
  } else if (bestAnnualIncome && totalMonthlyDebts) {
    const monthlyIncome = bestAnnualIncome / 12;
    estimatedDTI = monthlyIncome > 0 ? Math.round((totalMonthlyDebts / monthlyIncome) * 10000) / 100 : null;
  }

  let estimatedLTV: number | null = null;
  if (activeApp?.ltvRatio) {
    estimatedLTV = parseNum(activeApp.ltvRatio);
  } else if (activeApp?.purchasePrice && activeApp?.downPayment) {
    const pp = parseNum(activeApp.purchasePrice) || 0;
    const dp = parseNum(activeApp.downPayment) || 0;
    if (pp > 0) estimatedLTV = Math.round(((pp - dp) / pp) * 10000) / 100;
  }

  const employmentYears = activeApp?.employmentYears || (empHistory.length > 0 ? empHistory[0]?.yearsOnJob : null);
  const employmentStable = employmentYears != null ? employmentYears >= 2 : null;

  const hasAdequateSavings = (() => {
    if (!activeApp?.purchasePrice) return null;
    const pp = parseNum(activeApp.purchasePrice) || 0;
    const neededDown = pp * 0.035;
    const neededClosing = pp * 0.03;
    const total = neededDown + neededClosing;
    const available = totalVerifiedAssets || (goalData?.currentSavingsBalance ? parseNum(goalData.currentSavingsBalance) : null);
    if (!available) return null;
    return available >= total;
  })();

  let estimatedMaxPurchase: number | null = null;
  if (bestAnnualIncome && totalMonthlyDebts !== null) {
    const monthlyIncome = bestAnnualIncome / 12;
    const maxHousingPayment = monthlyIncome * 0.43 - (totalMonthlyDebts || 0);
    if (maxHousingPayment > 0) {
      const rate = 0.065 / 12;
      const term = 360;
      const factor = (Math.pow(1 + rate, term) - 1) / (rate * Math.pow(1 + rate, term));
      estimatedMaxPurchase = Math.round(maxHousingPayment * factor * 0.85);
    }
  }

  const eligibleLoanTypes: string[] = [];
  if (creditScore) {
    if (creditScore >= 620) eligibleLoanTypes.push("conventional");
    if (creditScore >= 580) eligibleLoanTypes.push("fha");
    if (creditScore >= 580 && (activeApp?.isVeteran || coachIntake?.isVeteran)) eligibleLoanTypes.push("va");
    if (creditScore >= 640) eligibleLoanTypes.push("usda");
  }

  const requiredDocs = ["pay_stub", "w2", "tax_return", "bank_statement", "government_id"];
  const uploadedTypes = new Set(docs.map(d => d.documentType));
  const documentsMissing = requiredDocs.filter(t => !uploadedTypes.has(t));

  const readiness: ReadinessSnapshot = {
    completionPercentage: 0,
    tier: "unknown",
    source: "calculated",
    completedInputs: [],
    outstandingInputs: [],
    estimatedTimeline: null,
    lastAssessedAt: null,
  };

  if (coachConvWithProfile) {
    const fp = coachConvWithProfile.financialProfile as any;
    readiness.source = "coach";
    readiness.completionPercentage = coachConvWithProfile.completionPercentage || fp?.completionPercentage || fp?.readinessScore || 0;
    readiness.tier = (coachConvWithProfile.readinessTier || fp?.readinessTier || "unknown") as any;
    readiness.completedInputs = fp?.completedInputs || fp?.strengths || [];
    readiness.outstandingInputs = fp?.outstandingInputs || fp?.gaps || [];
    readiness.estimatedTimeline = fp?.estimatedTimeline || null;
    readiness.lastAssessedAt = coachConvWithProfile.updatedAt?.toISOString() || null;
  } else {
    let calcScore = 10;
    if (activeApp) {
      const statusScores: Record<string, number> = {
        draft: 20, submitted: 35, analyzing: 40, pre_approved: 60,
        doc_collection: 55, processing: 65, underwriting: 75,
        conditional: 85, clear_to_close: 95, closing: 98, closed: 100,
      };
      calcScore = statusScores[activeApp.status] || 30;
    }
    if (creditScore && creditScore >= 680) { calcScore += 5; readiness.completedInputs.push("Credit score provided"); }
    if (employmentStable) { calcScore += 5; readiness.completedInputs.push("Employment verified (2+ years)"); }
    if (hasAdequateSavings) { calcScore += 5; readiness.completedInputs.push("Savings documented"); }
    if (estimatedDTI && estimatedDTI <= 43) { calcScore += 5; readiness.completedInputs.push("DTI calculated"); }

    if (creditScore && creditScore < 640) readiness.outstandingInputs.push("Credit score below 640");
    if (estimatedDTI && estimatedDTI > 43) readiness.outstandingInputs.push("DTI ratio above 43%");
    if (documentsMissing.length > 2) readiness.outstandingInputs.push("Missing key documents");
    if (!employmentStable && employmentYears !== null) readiness.outstandingInputs.push("Less than 2 years employment");

    readiness.completionPercentage = Math.min(calcScore, 100);
    readiness.tier = calcScore >= 80 ? "ready_now" : calcScore >= 60 ? "almost_ready" : calcScore >= 35 ? "building" : "exploring";
  }

  const activityMap = new Map(recentActivities.map(a => [a.activityType, { count: a.count, lastSeen: a.lastSeen }]));
  const getCount = (type: string) => activityMap.get(type)?.count || 0;
  const totalPageViews = getCount("page_view");
  const propertySearches = getCount("property_search");
  const propertyViews = getCount("property_click") + getCount("property_view");
  const calculatorUses = getCount("calculator_use");
  const coachSessionCount = getCount("coach_session_start");
  const coachMessageCount = getCount("coach_message_sent");
  const formStarts = getCount("form_start");
  const formAbandons = getCount("form_abandon");
  const ctaClicks = getCount("cta_click");

  const allLastSeen = recentActivities.map(a => a.lastSeen).filter(Boolean);
  const lastActiveAt = allLastSeen.length > 0
    ? allLastSeen.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    : user.lastActiveAt?.toISOString() || null;

  const daysSinceLastActivity = lastActiveAt
    ? Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 86400000)
    : null;

  let recentPropertyViews: BehaviorSignals["recentPropertyViews"] = [];
  try {
    const propActivities = await db.select({
      metadata: userActivities.metadata,
      createdAt: userActivities.createdAt,
    }).from(userActivities)
      .where(and(
        eq(userActivities.userId, userId),
        eq(userActivities.activityType, "property_click"),
        gte(userActivities.createdAt, sql`now() - interval '30 days'`)
      ))
      .orderBy(desc(userActivities.createdAt))
      .limit(10);

    recentPropertyViews = propActivities.map(a => ({
      propertyId: (a.metadata as any)?.propertyId || (a.metadata as any)?.property_id,
      price: parseNum((a.metadata as any)?.price) || undefined,
      viewedAt: a.createdAt?.toISOString() || "",
    }));
  } catch (err) {
    console.warn("[BorrowerGraph] Failed to fetch property views:", err);
  }

  const engagementLevel: "high" | "medium" | "low" | "dormant" =
    daysSinceLastActivity !== null && daysSinceLastActivity > 14 ? "dormant" :
    totalPageViews >= 20 || coachSessionCount >= 2 || propertySearches >= 3 ? "high" :
    totalPageViews >= 5 || coachSessionCount >= 1 || propertySearches >= 1 ? "medium" : "low";

  const likelyToApply = !activeApp && (
    (propertySearches >= 2 && calculatorUses >= 1) ||
    (coachSessionCount >= 1 && formStarts >= 1) ||
    ctaClicks >= 3
  );

  const likelyToAbandon = activeApp?.status === "draft" && (
    daysSinceLastActivity !== null && daysSinceLastActivity > 7
  );

  let suggestedNextAction = "Start your pre-approval application";
  if (activeApp) {
    if (activeApp.status === "draft") suggestedNextAction = "Complete your application";
    else if (activeApp.status === "pre_approved") suggestedNextAction = "Browse properties in your budget";
    else if (activeApp.status === "doc_collection") suggestedNextAction = "Upload required documents";
    else if (activeApp.status === "conditional") suggestedNextAction = "Clear remaining conditions";
    else if (activeApp.status === "clear_to_close") suggestedNextAction = "Schedule your closing";
    else if (activeApp.status === "denied") suggestedNextAction = "Talk to the AI Coach about improving your profile";
  } else if (engagementLevel === "dormant") {
    suggestedNextAction = "Welcome back — check out new listings or chat with the Coach";
  } else if (propertySearches > 0 && !activeApp) {
    suggestedNextAction = "Get pre-approved to make offers on homes you've been viewing";
  } else if (coachSessionCount > 0 && !activeApp) {
    suggestedNextAction = "Ready to apply? Your Coach data will pre-fill the application";
  }

  let actionPlan: BorrowerGraph["actionPlan"] = [];
  let documentChecklist: BorrowerGraph["documentChecklist"] = [];

  if (coachConvWithProfile) {
    const ap = coachConvWithProfile.actionPlan as any[];
    if (ap && Array.isArray(ap)) {
      actionPlan = ap.map(item => ({
        id: item.id,
        title: item.title,
        priority: item.priority,
        category: item.category,
        completed: item.completed || false,
      }));
    }
    const dc = coachConvWithProfile.documentChecklist as any[];
    if (dc && Array.isArray(dc)) {
      documentChecklist = dc.map(item => ({
        docType: item.docType,
        label: item.label,
        priority: item.priority,
      }));
    }
  }

  let milestonesAchieved = 0;
  if (goalData) {
    try {
      const milestones = await db.select({ cnt: sql<number>`count(*)::int` })
        .from(journeyMilestones)
        .where(eq(journeyMilestones.goalId, goalData.id));
      milestonesAchieved = milestones[0]?.cnt || 0;
    } catch (err) {
      console.warn("[BorrowerGraph] Failed to fetch milestones:", err);
    }
  }

  return {
    userId,
    userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email?.split("@")[0] || null,
    email: user.email || null,
    role: user.role,
    memberSince: user.createdAt?.toISOString() || null,

    applications: apps.map(a => ({
      id: a.id,
      status: a.status,
      loanPurpose: a.loanPurpose || null,
      preferredLoanType: a.preferredLoanType || null,
      purchasePrice: parseNum(a.purchasePrice),
      downPayment: parseNum(a.downPayment),
      preApprovalAmount: parseNum(a.preApprovalAmount),
      isVeteran: a.isVeteran || false,
      isFirstTimeBuyer: a.isFirstTimeBuyer || false,
      createdAt: a.createdAt?.toISOString() || null,
    })),

    activeApplicationId: activeApp?.id || null,

    income: incomeSources,
    bestAnnualIncome,
    bestIncomeSource,

    assets: assetRecords,
    totalVerifiedAssets,

    liabilities: liabilityRecords,
    totalMonthlyDebts,

    documents: extractedDocs,
    documentsUploaded: docs.length,
    documentsVerified: docs.filter(d => d.status === "verified").length,
    documentsMissing,

    readiness,
    eligibility: {
      estimatedDTI,
      estimatedLTV,
      creditTier: getCreditTier(creditScore),
      creditScore,
      creditScoreSource,
      employmentStable,
      employmentYears: employmentYears || null,
      hasAdequateSavings,
      estimatedMaxPurchase,
      eligibleLoanTypes,
    },

    goal: {
      goal: goalData?.currentPhase || null,
      targetHomePrice: parseNum(goalData?.targetHomePrice),
      targetDownPayment: parseNum(goalData?.targetDownPayment),
      targetCreditScore: goalData?.targetCreditScore || null,
      targetCity: goalData?.targetCity || null,
      targetState: goalData?.targetState || null,
      currentPhase: goalData?.currentPhase || null,
      savingsProgress: parseNum(goalData?.savingsProgress),
      creditScoreChange: goalData?.creditScoreChange || null,
      journeyDay: goalData?.journeyDay || null,
      milestonesAchieved,
    },

    behavior: {
      totalPageViews,
      propertySearches,
      propertyViews,
      calculatorUses,
      coachSessions: coachSessionCount,
      coachMessages: coachMessageCount,
      formStarts,
      formAbandons,
      ctaClicks,
      lastActiveAt,
      topPages: activityCounts.map(a => ({ page: a.page || "", views: a.views })),
      recentPropertyViews,
    },

    actionPlan,
    documentChecklist,

    predictiveSignals: {
      likelyToApply,
      likelyToAbandon,
      engagementLevel,
      daysSinceLastActivity,
      suggestedNextAction,
    },
  };
}

export async function getPropertyAffordability(
  userId: string,
  propertyPrice: number,
): Promise<{
  canAfford: boolean;
  estimatedDTI: number | null;
  estimatedMonthlyPayment: number | null;
  additionalSavingsNeeded: number | null;
  estimatedDownPayment: number;
  eligibleLoanTypes: string[];
  message: string;
}> {
  const graph = await buildBorrowerGraph(userId);

  const downPaymentPercent = graph.eligibility.creditScore && graph.eligibility.creditScore >= 620 ? 0.05 : 0.035;
  const estimatedDownPayment = Math.round(propertyPrice * downPaymentPercent);
  const loanAmount = propertyPrice - estimatedDownPayment;

  const rate = 0.065 / 12;
  const term = 360;
  const monthlyPI = loanAmount * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
  const monthlyTaxIns = propertyPrice * 0.015 / 12;
  const estimatedMonthlyPayment = Math.round(monthlyPI + monthlyTaxIns);

  const monthlyIncome = graph.bestAnnualIncome ? graph.bestAnnualIncome / 12 : null;
  const currentDebts = graph.totalMonthlyDebts || 0;
  const estimatedDTI = monthlyIncome ? Math.round(((estimatedMonthlyPayment + currentDebts) / monthlyIncome) * 10000) / 100 : null;

  const totalNeeded = estimatedDownPayment + Math.round(propertyPrice * 0.03);
  const available = graph.totalVerifiedAssets || (graph.assets.length > 0 ? graph.assets[0].balance : 0);
  const additionalSavingsNeeded = available < totalNeeded ? Math.round(totalNeeded - available) : null;

  const canAfford = (estimatedDTI !== null && estimatedDTI <= 50) && !additionalSavingsNeeded;

  let message: string;
  if (canAfford && estimatedDTI && estimatedDTI <= 43) {
    message = `This home fits your financial profile. Your estimated DTI would be ${estimatedDTI}%, well within guidelines.`;
  } else if (canAfford) {
    message = `You could qualify for this home, though your DTI of ${estimatedDTI}% is on the higher side. An FHA loan may offer more flexibility.`;
  } else if (additionalSavingsNeeded) {
    message = `You would need approximately $${additionalSavingsNeeded.toLocaleString()} more in savings for the down payment and closing costs on this home.`;
  } else if (estimatedDTI && estimatedDTI > 50) {
    message = `This home may stretch your budget. Your estimated DTI would be ${estimatedDTI}%. Consider properties under $${graph.eligibility.estimatedMaxPurchase?.toLocaleString() || "N/A"}.`;
  } else {
    message = `We need more financial information to assess your affordability for this home. Complete your application or chat with the AI Coach.`;
  }

  return {
    canAfford,
    estimatedDTI,
    estimatedMonthlyPayment,
    additionalSavingsNeeded,
    estimatedDownPayment,
    eligibleLoanTypes: graph.eligibility.eligibleLoanTypes,
    message,
  };
}
