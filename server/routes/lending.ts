import type { Express } from "express";
import type { IStorage } from "../storage";
import { 
  insertBorrowerDeclarationsSchema,
  isStaffRole,
  type User,
} from "@shared/schema";
import { analyzeLoanApplication } from "../gemini";
import { generateMISMO34XML, type MISMOLoanDTO } from "../mismo";
import { z } from "zod";
import crypto from "crypto";
import { upload } from "./utils";
import { logAudit } from "../auditLog";
import { sendNotificationEmail } from "../services/emailService";

const declarationsValidationSchema = insertBorrowerDeclarationsSchema.partial().extend({
  applicationId: z.string().optional(),
});

const loanApplicationInputSchema = z.object({
  annualIncome: z.string().or(z.number()).transform(v => String(v).replace(/[,$]/g, "")),
  monthlyDebts: z.string().or(z.number()).transform(v => String(v).replace(/[,$]/g, "")),
  creditScore: z.string().or(z.number()).transform(v => {
    const n = parseInt(String(v));
    return isNaN(n) ? 700 : Math.max(300, Math.min(850, n));
  }),
  employmentType: z.string().min(1).max(50).optional(),
  employmentYears: z.string().or(z.number()).transform(v => {
    const n = parseInt(String(v));
    return isNaN(n) ? 0 : Math.max(0, Math.min(80, n));
  }).optional(),
  propertyType: z.string().max(50).optional(),
  purchasePrice: z.string().or(z.number()).transform(v => String(v).replace(/[,$]/g, "")),
  downPayment: z.string().or(z.number()).transform(v => String(v).replace(/[,$]/g, "")),
  loanPurpose: z.string().max(50).optional(),
  isVeteran: z.boolean().optional().default(false),
  isFirstTimeBuyer: z.boolean().optional().default(false),
  propertyState: z.string().max(2).optional(),
});

export function registerLendingRoutes(
  app: Express,
  storage: IStorage,
  isAuthenticated: any,
  isAdmin: any,
) {
  app.get("/api/dashboard", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const [applications, documents, stats, unreadMessages] = await Promise.all([
        storage.getLoanApplicationsByUser(userId),
        storage.getDocumentsByUser(userId),
        storage.getDashboardStats(userId),
        storage.getUnreadMessageCount(userId),
      ]);

      const recentOptions = [];
      for (const app of applications.slice(0, 3)) {
        const options = await storage.getLoanOptionsByApplication(app.id);
        recentOptions.push(...options);
      }

      let pendingTaskCount = 0;
      for (const app of applications) {
        const tasks = await storage.getTasksByApplication(app.id);
        pendingTaskCount += tasks.filter(t => ["pending", "in_progress", "rejected"].includes(t.status)).length;
      }

      res.json({
        applications,
        documents,
        recentOptions: recentOptions.slice(0, 5),
        stats,
        unreadMessages,
        pendingTaskCount,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  });

  // Document Checklist API - shows required documents and their status
  app.get("/api/applications/:applicationId/document-checklist", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;

      // Verify ownership or staff access
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== userId && !isStaffRole((req.user as User).role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get uploaded documents for this application
      const uploadedDocs = await storage.getDocumentsByApplication(applicationId);
      
      // Get tasks that request documents
      const tasks = await storage.getTasksByApplication(applicationId);
      const documentTasks = tasks.filter(t => t.taskType === "document_request");

      // Define standard document requirements based on loan type
      const standardDocs = [
        { type: "w2", label: "W-2 Forms (Last 2 Years)", required: true },
        { type: "pay_stub", label: "Recent Pay Stubs (Last 30 Days)", required: true },
        { type: "tax_return", label: "Tax Returns (Last 2 Years)", required: true },
        { type: "bank_statement", label: "Bank Statements (Last 2 Months)", required: true },
        { type: "id", label: "Government-Issued ID", required: true },
      ];

      // Build document checklist
      const documents = standardDocs.map(doc => {
        const uploaded = uploadedDocs.find(u => u.documentType === doc.type);
        const task = documentTasks.find(t => t.documentCategory === doc.type);
        
        let status: "needed" | "uploaded" | "verifying" | "verified" | "rejected" = "needed";
        if (uploaded) {
          if (uploaded.status === "verified") status = "verified";
          else if (uploaded.status === "rejected") status = "rejected";
          else status = "uploaded";
        } else if (task && task.status === "submitted") {
          status = "verifying";
        }

        return {
          id: uploaded?.id || doc.type,
          documentType: doc.type,
          label: doc.label,
          status,
          fileName: uploaded?.fileName,
          uploadedAt: uploaded?.createdAt?.toISOString(),
          notes: uploaded?.notes || task?.verificationNotes,
          requestingTeam: task?.requestingTeam,
          isCustomRequest: task?.isCustomRequest,
          instructions: task?.documentInstructions,
        };
      });

      // Add any additional document tasks not in standard list (custom requests)
      for (const task of documentTasks) {
        if (!standardDocs.find(d => d.type === task.documentCategory)) {
          const uploaded = uploadedDocs.find(u => u.documentType === task.documentCategory);
          documents.push({
            id: task.id,
            documentType: task.documentCategory || "other",
            label: task.title,
            status: uploaded ? (uploaded.status === "verified" ? "verified" : "uploaded") : "needed",
            fileName: uploaded?.fileName,
            uploadedAt: uploaded?.createdAt?.toISOString(),
            notes: task.documentInstructions,
            requestingTeam: task.requestingTeam,
            isCustomRequest: task.isCustomRequest,
            instructions: task.documentInstructions,
          });
        }
      }

      const stats = {
        total: documents.length,
        verified: documents.filter(d => d.status === "verified").length,
        uploaded: documents.filter(d => d.status === "uploaded" || d.status === "verifying").length,
        needed: documents.filter(d => d.status === "needed").length,
        rejected: documents.filter(d => d.status === "rejected").length,
      };

      res.json({ documents, stats });
    } catch (error) {
      console.error("Document checklist error:", error);
      res.status(500).json({ error: "Failed to load document checklist" });
    }
  });

  // Action Items API - shows pending tasks and required actions
  app.get("/api/applications/:applicationId/action-items", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const user = req.user as User;

      // Verify ownership or staff access
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== user.id && !isStaffRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get all tasks for this application that are borrower-relevant
      // Include tasks assigned to borrower OR unassigned tasks OR document request tasks
      const allTasks = await storage.getTasksByApplication(applicationId);
      const borrowerTasks = allTasks.filter(t => 
        t.assignedToUserId === user.id || 
        !t.assignedToUserId || 
        t.taskType === "document_request"
      );

      // Get conditions that need attention
      const conditions = await storage.getLoanConditionsByApplication(applicationId);
      const outstandingConditions = conditions.filter((c: any) => c.status === "outstanding");

      // Get existing consents for this application
      const existingConsents = await storage.getBorrowerConsentsByApplication(applicationId);
      
      // Check for required consent types that haven't been given
      const requiredConsentTypes = ["credit_pull", "disclosure", "privacy_policy"];
      const givenConsentTypes = existingConsents
        .filter((c: any) => c.consentGiven && !c.isRevoked)
        .map((c: any) => c.consentType);
      const pendingConsentTypes = requiredConsentTypes.filter(type => !givenConsentTypes.includes(type));

      // Build action items list
      const items: any[] = [];

      // Add document tasks that aren't completed/verified
      for (const task of borrowerTasks.filter(t => t.status !== "completed" && t.status !== "verified")) {
        items.push({
          id: task.id,
          type: task.taskType === "document_request" ? "document" : task.taskType,
          title: task.title,
          description: task.description || task.documentInstructions,
          priority: task.priority || "normal",
          dueDate: task.dueDate?.toISOString(),
          status: task.status === "submitted" ? "in_progress" : "pending",
          actionUrl: `/tasks/${task.id}`,
          actionLabel: task.taskType === "document_request" ? "Upload" : "Complete",
        });
      }

      // Add pending consent types as action items
      if (pendingConsentTypes.length > 0) {
        items.push({
          id: `consent-pending`,
          type: "consent",
          title: "Sign Required Disclosures",
          description: `${pendingConsentTypes.length} consent(s) need your signature`,
          priority: "high",
          status: "pending",
          actionUrl: `/econsent/${applicationId}`,
          actionLabel: "Review & Sign",
        });
      }

      // Add outstanding conditions that borrower can address
      for (const condition of outstandingConditions.slice(0, 3)) {
        if (condition.requiredDocumentTypes && condition.requiredDocumentTypes.length > 0) {
          items.push({
            id: `condition-${condition.id}`,
            type: "document",
            title: condition.title,
            description: condition.description,
            priority: condition.priority === "prior_to_approval" ? "urgent" : "normal",
            status: "pending",
            actionUrl: `/documents`,
            actionLabel: "Upload Documents",
          });
        }
      }

      // Sort by priority (urgent first) then by due date
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      items.sort((a, b) => {
        const priorityDiff = (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - 
                            (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return 0;
      });

      const stats = {
        total: items.length,
        urgent: items.filter(i => i.priority === "urgent").length,
        pending: items.filter(i => i.status === "pending").length,
        completed: borrowerTasks.filter(t => t.status === "completed" || t.status === "verified").length,
      };

      res.json({ items, stats });
    } catch (error) {
      console.error("Action items error:", error);
      res.status(500).json({ error: "Failed to load action items" });
    }
  });

  app.post("/api/loan-applications", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const userId = user.id;
      
      const parsed = loanApplicationInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      }
      const formData = parsed.data;
      
      let referringBrokerId: string | undefined = undefined;
      if (user.referredByUserId) {
        referringBrokerId = user.referredByUserId;
      }
      
      const applicationData = {
        userId,
        status: "submitted" as const,
        annualIncome: formData.annualIncome || "0",
        monthlyDebts: formData.monthlyDebts || "0",
        creditScore: formData.creditScore,
        employmentType: formData.employmentType,
        employmentYears: formData.employmentYears || 0,
        propertyType: formData.propertyType,
        purchasePrice: formData.purchasePrice || "0",
        downPayment: formData.downPayment || "0",
        loanPurpose: formData.loanPurpose,
        isVeteran: formData.isVeteran,
        isFirstTimeBuyer: formData.isFirstTimeBuyer,
        propertyState: formData.propertyState,
        referringBrokerId,
      };

      const application = await storage.createLoanApplication(applicationData);
      logAudit(req, "loan_application.created", "loan_application", application.id);

      await storage.createDealActivity({
        applicationId: application.id,
        activityType: "status_change",
        title: "Application Submitted",
        description: "Your loan application has been received and is being analyzed.",
        performedBy: userId,
      });

      await storage.createNotification({
        userId,
        type: "application_submitted",
        title: "Application Received",
        body: "Your mortgage application has been submitted and is being reviewed.",
        entityType: "loan_application",
        entityId: application.id,
        status: "unread",
      });

      if (user.email) {
        sendNotificationEmail({
          type: "application_submitted",
          recipientEmail: user.email,
          data: { borrowerName: user.firstName || "Borrower", applicationId: application.id },
        });
      }

      res.status(201).json(application);

      try {
        await storage.updateLoanApplication(application.id, { status: "analyzing" });

        const analysisResult = await analyzeLoanApplication({
          annualIncome: applicationData.annualIncome,
          monthlyDebts: applicationData.monthlyDebts,
          creditScore: String(formData.creditScore),
          purchasePrice: applicationData.purchasePrice,
          downPayment: applicationData.downPayment,
          propertyType: applicationData.propertyType || "single_family",
          loanPurpose: applicationData.loanPurpose || "purchase",
          isVeteran: applicationData.isVeteran,
          isFirstTimeBuyer: applicationData.isFirstTimeBuyer,
          employmentType: applicationData.employmentType || "employed",
          employmentYears: String(formData.employmentYears || 0),
        });

        const newStatus = analysisResult.isApproved ? "pre_approved" : "denied";
        
        await storage.updateLoanApplication(application.id, {
          status: newStatus,
          preApprovalAmount: analysisResult.preApprovalAmount,
          dtiRatio: analysisResult.dtiRatio,
          ltvRatio: analysisResult.ltvRatio,
          aiAnalysis: analysisResult.analysis,
          aiAnalyzedAt: new Date(),
        });

        for (const scenario of analysisResult.scenarios) {
          await storage.createLoanOption({
            applicationId: application.id,
            ...scenario,
          });
        }

        await storage.createDealActivity({
          applicationId: application.id,
          activityType: "status_change",
          title: analysisResult.isApproved ? "Pre-Approved!" : "Application Review Required",
          description: analysisResult.isApproved 
            ? `Congratulations! You've been pre-approved for up to $${parseFloat(analysisResult.preApprovalAmount).toLocaleString()}`
            : "Your application requires additional review.",
        });

        const borrowerName = user.firstName || "Borrower";
        if (analysisResult.isApproved) {
          await storage.createNotification({
            userId,
            type: "application_pre_approved",
            title: "You've Been Pre-Approved!",
            body: `Congratulations! You've been pre-approved for up to $${parseFloat(analysisResult.preApprovalAmount).toLocaleString()}.`,
            entityType: "loan_application",
            entityId: application.id,
            status: "unread",
          });
          if (user.email) {
            sendNotificationEmail({
              type: "application_pre_approved",
              recipientEmail: user.email,
              data: { borrowerName, amount: parseFloat(analysisResult.preApprovalAmount).toLocaleString(), applicationId: application.id },
            });
          }
        } else {
          await storage.createNotification({
            userId,
            type: "application_denied",
            title: "Application Update",
            body: "Your application requires additional review. Please check your dashboard for details.",
            entityType: "loan_application",
            entityId: application.id,
            status: "unread",
          });
          if (user.email) {
            sendNotificationEmail({
              type: "application_denied",
              recipientEmail: user.email,
              data: { borrowerName },
            });
          }
        }

        if (analysisResult.isApproved) {
          const updatedApp = await storage.getLoanApplication(application.id);
          if (updatedApp) {
            const { initializeLoanPipeline } = await import("../pipelineEngine");
            await initializeLoanPipeline(updatedApp, userId);
            
            await storage.createDealActivity({
              applicationId: application.id,
              activityType: "status_change",
              title: "Document Collection Started",
              description: "Required documents have been identified. Please upload them to continue your application.",
              performedBy: "system",
            });
          }
        }
      } catch (analysisError) {
        console.error("AI analysis error:", analysisError);
        await storage.updateLoanApplication(application.id, { status: "submitted" });
      }
    } catch (error) {
      console.error("Create application error:", error);
      res.status(500).json({ error: "Failed to create application" });
    }
  });

  app.get("/api/loan-applications", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const applications = await storage.getLoanApplicationsByUser(userId);
      res.json(applications);
    } catch (error) {
      console.error("Get applications error:", error);
      res.status(500).json({ error: "Failed to get applications" });
    }
  });

  app.get("/api/loan-applications/:id", isAuthenticated, async (req, res) => {
    try {
      const application = await storage.getLoanApplicationWithAccess(
        req.params.id, 
        req.user!.id, 
        req.user!.role
      );
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const [options, documents, activities] = await Promise.all([
        storage.getLoanOptionsByApplication(req.params.id),
        storage.getDocumentsByApplication(req.params.id),
        storage.getDealActivitiesByApplication(req.params.id),
      ]);

      res.json({
        application,
        options,
        documents,
        activities,
      });
    } catch (error) {
      console.error("Get application error:", error);
      res.status(500).json({ error: "Failed to get application" });
    }
  });

  app.get("/api/loan-applications/:id/options", isAuthenticated, async (req, res) => {
    try {
      const application = await storage.getLoanApplicationWithAccess(
        req.params.id, 
        req.user!.id, 
        req.user!.role
      );
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const options = await storage.getLoanOptionsByApplication(req.params.id);
      
      res.json({
        application,
        options,
      });
    } catch (error) {
      console.error("Get loan options error:", error);
      res.status(500).json({ error: "Failed to get loan options" });
    }
  });

  app.post("/api/loan-options/:id/lock", isAuthenticated, async (req, res) => {
    try {
      const option = await storage.lockLoanOption(req.params.id);
      if (!option) {
        return res.status(404).json({ error: "Loan option not found" });
      }

      await storage.createDealActivity({
        applicationId: option.applicationId,
        activityType: "rate_locked",
        title: "Rate Locked",
        description: `Your ${option.interestRate}% rate has been locked for 30 days.`,
        performedBy: req.user!.id,
      });

      res.json(option);
    } catch (error) {
      console.error("Lock rate error:", error);
      res.status(500).json({ error: "Failed to lock rate" });
    }
  });

  // MISMO 3.4 XML Export Route - GSE compliant loan delivery format
  app.get("/api/loan-applications/:id/mismo-export", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      
      // Only staff roles can export MISMO XML
      if (!isStaffRole(userRole || "")) {
        return res.status(403).json({ error: "Only staff can export MISMO data" });
      }

      const { id } = req.params;
      const mismoData = await storage.getMISMOLoanData(id);
      
      if (!mismoData) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Build the DTO with declarations from storage
      const dto: MISMOLoanDTO = {
        ...mismoData,
      };

      const xml = generateMISMO34XML(dto);
      
      // Set proper headers for XML download
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Content-Disposition", `attachment; filename="mismo-${id}.xml"`);
      res.send(xml);

      await storage.createDealActivity({
        applicationId: id,
        activityType: "note",
        title: "MISMO XML Exported",
        description: "Loan data exported in MISMO 3.4 format for GSE delivery",
        performedBy: req.user!.id,
      });
    } catch (error) {
      console.error("MISMO export error:", error);
      res.status(500).json({ error: "Failed to generate MISMO XML" });
    }
  });

  // Data Quality Scoring API - for broker dashboard (ownership-scoped query)
  app.get("/api/loan-applications/:id/data-quality", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      // Use ownership-scoped query - authorization happens at database level
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role || "");
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const quality = await storage.getApplicationDataQuality(id);
      res.json(quality);
    } catch (error) {
      console.error("Data quality error:", error);
      res.status(500).json({ error: "Failed to get data quality" });
    }
  });

  // Borrower Declarations API - with ownership-scoped query
  app.get("/api/loan-applications/:id/declarations", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      // Use ownership-scoped query - authorization happens at database level
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role || "");
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const declarations = await storage.getBorrowerDeclarations(id);
      res.json(declarations || null);
    } catch (error) {
      console.error("Get declarations error:", error);
      res.status(500).json({ error: "Failed to get declarations" });
    }
  });

  app.post("/api/loan-applications/:id/declarations", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate request body with Zod schema
      const parseResult = declarationsValidationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid declarations data", 
          details: parseResult.error.flatten() 
        });
      }
      
      // Use ownership-scoped query - authorization happens at database level
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role || "");
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const data = { ...parseResult.data, applicationId: id };
      const declarations = await storage.upsertBorrowerDeclarations(data);
      
      await storage.createDealActivity({
        applicationId: id,
        activityType: "note",
        title: "Declarations Updated",
        description: "Borrower declarations have been submitted",
        performedBy: req.user!.id,
      });
      
      res.json(declarations);
    } catch (error) {
      console.error("Save declarations error:", error);
      res.status(500).json({ error: "Failed to save declarations" });
    }
  });

  app.post("/api/documents/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { documentType, applicationId } = req.body;
      const userId = req.user!.id;

      const document = await storage.createDocument({
        userId,
        applicationId: applicationId || null,
        documentType: documentType || "other",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        status: "uploaded",
      });

      if (applicationId) {
        await storage.createDealActivity({
          applicationId,
          activityType: "document_uploaded",
          title: "Document Uploaded",
          description: `${req.file.originalname} has been uploaded.`,
          performedBy: userId,
        });
        
        // Emit document uploaded event for Task Engine
        const { taskEventEmitter } = await import("../services/taskEventEmitter");
        await taskEventEmitter.emitDocumentEvent("DOCUMENT_UPLOADED", {
          applicationId,
          documentId: document.id,
          documentType: documentType || "other",
          triggeredBy: userId,
        });
      }

      res.status(201).json(document);
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  app.get("/api/documents", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const documents = await storage.getDocumentsByUser(userId);
      res.json(documents);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ error: "Failed to get documents" });
    }
  });

  app.patch("/api/loan-applications/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const application = await storage.getLoanApplication(id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const formData = req.body;
      const updateData: any = {
        status: "draft",
      };

      if (formData.annualIncome !== undefined) updateData.annualIncome = formData.annualIncome?.replace(/[,$]/g, "") || "0";
      if (formData.monthlyDebts !== undefined) updateData.monthlyDebts = formData.monthlyDebts?.replace(/[,$]/g, "") || "0";
      if (formData.creditScore !== undefined) updateData.creditScore = parseInt(formData.creditScore) || 700;
      if (formData.employmentType !== undefined) updateData.employmentType = formData.employmentType;
      if (formData.employmentYears !== undefined) updateData.employmentYears = parseInt(formData.employmentYears) || 0;
      if (formData.propertyType !== undefined) updateData.propertyType = formData.propertyType;
      if (formData.purchasePrice !== undefined) updateData.purchasePrice = formData.purchasePrice?.replace(/[,$]/g, "") || "0";
      if (formData.downPayment !== undefined) updateData.downPayment = formData.downPayment?.replace(/[,$]/g, "") || "0";
      if (formData.loanPurpose !== undefined) updateData.loanPurpose = formData.loanPurpose;
      if (formData.isVeteran !== undefined) updateData.isVeteran = formData.isVeteran;
      if (formData.isFirstTimeBuyer !== undefined) updateData.isFirstTimeBuyer = formData.isFirstTimeBuyer;
      if (formData.propertyState !== undefined) updateData.propertyState = formData.propertyState;
      if (formData.employerName !== undefined) updateData.employerName = formData.employerName;
      if (formData.propertyAddress !== undefined) updateData.propertyAddress = formData.propertyAddress;
      if (formData.propertyCity !== undefined) updateData.propertyCity = formData.propertyCity;
      if (formData.propertyZip !== undefined) updateData.propertyZip = formData.propertyZip;

      const updated = await storage.updateLoanApplication(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Update application error:", error);
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  const staffStatusSchema = z.object({
    status: z.enum(["submitted", "in_review", "underwriting", "conditional_approval", "pre_approved", "approved", "denied", "suspended", "withdrawn"]),
    notes: z.string().max(2000).optional(),
  });

  app.patch("/api/loan-applications/:id/status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }

      const { id } = req.params;
      const parsed = staffStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid status", details: parsed.error.errors });
      }

      const application = await storage.getLoanApplication(id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const previousStatus = application.status;
      const { status, notes } = parsed.data;

      const updated = await storage.updateLoanApplication(id, { status });

      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: `Status Updated to ${status.replace(/_/g, " ").toUpperCase()}`,
        description: notes || `Application status changed from ${previousStatus} to ${status}`,
        performedBy: user.id,
      });

      const borrower = await storage.getUser(application.userId);
      if (borrower) {
        const statusLabel = status.replace(/_/g, " ");
        await storage.createNotification({
          userId: borrower.id,
          type: "status_update",
          title: "Application Status Updated",
          body: `Your application status has been updated to: ${statusLabel}`,
          entityType: "loan_application",
          entityId: id,
          status: "unread",
        });

        if (borrower.email) {
          const borrowerName = borrower.firstName || "Borrower";
          if (status === "pre_approved" || status === "approved") {
            sendNotificationEmail({
              type: "application_pre_approved",
              recipientEmail: borrower.email,
              data: {
                borrowerName,
                amount: parseFloat(application.preApprovalAmount || "0").toLocaleString(),
                applicationId: id,
              },
            });
          } else if (status === "denied") {
            sendNotificationEmail({
              type: "application_denied",
              recipientEmail: borrower.email,
              data: { borrowerName },
            });
          } else {
            sendNotificationEmail({
              type: "status_update",
              recipientEmail: borrower.email,
              data: { borrowerName, statusLabel, applicationId: id },
            });
          }
        }
      }

      logAudit(req, "loan_application.status_changed", "loan_application", id, {
        previousStatus,
        newStatus: status,
        changedBy: user.id,
      });

      res.json(updated);
    } catch (error) {
      console.error("Staff status update error:", error);
      res.status(500).json({ error: "Failed to update application status" });
    }
  });

  app.get("/api/loan-applications/draft/latest", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const applications = await storage.getLoanApplicationsByUser(userId);
      
      const draft = applications.find(app => app.status === "draft");
      if (draft) {
        return res.json(draft);
      }
      
      res.json(null);
    } catch (error) {
      console.error("Get draft application error:", error);
      res.status(500).json({ error: "Failed to get draft application" });
    }
  });

  app.post("/api/loan-applications/:id/generate-letter", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      if (application.status !== "pre_approved") {
        return res.status(400).json({ error: "Only pre-approved applications can generate letters" });
      }

      const { generatePreApprovalPDF } = await import("../services/pdfLetterGenerator");

      const letterNumber = `BN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 90);

      const purchasePrice = parseFloat(application.purchasePrice || "0");
      const downPayment = parseFloat(application.downPayment || "0");
      const loanAmount = application.preApprovalAmount || String(purchasePrice - downPayment);

      const conditions = [
        "Satisfactory property appraisal",
        "Verification of employment and income",
        "Clear title search and title insurance",
        "Property insurance in effect prior to closing",
        "No material change in financial condition",
      ];

      const disclaimers = [
        "This pre-approval is not a commitment to lend. Final approval is subject to satisfactory appraisal, title search, and verification of all information provided.",
        "This letter is valid only for the borrower named above and is non-transferable. Terms are subject to change based on market conditions.",
        "The pre-approved amount is based on information provided and preliminary underwriting review. The actual loan amount may differ upon full underwriting.",
        "This pre-approval does not guarantee any specific interest rate. Rate lock is available separately.",
        "Equal Housing Lender. All loans are subject to credit approval.",
      ];

      const borrowerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Borrower";

      const pdfBuffer = await generatePreApprovalPDF({
        letterNumber,
        borrowerName,
        loanAmount,
        productType: application.propertyType === "condo" ? "CONV" : (application.isVeteran ? "VA" : "CONV"),
        occupancy: "Primary",
        loanPurpose: application.loanPurpose || "Purchase",
        companyLegalName: "Baranest Mortgage Corporation",
        companyNmlsId: "123456",
        companyContactInfo: "support@baranest.com | (555) 123-4567",
        expirationDate,
        generatedAt: new Date(),
        conditions,
        disclaimers,
        watermarkApplied: true,
      });

      const storageKey = `letters/${letterNumber}.pdf`;
      let pdfStored = false;
      try {
        const { objectStorageClient } = await import("../replit_integrations/object_storage/objectStorage");
        const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
        if (privateDir) {
          const fullPath = `${privateDir}/${storageKey}`;
          const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          await file.save(pdfBuffer, { contentType: "application/pdf" });
          pdfStored = true;
        }
      } catch (storageErr) {
        console.error("[Letter] Object storage upload failed, will regenerate on demand:", storageErr);
      }

      const { db: database } = await import("../db");
      const { preApprovalLetters, disclaimerVersions, underwritingDecisions } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      let snapshotId: string | null = null;
      try {
        const [snapshot] = await database.select().from(underwritingDecisions)
          .where(eq(underwritingDecisions.loanId, id))
          .orderBy(desc(underwritingDecisions.decidedAt))
          .limit(1);
        snapshotId = snapshot?.id || null;
      } catch {}

      let disclaimerId: string | null = null;
      try {
        const [disc] = await database.select().from(disclaimerVersions).limit(1);
        disclaimerId = disc?.id || null;
      } catch {}

      if (!disclaimerId) {
        try {
          const [fallbackDisc] = await database.insert(disclaimerVersions).values({
            disclaimerType: "primary",
            version: "1.0",
            text: "This pre-approval is not a commitment to lend. Final approval is subject to a satisfactory appraisal, title search, and verification of all information provided.",
            effectiveFrom: new Date(),
          }).returning();
          disclaimerId = fallbackDisc.id;
        } catch (discErr) {
          console.error("[Letter] Fallback disclaimer creation failed:", discErr);
        }
      }

      let letterId: string | null = null;
      try {
        const insertValues: any = {
          letterNumber,
          borrowerName,
          applicationId: id,
          loanAmount,
          productType: application.isVeteran ? "VA" : "CONV",
          occupancy: "Primary",
          loanPurpose: application.loanPurpose || "Purchase",
          expirationDate,
          companyLegalName: "Baranest Mortgage Corporation",
          companyNmlsId: "123456",
          companyContactInfo: "support@baranest.com | (555) 123-4567",
          loanOfficerId: isStaffRole(user.role) ? user.id : undefined,
          pdfStorageKey: pdfStored ? storageKey : undefined,
          pdfGeneratedAt: new Date(),
        };

        if (snapshotId) {
          insertValues.underwritingSnapshotId = snapshotId;
        }
        if (disclaimerId) {
          insertValues.primaryDisclaimerId = disclaimerId;
          insertValues.brokerRoleDisclaimerId = disclaimerId;
          insertValues.documentRelianceDisclaimerId = disclaimerId;
          insertValues.changeInCircumstanceDisclaimerId = disclaimerId;
          insertValues.systemGeneratedDisclaimerId = disclaimerId;
        }

        const [letter] = await database.insert(preApprovalLetters).values(insertValues).returning();
        letterId = letter?.id || null;
      } catch (dbErr) {
        console.error("[Letter] DB insert failed:", dbErr);
      }

      await storage.createNotification({
        userId: user.id,
        type: "pre_approval_letter_ready",
        title: "Pre-Approval Letter Ready",
        body: `Your pre-approval letter #${letterNumber} is ready for download.`,
        entityType: "pre_approval_letter",
        entityId: letterId || id,
        status: "unread",
      });

      if (user.email) {
        sendNotificationEmail({
          type: "pre_approval_letter_ready",
          recipientEmail: user.email,
          data: {
            borrowerName,
            amount: parseFloat(loanAmount).toLocaleString(),
            letterNumber,
          },
        });
      }

      logAudit(req, "pre_approval_letter.generated", "pre_approval_letter", letterId || letterNumber);

      res.json({
        letterNumber,
        letterId,
        loanAmount,
        expirationDate,
        pdfAvailable: true,
        pdfStored,
      });
    } catch (error) {
      console.error("Generate letter error:", error);
      res.status(500).json({ error: "Failed to generate pre-approval letter" });
    }
  });

  app.get("/api/loan-applications/:id/letter-pdf", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../db");
      const { preApprovalLetters } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [letter] = await database.select().from(preApprovalLetters)
        .where(eq(preApprovalLetters.applicationId, id))
        .orderBy(desc(preApprovalLetters.createdAt))
        .limit(1);

      if (letter?.pdfStorageKey) {
        try {
          const { objectStorageClient } = await import("../replit_integrations/object_storage/objectStorage");
          const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
          const fullPath = `${privateDir}/${letter.pdfStorageKey}`;
          const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          const [exists] = await file.exists();
          if (exists) {
            const [contents] = await file.download();
            logAudit(req, "pre_approval_letter.downloaded", "pre_approval_letter", letter.id);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${letter.letterNumber}.pdf"`);
            return res.send(contents);
          }
        } catch (storageErr) {
          console.error("[Letter] Storage download failed, regenerating:", storageErr);
        }
      }

      const { generatePreApprovalPDF } = await import("../services/pdfLetterGenerator");
      const purchasePrice = parseFloat(application.purchasePrice || "0");
      const downPayment = parseFloat(application.downPayment || "0");
      const loanAmount = application.preApprovalAmount || String(purchasePrice - downPayment);
      const borrowerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Borrower";

      const pdfBuffer = await generatePreApprovalPDF({
        letterNumber: letter?.letterNumber || `BN-${Date.now().toString(36).toUpperCase()}`,
        borrowerName,
        loanAmount,
        productType: application.isVeteran ? "VA" : "CONV",
        occupancy: "Primary",
        loanPurpose: application.loanPurpose || "Purchase",
        companyLegalName: "Baranest Mortgage Corporation",
        companyNmlsId: "123456",
        companyContactInfo: "support@baranest.com | (555) 123-4567",
        expirationDate: letter?.expirationDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        generatedAt: letter?.generatedAt || new Date(),
        conditions: [
          "Satisfactory property appraisal",
          "Verification of employment and income",
          "Clear title search and title insurance",
          "Property insurance in effect prior to closing",
          "No material change in financial condition",
        ],
        disclaimers: [],
        watermarkApplied: true,
      });

      logAudit(req, "pre_approval_letter.downloaded", "pre_approval_letter", letter?.id || id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="pre-approval-${id.substring(0, 8)}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Download letter PDF error:", error);
      res.status(500).json({ error: "Failed to download pre-approval letter" });
    }
  });

  app.get("/api/loan-applications/:id/letter-status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../db");
      const { preApprovalLetters } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [letter] = await database.select().from(preApprovalLetters)
        .where(eq(preApprovalLetters.applicationId, id))
        .orderBy(desc(preApprovalLetters.createdAt))
        .limit(1);

      if (!letter) {
        return res.json({ hasLetter: false });
      }

      res.json({
        hasLetter: true,
        letterNumber: letter.letterNumber,
        status: letter.status,
        expirationDate: letter.expirationDate,
        generatedAt: letter.generatedAt,
        pdfAvailable: !!(letter.pdfStorageKey || letter.pdfGeneratedAt),
      });
    } catch (error) {
      console.error("Letter status error:", error);
      res.status(500).json({ error: "Failed to check letter status" });
    }
  });
}
