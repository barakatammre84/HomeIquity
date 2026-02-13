import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { generateCoachResponse, type VerifiedUserContext, type CoachIntakeData, type DocumentExtractedData, deriveUserType, deriveReadinessState, deriveCompletionPercentage, deriveCompletedSteps } from "../services/coachingService";
import { buildBorrowerGraph } from "../services/borrowerGraph";
import type { User } from "@shared/schema";
import { z } from "zod";

const messageSchema = z.object({
  message: z.string().min(1).max(5000),
  conversationId: z.string().optional(),
  propertyPrice: z.number().optional(),
  propertyAddress: z.string().optional(),
});

async function buildVerifiedContext(userId: string, user: User, propertyContext?: { price: number; address: string } | null): Promise<VerifiedUserContext> {
  try {
    const applications = await storage.getLoanApplicationsByUser(userId);
    const activeApp = applications.find(a => a.status !== "draft" && a.status !== "denied") || applications[0];

    if (!activeApp) {
      return {
        hasApplication: false,
        userName: user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : (user.email?.split("@")[0] || undefined),
      };
    }

    let employmentHistory: VerifiedUserContext["employmentHistory"] = [];
    try {
      const { db: database } = await import("../db");
      const { employmentHistory: empTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const empRecords = await database.select().from(empTable)
        .where(eq(empTable.applicationId, activeApp.id));
      employmentHistory = empRecords.map(e => ({
        employerName: e.employerName,
        positionTitle: e.positionTitle,
        isSelfEmployed: e.isSelfEmployed || false,
        startDate: e.startDate,
        totalMonthlyIncome: e.totalMonthlyIncome,
      }));
    } catch (e) {
      console.warn("[Coach] Could not fetch employment history:", e);
    }

    let uploadedDocuments: VerifiedUserContext["uploadedDocuments"] = [];
    let documentExtractedData: DocumentExtractedData[] = [];
    try {
      const docs = await storage.getDocumentsByApplication(activeApp.id);
      uploadedDocuments = docs.map(d => ({
        documentType: d.documentType,
        status: d.status || "uploaded",
      }));

      for (const doc of docs) {
        if (!doc.notes) continue;
        try {
          const parsed = JSON.parse(doc.notes as string);
          if (!parsed.confidence || parsed.confidence === "low") continue;

          const extracted: DocumentExtractedData = {
            documentType: doc.documentType,
            confidence: parsed.confidence,
          };

          if (parsed.grossIncome) extracted.grossIncome = parsed.grossIncome;
          if (parsed.adjustedGrossIncome) extracted.adjustedGrossIncome = parsed.adjustedGrossIncome;
          if (parsed.taxableIncome) extracted.taxableIncome = parsed.taxableIncome;
          if (parsed.filingStatus) extracted.filingStatus = parsed.filingStatus;
          if (parsed.documentYear) extracted.documentYear = parsed.documentYear;
          if (parsed.grossPay) extracted.grossPay = parsed.grossPay;
          if (parsed.netPay) extracted.netPay = parsed.netPay;
          if (parsed.ytdGross) extracted.ytdGross = parsed.ytdGross;
          if (parsed.employerName) extracted.employerName = parsed.employerName;
          if (parsed.employeeName) extracted.employeeName = parsed.employeeName;
          if (parsed.closingBalance) extracted.closingBalance = parsed.closingBalance;
          if (parsed.totalDeposits) extracted.totalDeposits = parsed.totalDeposits;
          if (parsed.accountType) extracted.accountType = parsed.accountType;

          const hasData = Object.keys(extracted).length > 2;
          if (hasData) documentExtractedData.push(extracted);
        } catch {
          // notes is not valid JSON extraction data, skip
        }
      }
    } catch (e) {
      console.warn("[Coach] Could not fetch documents:", e);
    }

    const context: VerifiedUserContext = {
      hasApplication: true,
      applicationStatus: activeApp.status,
      annualIncome: activeApp.annualIncome,
      monthlyDebts: activeApp.monthlyDebts,
      creditScore: activeApp.creditScore,
      employmentType: activeApp.employmentType,
      employmentYears: activeApp.employmentYears,
      employerName: activeApp.employerName,
      isVeteran: activeApp.isVeteran || false,
      isFirstTimeBuyer: activeApp.isFirstTimeBuyer || false,
      dtiRatio: activeApp.dtiRatio,
      ltvRatio: activeApp.ltvRatio,
      preApprovalAmount: activeApp.preApprovalAmount,
      purchasePrice: activeApp.purchasePrice,
      downPayment: activeApp.downPayment,
      preferredLoanType: activeApp.preferredLoanType,
      propertyType: activeApp.propertyType,
      loanPurpose: activeApp.loanPurpose,
      employmentHistory,
      uploadedDocuments,
      documentExtractedData: documentExtractedData.length > 0 ? documentExtractedData : undefined,
      userName: user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : (user.email?.split("@")[0] || undefined),
    };

    try {
      const graph = await buildBorrowerGraph(userId);
      if (graph) {
        context.readinessScore = graph.readiness.score;
        context.readinessTier = graph.readiness.tier;
        context.readinessGaps = graph.readiness.gaps;
        context.readinessStrengths = graph.readiness.strengths;
        context.documentsMissing = graph.documentsMissing;
        context.documentsUploaded = graph.documentsUploaded;
        context.documentsVerified = graph.documentsVerified;
        context.daysSinceLastActivity = graph.predictiveSignals.daysSinceLastActivity;
        context.engagementLevel = graph.predictiveSignals.engagementLevel;
        context.suggestedNextAction = graph.predictiveSignals.suggestedNextAction;

        const selfEmployed = employmentHistory?.some(e => e.isSelfEmployed);
        const multipleIncomes = (employmentHistory?.length || 0) > 1;
        context.hasMultipleIncomes = multipleIncomes;
        context.hasBusinessIncome = selfEmployed || false;
      }
    } catch (e) {
      console.warn("[Coach] Could not enrich context from Borrower Graph:", e);
    }

    if (propertyContext) {
      context.propertyContext = propertyContext;
    }

    context.userType = deriveUserType(context);
    context.readinessState = deriveReadinessState(context);
    context.completionPercentage = deriveCompletionPercentage(context);
    context.completedSteps = deriveCompletedSteps(context);

    return context;
  } catch (error) {
    console.error("[Coach] Error building verified context:", error);
    return { hasApplication: false };
  }
}

function getLatestIntakeFromConversation(
  conversation: any,
  latestResponse?: { intake?: CoachIntakeData }
): CoachIntakeData | null {
  const intake: CoachIntakeData = {};
  
  const existingProfile = conversation.financialProfile as any;
  if (existingProfile) {
    if (existingProfile.annualIncome) intake.annualIncome = String(existingProfile.annualIncome);
    if (existingProfile.creditScore) intake.creditScore = String(existingProfile.creditScore);
  }

  if (latestResponse?.intake) {
    Object.assign(intake, latestResponse.intake);
  }

  return Object.keys(intake).length > 0 ? intake : null;
}

export function registerCoachRoutes(app: Express) {
  app.get("/api/coach/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversations = await storage.getCoachConversationsByUser(user.id);
      res.json(conversations);
    } catch (error) {
      console.error("Get coach conversations error:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/coach/intake/latest", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversations = await storage.getCoachConversationsByUser(user.id);

      if (!conversations || conversations.length === 0) {
        return res.json(null);
      }

      const sorted = [...conversations].sort((a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
      );

      const intake: CoachIntakeData = {};

      for (const conv of sorted) {
        const messages = await storage.getCoachMessages(conv.id);
        const messagesWithData = messages
          .filter(m => m.role === "assistant" && m.structuredData)
          .sort((a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );

        for (const msg of messagesWithData) {
          const sd = msg.structuredData as any;
          if (sd?.intake) {
            for (const [key, val] of Object.entries(sd.intake)) {
              if (val !== null && val !== undefined && val !== "" && !(key in intake)) {
                (intake as any)[key] = val;
              }
            }
          }
        }
      }

      const latestConv = sorted[0];
      const profile = latestConv.financialProfile as any;
      const readinessTier = latestConv.readinessTier;
      const readinessScore = latestConv.readinessScore;

      res.json({
        intake: Object.keys(intake).length > 0 ? intake : null,
        readinessTier,
        readinessScore,
        profile: profile || null,
        actionPlan: latestConv.actionPlan || null,
        documentChecklist: latestConv.documentChecklist || null,
        updatedAt: latestConv.updatedAt,
      });
    } catch (error) {
      console.error("Get coach intake error:", error);
      res.status(500).json({ error: "Failed to fetch coach intake" });
    }
  });

  app.get("/api/coach/conversations/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversation = await storage.getCoachConversation(req.params.id);
      if (!conversation || conversation.userId !== user.id) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getCoachMessages(conversation.id);
      res.json({ conversation, messages });
    } catch (error) {
      console.error("Get coach conversation error:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/coach/message", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const parsed = messageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid message", details: parsed.error.errors });
      }

      const { message, conversationId, propertyPrice, propertyAddress } = parsed.data;
      const propertyCtx = propertyPrice && propertyAddress
        ? { price: propertyPrice, address: propertyAddress }
        : null;

      const allConvs = await storage.getCoachConversationsByUser(user.id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let todayCount = 0;
      const dailyLimit = 30;
      for (const c of allConvs) {
        const msgs = await storage.getCoachMessages(c.id);
        todayCount += msgs.filter(m =>
          m.role === "user" && m.createdAt && new Date(m.createdAt) >= today
        ).length;
      }
      if (todayCount >= dailyLimit) {
        return res.status(429).json({
          error: "Daily message limit reached",
          remaining: 0,
          dailyLimit,
          resetsAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      let conversation;

      if (conversationId) {
        conversation = await storage.getCoachConversation(conversationId);
        if (!conversation || conversation.userId !== user.id) {
          return res.status(404).json({ error: "Conversation not found" });
        }
      } else {
        conversation = await storage.createCoachConversation({
          userId: user.id,
          title: message.substring(0, 100),
          status: "active",
        });
      }

      await storage.createCoachMessage({
        conversationId: conversation.id,
        role: "user",
        content: message,
      });

      const existingMessages = await storage.getCoachMessages(conversation.id);
      const history = existingMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const verifiedContext = await buildVerifiedContext(user.id, user, propertyCtx);

      const coachResponse = await generateCoachResponse(
        message,
        history,
        conversation.financialProfile,
        verifiedContext,
      );

      const hasStructuredData = coachResponse.profile || coachResponse.intake || coachResponse.actionPlan || coachResponse.documentChecklist;

      const assistantMsg = await storage.createCoachMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: coachResponse.message,
        structuredData: hasStructuredData
          ? {
              profile: coachResponse.profile || null,
              intake: coachResponse.intake || null,
              actionPlan: coachResponse.actionPlan || null,
              documentChecklist: coachResponse.documentChecklist || null,
            }
          : null,
      });

      if (hasStructuredData) {
        const updateData: Record<string, any> = {};
        if (coachResponse.profile) {
          updateData.financialProfile = coachResponse.profile;
          updateData.readinessTier = coachResponse.profile.readinessTier;
          updateData.readinessScore = coachResponse.profile.readinessScore;
          updateData.recommendedLoanTypes = coachResponse.profile.recommendedLoanTypes;
        }
        if (coachResponse.actionPlan) {
          updateData.actionPlan = coachResponse.actionPlan;
        }
        if (coachResponse.documentChecklist) {
          updateData.documentChecklist = coachResponse.documentChecklist;
        }
        await storage.updateCoachConversation(conversation.id, updateData);
      }

      const existingIntake = getLatestIntakeFromConversation(conversation, coachResponse);

      res.json({
        conversationId: conversation.id,
        message: assistantMsg,
        profile: coachResponse.profile || conversation.financialProfile || null,
        intake: existingIntake,
        actionPlan: coachResponse.actionPlan || conversation.actionPlan || null,
        documentChecklist: coachResponse.documentChecklist || conversation.documentChecklist || null,
      });
    } catch (error) {
      console.error("Coach message error:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  app.patch("/api/coach/conversations/:id/action-plan/:itemId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversation = await storage.getCoachConversation(req.params.id);
      if (!conversation || conversation.userId !== user.id) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const plan = (conversation.actionPlan as any[]) || [];
      const itemIndex = plan.findIndex((item: any) => item.id === req.params.itemId);
      if (itemIndex === -1) {
        return res.status(404).json({ error: "Action item not found" });
      }

      plan[itemIndex].completed = !plan[itemIndex].completed;
      await storage.updateCoachConversation(conversation.id, { actionPlan: plan });

      res.json({ actionPlan: plan, toggled: plan[itemIndex] });
    } catch (error) {
      console.error("Toggle action item error:", error);
      res.status(500).json({ error: "Failed to toggle action item" });
    }
  });

  app.get("/api/coach/usage", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversations = await storage.getCoachConversationsByUser(user.id);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let todayCount = 0;
      const dailyLimit = 30;

      for (const conv of conversations) {
        const msgs = await storage.getCoachMessages(conv.id);
        todayCount += msgs.filter(m =>
          m.role === "user" && m.createdAt && new Date(m.createdAt) >= today
        ).length;
      }

      res.json({
        todayCount,
        dailyLimit,
        remaining: Math.max(0, dailyLimit - todayCount),
        isLimited: todayCount >= dailyLimit,
      });
    } catch (error) {
      console.error("Coach usage error:", error);
      res.status(500).json({ error: "Failed to fetch usage" });
    }
  });

  app.get("/api/coach/insights", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const verifiedContext = await buildVerifiedContext(user.id, user);
      const conversations = await storage.getCoachConversationsByUser(user.id);
      const hasAssessment = conversations.some(c => c.financialProfile);
      const totalConversations = conversations.length;

      const insights: Array<{ type: string; title: string; description: string; action?: string }> = [];

      if (verifiedContext.hasApplication && !hasAssessment) {
        insights.push({
          type: "readiness_check",
          title: "Get Your Readiness Assessment",
          description: "You have application data on file. Ask the coach to assess your mortgage readiness for a personalized action plan.",
          action: "Assess my mortgage readiness based on my application",
        });
      }

      if (verifiedContext.hasApplication && verifiedContext.uploadedDocuments) {
        const uploaded = verifiedContext.uploadedDocuments.length;
        if (uploaded === 0) {
          insights.push({
            type: "missing_docs",
            title: "Upload Your Documents",
            description: "No documents uploaded yet. The coach can create a personalized checklist for you.",
            action: "What documents do I need to upload?",
          });
        }
      }

      if (verifiedContext.hasApplication && verifiedContext.creditScore && verifiedContext.creditScore < 680) {
        insights.push({
          type: "credit_improvement",
          title: "Credit Score Tips",
          description: `Your credit score is ${verifiedContext.creditScore}. The coach can help you create a plan to improve it.`,
          action: "How can I improve my credit score for a better mortgage rate?",
        });
      }

      if (verifiedContext.hasApplication && verifiedContext.dtiRatio && parseFloat(verifiedContext.dtiRatio) > 43) {
        insights.push({
          type: "dti_high",
          title: "DTI Ratio Guidance",
          description: `Your debt-to-income ratio is ${verifiedContext.dtiRatio}%. The coach can help you strategize to lower it.`,
          action: "My DTI is high. What can I do to bring it down?",
        });
      }

      if (!verifiedContext.hasApplication && totalConversations === 0) {
        insights.push({
          type: "get_started",
          title: "Start Your Homebuying Journey",
          description: "Chat with the coach to understand what you need for a mortgage and create a personalized plan.",
        });
      }

      res.json({ insights, hasApplication: verifiedContext.hasApplication, hasAssessment });
    } catch (error) {
      console.error("Coach insights error:", error);
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  app.get("/api/coach/profile", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversations = await storage.getCoachConversationsByUser(user.id);
      const activeConv = conversations.find(c => c.financialProfile);
      if (!activeConv) {
        return res.json({ profile: null, actionPlan: null, documentChecklist: null });
      }
      res.json({
        profile: activeConv.financialProfile,
        actionPlan: activeConv.actionPlan,
        documentChecklist: activeConv.documentChecklist,
        readinessTier: activeConv.readinessTier,
        readinessScore: activeConv.readinessScore,
        conversationId: activeConv.id,
      });
    } catch (error) {
      console.error("Get coach profile error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
}
