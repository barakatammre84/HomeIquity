import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import { analyzeLoanApplication } from "./gemini";
import { generateMISMO34XML, type MISMOLoanDTO } from "./mismo";
import { seedDatabase } from "./seed";
import { 
  insertLoanApplicationSchema, 
  insertBorrowerDeclarationsSchema,
  insertContentCategorySchema,
  insertArticleSchema,
  insertFaqSchema,
  insertCalculatorResultSchema,
  insertHomeownershipGoalSchema,
  insertCreditActionSchema,
  insertSavingsTransactionSchema,
  insertJourneyMilestoneSchema,
  insertApplicationInviteSchema,
  insertDocumentPackageSchema,
  insertDocumentPackageItemSchema,
  ALL_ROLES,
  STAFF_ROLES,
  isStaffRole,
  type User,
} from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";
import { 
  qualifyIncome, 
  verifyAssets, 
  assessLiabilities, 
  calculateDTI, 
  checkPropertyEligibility 
} from "./underwriting";
import { calculateLLPA, getAreaMedianIncome } from "./pricing";
import {
  extractTaxReturnData,
  extractPayStubData,
  extractBankStatementData,
} from "./extractionService";
import * as creditService from "./services/creditService";

// Validation schema for declarations with boolean coercion
const declarationsValidationSchema = insertBorrowerDeclarationsSchema.partial().extend({
  applicationId: z.string().optional(),
});
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);
  await seedDatabase();

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
      
      const formData = req.body;
      
      // Check if user was referred by someone - set as referring broker for commissions
      let referringBrokerId: string | undefined = undefined;
      if (user.referredByUserId) {
        referringBrokerId = user.referredByUserId;
      }
      
      const applicationData = {
        userId,
        status: "submitted" as const,
        annualIncome: formData.annualIncome?.replace(/[,$]/g, "") || "0",
        monthlyDebts: formData.monthlyDebts?.replace(/[,$]/g, "") || "0",
        creditScore: parseInt(formData.creditScore) || 700,
        employmentType: formData.employmentType,
        employmentYears: parseInt(formData.employmentYears) || 0,
        propertyType: formData.propertyType,
        purchasePrice: formData.purchasePrice?.replace(/[,$]/g, "") || "0",
        downPayment: formData.downPayment?.replace(/[,$]/g, "") || "0",
        loanPurpose: formData.loanPurpose,
        isVeteran: formData.isVeteran || false,
        isFirstTimeBuyer: formData.isFirstTimeBuyer || false,
        propertyState: formData.propertyState,
        referringBrokerId,
      };

      const application = await storage.createLoanApplication(applicationData);

      await storage.createDealActivity({
        applicationId: application.id,
        activityType: "status_change",
        title: "Application Submitted",
        description: "Your loan application has been received and is being analyzed.",
        performedBy: userId,
      });

      res.status(201).json(application);

      try {
        await storage.updateLoanApplication(application.id, { status: "analyzing" });

        const analysisResult = await analyzeLoanApplication({
          annualIncome: applicationData.annualIncome,
          monthlyDebts: applicationData.monthlyDebts,
          creditScore: formData.creditScore,
          purchasePrice: applicationData.purchasePrice,
          downPayment: applicationData.downPayment,
          propertyType: applicationData.propertyType || "single_family",
          loanPurpose: applicationData.loanPurpose || "purchase",
          isVeteran: applicationData.isVeteran,
          isFirstTimeBuyer: applicationData.isFirstTimeBuyer,
          employmentType: applicationData.employmentType || "employed",
          employmentYears: formData.employmentYears || "0",
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

        if (analysisResult.isApproved) {
          const updatedApp = await storage.getLoanApplication(application.id);
          if (updatedApp) {
            const { initializeLoanPipeline } = await import("./pipelineEngine");
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
        const { taskEventEmitter } = await import("./services/taskEventEmitter");
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

  // ============================================================================
  // AI DOCUMENT EXTRACTION ENDPOINTS
  // ============================================================================

  app.post("/api/documents/:id/extract", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.userId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { documentYear } = req.body;
      let extractedData: any;

      switch (document.documentType) {
        case "tax_return":
          extractedData = await extractTaxReturnData(document.storagePath, documentYear);
          break;
        case "pay_stub":
          extractedData = await extractPayStubData(document.storagePath);
          break;
        case "bank_statement":
          extractedData = await extractBankStatementData(document.storagePath);
          break;
        default:
          return res.status(400).json({ 
            error: "Document type not supported for extraction",
            supportedTypes: ["tax_return", "pay_stub", "bank_statement"]
          });
      }

      await storage.updateDocument(id, {
        status: extractedData.confidence === "high" ? "verified" : "uploaded",
        notes: JSON.stringify({
          extractedAt: new Date().toISOString(),
          extractedFields: extractedData.extractedFields,
          confidence: extractedData.confidence,
          warnings: extractedData.warnings,
        }),
      });

      // Emit task events based on extraction result
      if (document.applicationId) {
        const { taskEventEmitter } = await import("./services/taskEventEmitter");
        
        if (extractedData.confidence === "low" || (extractedData.warnings && extractedData.warnings.length > 0)) {
          // OCR quality issue - create review task
          await taskEventEmitter.emitDocumentEvent("DOCUMENT_OCR_ISSUE", {
            applicationId: document.applicationId,
            documentId: id,
            documentType: document.documentType,
            errorMessage: extractedData.warnings?.join(", ") || "Low confidence extraction",
            triggeredBy: req.user!.id,
          });
        }
      }

      res.json({
        documentId: id,
        documentType: document.documentType,
        ...extractedData,
      });
    } catch (error) {
      console.error("Document extraction error:", error);
      
      // Emit extraction failure event if we have application context
      const document = await storage.getDocument(req.params.id);
      if (document?.applicationId) {
        const { taskEventEmitter } = await import("./services/taskEventEmitter");
        await taskEventEmitter.emitDocumentEvent("DOCUMENT_EXTRACTION_FAILED", {
          applicationId: document.applicationId,
          documentId: req.params.id,
          documentType: document.documentType,
          errorMessage: error instanceof Error ? error.message : "Unknown extraction error",
        });
      }
      
      res.status(500).json({ error: "Failed to extract document data" });
    }
  });

  app.post("/api/documents/extract-tax-return", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { documentYear, applicationId } = req.body;
      const userId = req.user!.id;

      const document = await storage.createDocument({
        userId,
        applicationId: applicationId || null,
        documentType: "tax_return",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        status: "uploaded",
      });

      const extractedData = await extractTaxReturnData(req.file.path, documentYear);

      await storage.updateDocument(document.id, {
        status: extractedData.confidence === "high" ? "verified" : "uploaded",
        notes: JSON.stringify({
          extractedAt: new Date().toISOString(),
          extractedFields: extractedData.extractedFields,
          confidence: extractedData.confidence,
          warnings: extractedData.warnings,
        }),
      });

      if (applicationId) {
        await storage.createDealActivity({
          applicationId,
          activityType: "document_uploaded",
          title: "Tax Return Extracted",
          description: `Tax return for ${documentYear || extractedData.documentYear} extracted with ${extractedData.confidence} confidence.`,
          performedBy: userId,
          metadata: { documentId: document.id, extractedData },
        });
      }

      res.status(201).json({
        document,
        extraction: {
          documentType: "tax_return",
          ...extractedData,
        },
      });
    } catch (error) {
      console.error("Tax return extraction error:", error);
      res.status(500).json({ error: "Failed to extract tax return" });
    }
  });

  app.post("/api/documents/extract-paystub", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { applicationId } = req.body;
      const userId = req.user!.id;

      const document = await storage.createDocument({
        userId,
        applicationId: applicationId || null,
        documentType: "pay_stub",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        status: "uploaded",
      });

      const extractedData = await extractPayStubData(req.file.path);

      await storage.updateDocument(document.id, {
        status: extractedData.confidence === "high" ? "verified" : "uploaded",
        notes: JSON.stringify({
          extractedAt: new Date().toISOString(),
          extractedFields: extractedData.extractedFields,
          confidence: extractedData.confidence,
          warnings: extractedData.warnings,
        }),
      });

      if (applicationId) {
        await storage.createDealActivity({
          applicationId,
          activityType: "document_uploaded",
          title: "Pay Stub Extracted",
          description: `Pay stub extracted with ${extractedData.confidence} confidence. Gross pay: ${extractedData.grossPay ? '$' + extractedData.grossPay.toLocaleString() : 'not extracted'}`,
          performedBy: userId,
          metadata: { documentId: document.id, extractedData },
        });
      }

      res.status(201).json({
        document,
        extraction: {
          documentType: "pay_stub",
          ...extractedData,
        },
      });
    } catch (error) {
      console.error("Pay stub extraction error:", error);
      res.status(500).json({ error: "Failed to extract pay stub" });
    }
  });

  app.post("/api/documents/extract-bank-statement", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { applicationId } = req.body;
      const userId = req.user!.id;

      const document = await storage.createDocument({
        userId,
        applicationId: applicationId || null,
        documentType: "bank_statement",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        status: "uploaded",
      });

      const extractedData = await extractBankStatementData(req.file.path);

      await storage.updateDocument(document.id, {
        status: extractedData.confidence === "high" ? "verified" : "uploaded",
        notes: JSON.stringify({
          extractedAt: new Date().toISOString(),
          extractedFields: extractedData.extractedFields,
          confidence: extractedData.confidence,
          warnings: extractedData.warnings,
        }),
      });

      if (applicationId) {
        await storage.createDealActivity({
          applicationId,
          activityType: "document_uploaded",
          title: "Bank Statement Extracted",
          description: `Bank statement extracted with ${extractedData.confidence} confidence. Closing balance: ${extractedData.closingBalance ? '$' + extractedData.closingBalance.toLocaleString() : 'not extracted'}`,
          performedBy: userId,
          metadata: { documentId: document.id, extractedData },
        });
      }

      res.status(201).json({
        document,
        extraction: {
          documentType: "bank_statement",
          ...extractedData,
        },
      });
    } catch (error) {
      console.error("Bank statement extraction error:", error);
      res.status(500).json({ error: "Failed to extract bank statement" });
    }
  });

  app.get("/api/properties", async (req, res) => {
    try {
      const { search, type, minPrice, maxPrice } = req.query;
      
      const properties = await storage.getAllProperties({
        search: search as string,
        type: type as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      });
      
      res.json(properties);
    } catch (error) {
      console.error("Get properties error:", error);
      res.status(500).json({ error: "Failed to get properties" });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Get property error:", error);
      res.status(500).json({ error: "Failed to get property" });
    }
  });

  // Affordability check API - Uses underwriting engine to determine if buyer qualifies
  app.post("/api/properties/:id/affordability", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Get user's latest pre-approved loan application
      const applications = await storage.getLoanApplicationsByUser(userId);
      const preApproval = applications.find(
        app => app.status === "pre_approved" || app.status === "approved"
      ) || applications[0];

      if (!preApproval) {
        return res.status(400).json({ 
          error: "No loan application found",
          message: "Please complete a pre-approval application first"
        });
      }

      // Validate required financial data exists
      const annualIncome = preApproval.annualIncome ? parseFloat(String(preApproval.annualIncome)) : 0;
      if (annualIncome <= 0) {
        return res.status(400).json({ 
          error: "Incomplete application",
          message: "Your loan application is missing income information"
        });
      }

      const preApprovalAmount = preApproval.preApprovalAmount 
        ? parseFloat(String(preApproval.preApprovalAmount))
        : 0;
      const monthlyIncome = annualIncome / 12;
      const monthlyDebts = preApproval.monthlyDebts 
        ? parseFloat(String(preApproval.monthlyDebts))
        : 0;
      const creditScore = preApproval.creditScore || 720;

      const price = parseFloat(property.price);
      const downPaymentPercent = req.body.downPaymentPercent || 5;
      
      // Use underwriting engine to check property eligibility
      const eligibility = checkPropertyEligibility(
        preApprovalAmount * 0.2, // Estimate assets as 20% of pre-approval for down payment capacity
        monthlyIncome,
        monthlyDebts,
        price,
        property.propertyType || "single_family",
        undefined, // property tax - will use default estimate
        undefined, // HOA
        Math.max(100, price * 0.003 / 12), // insurance estimate based on property value
        100 - downPaymentPercent // max LTV
      );

      // Determine status using GSE-aligned thresholds
      let status: "qualified" | "stretch" | "not_qualified" = "qualified";
      
      // Check price vs pre-approval
      if (price > preApprovalAmount) {
        status = "not_qualified";
      }
      
      // Check DTI
      if (!eligibility.canBuyProperty || eligibility.finalDTI > 50) {
        status = "not_qualified";
      } else if (eligibility.finalDTI > 43) {
        if (status !== "not_qualified") status = "stretch";
      }

      res.json({
        canAfford: status !== "not_qualified",
        status,
        estimatedPayment: eligibility.estimatedPITI,
        dtiWithProperty: eligibility.finalDTI,
        requiredDownPayment: eligibility.requiredDownPayment,
        loanAmount: eligibility.maxLoanAmount,
        ltvRatio: eligibility.ltvRatio,
        reasons: eligibility.reasons,
        preApprovalAmount,
        monthlyIncome,
        creditScore,
      });
    } catch (error) {
      console.error("Affordability check error:", error);
      res.status(500).json({ error: "Failed to check affordability" });
    }
  });

  // Property CRUD for agents
  app.post("/api/properties", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const agentProfile = await storage.getAgentProfileByUserId(userId);
      
      if (!agentProfile) {
        return res.status(403).json({ error: "Agent profile required to create listings" });
      }

      const propertyData = {
        ...req.body,
        agentId: agentProfile.id,
        listedAt: new Date(),
      };

      const property = await storage.createProperty(propertyData);
      
      await storage.updateAgentProfile(agentProfile.id, {
        activeListings: (agentProfile.activeListings || 0) + 1,
      });

      res.status(201).json(property);
    } catch (error) {
      console.error("Create property error:", error);
      res.status(500).json({ error: "Failed to create property" });
    }
  });

  app.patch("/api/properties/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const agentProfile = await storage.getAgentProfileByUserId(userId);
      if (!agentProfile || property.agentId !== agentProfile.id) {
        return res.status(403).json({ error: "Not authorized to update this property" });
      }

      const updated = await storage.updateProperty(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Update property error:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });

  app.delete("/api/properties/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const agentProfile = await storage.getAgentProfileByUserId(userId);
      if (!agentProfile || property.agentId !== agentProfile.id) {
        return res.status(403).json({ error: "Not authorized to delete this property" });
      }

      await storage.deleteProperty(req.params.id);
      
      if (property.status === "active") {
        await storage.updateAgentProfile(agentProfile.id, {
          activeListings: Math.max((agentProfile.activeListings || 1) - 1, 0),
        });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Delete property error:", error);
      res.status(500).json({ error: "Failed to delete property" });
    }
  });

  // Agent Profile Routes
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAllAgentProfiles();
      res.json(agents);
    } catch (error) {
      console.error("Get agents error:", error);
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  app.get("/api/agents/:agentId", async (req, res) => {
    try {
      const agent = await storage.getAgentProfile(req.params.agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const user = await storage.getUser(agent.userId);
      res.json({
        ...agent,
        user: user ? { email: user.email, firstName: user.firstName, lastName: user.lastName } : undefined,
      });
    } catch (error) {
      console.error("Get agent error:", error);
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  app.get("/api/agents/:agentId/listings", async (req, res) => {
    try {
      const properties = await storage.getPropertiesByAgent(req.params.agentId);
      res.json(properties.filter(p => p.status === "active"));
    } catch (error) {
      console.error("Get agent listings error:", error);
      res.status(500).json({ error: "Failed to get agent listings" });
    }
  });

  // Current user agent profile routes
  app.get("/api/me/agent-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      let profile = await storage.getAgentProfileByUserId(userId);
      
      if (!profile) {
        profile = await storage.createAgentProfile({ userId });
      }
      
      const user = await storage.getUser(userId);
      res.json({
        ...profile,
        user: user ? { email: user.email, firstName: user.firstName, lastName: user.lastName } : undefined,
      });
    } catch (error) {
      console.error("Get my agent profile error:", error);
      res.status(500).json({ error: "Failed to get agent profile" });
    }
  });

  app.patch("/api/me/agent-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      let profile = await storage.getAgentProfileByUserId(userId);
      
      if (!profile) {
        profile = await storage.createAgentProfile({ userId, ...req.body });
      } else {
        profile = await storage.updateAgentProfile(profile.id, req.body);
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Update agent profile error:", error);
      res.status(500).json({ error: "Failed to update agent profile" });
    }
  });

  app.get("/api/me/listings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const profile = await storage.getAgentProfileByUserId(userId);
      
      if (!profile) {
        return res.json([]);
      }
      
      const properties = await storage.getPropertiesByAgent(profile.id);
      res.json(properties);
    } catch (error) {
      console.error("Get my listings error:", error);
      res.status(500).json({ error: "Failed to get listings" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, async (req, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ error: "Failed to get admin stats" });
    }
  });

  app.get("/api/admin/applications", isAuthenticated, async (req, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const applications = await storage.getAllLoanApplications();
      res.json(applications);
    } catch (error) {
      console.error("Admin applications error:", error);
      res.status(500).json({ error: "Failed to get applications" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, async (req, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  // Broker Referral Dashboard endpoints
  app.get("/api/broker/referrals", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const referrals = await storage.getBrokerReferrals(user.id);
      res.json(referrals);
    } catch (error) {
      console.error("Get broker referrals error:", error);
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });

  app.get("/api/broker/stats", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const stats = await storage.getBrokerReferralStats(user.id);
      res.json(stats);
    } catch (error) {
      console.error("Get broker stats error:", error);
      res.status(500).json({ error: "Failed to get broker stats" });
    }
  });

  app.get("/api/broker/commissions", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const commissions = await storage.getBrokerCommissions(user.id);
      res.json(commissions);
    } catch (error) {
      console.error("Get broker commissions error:", error);
      res.status(500).json({ error: "Failed to get commissions" });
    }
  });

  app.post("/api/broker/commissions", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { brokerId, applicationId, loanAmount, commissionRate } = req.body;
      
      if (!brokerId || !applicationId || !loanAmount || !commissionRate) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const commissionAmount = (Number(loanAmount) * Number(commissionRate)).toFixed(2);
      
      const commission = await storage.createBrokerCommission({
        brokerId,
        applicationId,
        loanAmount: loanAmount.toString(),
        commissionRate: commissionRate.toString(),
        commissionAmount,
        status: "pending",
      });
      
      res.status(201).json(commission);
    } catch (error) {
      console.error("Create broker commission error:", error);
      res.status(500).json({ error: "Failed to create commission" });
    }
  });

  app.patch("/api/broker/commissions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { id } = req.params;
      const updateData = { ...req.body };
      
      if (updateData.status === "paid" && !updateData.paidAt) {
        updateData.paidAt = new Date();
        updateData.paidBy = user.id;
      }
      
      const updated = await storage.updateBrokerCommission(id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Commission not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Update broker commission error:", error);
      res.status(500).json({ error: "Failed to update commission" });
    }
  });

  app.get("/api/admin/commissions/pending", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const commissions = await storage.getAllPendingCommissions();
      res.json(commissions);
    } catch (error) {
      console.error("Get pending commissions error:", error);
      res.status(500).json({ error: "Failed to get pending commissions" });
    }
  });

  // Calculator Results endpoints
  app.post("/api/calculator-results", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      const validationResult = insertCalculatorResultSchema.safeParse({
        ...req.body,
        userId: user.id,
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validationResult.error.errors 
        });
      }
      
      const calculatorResult = await storage.createCalculatorResult(validationResult.data);
      
      res.status(201).json(calculatorResult);
    } catch (error) {
      console.error("Create calculator result error:", error);
      res.status(500).json({ error: "Failed to save calculator results" });
    }
  });

  app.get("/api/calculator-results", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const results = await storage.getCalculatorResultsByUser(user.id);
      res.json(results);
    } catch (error) {
      console.error("Get calculator results error:", error);
      res.status(500).json({ error: "Failed to get calculator results" });
    }
  });

  app.get("/api/calculator-results/:type", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { type } = req.params;
      const result = await storage.getLatestCalculatorResult(user.id, type);
      
      if (!result) {
        return res.status(404).json({ error: "No results found" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Get calculator result error:", error);
      res.status(500).json({ error: "Failed to get calculator result" });
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

  app.patch("/api/admin/users/:id/role", isAuthenticated, async (req, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { role } = req.body;
      if (!ALL_ROLES.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      const user = await storage.updateUserRole(req.params.id, role);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Update user role error:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // Application Properties Routes - multi-property support
  app.get("/api/loan-applications/:id/properties", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      const properties = await storage.getApplicationProperties(id);
      res.json(properties);
    } catch (error) {
      console.error("Get application properties error:", error);
      res.status(500).json({ error: "Failed to get properties" });
    }
  });

  app.get("/api/loan-applications/:id/current-property", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      const property = await storage.getCurrentProperty(id);
      res.json(property || null);
    } catch (error) {
      console.error("Get current property error:", error);
      res.status(500).json({ error: "Failed to get current property" });
    }
  });

  app.post("/api/loan-applications/:id/properties", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const propertyData = {
        applicationId: id,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        zipCode: req.body.zipCode,
        propertyType: req.body.propertyType,
        purchasePrice: req.body.purchasePrice?.toString().replace(/[,$]/g, "") || "0",
        downPayment: req.body.downPayment?.toString().replace(/[,$]/g, "") || "0",
        isCurrentProperty: true,
        status: "active" as const,
        offerAmount: req.body.offerAmount?.toString().replace(/[,$]/g, ""),
        offerDate: req.body.offerDate ? new Date(req.body.offerDate) : undefined,
        offerStatus: req.body.offerStatus,
      };

      const property = await storage.createApplicationProperty(propertyData);

      // Also update the main application with the new property details
      await storage.updateLoanApplication(id, {
        propertyAddress: property.address,
        propertyCity: property.city || undefined,
        propertyState: property.state || undefined,
        propertyZip: property.zipCode || undefined,
        propertyType: property.propertyType || undefined,
        purchasePrice: property.purchasePrice,
        downPayment: property.downPayment || undefined,
      });

      // Log the activity
      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: "New Property Added",
        description: `Property at ${property.address} has been added to the application.`,
        performedBy: req.user!.id,
      });

      res.status(201).json(property);
    } catch (error) {
      console.error("Create application property error:", error);
      res.status(500).json({ error: "Failed to add property" });
    }
  });

  app.post("/api/loan-applications/:id/properties/:propertyId/switch", isAuthenticated, async (req, res) => {
    try {
      const { id, propertyId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const property = await storage.switchToProperty(id, propertyId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Update the main application with the switched property details
      await storage.updateLoanApplication(id, {
        propertyAddress: property.address,
        propertyCity: property.city || undefined,
        propertyState: property.state || undefined,
        propertyZip: property.zipCode || undefined,
        propertyType: property.propertyType || undefined,
        purchasePrice: property.purchasePrice,
        downPayment: property.downPayment || undefined,
      });

      // Log the activity
      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: "Property Switched",
        description: `Application property changed to ${property.address}.`,
        performedBy: req.user!.id,
      });

      res.json(property);
    } catch (error) {
      console.error("Switch property error:", error);
      res.status(500).json({ error: "Failed to switch property" });
    }
  });

  app.post("/api/loan-applications/:id/properties/:propertyId/deal-fell-through", isAuthenticated, async (req, res) => {
    try {
      const { id, propertyId } = req.params;
      const { reason } = req.body;
      
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const property = await storage.markDealFellThrough(propertyId, reason || "Deal did not proceed");
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Log the activity
      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: "Deal Fell Through",
        description: `The deal for ${property.address} did not proceed. Reason: ${reason || "Not specified"}`,
        performedBy: req.user!.id,
      });

      res.json(property);
    } catch (error) {
      console.error("Mark deal fell through error:", error);
      res.status(500).json({ error: "Failed to update property status" });
    }
  });

  app.patch("/api/loan-applications/:id/properties/:propertyId", isAuthenticated, async (req, res) => {
    try {
      const { id, propertyId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const updateData: any = {};
      if (req.body.address !== undefined) updateData.address = req.body.address;
      if (req.body.city !== undefined) updateData.city = req.body.city;
      if (req.body.state !== undefined) updateData.state = req.body.state;
      if (req.body.zipCode !== undefined) updateData.zipCode = req.body.zipCode;
      if (req.body.propertyType !== undefined) updateData.propertyType = req.body.propertyType;
      if (req.body.purchasePrice !== undefined) updateData.purchasePrice = req.body.purchasePrice?.toString().replace(/[,$]/g, "");
      if (req.body.downPayment !== undefined) updateData.downPayment = req.body.downPayment?.toString().replace(/[,$]/g, "");
      if (req.body.offerAmount !== undefined) updateData.offerAmount = req.body.offerAmount?.toString().replace(/[,$]/g, "");
      if (req.body.offerStatus !== undefined) updateData.offerStatus = req.body.offerStatus;
      if (req.body.status !== undefined) updateData.status = req.body.status;

      const property = await storage.updateApplicationProperty(propertyId, updateData);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // If this is the current property, also update the main application
      if (property.isCurrentProperty) {
        await storage.updateLoanApplication(id, {
          propertyAddress: property.address,
          propertyCity: property.city || undefined,
          propertyState: property.state || undefined,
          propertyZip: property.zipCode || undefined,
          propertyType: property.propertyType || undefined,
          purchasePrice: property.purchasePrice,
          downPayment: property.downPayment || undefined,
        });
      }

      res.json(property);
    } catch (error) {
      console.error("Update application property error:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });

  // URLA Data Routes
  app.get("/api/urla/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      const urlaData = await storage.getCompleteUrlaData(applicationId);
      res.json({ application, ...urlaData });
    } catch (error) {
      console.error("Get URLA data error:", error);
      res.status(500).json({ error: "Failed to get URLA data" });
    }
  });

  app.post("/api/urla/:applicationId/personal-info", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.upsertUrlaPersonalInfo(data);
      res.json(result);
    } catch (error) {
      console.error("Save personal info error:", error);
      res.status(500).json({ error: "Failed to save personal info" });
    }
  });

  app.post("/api/urla/:applicationId/employment", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.createEmploymentHistory(data);
      res.status(201).json(result);
    } catch (error) {
      console.error("Create employment error:", error);
      res.status(500).json({ error: "Failed to create employment record" });
    }
  });

  app.patch("/api/urla/employment/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.updateEmploymentHistory(id, req.body);
      if (!result) {
        return res.status(404).json({ error: "Employment record not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Update employment error:", error);
      res.status(500).json({ error: "Failed to update employment record" });
    }
  });

  app.delete("/api/urla/employment/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteEmploymentHistory(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete employment error:", error);
      res.status(500).json({ error: "Failed to delete employment record" });
    }
  });

  app.post("/api/urla/:applicationId/other-income", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.createOtherIncomeSource(data);
      res.status(201).json(result);
    } catch (error) {
      console.error("Create other income error:", error);
      res.status(500).json({ error: "Failed to create other income source" });
    }
  });

  app.delete("/api/urla/other-income/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteOtherIncomeSource(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete other income error:", error);
      res.status(500).json({ error: "Failed to delete other income source" });
    }
  });

  app.post("/api/urla/:applicationId/assets", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.createUrlaAsset(data);
      res.status(201).json(result);
    } catch (error) {
      console.error("Create asset error:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  app.patch("/api/urla/assets/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.updateUrlaAsset(id, req.body);
      if (!result) {
        return res.status(404).json({ error: "Asset not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Update asset error:", error);
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  app.delete("/api/urla/assets/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteUrlaAsset(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete asset error:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  app.post("/api/urla/:applicationId/liabilities", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.createUrlaLiability(data);
      res.status(201).json(result);
    } catch (error) {
      console.error("Create liability error:", error);
      res.status(500).json({ error: "Failed to create liability" });
    }
  });

  app.patch("/api/urla/liabilities/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.updateUrlaLiability(id, req.body);
      if (!result) {
        return res.status(404).json({ error: "Liability not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Update liability error:", error);
      res.status(500).json({ error: "Failed to update liability" });
    }
  });

  app.delete("/api/urla/liabilities/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteUrlaLiability(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete liability error:", error);
      res.status(500).json({ error: "Failed to delete liability" });
    }
  });

  app.post("/api/urla/:applicationId/property-info", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.upsertUrlaPropertyInfo(data);
      res.json(result);
    } catch (error) {
      console.error("Save property info error:", error);
      res.status(500).json({ error: "Failed to save property info" });
    }
  });

  // Bulk save URLA data - only updates sections that are explicitly provided with content
  app.post("/api/urla/:applicationId/save", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { personalInfo, employmentHistory, otherIncomeSources, assets, liabilities, propertyInfo } = req.body;

      // Verify user owns this application
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Not authorized to modify this application" });
      }

      const results: any = {};

      // Only update personal info if provided with actual content
      if (personalInfo && Object.keys(personalInfo).some(key => personalInfo[key] !== undefined && personalInfo[key] !== "")) {
        results.personalInfo = await storage.upsertUrlaPersonalInfo({ ...personalInfo, applicationId });
      }

      // Only update property info if provided with actual content
      if (propertyInfo && Object.keys(propertyInfo).some(key => propertyInfo[key] !== undefined && propertyInfo[key] !== "")) {
        results.propertyInfo = await storage.upsertUrlaPropertyInfo({ ...propertyInfo, applicationId });
      }

      // Handle employment records - update existing, create new
      if (employmentHistory && Array.isArray(employmentHistory) && employmentHistory.length > 0) {
        results.employmentHistory = [];
        for (const emp of employmentHistory) {
          // Skip empty records
          if (!emp.employerName && !emp.positionTitle && !emp.baseIncome) continue;
          
          if (emp.id) {
            const updated = await storage.updateEmploymentHistory(emp.id, emp);
            if (updated) results.employmentHistory.push(updated);
          } else {
            const created = await storage.createEmploymentHistory({ ...emp, applicationId, employmentType: emp.employmentType || "current" });
            results.employmentHistory.push(created);
          }
        }
      }

      // Handle assets - update existing, create new
      if (assets && Array.isArray(assets) && assets.length > 0) {
        results.assets = [];
        for (const asset of assets) {
          // Skip empty records
          if (!asset.accountType && !asset.financialInstitution) continue;
          
          if (asset.id) {
            const updated = await storage.updateUrlaAsset(asset.id, asset);
            if (updated) results.assets.push(updated);
          } else if (asset.accountType) {
            const created = await storage.createUrlaAsset({ ...asset, applicationId });
            results.assets.push(created);
          }
        }
      }

      // Handle liabilities - update existing, create new
      if (liabilities && Array.isArray(liabilities) && liabilities.length > 0) {
        results.liabilities = [];
        for (const liability of liabilities) {
          // Skip empty records
          if (!liability.liabilityType && !liability.creditorName) continue;
          
          if (liability.id) {
            const updated = await storage.updateUrlaLiability(liability.id, liability);
            if (updated) results.liabilities.push(updated);
          } else if (liability.liabilityType) {
            const created = await storage.createUrlaLiability({ ...liability, applicationId });
            results.liabilities.push(created);
          }
        }
      }

      // Handle other income sources - only create new ones (existing ones are preserved)
      if (otherIncomeSources && Array.isArray(otherIncomeSources) && otherIncomeSources.length > 0) {
        results.otherIncomeSources = [];
        for (const income of otherIncomeSources) {
          // Skip empty or already-saved records
          if (!income.incomeSource || !income.monthlyAmount) continue;
          if (income.id) continue; // Skip existing records, they're already saved
          
          const created = await storage.createOtherIncomeSource({ ...income, applicationId });
          results.otherIncomeSources.push(created);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Save URLA data error:", error);
      res.status(500).json({ error: "Failed to save URLA data" });
    }
  });

  // Task Routes - Admin/Staff can create and manage tasks
  app.post("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!isStaffRole(userRole || "")) {
        return res.status(403).json({ error: "Only staff can create tasks" });
      }

      const taskData = {
        ...req.body,
        createdByUserId: req.user!.id,
      };

      const task = await storage.createTask(taskData);

      await storage.createDealActivity({
        applicationId: task.applicationId,
        activityType: "note",
        title: "Task Created",
        description: `New task: ${task.title}`,
        performedBy: req.user!.id,
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Create task error:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.get("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      const userId = req.user!.id;

      let tasks;
      if (isStaffRole(userRole || "")) {
        tasks = await storage.getAllTasks();
      } else {
        tasks = await storage.getTasksByUser(userId);
      }

      res.json(tasks);
    } catch (error) {
      console.error("Get tasks error:", error);
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  app.get("/api/tasks/user/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user!.id;
      const userRole = req.user?.role;

      if (userId !== requestingUserId && !isStaffRole(userRole || "")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const tasks = await storage.getTasksByUser(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Get user tasks error:", error);
      res.status(500).json({ error: "Failed to get user tasks" });
    }
  });

  app.get("/api/tasks/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const tasks = await storage.getTasksByApplication(applicationId);
      res.json(tasks);
    } catch (error) {
      console.error("Get application tasks error:", error);
      res.status(500).json({ error: "Failed to get application tasks" });
    }
  });

  app.get("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const taskDocs = await storage.getTaskDocuments(task.id);

      res.json({ ...task, documents: taskDocs });
    } catch (error) {
      console.error("Get task error:", error);
      res.status(500).json({ error: "Failed to get task" });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const userRole = req.user?.role;
      const userId = req.user!.id;
      const isStaff = isStaffRole(userRole || "");
      const isAssignedUser = task.assignedToUserId === userId;

      if (!isStaff && !isAssignedUser) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updateData = req.body;
      if (updateData.verificationStatus && isStaff) {
        updateData.verifiedByUserId = userId;
        updateData.verifiedAt = new Date();
      }

      const updated = await storage.updateTask(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (userRole !== "admin") {
        return res.status(403).json({ error: "Only admins can delete tasks" });
      }

      await storage.deleteTask(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete task error:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Task Document Routes
  app.post("/api/tasks/:taskId/documents", isAuthenticated, async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const userId = req.user!.id;
      if (task.assignedToUserId !== userId && !isStaffRole(req.user?.role || "")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { documentId } = req.body;

      const taskDocument = await storage.createTaskDocument({
        taskId,
        documentId,
      });

      await storage.updateTask(taskId, { status: "submitted" });

      await storage.createDealActivity({
        applicationId: task.applicationId,
        activityType: "document_uploaded",
        title: "Document Uploaded for Task",
        description: `Document uploaded for task: ${task.title}`,
        performedBy: userId,
      });

      res.status(201).json(taskDocument);
    } catch (error) {
      console.error("Create task document error:", error);
      res.status(500).json({ error: "Failed to link document to task" });
    }
  });

  app.get("/api/tasks/:taskId/documents", isAuthenticated, async (req, res) => {
    try {
      const { taskId } = req.params;
      const taskDocs = await storage.getTaskDocuments(taskId);
      res.json(taskDocs);
    } catch (error) {
      console.error("Get task documents error:", error);
      res.status(500).json({ error: "Failed to get task documents" });
    }
  });

  app.patch("/api/tasks/:taskId/documents/:docId/verify", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!isStaffRole(userRole || "")) {
        return res.status(403).json({ error: "Only staff can verify documents" });
      }

      const { taskId, docId } = req.params;
      const { isVerified, verificationNotes } = req.body;

      const updated = await storage.updateTaskDocument(docId, {
        isVerified,
        verificationNotes,
      });

      if (isVerified) {
        const task = await storage.getTask(taskId);
        if (task) {
          await storage.updateTask(taskId, {
            status: "verified",
            verificationStatus: "verified",
            verifiedByUserId: req.user!.id,
            verifiedAt: new Date(),
            verificationNotes,
          });
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Verify task document error:", error);
      res.status(500).json({ error: "Failed to verify document" });
    }
  });

  // ========================================================================
  // TASK ENGINE API ENDPOINTS
  // ========================================================================

  // Import task engine
  const { taskEngine } = await import("./services/taskEngine");

  // Get SLA class configurations
  app.get("/api/task-engine/sla-classes", isAuthenticated, async (req, res) => {
    try {
      const configs = await taskEngine.getAllSlaClassConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Get SLA classes error:", error);
      res.status(500).json({ error: "Failed to get SLA configurations" });
    }
  });

  // Get task type SLA mappings
  app.get("/api/task-engine/task-type-mappings", isAuthenticated, async (req, res) => {
    try {
      const mappings = await taskEngine.getAllTaskTypeSlaMappings();
      res.json(mappings);
    } catch (error) {
      console.error("Get task type mappings error:", error);
      res.status(500).json({ error: "Failed to get task type mappings" });
    }
  });

  // Get task dashboard metrics (staff only)
  app.get("/api/task-engine/metrics", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const metrics = await taskEngine.getTaskDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get task metrics error:", error);
      res.status(500).json({ error: "Failed to get task metrics" });
    }
  });

  // Get tasks with SLA status for an application (staff only)
  app.get("/api/task-engine/applications/:applicationId/tasks", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required for full task list" });
      }
      const { applicationId } = req.params;
      const tasks = await taskEngine.getTasksForApplication(applicationId);
      res.json(tasks);
    } catch (error) {
      console.error("Get application tasks error:", error);
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  // Get borrower-visible tasks (verify ownership)
  app.get("/api/task-engine/applications/:applicationId/borrower-tasks", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user?.role;
      
      // Staff can access any application's borrower tasks
      if (!isStaffRole(userRole)) {
        // Borrowers must own the application
        const application = await storage.getLoanApplicationWithAccess(applicationId, userId, userRole || "borrower");
        if (!application) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
      }
      
      const tasks = await taskEngine.getBorrowerTasks(applicationId);
      res.json(tasks);
    } catch (error) {
      console.error("Get borrower tasks error:", error);
      res.status(500).json({ error: "Failed to get borrower tasks" });
    }
  });

  // Get tasks by owner role (staff only)
  app.get("/api/task-engine/tasks/by-role/:role", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const { role } = req.params;
      const status = req.query.status as string | undefined;
      const tasks = await taskEngine.getTasksByOwnerRole(role.toUpperCase(), status);
      res.json(tasks);
    } catch (error) {
      console.error("Get tasks by role error:", error);
      res.status(500).json({ error: "Failed to get tasks by role" });
    }
  });

  // Get tasks assigned to current user
  app.get("/api/task-engine/my-tasks", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const status = req.query.status as string | undefined;
      const tasks = await taskEngine.getTasksForUser(userId, status);
      res.json(tasks);
    } catch (error) {
      console.error("Get my tasks error:", error);
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  // Get pending task count for borrower (for sidebar badge)
  app.get("/api/task-engine/my-tasks/pending-count", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const tasks = await taskEngine.getTasksForUser(userId, "OPEN");
      const pendingCount = tasks.filter(t => t.ownerRole === "BORROWER").length;
      res.json({ pendingCount });
    } catch (error) {
      console.error("Get pending task count error:", error);
      res.status(500).json({ error: "Failed to get pending count" });
    }
  });

  // Create task with SLA (staff only)
  app.post("/api/task-engine/tasks", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const { title, description, applicationId, taskType, taskTypeCode, ownerRole, assignedToUserId } = req.body;
      
      if (!title || !applicationId || !taskType) {
        return res.status(400).json({ error: "Title, applicationId, and taskType are required" });
      }

      const task = await taskEngine.createTask(
        {
          title,
          description,
          applicationId,
          taskType,
          taskTypeCode,
          ownerRole,
          assignedToUserId,
        },
        req.user!.id,
        "MANUAL"
      );

      res.status(201).json(task);
    } catch (error) {
      console.error("Create task error:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Update task status (staff or assigned user only)
  app.patch("/api/task-engine/tasks/:taskId/status", isAuthenticated, async (req, res) => {
    try {
      const { taskId } = req.params;
      const { status, notes } = req.body;
      const userId = req.user!.id;
      const userRole = req.user?.role;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      // Fetch task first to check authorization
      const existingTask = await storage.getTask(taskId);
      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Staff can update any task
      // Non-staff can only update tasks assigned to them
      if (!isStaffRole(userRole)) {
        if (existingTask.assignedToUserId !== userId) {
          return res.status(403).json({ error: "Access denied: You can only update tasks assigned to you" });
        }
      }

      const task = await taskEngine.updateTaskStatus(taskId, status, userId, notes);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Update task status error:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });

  // Escalate a task (staff only)
  app.post("/api/task-engine/tasks/:taskId/escalate", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
      }

      const { taskId } = req.params;
      const { reason } = req.body;

      const task = await taskEngine.escalateTask(taskId, reason);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Escalate task error:", error);
      res.status(500).json({ error: "Failed to escalate task" });
    }
  });

  // Get task audit trail
  app.get("/api/task-engine/tasks/:taskId/audit", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
      }

      const { taskId } = req.params;
      const auditTrail = await taskEngine.getTaskAuditTrail(taskId);
      res.json(auditTrail);
    } catch (error) {
      console.error("Get task audit trail error:", error);
      res.status(500).json({ error: "Failed to get audit trail" });
    }
  });

  // Run escalation check (admin only - for manual trigger)
  app.post("/api/task-engine/run-escalation", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const escalatedCount = await taskEngine.runEscalationCheck();
      res.json({ escalatedCount, message: `Escalated ${escalatedCount} tasks` });
    } catch (error) {
      console.error("Run escalation error:", error);
      res.status(500).json({ error: "Failed to run escalation check" });
    }
  });

  // ========================================================================
  // UNDERWRITING ENGINE API ENDPOINTS
  // ========================================================================

  app.post("/api/loan-applications/:id/calculate-income", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const employment = await storage.getEmploymentHistory(id);
      const otherIncome = await storage.getOtherIncomeSources(id);

      const result = qualifyIncome(employment, otherIncome, {
        annualIncome: application.annualIncome || "0",
        employmentYears: application.employmentYears || 0,
      });

      res.json(result);
    } catch (error) {
      console.error("Calculate income error:", error);
      res.status(500).json({ error: "Failed to calculate income" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-assets", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const assets = await storage.getUrlaAssets(id);
      const downPaymentAndClosing = req.body.downPaymentAndClosing ? 
        parseFloat(req.body.downPaymentAndClosing) : 0;

      const result = verifyAssets(assets, downPaymentAndClosing);
      res.json(result);
    } catch (error) {
      console.error("Calculate assets error:", error);
      res.status(500).json({ error: "Failed to calculate assets" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-liabilities", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const liabilities = await storage.getUrlaLiabilities(id);
      const result = assessLiabilities(liabilities);
      res.json(result);
    } catch (error) {
      console.error("Calculate liabilities error:", error);
      res.status(500).json({ error: "Failed to calculate liabilities" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-dti", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { qualifyingIncome, housingExpense, nonHousingDebts } = req.body;
      if (!qualifyingIncome || !housingExpense || nonHousingDebts === undefined) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const result = calculateDTI(
        parseFloat(qualifyingIncome),
        parseFloat(housingExpense),
        parseFloat(nonHousingDebts)
      );

      res.json(result);
    } catch (error) {
      console.error("Calculate DTI error:", error);
      res.status(500).json({ error: "Failed to calculate DTI" });
    }
  });

  app.post("/api/loan-applications/:id/check-property-eligibility", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const {
        borrowerAssets,
        borrowerIncome,
        borrowerDebts,
        propertyPrice,
        propertyType = "single_family",
        propertyTaxAnnual,
        hoaMontly = 0,
        homeInsuranceEstimate = 150,
      } = req.body;

      if (!borrowerAssets || !borrowerIncome || borrowerDebts === undefined || !propertyPrice) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const result = checkPropertyEligibility(
        parseFloat(borrowerAssets),
        parseFloat(borrowerIncome),
        parseFloat(borrowerDebts),
        parseFloat(propertyPrice),
        propertyType,
        propertyTaxAnnual ? parseFloat(propertyTaxAnnual) : undefined,
        parseFloat(hoaMontly),
        parseFloat(homeInsuranceEstimate)
      );

      res.json(result);
    } catch (error) {
      console.error("Check property eligibility error:", error);
      res.status(500).json({ error: "Failed to check property eligibility" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-pricing", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const {
        loanAmount,
        creditScore,
        ltv,
        propertyType = "single_family",
        occupancyType = "primary_residence",
        propertyZip,
      } = req.body;

      if (!loanAmount || !creditScore || !ltv) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Get AMI for FTHB waiver
      let areaMedianIncome = 0;
      if (propertyZip) {
        areaMedianIncome = await getAreaMedianIncome(propertyZip);
      }

      const borrowerIncome = application.annualIncome ? 
        parseFloat(application.annualIncome) / 12 : 0;

      const result = calculateLLPA(
        parseFloat(loanAmount),
        parseInt(creditScore),
        parseFloat(ltv),
        propertyType as any,
        occupancyType as any,
        application.isFirstTimeBuyer ?? false,
        borrowerIncome,
        areaMedianIncome
      );

      res.json(result);
    } catch (error) {
      console.error("Calculate pricing error:", error);
      res.status(500).json({ error: "Failed to calculate pricing" });
    }
  });

  // ============================================================================
  // LOAN PIPELINE API ENDPOINTS
  // ============================================================================

  app.get("/api/loan-applications/:id/pipeline", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { checkPipelineProgress, getPipelineSummary } = await import("./pipelineEngine");
      
      const [progress, summary, milestones, conditions] = await Promise.all([
        checkPipelineProgress(id),
        getPipelineSummary(id),
        storage.getLoanMilestones(id),
        storage.getLoanConditionsByApplication(id),
      ]);

      res.json({
        progress,
        summary,
        milestones,
        conditions,
      });
    } catch (error) {
      console.error("Get pipeline status error:", error);
      res.status(500).json({ error: "Failed to get pipeline status" });
    }
  });

  app.get("/api/loan-applications/:id/conditions", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const conditions = await storage.getLoanConditionsByApplication(id);
      
      const grouped = {
        priorToApproval: conditions.filter(c => c.priority === "prior_to_approval"),
        priorToDocs: conditions.filter(c => c.priority === "prior_to_docs"),
        priorToFunding: conditions.filter(c => c.priority === "prior_to_funding"),
      };

      const stats = {
        total: conditions.length,
        outstanding: conditions.filter(c => c.status === "outstanding").length,
        submitted: conditions.filter(c => c.status === "submitted").length,
        cleared: conditions.filter(c => c.status === "cleared").length,
        waived: conditions.filter(c => c.status === "waived").length,
      };

      res.json({ conditions, grouped, stats });
    } catch (error) {
      console.error("Get conditions error:", error);
      res.status(500).json({ error: "Failed to get conditions" });
    }
  });

  app.patch("/api/conditions/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const condition = await storage.getLoanCondition(id);
      if (!condition) {
        return res.status(404).json({ error: "Condition not found" });
      }

      const userRole = req.user?.role;
      const isStaff = isStaffRole(userRole || "");
      
      if (!isStaff) {
        return res.status(403).json({ error: "Only staff can update conditions" });
      }

      const { status, clearanceNotes } = req.body;

      if (status === "cleared") {
        const updated = await storage.clearLoanCondition(id, req.user!.id, clearanceNotes);
        
        await storage.createDealActivity({
          applicationId: condition.applicationId,
          activityType: "condition_cleared",
          title: "Condition Cleared",
          description: `"${condition.title}" has been cleared.`,
          performedBy: req.user!.id,
          metadata: { conditionId: id, notes: clearanceNotes },
        });

        return res.json(updated);
      }

      if (status === "waived") {
        const updated = await storage.updateLoanCondition(id, {
          status: "waived",
          clearanceNotes,
          clearedByUserId: req.user!.id,
          clearedAt: new Date(),
        });

        await storage.createDealActivity({
          applicationId: condition.applicationId,
          activityType: "condition_waived",
          title: "Condition Waived",
          description: `"${condition.title}" has been waived.${clearanceNotes ? ` Reason: ${clearanceNotes}` : ""}`,
          performedBy: req.user!.id,
          metadata: { conditionId: id, notes: clearanceNotes },
        });

        return res.json(updated);
      }

      if (status === "not_applicable") {
        const updated = await storage.updateLoanCondition(id, {
          status: "not_applicable",
          clearanceNotes,
          clearedByUserId: req.user!.id,
          clearedAt: new Date(),
        });

        await storage.createDealActivity({
          applicationId: condition.applicationId,
          activityType: "condition_not_applicable",
          title: "Condition Marked N/A",
          description: `"${condition.title}" marked as not applicable.${clearanceNotes ? ` Reason: ${clearanceNotes}` : ""}`,
          performedBy: req.user!.id,
          metadata: { conditionId: id, notes: clearanceNotes },
        });

        return res.json(updated);
      }

      const updated = await storage.updateLoanCondition(id, { status, clearanceNotes });
      res.json(updated);
    } catch (error) {
      console.error("Update condition error:", error);
      res.status(500).json({ error: "Failed to update condition" });
    }
  });

  app.get("/api/loan-applications/:id/milestones", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const milestones = await storage.getLoanMilestones(id);
      res.json(milestones || {});
    } catch (error) {
      console.error("Get milestones error:", error);
      res.status(500).json({ error: "Failed to get milestones" });
    }
  });

  app.post("/api/loan-applications/:id/advance-stage", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;
      const isStaff = isStaffRole(userRole || "");
      
      if (!isStaff) {
        return res.status(403).json({ error: "Only staff can advance loan stages" });
      }

      const application = await storage.getLoanApplication(id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { newStage } = req.body;
      if (!newStage) {
        return res.status(400).json({ error: "New stage is required" });
      }

      const { updatePipelineStage, checkPipelineProgress } = await import("./pipelineEngine");
      
      const progress = await checkPipelineProgress(id);
      if (!progress.readyForNextStage && newStage !== "denied") {
        return res.status(400).json({ 
          error: "Cannot advance stage", 
          blockers: progress.blockers 
        });
      }

      await updatePipelineStage(id, newStage);

      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: `Stage Advanced to ${newStage.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
        description: `Loan advanced to ${newStage} stage.`,
        performedBy: req.user!.id,
      });

      const updatedApp = await storage.getLoanApplication(id);
      res.json(updatedApp);
    } catch (error) {
      console.error("Advance stage error:", error);
      res.status(500).json({ error: "Failed to advance stage" });
    }
  });

  app.get("/api/pipeline/queue", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      const isStaff = isStaffRole(userRole || "");
      
      if (!isStaff) {
        return res.status(403).json({ error: "Only staff can view pipeline queue" });
      }

      const applications = await storage.getAllLoanApplications();
      const activeApps = applications.filter(a => 
        !["draft", "funded", "denied"].includes(a.status || "draft")
      );

      const { getPipelineSummary } = await import("./pipelineEngine");
      
      const summaries = await Promise.all(
        activeApps.map(app => getPipelineSummary(app.id))
      );

      const queue = summaries
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .sort((a, b) => {
          const priorityOrder = { urgent: 0, high: 1, normal: 2 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return b.daysInPipeline - a.daysInPipeline;
        });

      const byStage: Record<string, typeof queue> = {};
      for (const item of queue) {
        if (!byStage[item.currentStage]) {
          byStage[item.currentStage] = [];
        }
        byStage[item.currentStage].push(item);
      }

      res.json({
        total: queue.length,
        byPriority: {
          urgent: queue.filter(q => q.priority === "urgent").length,
          high: queue.filter(q => q.priority === "high").length,
          normal: queue.filter(q => q.priority === "normal").length,
        },
        byStage,
        queue,
      });
    } catch (error) {
      console.error("Get pipeline queue error:", error);
      res.status(500).json({ error: "Failed to get pipeline queue" });
    }
  });

  app.get("/api/loan-applications/:id/underwriting-snapshots", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const snapshots = await storage.getUnderwritingSnapshotsByApplication(id);
      res.json(snapshots);
    } catch (error) {
      console.error("Get underwriting snapshots error:", error);
      res.status(500).json({ error: "Failed to get underwriting snapshots" });
    }
  });

  app.get("/api/loan-applications/:id/mismo-validation", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { validateMISMOCompleteness } = await import("./services/mismoValidation");
      const validation = await validateMISMOCompleteness(id);
      res.json(validation);
    } catch (error) {
      console.error("MISMO validation error:", error);
      res.status(500).json({ error: "Failed to validate MISMO completeness" });
    }
  });

  app.get("/api/loan-applications/:id/loan-estimate", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { generateLoanEstimate, formatLoanEstimateForDisplay } = await import("./services/loanEstimate");
      const le = await generateLoanEstimate(id);
      const formatted = formatLoanEstimateForDisplay(le);
      res.json(formatted);
    } catch (error) {
      console.error("Loan estimate error:", error);
      res.status(500).json({ error: "Failed to generate loan estimate" });
    }
  });

  app.get("/api/compliance/dashboard", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      const isStaff = isStaffRole(userRole || "");
      
      if (!isStaff) {
        return res.status(403).json({ error: "Only staff can view compliance dashboard" });
      }

      const applications = await storage.getAllLoanApplications();
      const activeApps = applications.filter(a => 
        !["draft", "denied"].includes(a.status || "draft")
      );

      const { getApplicationValidationSummary } = await import("./services/mismoValidation");
      
      const validationResults = await Promise.all(
        activeApps.map(async (app) => {
          try {
            const validation = await getApplicationValidationSummary(app.id);
            return {
              ...validation,
              borrowerName: app.propertyAddress ? `Loan - ${app.propertyAddress}` : `Application ${app.id.slice(0, 8)}`,
              status: app.status,
              loanAmount: app.purchasePrice && app.downPayment
                ? Number(app.purchasePrice) - Number(app.downPayment)
                : null,
            };
          } catch {
            return null;
          }
        })
      );

      const validResults = validationResults.filter((r): r is NonNullable<typeof r> => r !== null);

      res.json({
        total: validResults.length,
        gseReady: validResults.filter(r => r.gseReady).length,
        ulddCompliant: validResults.filter(r => r.ulddCompliant).length,
        needsAttention: validResults.filter(r => r.criticalCount > 0).length,
        applications: validResults,
      });
    } catch (error) {
      console.error("Compliance dashboard error:", error);
      res.status(500).json({ error: "Failed to load compliance dashboard" });
    }
  });

  // ============================================================================
  // PLAID VERIFICATION ROUTES
  // ============================================================================

  // Create a Plaid Link token for verification
  app.post("/api/verifications/link-token", isAuthenticated, async (req, res) => {
    try {
      const { applicationId, verificationType } = req.body;
      const userId = req.user!.id;

      if (!applicationId || !verificationType) {
        return res.status(400).json({ error: "applicationId and verificationType are required" });
      }

      // Verify ownership
      const application = await storage.getLoanApplication(applicationId);
      if (!application || application.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { isPlaidConfigured, createLinkToken } = await import("./plaid");

      if (!isPlaidConfigured()) {
        return res.status(503).json({ 
          error: "Verification service not configured",
          message: "Please contact support to enable verification services."
        });
      }

      const result = await createLinkToken({
        userId,
        verificationType,
      });

      // Store the link token
      const expiresAt = new Date(result.expiration);
      const linkTokenRecord = await storage.createPlaidLinkToken({
        userId,
        applicationId,
        linkToken: result.linkToken,
        verificationType,
        status: "pending",
        expiresAt,
      });

      res.json({
        linkToken: result.linkToken,
        expiration: result.expiration,
        linkTokenId: linkTokenRecord.id,
      });
    } catch (error) {
      console.error("Create link token error:", error);
      res.status(500).json({ error: "Failed to create verification session" });
    }
  });

  // Exchange public token and process verification
  app.post("/api/verifications/exchange", isAuthenticated, async (req, res) => {
    try {
      const { publicToken, linkTokenId, applicationId, verificationType } = req.body;
      const userId = req.user!.id;

      if (!publicToken || !applicationId || !verificationType) {
        return res.status(400).json({ error: "publicToken, applicationId, and verificationType are required" });
      }

      // Verify ownership
      const application = await storage.getLoanApplication(applicationId);
      if (!application || application.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { isPlaidConfigured, exchangePublicToken, getIdentityData } = await import("./plaid");

      if (!isPlaidConfigured()) {
        return res.status(503).json({ error: "Verification service not configured" });
      }

      // Exchange the public token
      const { accessToken, itemId } = await exchangePublicToken(publicToken);

      // Create verification record
      const verification = await storage.createVerification({
        applicationId,
        userId,
        verificationType,
        plaidItemId: itemId,
        plaidAccessToken: accessToken,
        status: "in_progress",
        verificationMethod: "plaid_payroll",
      });

      // Update link token status if provided
      if (linkTokenId) {
        await storage.updatePlaidLinkToken(linkTokenId, { status: "completed" });
      }

      // For identity verification, fetch and store the data
      if (verificationType === "identity") {
        try {
          const identityResult = await getIdentityData(accessToken);
          await storage.updateVerification(verification.id, {
            status: identityResult.verified ? "verified" : "failed",
            identityVerified: identityResult.verified,
            rawResponse: identityResult.rawResponse,
            verifiedAt: identityResult.verified ? new Date() : undefined,
          });
        } catch (identityError) {
          console.error("Identity fetch error:", identityError);
          await storage.updateVerification(verification.id, {
            status: "failed",
            rawResponse: { error: String(identityError) },
          });
        }
      }

      // For employment verification, mark as pending review (webhook will update)
      if (verificationType === "employment" || verificationType === "income") {
        await storage.updateVerification(verification.id, {
          status: "in_progress",
        });
      }

      res.json({
        verificationId: verification.id,
        status: verification.status,
        message: "Verification initiated successfully",
      });
    } catch (error) {
      console.error("Exchange token error:", error);
      res.status(500).json({ error: "Failed to process verification" });
    }
  });

  // Get verifications for an application
  app.get("/api/verifications/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user?.role;
      const isStaff = isStaffRole(userRole || "");

      // Verify ownership or staff access
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== userId && !isStaff) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const verifications = await storage.getVerificationsByApplication(applicationId);
      res.json(verifications);
    } catch (error) {
      console.error("Get verifications error:", error);
      res.status(500).json({ error: "Failed to get verifications" });
    }
  });

  // Get verification status
  app.get("/api/verifications/:id", isAuthenticated, async (req, res) => {
    try {
      const verification = await storage.getVerification(req.params.id);
      if (!verification) {
        return res.status(404).json({ error: "Verification not found" });
      }

      const userId = req.user!.id;
      const userRole = req.user?.role;
      const isStaff = isStaffRole(userRole || "");

      if (verification.userId !== userId && !isStaff) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Don't expose sensitive data like access token to client
      const { plaidAccessToken, ...safeVerification } = verification;
      res.json(safeVerification);
    } catch (error) {
      console.error("Get verification error:", error);
      res.status(500).json({ error: "Failed to get verification" });
    }
  });

  // Staff: Update verification status (approve/reject)
  app.patch("/api/verifications/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      const isStaff = isStaffRole(userRole || "");

      if (!isStaff) {
        return res.status(403).json({ error: "Only staff can update verifications" });
      }

      const verification = await storage.getVerification(req.params.id);
      if (!verification) {
        return res.status(404).json({ error: "Verification not found" });
      }

      const { status, reviewNotes } = req.body;
      const updated = await storage.updateVerification(req.params.id, {
        status,
        reviewNotes,
        reviewedByUserId: req.user!.id,
        reviewedAt: new Date(),
        verifiedAt: status === "verified" ? new Date() : undefined,
      });

      res.json(updated);
    } catch (error) {
      console.error("Update verification error:", error);
      res.status(500).json({ error: "Failed to update verification" });
    }
  });

  // Check if Plaid is configured
  app.get("/api/verifications/config/status", isAuthenticated, async (req, res) => {
    try {
      const { isPlaidConfigured } = await import("./plaid");
      res.json({
        plaidConfigured: isPlaidConfigured(),
        supportedVerificationTypes: ["employment", "identity", "income", "assets"],
      });
    } catch (error) {
      res.json({ plaidConfigured: false, supportedVerificationTypes: [] });
    }
  });

  // ================================
  // Learning Center & FAQ Routes
  // ================================

  // --- Content Categories (Admin) ---
  
  // Get all categories (admin - includes inactive)
  app.get("/api/admin/content-categories", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin", "broker", "lender"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const categories = await storage.getAllContentCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  // Create category (admin)
  app.post("/api/admin/content-categories", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const validatedData = insertContentCategorySchema.parse(req.body);
      const category = await storage.createContentCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Create category error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Update category (admin)
  app.patch("/api/admin/content-categories/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const updated = await storage.updateContentCategory(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  // Delete category (admin)
  app.delete("/api/admin/content-categories/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      await storage.deleteContentCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // --- Articles (Admin) ---

  // Get all articles (admin - includes drafts)
  app.get("/api/admin/articles", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin", "broker", "lender"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const articles = await storage.getAllArticles();
      res.json(articles);
    } catch (error) {
      console.error("Get articles error:", error);
      res.status(500).json({ error: "Failed to get articles" });
    }
  });

  // Get single article (admin)
  app.get("/api/admin/articles/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin", "broker", "lender"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const article = await storage.getArticle(req.params.id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      res.json(article);
    } catch (error) {
      console.error("Get article error:", error);
      res.status(500).json({ error: "Failed to get article" });
    }
  });

  // Create article (admin)
  app.post("/api/admin/articles", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const validatedData = insertArticleSchema.parse({
        ...req.body,
        authorId: req.user!.id,
        publishedAt: req.body.status === "published" ? new Date() : null,
      });
      const article = await storage.createArticle(validatedData);
      res.status(201).json(article);
    } catch (error) {
      console.error("Create article error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create article" });
    }
  });

  // Update article (admin)
  app.patch("/api/admin/articles/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const updateData = { ...req.body };
      // Set publishedAt when publishing for the first time
      if (req.body.status === "published") {
        const existing = await storage.getArticle(req.params.id);
        if (existing && existing.status !== "published") {
          updateData.publishedAt = new Date();
        }
      }
      
      const updated = await storage.updateArticle(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Article not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update article error:", error);
      res.status(500).json({ error: "Failed to update article" });
    }
  });

  // Delete article (admin)
  app.delete("/api/admin/articles/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      await storage.deleteArticle(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete article error:", error);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  // --- FAQs (Admin) ---

  // Get all FAQs (admin - includes drafts)
  app.get("/api/admin/faqs", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin", "broker", "lender"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const faqs = await storage.getAllFaqs();
      res.json(faqs);
    } catch (error) {
      console.error("Get FAQs error:", error);
      res.status(500).json({ error: "Failed to get FAQs" });
    }
  });

  // Get single FAQ (admin)
  app.get("/api/admin/faqs/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin", "broker", "lender"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const faq = await storage.getFaq(req.params.id);
      if (!faq) {
        return res.status(404).json({ error: "FAQ not found" });
      }
      res.json(faq);
    } catch (error) {
      console.error("Get FAQ error:", error);
      res.status(500).json({ error: "Failed to get FAQ" });
    }
  });

  // Create FAQ (admin)
  app.post("/api/admin/faqs", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const validatedData = insertFaqSchema.parse({
        ...req.body,
        authorId: req.user!.id,
      });
      const faq = await storage.createFaq(validatedData);
      res.status(201).json(faq);
    } catch (error) {
      console.error("Create FAQ error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create FAQ" });
    }
  });

  // Update FAQ (admin)
  app.patch("/api/admin/faqs/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const updated = await storage.updateFaq(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "FAQ not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update FAQ error:", error);
      res.status(500).json({ error: "Failed to update FAQ" });
    }
  });

  // Delete FAQ (admin)
  app.delete("/api/admin/faqs/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!["admin"].includes(userRole || "")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      await storage.deleteFaq(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete FAQ error:", error);
      res.status(500).json({ error: "Failed to delete FAQ" });
    }
  });

  // --- Public Learning Center & FAQ Routes ---

  // Get active categories (public)
  app.get("/api/content-categories", async (req, res) => {
    try {
      const categories = await storage.getActiveContentCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  // Get published articles (public)
  app.get("/api/articles", async (req, res) => {
    try {
      const { category, search } = req.query;
      
      let articles;
      if (search && typeof search === "string") {
        articles = await storage.searchArticles(search);
      } else if (category && typeof category === "string") {
        articles = await storage.getArticlesByCategory(category);
      } else {
        articles = await storage.getPublishedArticles();
      }
      
      res.json(articles);
    } catch (error) {
      console.error("Get articles error:", error);
      res.status(500).json({ error: "Failed to get articles" });
    }
  });

  // Get single article by slug (public)
  app.get("/api/articles/:slug", async (req, res) => {
    try {
      const article = await storage.getArticleBySlug(req.params.slug);
      if (!article || article.status !== "published") {
        return res.status(404).json({ error: "Article not found" });
      }
      
      // Increment view count
      await storage.incrementArticleViewCount(article.id);
      
      res.json(article);
    } catch (error) {
      console.error("Get article error:", error);
      res.status(500).json({ error: "Failed to get article" });
    }
  });

  // Get published FAQs (public)
  app.get("/api/faqs", async (req, res) => {
    try {
      const { category, search, popular } = req.query;
      
      let faqs;
      if (search && typeof search === "string") {
        faqs = await storage.searchFaqs(search);
      } else if (popular === "true") {
        faqs = await storage.getPopularFaqs();
      } else if (category && typeof category === "string") {
        faqs = await storage.getFaqsByCategory(category);
      } else {
        faqs = await storage.getPublishedFaqs();
      }
      
      res.json(faqs);
    } catch (error) {
      console.error("Get FAQs error:", error);
      res.status(500).json({ error: "Failed to get FAQs" });
    }
  });

  // Get single FAQ and increment view (public)
  app.get("/api/faqs/:id", async (req, res) => {
    try {
      const faq = await storage.getFaq(req.params.id);
      if (!faq || faq.status !== "published") {
        return res.status(404).json({ error: "FAQ not found" });
      }
      
      // Increment view count
      await storage.incrementFaqViewCount(faq.id);
      
      res.json(faq);
    } catch (error) {
      console.error("Get FAQ error:", error);
      res.status(500).json({ error: "Failed to get FAQ" });
    }
  });

  // Mark FAQ as helpful/not helpful (public)
  app.post("/api/faqs/:id/feedback", async (req, res) => {
    try {
      const { helpful } = req.body;
      if (typeof helpful !== "boolean") {
        return res.status(400).json({ error: "helpful must be a boolean" });
      }
      
      const faq = await storage.getFaq(req.params.id);
      if (!faq || faq.status !== "published") {
        return res.status(404).json({ error: "FAQ not found" });
      }
      
      await storage.markFaqHelpful(req.params.id, helpful);
      res.json({ success: true });
    } catch (error) {
      console.error("FAQ feedback error:", error);
      res.status(500).json({ error: "Failed to record feedback" });
    }
  });

  // =============================================================================
  // MORTGAGE RATES
  // =============================================================================

  // Get mortgage rates for a location (public)
  app.get("/api/mortgage-rates", async (req, res) => {
    try {
      const { state, zipcode } = req.query;
      const rates = await storage.getMortgageRatesForLocation(
        state as string | undefined,
        zipcode as string | undefined
      );
      res.json(rates);
    } catch (error) {
      console.error("Get mortgage rates error:", error);
      res.status(500).json({ error: "Failed to get mortgage rates" });
    }
  });

  // Get all rate programs (public)
  app.get("/api/mortgage-rate-programs", async (req, res) => {
    try {
      const programs = await storage.getActiveMortgageRatePrograms();
      res.json(programs);
    } catch (error) {
      console.error("Get mortgage rate programs error:", error);
      res.status(500).json({ error: "Failed to get mortgage rate programs" });
    }
  });

  // =============================================================================
  // MORTGAGE RATES ADMIN (Admin only)
  // =============================================================================

  // Get all mortgage rates for admin
  app.get("/api/admin/mortgage-rates", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const rates = await storage.getAllMortgageRates();
      res.json(rates);
    } catch (error) {
      console.error("Admin get mortgage rates error:", error);
      res.status(500).json({ error: "Failed to get mortgage rates" });
    }
  });

  // Get all rate programs for admin
  app.get("/api/admin/mortgage-rate-programs", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const programs = await storage.getAllMortgageRatePrograms();
      res.json(programs);
    } catch (error) {
      console.error("Admin get mortgage rate programs error:", error);
      res.status(500).json({ error: "Failed to get mortgage rate programs" });
    }
  });

  // Create a new rate program (admin only)
  app.post("/api/admin/mortgage-rate-programs", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const program = await storage.createMortgageRateProgram(req.body);
      res.status(201).json(program);
    } catch (error) {
      console.error("Create mortgage rate program error:", error);
      res.status(500).json({ error: "Failed to create mortgage rate program" });
    }
  });

  // Update a rate program (admin only)
  app.patch("/api/admin/mortgage-rate-programs/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const program = await storage.updateMortgageRateProgram(req.params.id, req.body);
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }
      res.json(program);
    } catch (error) {
      console.error("Update mortgage rate program error:", error);
      res.status(500).json({ error: "Failed to update mortgage rate program" });
    }
  });

  // Delete a rate program (admin only)
  app.delete("/api/admin/mortgage-rate-programs/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      await storage.deleteMortgageRateProgram(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete mortgage rate program error:", error);
      res.status(500).json({ error: "Failed to delete mortgage rate program" });
    }
  });

  // Create a new mortgage rate (admin only)
  app.post("/api/admin/mortgage-rates", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const rateData = {
        ...req.body,
        createdBy: user.id,
        updatedBy: user.id,
      };
      const rate = await storage.createMortgageRate(rateData);
      res.status(201).json(rate);
    } catch (error) {
      console.error("Create mortgage rate error:", error);
      res.status(500).json({ error: "Failed to create mortgage rate" });
    }
  });

  // Update a mortgage rate (admin only)
  app.patch("/api/admin/mortgage-rates/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const rateData = {
        ...req.body,
        updatedBy: user.id,
      };
      const rate = await storage.updateMortgageRate(req.params.id, rateData);
      if (!rate) {
        return res.status(404).json({ error: "Rate not found" });
      }
      res.json(rate);
    } catch (error) {
      console.error("Update mortgage rate error:", error);
      res.status(500).json({ error: "Failed to update mortgage rate" });
    }
  });

  // Delete a mortgage rate (admin only)
  app.delete("/api/admin/mortgage-rates/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      await storage.deleteMortgageRate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete mortgage rate error:", error);
      res.status(500).json({ error: "Failed to delete mortgage rate" });
    }
  });

  // ==========================================================================
  // CREDIT & FCRA COMPLIANCE ENDPOINTS
  // ==========================================================================

  // Get disclosure text for consent form
  app.get("/api/credit/disclosure", isAuthenticated, async (req, res) => {
    try {
      const stateCode = req.query.state as string | undefined;
      res.json({
        disclosureText: creditService.getCombinedDisclosure(stateCode),
        disclosureVersion: creditService.getDisclosureVersion(),
        stateRules: stateCode ? creditService.getStateDisclosureRules(stateCode) : null,
      });
    } catch (error) {
      console.error("Get disclosure error:", error);
      res.status(500).json({ error: "Failed to get disclosure" });
    }
  });

  app.get("/api/credit/state-rules", isAuthenticated, async (req, res) => {
    try {
      const stateCode = req.query.state as string | undefined;
      if (stateCode) {
        res.json({ rules: creditService.getStateDisclosureRules(stateCode) });
      } else {
        res.json({ rules: creditService.getAllStateDisclosureRules() });
      }
    } catch (error) {
      console.error("Get state rules error:", error);
      res.status(500).json({ error: "Failed to get state rules" });
    }
  });

  // Get active consent for an application
  app.get("/api/loan-applications/:id/credit/consent", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id && !isStaffRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const consent = await creditService.getActiveConsent(req.params.id);
      res.json({ consent });
    } catch (error) {
      console.error("Get consent error:", error);
      res.status(500).json({ error: "Failed to get consent" });
    }
  });

  // Submit credit consent
  app.post("/api/loan-applications/:id/credit/consent", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id) {
        return res.status(403).json({ error: "Only the borrower can provide consent" });
      }
      
      const { consentType, borrowerFullName, borrowerSSNLast4, borrowerDOB, consentGiven } = req.body;
      
      if (!borrowerFullName || consentGiven === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const consent = await creditService.createCreditConsent({
        applicationId: req.params.id,
        userId: user.id,
        consentType: consentType || "hard_pull",
        borrowerFullName,
        borrowerSSNLast4,
        borrowerDOB,
        consentGiven,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
      
      res.status(201).json({ consent });
    } catch (error) {
      console.error("Create consent error:", error);
      res.status(500).json({ error: "Failed to create consent" });
    }
  });

  // Revoke consent
  app.post("/api/credit/consent/:consentId/revoke", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { reason } = req.body;
      
      await creditService.revokeConsent(
        req.params.consentId,
        reason || "Borrower requested revocation",
        user.id,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Revoke consent error:", error);
      res.status(500).json({ error: "Failed to revoke consent" });
    }
  });

  app.get("/api/loan-applications/:id/credit/draft", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const draft = await creditService.getDraftConsent(req.params.id, user.id);
      res.json({ draft });
    } catch (error) {
      console.error("Get draft consent error:", error);
      res.status(500).json({ error: "Failed to get draft consent" });
    }
  });

  app.post("/api/loan-applications/:id/credit/draft", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id) {
        return res.status(403).json({ error: "Only the borrower can save draft consent" });
      }
      
      const draft = await creditService.saveDraftConsent(req.params.id, user.id, req.body);
      res.json({ draft });
    } catch (error) {
      console.error("Save draft consent error:", error);
      res.status(500).json({ error: "Failed to save draft consent" });
    }
  });

  app.delete("/api/loan-applications/:id/credit/draft", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await creditService.deleteDraftConsent(req.params.id, user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete draft consent error:", error);
      res.status(500).json({ error: "Failed to delete draft consent" });
    }
  });

  // Request credit pull (staff only)
  app.post("/api/loan-applications/:id/credit/pull", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const application = await storage.getLoanApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const consent = await creditService.getActiveConsent(req.params.id);
      if (!consent) {
        return res.status(400).json({ error: "Valid consent required before credit pull" });
      }
      
      const { pullType, bureaus } = req.body;
      
      const pull = await creditService.requestCreditPull({
        applicationId: req.params.id,
        consentId: consent.id,
        requestedBy: user.id,
        pullType: pullType || "tri_merge",
        bureaus: bureaus || ["experian", "equifax", "transunion"],
        ipAddress: req.ip,
      });
      
      // In simulation mode, immediately complete the pull
      const completedPull = await creditService.simulateCreditPullCompletion(pull.id);
      
      // Update loan application with the representative credit score
      if (completedPull.representativeScore) {
        await storage.updateLoanApplication(req.params.id, {
          creditScore: completedPull.representativeScore,
        });
      }
      
      res.status(201).json({ pull: completedPull });
    } catch (error) {
      console.error("Request credit pull error:", error);
      res.status(500).json({ error: "Failed to request credit pull" });
    }
  });

  // Get credit pulls for an application
  app.get("/api/loan-applications/:id/credit/pulls", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id && !isStaffRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const pulls = await creditService.getCreditPullsByApplication(req.params.id);
      res.json({ pulls });
    } catch (error) {
      console.error("Get credit pulls error:", error);
      res.status(500).json({ error: "Failed to get credit pulls" });
    }
  });

  // Get latest credit pull for an application
  app.get("/api/loan-applications/:id/credit/latest", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id && !isStaffRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const pull = await creditService.getLatestCreditPull(req.params.id);
      res.json({ pull });
    } catch (error) {
      console.error("Get latest credit pull error:", error);
      res.status(500).json({ error: "Failed to get latest credit pull" });
    }
  });

  // Get adverse action reasons list
  app.get("/api/credit/adverse-action-reasons", isAuthenticated, async (req, res) => {
    try {
      res.json({ reasons: creditService.getAdverseActionReasons() });
    } catch (error) {
      console.error("Get adverse action reasons error:", error);
      res.status(500).json({ error: "Failed to get adverse action reasons" });
    }
  });

  // Get detailed adverse action reasons with bureau codes
  app.get("/api/credit/adverse-action-reasons/detailed", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      res.json({ reasons: creditService.getAdverseActionReasonsDetailed() });
    } catch (error) {
      console.error("Get detailed adverse action reasons error:", error);
      res.status(500).json({ error: "Failed to get detailed adverse action reasons" });
    }
  });

  // Get retention policies
  app.get("/api/credit/retention-policies", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      res.json({ policies: creditService.getRetentionPolicies() });
    } catch (error) {
      console.error("Get retention policies error:", error);
      res.status(500).json({ error: "Failed to get retention policies" });
    }
  });

  // Get retention compliance report
  app.get("/api/credit/retention-report", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const report = await creditService.getRetentionComplianceReport();
      res.json(report);
    } catch (error) {
      console.error("Get retention report error:", error);
      res.status(500).json({ error: "Failed to get retention report" });
    }
  });

  // Get application retention status
  app.get("/api/loan-applications/:id/retention-status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const application = await storage.getLoanApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      const status = await creditService.getApplicationRetentionStatus(req.params.id);
      res.json(status);
    } catch (error) {
      console.error("Get retention status error:", error);
      res.status(500).json({ error: "Failed to get retention status" });
    }
  });

  // Archive credit pull (staff only)
  app.post("/api/credit/pulls/:pullId/archive", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const { reason } = req.body;
      await creditService.archiveCreditPull(req.params.pullId, reason || "Retention policy", user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Archive credit pull error:", error);
      res.status(500).json({ error: "Failed to archive credit pull" });
    }
  });

  // Get archive-eligible records
  app.get("/api/credit/archive-eligible", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const eligible = await creditService.getArchiveEligibleRecords();
      res.json(eligible);
    } catch (error) {
      console.error("Get archive eligible error:", error);
      res.status(500).json({ error: "Failed to get archive eligible records" });
    }
  });

  // Zod schema for adverse action request validation
  const adverseActionRequestSchema = z.object({
    actionType: z.enum(["denial", "counteroffer", "rate_adjustment", "terms_change"]),
    primaryReason: z.string().refine(
      (val) => creditService.validateAdverseActionReason(val),
      { message: `Invalid primary reason key. Must be one of: ${creditService.getValidAdverseActionReasonKeys().join(", ")}` }
    ),
    secondaryReasons: z.array(
      z.string().refine(
        (val) => creditService.validateAdverseActionReason(val),
        { message: `Invalid secondary reason key. Must be one of: ${creditService.getValidAdverseActionReasonKeys().join(", ")}` }
      )
    ).optional(),
    creditPullId: z.string().uuid().optional(),
    creditScoreUsed: z.number().min(300).max(850).optional(),
    creditScoreSource: z.enum(["experian", "equifax", "transunion"]).optional(),
  });

  // Generate adverse action notice (staff only)
  app.post("/api/loan-applications/:id/credit/adverse-action", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const application = await storage.getLoanApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      // Validate request body using Zod schema
      const parseResult = adverseActionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.errors.map(e => e.message).join("; ");
        return res.status(400).json({ error: errorMessages });
      }
      
      const { 
        actionType, 
        primaryReason, 
        secondaryReasons, 
        creditPullId,
        creditScoreUsed,
        creditScoreSource,
      } = parseResult.data;
      
      const adverseAction = await creditService.generateAdverseAction({
        applicationId: req.params.id,
        creditPullId,
        userId: application.userId,
        actionType,
        primaryReason,
        secondaryReasons,
        creditScoreUsed,
        creditScoreSource,
        generatedBy: user.id,
      });
      
      res.status(201).json({ adverseAction });
    } catch (error) {
      console.error("Generate adverse action error:", error);
      res.status(500).json({ error: "Failed to generate adverse action" });
    }
  });

  // Get adverse actions for an application
  app.get("/api/loan-applications/:id/credit/adverse-actions", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id && !isStaffRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const adverseActions = await creditService.getAdverseActionsByApplication(req.params.id);
      res.json({ adverseActions });
    } catch (error) {
      console.error("Get adverse actions error:", error);
      res.status(500).json({ error: "Failed to get adverse actions" });
    }
  });

  // Mark adverse action as delivered (staff only)
  app.post("/api/credit/adverse-action/:actionId/deliver", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const { deliveryMethod, deliveryConfirmation } = req.body;
      
      await creditService.markAdverseActionDelivered(
        req.params.actionId,
        deliveryMethod || "in_app",
        deliveryConfirmation
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Mark adverse action delivered error:", error);
      res.status(500).json({ error: "Failed to mark adverse action as delivered" });
    }
  });

  // Get credit audit log for an application (staff only)
  app.get("/api/loan-applications/:id/credit/audit-log", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const application = await storage.getLoanApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const limit = parseInt(req.query.limit as string) || 100;
      const auditLog = await creditService.getCreditAuditLog(req.params.id, limit);
      res.json({ auditLog });
    } catch (error) {
      console.error("Get credit audit log error:", error);
      res.status(500).json({ error: "Failed to get credit audit log" });
    }
  });

  app.get("/api/loan-applications/:id/credit/audit-log/verify", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const application = await storage.getLoanApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const result = await creditService.verifyAuditLogIntegrity(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Verify audit log error:", error);
      res.status(500).json({ error: "Failed to verify audit log" });
    }
  });

  app.get("/api/loan-applications/:id/credit/audit-log/export", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const application = await storage.getLoanApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const format = req.query.format as string || "json";
      
      if (format === "csv") {
        const csv = await creditService.generateCSVExport(req.params.id);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="audit-log-${req.params.id}.csv"`);
        res.send(csv);
      } else {
        const exportPackage = await creditService.generateAuditExportPackage(req.params.id, user.id);
        res.json(exportPackage);
      }
    } catch (error) {
      console.error("Export audit log error:", error);
      res.status(500).json({ error: "Failed to export audit log" });
    }
  });

  // Get comprehensive credit summary for an application
  app.get("/api/loan-applications/:id/credit/summary", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id && !isStaffRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const [consent, latestPull, pulls, adverseActions] = await Promise.all([
        creditService.getActiveConsent(req.params.id),
        creditService.getLatestCreditPull(req.params.id),
        creditService.getCreditPullsByApplication(req.params.id),
        creditService.getAdverseActionsByApplication(req.params.id),
      ]);
      
      res.json({
        hasActiveConsent: !!consent,
        consent,
        latestPull,
        pullCount: pulls.length,
        adverseActionCount: adverseActions.length,
        latestAdverseAction: adverseActions[0] || null,
      });
    } catch (error) {
      console.error("Get credit summary error:", error);
      res.status(500).json({ error: "Failed to get credit summary" });
    }
  });

  // ===== ASPIRING OWNER JOURNEY API =====

  // Get or create homeownership goal for the current user
  app.get("/api/homeownership-goal", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const goal = await storage.getHomeownershipGoal(user.id);
      
      if (!goal) {
        return res.json({ goal: null });
      }

      const [creditActions, savingsTransactions, milestones] = await Promise.all([
        storage.getCreditActions(goal.id),
        storage.getSavingsTransactions(goal.id),
        storage.getJourneyMilestones(goal.id),
      ]);

      res.json({
        goal,
        creditActions,
        savingsTransactions,
        milestones,
      });
    } catch (error) {
      console.error("Get homeownership goal error:", error);
      res.status(500).json({ error: "Failed to get homeownership goal" });
    }
  });

  // Create homeownership goal
  app.post("/api/homeownership-goal", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Check if goal already exists
      const existing = await storage.getHomeownershipGoal(user.id);
      if (existing) {
        return res.status(400).json({ error: "Homeownership goal already exists" });
      }

      const validated = insertHomeownershipGoalSchema.parse({
        ...req.body,
        userId: user.id,
      });

      const goal = await storage.createHomeownershipGoal(validated);

      // Create initial milestone for starting the journey
      await storage.createJourneyMilestone({
        goalId: goal.id,
        milestoneType: "journey_started",
        title: "Journey Started",
        description: "You've taken the first step toward homeownership!",
        celebrationMessage: "Welcome to your homeownership journey! We're excited to help you achieve your dream.",
        pointsAwarded: 10,
      });

      res.status(201).json({ goal });
    } catch (error) {
      console.error("Create homeownership goal error:", error);
      res.status(500).json({ error: "Failed to create homeownership goal" });
    }
  });

  // Update homeownership goal
  app.patch("/api/homeownership-goal", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Validate update data using partial insert schema
      const updateSchema = insertHomeownershipGoalSchema.partial();
      const validated = updateSchema.parse(req.body);
      
      const goal = await storage.updateHomeownershipGoal(user.id, validated);
      
      if (!goal) {
        return res.status(404).json({ error: "Homeownership goal not found" });
      }

      res.json({ goal });
    } catch (error) {
      console.error("Update homeownership goal error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update homeownership goal" });
    }
  });

  // Get gap analysis (calculated from goal data)
  app.get("/api/homeownership-goal/gap-analysis", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const goal = await storage.getHomeownershipGoal(user.id);
      
      if (!goal) {
        return res.json({ hasGoal: false });
      }

      // Calculate gap analysis
      const currentCredit = goal.currentCreditScore || 0;
      const targetCredit = goal.targetCreditScore || 640;
      const creditGap = Math.max(0, targetCredit - currentCredit);

      const currentSavings = parseFloat(goal.currentSavingsBalance?.toString() || "0");
      const targetDownPayment = parseFloat(goal.targetDownPayment?.toString() || "0");
      const savingsGap = Math.max(0, targetDownPayment - currentSavings);

      const monthlyIncome = parseFloat(goal.monthlyIncome?.toString() || "0");
      const monthlyDebts = parseFloat(goal.monthlyDebts?.toString() || "0");
      const currentDTI = monthlyIncome > 0 ? (monthlyDebts / monthlyIncome) * 100 : 0;
      
      // Calculate affordable payment based on 43% DTI limit
      const maxDTI = 43;
      const availableForPayment = monthlyIncome * (maxDTI / 100) - monthlyDebts;
      
      // Estimate time to reach goals
      const monthlySavingsRate = parseFloat(goal.currentMonthlySavings?.toString() || "0");
      const monthsToSavingsGoal = monthlySavingsRate > 0 
        ? Math.ceil(savingsGap / monthlySavingsRate) 
        : null;

      // Calculate journey progress percentage
      const creditProgress = targetCredit > 0 ? Math.min(100, (currentCredit / targetCredit) * 100) : 0;
      const savingsProgress = targetDownPayment > 0 ? Math.min(100, (currentSavings / targetDownPayment) * 100) : 0;
      const overallProgress = (creditProgress + savingsProgress) / 2;

      res.json({
        hasGoal: true,
        analysis: {
          credit: {
            current: currentCredit,
            target: targetCredit,
            gap: creditGap,
            progress: creditProgress,
            status: creditGap === 0 ? "ready" : creditGap <= 20 ? "close" : "working",
          },
          savings: {
            current: currentSavings,
            target: targetDownPayment,
            gap: savingsGap,
            progress: savingsProgress,
            monthlyRate: monthlySavingsRate,
            monthsToGoal: monthsToSavingsGoal,
            status: savingsGap === 0 ? "ready" : savingsProgress >= 75 ? "close" : "working",
          },
          dti: {
            current: currentDTI,
            maxAllowed: maxDTI,
            availableForPayment,
            status: currentDTI <= maxDTI ? "healthy" : "high",
          },
          overall: {
            progress: overallProgress,
            phase: goal.currentPhase,
            journeyDay: goal.journeyDay,
            readyToBuy: creditGap === 0 && savingsGap === 0 && currentDTI <= maxDTI,
          },
        },
      });
    } catch (error) {
      console.error("Get gap analysis error:", error);
      res.status(500).json({ error: "Failed to calculate gap analysis" });
    }
  });

  // Add credit action
  app.post("/api/homeownership-goal/credit-actions", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const goal = await storage.getHomeownershipGoal(user.id);
      
      if (!goal) {
        return res.status(404).json({ error: "Homeownership goal not found" });
      }

      const validated = insertCreditActionSchema.parse({
        ...req.body,
        goalId: goal.id,
      });

      const action = await storage.createCreditAction(validated);
      res.status(201).json({ action });
    } catch (error) {
      console.error("Create credit action error:", error);
      res.status(500).json({ error: "Failed to create credit action" });
    }
  });

  // Update credit action
  app.patch("/api/credit-actions/:id", isAuthenticated, async (req, res) => {
    try {
      // Validate update data using partial insert schema
      const updateSchema = insertCreditActionSchema.partial();
      const validated = updateSchema.parse(req.body);
      
      const action = await storage.updateCreditAction(req.params.id, validated);
      
      if (!action) {
        return res.status(404).json({ error: "Credit action not found" });
      }

      res.json({ action });
    } catch (error) {
      console.error("Update credit action error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update credit action" });
    }
  });

  // Add savings transaction
  app.post("/api/homeownership-goal/savings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const goal = await storage.getHomeownershipGoal(user.id);
      
      if (!goal) {
        return res.status(404).json({ error: "Homeownership goal not found" });
      }

      const currentBalance = parseFloat(goal.currentSavingsBalance?.toString() || "0");
      const amount = parseFloat(req.body.amount);
      const newBalance = currentBalance + amount;

      const validated = insertSavingsTransactionSchema.parse({
        goalId: goal.id,
        transactionType: req.body.transactionType || "manual_deposit",
        amount: req.body.amount,
        description: req.body.description,
        runningBalance: newBalance.toString(),
      });

      const transaction = await storage.createSavingsTransaction(validated);

      // Update the goal's current savings balance
      await storage.updateHomeownershipGoal(user.id, {
        currentSavingsBalance: newBalance.toString(),
        savingsProgress: newBalance.toString(),
      });

      // Check for savings milestones
      const milestoneThresholds = [
        { amount: 500, type: "savings_500", title: "First $500 Saved!" },
        { amount: 1000, type: "savings_1000", title: "$1,000 Milestone!" },
        { amount: 2500, type: "savings_2500", title: "$2,500 Saved!" },
        { amount: 5000, type: "savings_5000", title: "$5,000 Milestone!" },
        { amount: 10000, type: "savings_10000", title: "$10,000 Saved!" },
      ];

      for (const milestone of milestoneThresholds) {
        if (newBalance >= milestone.amount && currentBalance < milestone.amount) {
          await storage.createJourneyMilestone({
            goalId: goal.id,
            milestoneType: milestone.type,
            title: milestone.title,
            description: `You've saved $${milestone.amount.toLocaleString()} toward your home!`,
            celebrationMessage: "Great progress! Every dollar brings you closer to homeownership.",
            pointsAwarded: milestone.amount / 100,
          });
        }
      }

      res.status(201).json({ transaction, newBalance });
    } catch (error) {
      console.error("Create savings transaction error:", error);
      res.status(500).json({ error: "Failed to create savings transaction" });
    }
  });

  // Get credit improvement recommendations
  app.get("/api/homeownership-goal/credit-recommendations", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const goal = await storage.getHomeownershipGoal(user.id);
      
      if (!goal) {
        return res.json({ recommendations: [] });
      }

      const currentScore = goal.currentCreditScore || 0;
      const recommendations = [];

      // Generate personalized recommendations based on credit score
      if (currentScore < 580) {
        recommendations.push({
          priority: "high",
          actionType: "pay_down_card",
          title: "Pay Down Credit Cards",
          description: "Reduce your credit utilization to under 30%. This is the fastest way to boost your score.",
          estimatedPointsGain: 15,
          timeframe: "1-2 months",
        });
        recommendations.push({
          priority: "high",
          actionType: "dispute_error",
          title: "Dispute Credit Errors",
          description: "Review your credit report for errors. Removing incorrect negative items can quickly improve your score.",
          estimatedPointsGain: 20,
          timeframe: "30-45 days",
        });
      }

      if (currentScore >= 580 && currentScore < 620) {
        recommendations.push({
          priority: "medium",
          actionType: "on_time_payment",
          title: "Set Up Auto-Pay",
          description: "Never miss a payment. Set up automatic payments for all your bills.",
          estimatedPointsGain: 10,
          timeframe: "3-6 months",
        });
        recommendations.push({
          priority: "medium",
          actionType: "authorized_user",
          title: "Become an Authorized User",
          description: "Ask a family member with good credit to add you as an authorized user on their oldest card.",
          estimatedPointsGain: 15,
          timeframe: "1-2 months",
        });
      }

      if (currentScore >= 620 && currentScore < 680) {
        recommendations.push({
          priority: "low",
          actionType: "credit_mix",
          title: "Diversify Credit Types",
          description: "A mix of credit types (cards, installment loans) can help your score.",
          estimatedPointsGain: 8,
          timeframe: "3-6 months",
        });
      }

      // Always recommend
      recommendations.push({
        priority: "medium",
        actionType: "utilization",
        title: "Keep Utilization Low",
        description: "Try to use less than 10% of your available credit for the best scores.",
        estimatedPointsGain: 10,
        timeframe: "Ongoing",
      });

      res.json({ recommendations, currentScore, targetScore: goal.targetCreditScore });
    } catch (error) {
      console.error("Get credit recommendations error:", error);
      res.status(500).json({ error: "Failed to get credit recommendations" });
    }
  });

  // ===== APPLICATION INVITES (Referral Links) =====
  
  // Create a new invite link (for LOs, LOAs, and agents)
  app.post("/api/application-invites", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const allowedRoles = ["admin", "lo", "loa"];
      
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: "Only loan officers and assistants can create invite links" });
      }

      const schema = z.object({
        clientName: z.string().optional(),
        clientEmail: z.string().email().optional().or(z.literal("")),
        clientPhone: z.string().optional(),
        message: z.string().optional(),
        expiresInDays: z.number().min(1).max(90).default(30),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const { clientName, clientEmail, clientPhone, message, expiresInDays } = result.data;

      // Generate unique token
      const token = crypto.randomBytes(32).toString("hex");
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const invite = await storage.createApplicationInvite({
        referrerId: user.id,
        referrerType: user.role as "lo" | "loa" | "admin",
        clientName: clientName || null,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        message: message || null,
        token,
        status: "pending",
        expiresAt,
      });

      // Generate the full URL
      const baseUrl = process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "http://localhost:5000";
      const inviteUrl = `${baseUrl}/apply/${token}`;

      res.status(201).json({ 
        invite,
        inviteUrl,
      });
    } catch (error) {
      console.error("Create application invite error:", error);
      res.status(500).json({ error: "Failed to create invite link" });
    }
  });

  // Get all invites for current user (referrer)
  app.get("/api/application-invites", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const invites = await storage.getApplicationInvitesByReferrer(user.id);
      
      // Add computed fields
      const invitesWithStatus = invites.map(invite => ({
        ...invite,
        isExpired: new Date(invite.expiresAt) < new Date(),
      }));

      res.json(invitesWithStatus);
    } catch (error) {
      console.error("Get application invites error:", error);
      res.status(500).json({ error: "Failed to get invites" });
    }
  });

  // Validate invite token (public endpoint for when client clicks link)
  app.get("/api/application-invites/validate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invite = await storage.getApplicationInviteByToken(token);

      if (!invite) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }

      // Check if expired
      if (new Date(invite.expiresAt) < new Date()) {
        await storage.updateApplicationInvite(invite.id, { status: "expired" });
        return res.status(410).json({ error: "This invite link has expired" });
      }

      // Check if already used
      if (invite.status === "applied") {
        return res.status(410).json({ error: "This invite link has already been used" });
      }

      // Get referrer info
      const referrer = await storage.getUser(invite.referrerId);

      // Mark as clicked if first time
      if (invite.status === "pending") {
        await storage.updateApplicationInvite(invite.id, { 
          status: "clicked",
          clickedAt: new Date(),
        });
      }

      res.json({
        valid: true,
        invite: {
          id: invite.id,
          clientName: invite.clientName,
          clientEmail: invite.clientEmail,
          message: invite.message,
          referrer: referrer ? {
            firstName: referrer.firstName,
            lastName: referrer.lastName,
            role: referrer.role,
          } : null,
        },
      });
    } catch (error) {
      console.error("Validate invite error:", error);
      res.status(500).json({ error: "Failed to validate invite" });
    }
  });

  // Mark invite as applied (called when client submits application)
  app.post("/api/application-invites/:id/applied", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { loanApplicationId } = req.body;

      const updated = await storage.updateApplicationInvite(id, {
        status: "applied",
        appliedAt: new Date(),
        loanApplicationId,
      });

      if (!updated) {
        return res.status(404).json({ error: "Invite not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Mark invite applied error:", error);
      res.status(500).json({ error: "Failed to update invite" });
    }
  });

  // ===== RATE LOCK SYSTEM =====

  // Create a rate lock
  app.post("/api/rate-locks", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Only staff can create rate locks" });
      }

      const schema = z.object({
        applicationId: z.string(),
        loanOptionId: z.string(),
        lockPeriodDays: z.number().min(15).max(90).default(30),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const { applicationId, loanOptionId, lockPeriodDays, notes } = result.data;

      // Check if there's already an active lock
      const existingLock = await storage.getActiveRateLock(applicationId);
      if (existingLock) {
        return res.status(400).json({ error: "Application already has an active rate lock" });
      }

      // Get the loan option details
      const options = await storage.getLoanOptionsByApplication(applicationId);
      const loanOption = options.find(o => o.id === loanOptionId);
      if (!loanOption) {
        return res.status(404).json({ error: "Loan option not found" });
      }

      const lockedAt = new Date();
      const expiresAt = new Date(lockedAt.getTime() + lockPeriodDays * 24 * 60 * 60 * 1000);

      const rateLock = await storage.createRateLock({
        applicationId,
        loanOptionId,
        interestRate: loanOption.interestRate,
        points: loanOption.points,
        loanAmount: loanOption.loanAmount,
        loanType: loanOption.loanType,
        loanTerm: loanOption.loanTerm,
        lockPeriodDays,
        lockedAt,
        expiresAt,
        status: "active",
        lockedBy: user.id,
        notes,
      });

      // Also update the loan option
      await storage.lockLoanOption(loanOptionId);

      // Log activity
      await storage.createDealActivity({
        applicationId,
        activityType: "rate_locked",
        title: "Rate Locked",
        description: `Rate locked at ${loanOption.interestRate}% for ${lockPeriodDays} days`,
        metadata: { rateLockId: rateLock.id },
        performedBy: user.id,
      });

      res.status(201).json(rateLock);
    } catch (error) {
      console.error("Create rate lock error:", error);
      res.status(500).json({ error: "Failed to create rate lock" });
    }
  });

  // Get rate locks for an application
  app.get("/api/rate-locks/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const locks = await storage.getRateLocksByApplication(applicationId);
      res.json(locks);
    } catch (error) {
      console.error("Get rate locks error:", error);
      res.status(500).json({ error: "Failed to get rate locks" });
    }
  });

  // Get expiring rate locks (for alerts)
  app.get("/api/rate-locks/expiring", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const withinDays = parseInt(req.query.days as string) || 7;
      const locks = await storage.getExpiringRateLocks(withinDays);
      res.json(locks);
    } catch (error) {
      console.error("Get expiring locks error:", error);
      res.status(500).json({ error: "Failed to get expiring locks" });
    }
  });

  // Extend a rate lock
  app.post("/api/rate-locks/:id/extend", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Only staff can extend rate locks" });
      }

      const { id } = req.params;
      const { additionalDays, extensionFee } = req.body;

      const lock = await storage.getRateLock(id);
      if (!lock) {
        return res.status(404).json({ error: "Rate lock not found" });
      }

      if (lock.status !== "active") {
        return res.status(400).json({ error: "Can only extend active rate locks" });
      }

      const currentExpiry = new Date(lock.expiresAt);
      const newExpiry = new Date(currentExpiry.getTime() + (additionalDays || 15) * 24 * 60 * 60 * 1000);

      const updated = await storage.updateRateLock(id, {
        expiresAt: newExpiry,
        extensionCount: (lock.extensionCount || 0) + 1,
        originalExpiresAt: lock.originalExpiresAt || lock.expiresAt,
        extensionFee: extensionFee?.toString(),
        status: "extended",
      });

      // Log activity
      await storage.createDealActivity({
        applicationId: lock.applicationId,
        activityType: "rate_lock_extended",
        title: "Rate Lock Extended",
        description: `Rate lock extended by ${additionalDays || 15} days`,
        performedBy: user.id,
      });

      res.json(updated);
    } catch (error) {
      console.error("Extend rate lock error:", error);
      res.status(500).json({ error: "Failed to extend rate lock" });
    }
  });

  // Cancel a rate lock
  app.post("/api/rate-locks/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Only staff can cancel rate locks" });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const lock = await storage.getRateLock(id);
      if (!lock) {
        return res.status(404).json({ error: "Rate lock not found" });
      }

      const updated = await storage.updateRateLock(id, {
        status: "cancelled",
        cancelledBy: user.id,
        cancelledAt: new Date(),
        cancelReason: reason,
      });

      res.json(updated);
    } catch (error) {
      console.error("Cancel rate lock error:", error);
      res.status(500).json({ error: "Failed to cancel rate lock" });
    }
  });

  // ===== ECONSENT SYSTEM =====

  // Get consent templates
  app.get("/api/consent-templates", isAuthenticated, async (req, res) => {
    try {
      const { type, state } = req.query;
      const templates = await storage.getActiveConsentTemplates(
        type as string | undefined,
        state as string | undefined
      );
      res.json(templates);
    } catch (error) {
      console.error("Get consent templates error:", error);
      res.status(500).json({ error: "Failed to get consent templates" });
    }
  });

  // Create consent template (admin only)
  app.post("/api/consent-templates", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        consentType: z.string(),
        version: z.string(),
        state: z.string().optional(),
        title: z.string(),
        shortDescription: z.string().optional(),
        fullText: z.string(),
        regulatoryReference: z.string().optional(),
        requiredForLoanTypes: z.array(z.string()).optional(),
        effectiveDate: z.string().transform(s => new Date(s)),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const template = await storage.createConsentTemplate({
        ...result.data,
        isActive: true,
      });

      res.status(201).json(template);
    } catch (error) {
      console.error("Create consent template error:", error);
      res.status(500).json({ error: "Failed to create consent template" });
    }
  });

  // Record borrower consent
  app.post("/api/consents", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      const schema = z.object({
        applicationId: z.string().optional(),
        templateId: z.string().optional(),
        consentType: z.string(),
        templateVersion: z.string().optional(),
        consentGiven: z.boolean(),
        consentMethod: z.enum(["click", "signature", "verbal", "paper"]),
        signatureData: z.string().optional(),
        signatureType: z.enum(["drawn", "typed", "none"]).optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Generate content hash for tamper evidence
      const contentHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(result.data) + new Date().toISOString())
        .digest("hex");

      const consent = await storage.createBorrowerConsent({
        userId: user.id,
        ...result.data,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        contentHash,
        consentedAt: new Date(),
      });

      // Log activity if application-related
      if (result.data.applicationId) {
        await storage.createDealActivity({
          applicationId: result.data.applicationId,
          activityType: "consent_given",
          title: `Consent: ${result.data.consentType}`,
          description: `Borrower provided ${result.data.consentType} consent`,
          performedBy: user.id,
        });
      }

      res.status(201).json(consent);
    } catch (error) {
      console.error("Record consent error:", error);
      res.status(500).json({ error: "Failed to record consent" });
    }
  });

  // Get consents for current user
  app.get("/api/consents/me", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const consents = await storage.getBorrowerConsentsByUser(user.id);
      res.json(consents);
    } catch (error) {
      console.error("Get user consents error:", error);
      res.status(500).json({ error: "Failed to get consents" });
    }
  });

  // Get consents for an application
  app.get("/api/consents/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const consents = await storage.getBorrowerConsentsByApplication(applicationId);
      res.json(consents);
    } catch (error) {
      console.error("Get application consents error:", error);
      res.status(500).json({ error: "Failed to get consents" });
    }
  });

  // Check if specific consent exists for application
  app.get("/api/consents/check/:applicationId/:consentType", isAuthenticated, async (req, res) => {
    try {
      const { applicationId, consentType } = req.params;
      const consent = await storage.getConsentByTypeAndApplication(consentType, applicationId);
      res.json({ hasConsent: !!consent, consent });
    } catch (error) {
      console.error("Check consent error:", error);
      res.status(500).json({ error: "Failed to check consent" });
    }
  });

  // ===== PARTNER API INTEGRATIONS =====

  // Get all partner providers
  app.get("/api/partner-providers", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const { serviceType } = req.query;
      let providers;
      if (serviceType) {
        providers = await storage.getPartnerProvidersByServiceType(serviceType as string);
      } else {
        providers = await storage.getAllPartnerProviders();
      }
      res.json(providers);
    } catch (error) {
      console.error("Get partner providers error:", error);
      res.status(500).json({ error: "Failed to get providers" });
    }
  });

  // Create partner provider (admin only)
  app.post("/api/partner-providers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string(),
        code: z.string(),
        serviceType: z.string(),
        apiBaseUrl: z.string().optional(),
        apiVersion: z.string().optional(),
        baseFee: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        expectedTurnaroundHours: z.number().optional(),
        isTestMode: z.boolean().default(true),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const provider = await storage.createPartnerProvider({
        ...result.data,
        isActive: true,
      });

      res.status(201).json(provider);
    } catch (error) {
      console.error("Create partner provider error:", error);
      res.status(500).json({ error: "Failed to create provider" });
    }
  });

  // Create partner order (credit, title, appraisal, etc.)
  app.post("/api/partner-orders", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Only staff can create partner orders" });
      }

      const schema = z.object({
        applicationId: z.string(),
        providerId: z.string(),
        serviceType: z.string(),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const provider = await storage.getPartnerProvider(result.data.providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const order = await storage.createPartnerOrder({
        ...result.data,
        status: "pending",
        orderedBy: user.id,
        orderedAt: new Date(),
        fee: provider.baseFee,
      });

      // Log activity
      await storage.createDealActivity({
        applicationId: result.data.applicationId,
        activityType: "partner_order_created",
        title: `${result.data.serviceType} Order Created`,
        description: `Order placed with ${provider.name}`,
        metadata: { orderId: order.id, providerId: provider.id },
        performedBy: user.id,
      });

      res.status(201).json(order);
    } catch (error) {
      console.error("Create partner order error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Get partner orders for an application
  app.get("/api/partner-orders/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const orders = await storage.getPartnerOrdersByApplication(applicationId);
      res.json(orders);
    } catch (error) {
      console.error("Get partner orders error:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  // Update partner order status (webhook simulation / manual update)
  app.patch("/api/partner-orders/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const { id } = req.params;
      const schema = z.object({
        status: z.enum(["pending", "submitted", "in_progress", "completed", "failed", "cancelled"]).optional(),
        resultSummary: z.record(z.any()).optional(),
        creditScoreExperian: z.number().optional(),
        creditScoreEquifax: z.number().optional(),
        creditScoreTransUnion: z.number().optional(),
        appraisedValue: z.string().optional(),
        titleStatus: z.string().optional(),
        completedAt: z.string().transform(s => new Date(s)).optional(),
        errorMessage: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const updated = await storage.updatePartnerOrder(id, result.data as any);
      if (!updated) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update partner order error:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // ===== DEAL TEAM MEMBERS =====

  // Get team members for an application
  app.get("/api/applications/:applicationId/team", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;

      // Verify access to application
      const app = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!app) {
        return res.status(404).json({ error: "Application not found" });
      }

      const team = await storage.getDealTeamMembers(applicationId);
      res.json(team);
    } catch (error) {
      console.error("Get deal team error:", error);
      res.status(500).json({ error: "Failed to get team members" });
    }
  });

  // Add team member to application (staff only)
  app.post("/api/applications/:applicationId/team", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const { applicationId } = req.params;
      const schema = z.object({
        userId: z.string().optional(),
        teamRole: z.string().min(1),
        externalName: z.string().optional(),
        externalEmail: z.string().email().optional(),
        externalPhone: z.string().optional(),
        externalCompany: z.string().optional(),
        isPrimary: z.boolean().optional(),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Verify application exists
      const app = await storage.getLoanApplication(applicationId);
      if (!app) {
        return res.status(404).json({ error: "Application not found" });
      }

      const member = await storage.createDealTeamMember({
        ...result.data,
        applicationId,
        assignedBy: user.id,
        assignedAt: new Date(),
      });

      // Log activity
      await storage.createDealActivity({
        applicationId,
        activityType: "team_updated",
        title: "Team member added",
        description: `${result.data.externalName || 'Team member'} added as ${result.data.teamRole.replace(/_/g, ' ')}`,
        performedBy: user.id,
      });

      res.status(201).json(member);
    } catch (error) {
      console.error("Add team member error:", error);
      res.status(500).json({ error: "Failed to add team member" });
    }
  });

  // Withdraw/cancel loan application (borrower can withdraw their own apps)
  app.post("/api/loan-applications/:applicationId/withdraw", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;

      const schema = z.object({
        reason: z.string().min(1),
        details: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Get the application
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Check ownership - borrower can only withdraw their own apps, staff can withdraw any
      if (!isStaffRole(user.role) && application.userId !== user.id) {
        return res.status(403).json({ error: "You can only withdraw your own applications" });
      }

      // Check if already withdrawn or in a terminal state
      if (["withdrawn", "closed", "denied"].includes(application.status)) {
        return res.status(400).json({ error: "Application cannot be withdrawn in its current state" });
      }

      // Update application status to withdrawn
      const updatedApp = await storage.updateLoanApplication(applicationId, {
        status: "withdrawn",
      });

      // Log the withdrawal activity
      await storage.createDealActivity({
        applicationId,
        activityType: "application_withdrawn",
        title: "Application Withdrawn",
        description: `Application withdrawn by ${user.role === "borrower" ? "borrower" : "staff"}. Reason: ${result.data.reason}${result.data.details ? `. Details: ${result.data.details}` : ""}`,
        performedBy: user.id,
        metadata: {
          reason: result.data.reason,
          details: result.data.details || "",
          withdrawnAt: new Date().toISOString(),
        },
      });

      res.json({ success: true, application: updatedApp });
    } catch (error) {
      console.error("Withdraw application error:", error);
      res.status(500).json({ error: "Failed to withdraw application" });
    }
  });

  // Update team member
  app.patch("/api/deal-team/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const { id } = req.params;
      const schema = z.object({
        teamRole: z.string().optional(),
        externalName: z.string().optional(),
        externalEmail: z.string().email().optional(),
        externalPhone: z.string().optional(),
        externalCompany: z.string().optional(),
        isPrimary: z.boolean().optional(),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const updated = await storage.updateDealTeamMember(id, result.data);
      if (!updated) {
        return res.status(404).json({ error: "Team member not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update team member error:", error);
      res.status(500).json({ error: "Failed to update team member" });
    }
  });

  // Remove team member
  app.delete("/api/deal-team/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const { id } = req.params;
      
      const member = await storage.getDealTeamMember(id);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }

      await storage.removeDealTeamMember(id);

      // Log activity
      await storage.createDealActivity({
        applicationId: member.applicationId,
        activityType: "team_updated",
        title: "Team member removed",
        description: `Team member removed from ${member.teamRole.replace(/_/g, ' ')} role`,
        performedBy: user.id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Remove team member error:", error);
      res.status(500).json({ error: "Failed to remove team member" });
    }
  });

  // Get all applications where user is a team member (for staff)
  app.get("/api/my-team-assignments", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const assignments = await storage.getTeamMembersByUser(user.id);
      res.json(assignments);
    } catch (error) {
      console.error("Get team assignments error:", error);
      res.status(500).json({ error: "Failed to get assignments" });
    }
  });

  // Get available staff for team assignment
  app.get("/api/available-staff", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const allUsers = await storage.getAllUsers();
      const staffMembers = allUsers.filter(u => isStaffRole(u.role));
      
      // Return minimal info for privacy
      const staff = staffMembers.map(s => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        role: s.role,
      }));

      res.json(staff);
    } catch (error) {
      console.error("Get available staff error:", error);
      res.status(500).json({ error: "Failed to get staff" });
    }
  });

  // ===== ANALYTICS DASHBOARD =====

  // Get pipeline metrics
  app.get("/api/analytics/pipeline", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const metrics = await storage.computePipelineMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get pipeline metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // Get bottleneck analysis
  app.get("/api/analytics/bottlenecks", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const analysis = await storage.getBottleneckAnalysis();
      res.json(analysis);
    } catch (error) {
      console.error("Get bottleneck analysis error:", error);
      res.status(500).json({ error: "Failed to get analysis" });
    }
  });

  // Get staff workload metrics
  app.get("/api/analytics/workload", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const metrics = await storage.getStaffWorkloadMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get workload metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // Get historical snapshots
  app.get("/api/analytics/history", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const days = parseInt(req.query.days as string) || 30;
      const snapshots = await storage.getAnalyticsSnapshots(days);
      res.json(snapshots);
    } catch (error) {
      console.error("Get analytics history error:", error);
      res.status(500).json({ error: "Failed to get history" });
    }
  });

  // Get SLA configurations
  app.get("/api/sla-configurations", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const configs = await storage.getAllSlaConfigurations();
      res.json(configs);
    } catch (error) {
      console.error("Get SLA configs error:", error);
      res.status(500).json({ error: "Failed to get configurations" });
    }
  });

  // Create SLA configuration (admin only)
  app.post("/api/sla-configurations", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string(),
        description: z.string().optional(),
        applicationToProcessingHours: z.number().optional(),
        processingToUnderwritingHours: z.number().optional(),
        underwritingDecisionHours: z.number().optional(),
        conditionalToCtcHours: z.number().optional(),
        ctcToClosingHours: z.number().optional(),
        totalApplicationToCloseHours: z.number().optional(),
        loanType: z.string().optional(),
        effectiveDate: z.string().transform(s => new Date(s)),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const config = await storage.createSlaConfiguration({
        ...result.data,
        isActive: true,
      });

      res.status(201).json(config);
    } catch (error) {
      console.error("Create SLA config error:", error);
      res.status(500).json({ error: "Failed to create configuration" });
    }
  });

  // Get application milestones
  app.get("/api/application-milestones/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const milestone = await storage.getApplicationMilestone(applicationId);
      res.json(milestone || null);
    } catch (error) {
      console.error("Get application milestones error:", error);
      res.status(500).json({ error: "Failed to get milestones" });
    }
  });

  // Update application milestones
  app.patch("/api/application-milestones/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const { applicationId } = req.params;
      
      // Get or create milestone record
      let milestone = await storage.getApplicationMilestone(applicationId);
      if (!milestone) {
        milestone = await storage.createApplicationMilestone({ applicationId });
      }

      const updated = await storage.updateApplicationMilestone(applicationId, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Update application milestones error:", error);
      res.status(500).json({ error: "Failed to update milestones" });
    }
  });

  // ============================================
  // Referral Link System Routes
  // ============================================
  
  // Get or generate referral code for current LO user
  app.get("/api/my-referral-code", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Only LOs, partners, or staff can have referral codes
      const allowedRoles = ['lo', 'loa', 'admin'];
      if (!allowedRoles.includes(user.role) && !user.isPartner) {
        return res.status(403).json({ error: "Only Loan Officers can generate referral codes" });
      }
      
      const referralCode = await storage.generateReferralCode(user.id);
      res.json({ 
        referralCode, 
        referralLink: `/ref/${referralCode}`,
        fullUrl: `${req.protocol}://${req.get('host')}/ref/${referralCode}`
      });
    } catch (error) {
      console.error("Get referral code error:", error);
      res.status(500).json({ error: "Failed to get referral code" });
    }
  });
  
  // Get referral stats for current LO
  app.get("/api/my-referral-stats", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const stats = await storage.getReferralStats(user.id);
      res.json(stats);
    } catch (error) {
      console.error("Get referral stats error:", error);
      res.status(500).json({ error: "Failed to get referral stats" });
    }
  });
  
  // Get list of users referred by current LO
  app.get("/api/my-referrals", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const referrals = await storage.getReferralsByUser(user.id);
      
      // Get applications for each referred user
      const referralsWithApps = await Promise.all(referrals.map(async (referredUser) => {
        const apps = await storage.getLoanApplicationsByUser(referredUser.id);
        return {
          ...referredUser,
          applicationCount: apps.length,
          latestApplication: apps[0] || null,
        };
      }));
      
      res.json(referralsWithApps);
    } catch (error) {
      console.error("Get referrals error:", error);
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });
  
  // Validate a referral code and get LO info (public route for landing page)
  app.get("/api/referral/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const referrer = await storage.getUserByReferralCode(code);
      
      if (!referrer) {
        return res.status(404).json({ error: "Invalid referral code" });
      }
      
      // Return public profile info about the referrer
      res.json({
        valid: true,
        loName: `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim() || 'Your Loan Officer',
        firstName: referrer.firstName,
        lastName: referrer.lastName,
        email: referrer.email,
        profileImageUrl: referrer.profileImageUrl,
        nmlsId: referrer.nmlsId,
        companyName: referrer.partnerCompanyName,
      });
    } catch (error) {
      console.error("Validate referral code error:", error);
      res.status(500).json({ error: "Failed to validate referral code" });
    }
  });
  
  // Apply referral code to current user (called after signup with ref code)
  app.post("/api/apply-referral", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({ error: "Referral code is required" });
      }
      
      // Check if user already has a referrer
      if (user.referredByUserId) {
        return res.status(400).json({ error: "You already have a referring loan officer" });
      }
      
      const referrer = await storage.getUserByReferralCode(referralCode);
      if (!referrer) {
        return res.status(404).json({ error: "Invalid referral code" });
      }
      
      // Can't refer yourself
      if (referrer.id === user.id) {
        return res.status(400).json({ error: "Cannot use your own referral code" });
      }
      
      await storage.setUserReferredBy(user.id, referrer.id);
      
      res.json({ 
        success: true, 
        message: `You've been connected with ${referrer.firstName || 'your'} ${referrer.lastName || 'loan officer'}!`
      });
    } catch (error) {
      console.error("Apply referral error:", error);
      res.status(500).json({ error: "Failed to apply referral code" });
    }
  });

  // ============================================================================
  // DOCUMENT PACKAGES - Lender-Ready Document Organization
  // ============================================================================

  // Validation schemas for document packages - using drizzle-zod schemas from shared/schema.ts
  const createPackageValidation = insertDocumentPackageSchema.omit({ createdByUserId: true });
  const updatePackageValidation = insertDocumentPackageSchema.partial().omit({ 
    createdByUserId: true, 
    applicationId: true 
  });
  const addPackageItemValidation = insertDocumentPackageItemSchema.omit({ packageId: true });
  const updatePackageItemValidation = insertDocumentPackageItemSchema.partial().omit({ 
    packageId: true, 
    documentId: true 
  });

  // Create document package
  app.post("/api/document-packages", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const parsed = createPackageValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid package data", details: parsed.error.flatten() });
      }

      // Verify application exists before creating package
      const application = await storage.getLoanApplication(parsed.data.applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const packageData = {
        ...parsed.data,
        createdByUserId: user.id,
      };

      const pkg = await storage.createDocumentPackage(packageData);

      await storage.createDealActivity({
        applicationId: pkg.applicationId,
        activityType: "note",
        title: "Document Package Created",
        description: `Created package: ${pkg.name}`,
        performedBy: user.id,
      });

      res.status(201).json(pkg);
    } catch (error) {
      console.error("Create document package error:", error);
      res.status(500).json({ error: "Failed to create document package" });
    }
  });

  // Get document packages for application
  app.get("/api/applications/:applicationId/document-packages", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const user = req.user as User;

      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== user.id && !isStaffRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const packages = await storage.getDocumentPackagesByApplication(applicationId);
      res.json(packages);
    } catch (error) {
      console.error("Get document packages error:", error);
      res.status(500).json({ error: "Failed to get document packages" });
    }
  });

  // Get single document package with items
  app.get("/api/document-packages/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;

      const pkg = await storage.getDocumentPackage(id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      const application = await storage.getLoanApplication(pkg.applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== user.id && !isStaffRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const items = await storage.getDocumentPackageItems(id);
      res.json({ ...pkg, items });
    } catch (error) {
      console.error("Get document package error:", error);
      res.status(500).json({ error: "Failed to get document package" });
    }
  });

  // Update document package
  app.patch("/api/document-packages/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Verify package exists and staff can access
      const existingPkg = await storage.getDocumentPackage(id);
      if (!existingPkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      const parsed = updatePackageValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid update data", details: parsed.error.flatten() });
      }

      // Handle status transitions and set timestamps
      const updateData: any = { ...parsed.data };
      if (parsed.data.status === "sent" && existingPkg.status !== "sent") {
        updateData.sentAt = new Date();
      }
      if (parsed.data.status === "acknowledged" && existingPkg.status !== "acknowledged") {
        updateData.acknowledgedAt = new Date();
      }

      const pkg = await storage.updateDocumentPackage(id, updateData);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      res.json(pkg);
    } catch (error) {
      console.error("Update document package error:", error);
      res.status(500).json({ error: "Failed to update document package" });
    }
  });

  // Delete document package
  app.delete("/api/document-packages/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Verify package exists before deleting
      const pkg = await storage.getDocumentPackage(id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      await storage.deleteDocumentPackage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete document package error:", error);
      res.status(500).json({ error: "Failed to delete document package" });
    }
  });

  // Add document to package
  app.post("/api/document-packages/:packageId/items", isAuthenticated, async (req, res) => {
    try {
      const { packageId } = req.params;
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Verify package exists
      const pkg = await storage.getDocumentPackage(packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      const parsed = addPackageItemValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid item data", details: parsed.error.flatten() });
      }

      const item = await storage.addDocumentToPackage({
        ...parsed.data,
        packageId,
      });

      res.status(201).json(item);
    } catch (error) {
      console.error("Add document to package error:", error);
      res.status(500).json({ error: "Failed to add document to package" });
    }
  });

  // Update package item
  app.patch("/api/document-package-items/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const parsed = updatePackageItemValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid update data", details: parsed.error.flatten() });
      }

      const item = await storage.updateDocumentPackageItem(id, parsed.data);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      res.json(item);
    } catch (error) {
      console.error("Update package item error:", error);
      res.status(500).json({ error: "Failed to update package item" });
    }
  });

  // Remove document from package
  app.delete("/api/document-package-items/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      await storage.removeDocumentFromPackage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove document from package error:", error);
      res.status(500).json({ error: "Failed to remove document from package" });
    }
  });

  // Get documents for application (for package builder)
  app.get("/api/applications/:applicationId/documents", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const user = req.user as User;

      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== user.id && !isStaffRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const docs = await storage.getDocumentsByApplication(applicationId);
      res.json(docs);
    } catch (error) {
      console.error("Get application documents error:", error);
      res.status(500).json({ error: "Failed to get documents" });
    }
  });

  // ============================================
  // Team Messaging API Routes
  // ============================================

  // Get all staff users for team display
  app.get("/api/team-members", isAuthenticated, async (req, res) => {
    try {
      const staffUsersWithPresence = await storage.getTeamMembersWithPresence();
      
      // Transform to include display info and presence
      const teamMembers = staffUsersWithPresence.map(user => ({
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Team Member',
        role: user.role,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        initials: getInitials(user),
        presenceStatus: user.presenceStatus,
      }));
      
      res.json(teamMembers);
    } catch (error) {
      console.error("Get team members error:", error);
      res.status(500).json({ error: "Failed to get team members" });
    }
  });
  
  // Update presence (heartbeat endpoint)
  app.post("/api/presence/heartbeat", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      await storage.updateUserPresence(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Presence update error:", error);
      res.status(500).json({ error: "Failed to update presence" });
    }
  });

  // Get all conversations for current user
  app.get("/api/messages/conversations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const conversations = await storage.getConversations(userId);
      
      // Get partner info for each conversation
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const partner = await storage.getUser(conv.partnerId);
          return {
            ...conv,
            partner: partner ? {
              id: partner.id,
              name: `${partner.firstName || ''} ${partner.lastName || ''}`.trim() || partner.email || 'User',
              role: partner.role,
              email: partner.email,
              profileImageUrl: partner.profileImageUrl,
              initials: getInitials(partner),
            } : null,
          };
        })
      );
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  // Get messages with a specific user
  app.get("/api/messages/:otherUserId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { otherUserId } = req.params;
      
      const messages = await storage.getMessages(userId, otherUserId);
      
      // Mark messages as read
      await storage.markMessagesAsRead(userId, otherUserId);
      
      res.json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Send a message (supports regular text and document requests)
  app.post("/api/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { recipientId, message, applicationId, messageType, documentRequestData } = req.body;
      
      if (!recipientId || !message) {
        return res.status(400).json({ error: "recipientId and message are required" });
      }
      
      // Verify recipient exists
      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }
      
      const newMessage = await storage.sendMessage({
        senderId: userId,
        recipientId,
        message,
        applicationId: applicationId || null,
        messageType: messageType || 'text',
        documentRequestData: documentRequestData || null,
        isRead: false,
      });
      
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  
  // Update document request status (when borrower uploads or staff approves)
  app.patch("/api/messages/:messageId/document-request", isAuthenticated, async (req, res) => {
    try {
      const { messageId } = req.params;
      const { status, documentId } = req.body;
      
      if (!status || !['pending', 'submitted', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Valid status is required" });
      }
      
      const updated = await storage.updateDocumentRequestStatus(messageId, status, documentId);
      
      if (!updated) {
        return res.status(404).json({ error: "Document request not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Update document request error:", error);
      res.status(500).json({ error: "Failed to update document request" });
    }
  });
  
  // Get pending document requests for current user
  app.get("/api/messages/document-requests/pending", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const pendingRequests = await storage.getPendingDocumentRequests(userId);
      res.json(pendingRequests);
    } catch (error) {
      console.error("Get pending document requests error:", error);
      res.status(500).json({ error: "Failed to get pending document requests" });
    }
  });

  // Get unread message count
  app.get("/api/messages/unread/count", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  // Helper function to get initials from user
  function getInitials(user: User): string {
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'TM';
  }

  // ================================
  // Agent Co-Branding Portal API Routes
  // ================================

  // Get or create co-brand profile for current user
  app.get("/api/co-brand/profile", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getCoBrandProfileByUser(req.user!.id);
      res.json(profile || null);
    } catch (error) {
      console.error("Get co-brand profile error:", error);
      res.status(500).json({ error: "Failed to get co-brand profile" });
    }
  });

  // Create co-brand profile
  app.post("/api/co-brand/profile", isAuthenticated, async (req, res) => {
    try {
      const existing = await storage.getCoBrandProfileByUser(req.user!.id);
      if (existing) {
        return res.status(409).json({ error: "Co-brand profile already exists", profile: existing });
      }

      const { brandName, tagline, contactEmail, contactPhone, websiteUrl, nmlsId, licenseNumber, disclaimerText, bio, specialties, serviceAreas, primaryColor, accentColor } = req.body;
      if (!brandName) {
        return res.status(400).json({ error: "Brand name is required" });
      }

      const profile = await storage.createCoBrandProfile({
        userId: req.user!.id,
        brandName,
        tagline: tagline || null,
        contactEmail: contactEmail || req.user!.email || null,
        contactPhone: contactPhone || null,
        websiteUrl: websiteUrl || null,
        nmlsId: nmlsId || null,
        licenseNumber: licenseNumber || null,
        disclaimerText: disclaimerText || null,
        bio: bio || null,
        specialties: specialties || null,
        serviceAreas: serviceAreas || null,
        primaryColor: primaryColor || "#1e3a5f",
        accentColor: accentColor || "#10b981",
      });
      res.json(profile);
    } catch (error) {
      console.error("Create co-brand profile error:", error);
      res.status(500).json({ error: "Failed to create co-brand profile" });
    }
  });

  // Update co-brand profile
  app.patch("/api/co-brand/profile/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getCoBrandProfile(req.params.id);
      if (!profile || profile.userId !== req.user!.id) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const allowedFields = [
        "brandName", "tagline", "logoUrl", "heroImageUrl", "primaryColor", "accentColor",
        "contactEmail", "contactPhone", "websiteUrl", "nmlsId", "licenseNumber",
        "disclaimerText", "bio", "specialties", "serviceAreas", "isActive",
      ];
      const safeUpdate: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) safeUpdate[key] = req.body[key];
      }

      const updated = await storage.updateCoBrandProfile(req.params.id, safeUpdate);
      res.json(updated);
    } catch (error) {
      console.error("Update co-brand profile error:", error);
      res.status(500).json({ error: "Failed to update co-brand profile" });
    }
  });

  // Public endpoint - Get co-brand profile by user ID (for public landing pages)
  app.get("/api/co-brand/public/:id", async (req, res) => {
    try {
      let profile = await storage.getCoBrandProfile(req.params.id);
      if (!profile) {
        profile = await storage.getCoBrandProfileByUser(req.params.id);
      }
      if (!profile || !profile.isActive) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const user = await storage.getUser(profile.userId);
      res.json({
        brandName: profile.brandName,
        tagline: profile.tagline,
        logoUrl: profile.logoUrl,
        heroImageUrl: profile.heroImageUrl,
        primaryColor: profile.primaryColor,
        accentColor: profile.accentColor,
        contactEmail: profile.contactEmail,
        contactPhone: profile.contactPhone,
        websiteUrl: profile.websiteUrl,
        nmlsId: profile.nmlsId,
        licenseNumber: profile.licenseNumber,
        disclaimerText: profile.disclaimerText,
        bio: profile.bio,
        specialties: profile.specialties,
        serviceAreas: profile.serviceAreas,
        loName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Loan Officer",
        loProfileImage: user?.profileImageUrl || null,
      });
    } catch (error) {
      console.error("Get public co-brand error:", error);
      res.status(500).json({ error: "Failed to get co-brand profile" });
    }
  });

  // Get referred client statuses for current user
  app.get("/api/co-brand/referrals", isAuthenticated, async (req, res) => {
    try {
      const invites = await storage.getApplicationInvitesByReferrer(req.user!.id);
      const enriched = await Promise.all(invites.map(async (inv: any) => {
        let appStatus = null;
        let appStage = null;
        if (inv.loanApplicationId) {
          const app = await storage.getLoanApplication(inv.loanApplicationId);
          appStatus = app?.status || null;
          appStage = (app as any)?.currentStage || app?.status || null;
        }
        return {
          id: inv.id,
          clientName: inv.clientName,
          clientEmail: inv.clientEmail,
          status: inv.status,
          createdAt: inv.createdAt,
          clickedAt: inv.clickedAt,
          appliedAt: inv.appliedAt,
          applicationStatus: appStatus,
          applicationStage: appStage,
        };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Get referral statuses error:", error);
      res.status(500).json({ error: "Failed to get referral statuses" });
    }
  });

  // ================================
  // Deal Desk API Routes
  // ================================

  // Create a deal desk thread
  app.post("/api/deal-desk/threads", isAuthenticated, async (req, res) => {
    try {
      const { subject, scenarioType, loanAmount, propertyType, creditScore, borrowerType, notes } = req.body;
      if (!subject) {
        return res.status(400).json({ error: "Subject is required" });
      }

      const thread = await storage.createDealDeskThread({
        agentUserId: req.user!.id,
        subject,
        scenarioType: scenarioType || null,
        loanAmount: loanAmount || null,
        propertyType: propertyType || null,
        creditScore: creditScore || null,
        borrowerType: borrowerType || null,
        notes: notes || null,
        status: "open",
      });

      if (notes) {
        await storage.createDealDeskMessage({
          threadId: thread.id,
          senderUserId: req.user!.id,
          content: notes,
        });
      }

      res.json(thread);
    } catch (error) {
      console.error("Create deal desk thread error:", error);
      res.status(500).json({ error: "Failed to create thread" });
    }
  });

  // Get deal desk threads for current user
  app.get("/api/deal-desk/threads", isAuthenticated, async (req, res) => {
    try {
      const threads = await storage.getDealDeskThreadsByUser(req.user!.id);
      res.json(threads);
    } catch (error) {
      console.error("Get deal desk threads error:", error);
      res.status(500).json({ error: "Failed to get threads" });
    }
  });

  // Get a specific thread with messages
  app.get("/api/deal-desk/threads/:id", isAuthenticated, async (req, res) => {
    try {
      const thread = await storage.getDealDeskThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (thread.agentUserId !== req.user!.id && thread.loUserId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await storage.getDealDeskMessagesByThread(thread.id);
      const enrichedMessages = await Promise.all(messages.map(async (msg: any) => {
        const sender = await storage.getUser(msg.senderUserId);
        return {
          ...msg,
          senderName: sender ? `${sender.firstName || ""} ${sender.lastName || ""}`.trim() : "Unknown",
        };
      }));

      res.json({ thread, messages: enrichedMessages });
    } catch (error) {
      console.error("Get deal desk thread error:", error);
      res.status(500).json({ error: "Failed to get thread" });
    }
  });

  // Add message to a deal desk thread
  app.post("/api/deal-desk/threads/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const thread = await storage.getDealDeskThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (thread.agentUserId !== req.user!.id && thread.loUserId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const message = await storage.createDealDeskMessage({
        threadId: thread.id,
        senderUserId: req.user!.id,
        content,
      });

      res.json(message);
    } catch (error) {
      console.error("Create deal desk message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Close a deal desk thread
  app.patch("/api/deal-desk/threads/:id/close", isAuthenticated, async (req, res) => {
    try {
      const thread = await storage.getDealDeskThread(req.params.id);
      if (!thread || thread.agentUserId !== req.user!.id) {
        return res.status(404).json({ error: "Thread not found" });
      }
      const updated = await storage.updateDealDeskThread(thread.id, { status: "closed", closedAt: new Date() });
      res.json(updated);
    } catch (error) {
      console.error("Close deal desk thread error:", error);
      res.status(500).json({ error: "Failed to close thread" });
    }
  });

  // ================================
  // DPA Programs API Routes
  // ================================

  // Get DPA programs with optional filters
  app.get("/api/dpa-programs", async (req, res) => {
    try {
      const { state, firstTimeBuyer, minCreditScore, maxIncome } = req.query;
      const filters: any = {};
      if (state) filters.state = state as string;
      if (firstTimeBuyer === "true") filters.firstTimeBuyer = true;
      if (minCreditScore) filters.minCreditScore = parseInt(minCreditScore as string);
      if (maxIncome) filters.maxIncome = parseFloat(maxIncome as string);

      const programs = await storage.getDpaPrograms(Object.keys(filters).length > 0 ? filters : undefined);

      let filtered = programs;
      if (filters.firstTimeBuyer === true) {
        // Show all programs (both first-time-only and general) since first-time buyers qualify for both
      } else if (filters.firstTimeBuyer === false) {
        filtered = programs.filter(p => !p.firstTimeBuyerOnly);
      }
      if (filters.minCreditScore) {
        filtered = filtered.filter(p => !p.minCreditScore || p.minCreditScore <= filters.minCreditScore);
      }
      if (filters.maxIncome) {
        filtered = filtered.filter(p => !p.maxIncome || parseFloat(p.maxIncome) >= filters.maxIncome);
      }

      res.json(filtered);
    } catch (error) {
      console.error("Get DPA programs error:", error);
      res.status(500).json({ error: "Failed to get DPA programs" });
    }
  });

  // Get specific DPA program
  app.get("/api/dpa-programs/:id", async (req, res) => {
    try {
      const program = await storage.getDpaProgram(req.params.id);
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }
      res.json(program);
    } catch (error) {
      console.error("Get DPA program error:", error);
      res.status(500).json({ error: "Failed to get program" });
    }
  });

  // ================================
  // Digital Onboarding API Routes
  // ================================

  function detectBorrowerType(app: any): string {
    if (!app) return "standard";
    if (app.employmentType === "self_employed") return "self_employed";
    if (app.isFirstTimeBuyer) return "first_time_buyer";
    const nonQmIndicators = [
      app.loanType && !["conventional", "fha", "va", "usda"].includes(app.loanType),
      app.creditScore && app.creditScore < 620,
      app.incomeDocType === "bank_statement" || app.incomeDocType === "asset_based",
    ];
    if (nonQmIndicators.some(Boolean)) return "non_qm";
    return "standard";
  }

  // Get onboarding status - aggregates identity, KYC, profile data
  app.get("/api/onboarding/status", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;

      const [profile, kbaSessions, kycScreenings, verificationRecords, applications] = await Promise.all([
        storage.getOnboardingProfileByUser(userId),
        storage.getKbaSessionsByUser(userId),
        storage.getKycScreeningsByUser(userId),
        storage.getVerificationsByUser(userId),
        storage.getLoanApplicationsByUser(userId),
      ]);

      const latestKba = kbaSessions[0];
      const latestKyc = kycScreenings[0];
      const latestApp = applications[0];

      const borrowerType = detectBorrowerType(latestApp);

      res.json({
        profile: profile || null,
        kba: latestKba ? { id: latestKba.id, status: latestKba.status, score: latestKba.score, attemptNumber: latestKba.attemptNumber, maxAttempts: latestKba.maxAttempts } : null,
        kyc: latestKyc || null,
        verifications: verificationRecords,
        borrowerType,
        applicationId: latestApp?.id || null,
        applicationStatus: latestApp?.status || null,
      });
    } catch (error) {
      console.error("Get onboarding status error:", error);
      res.status(500).json({ error: "Failed to get onboarding status" });
    }
  });

  // Create or get onboarding profile
  app.post("/api/onboarding/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      let profile = await storage.getOnboardingProfileByUser(userId);

      if (!profile) {
        const applications = await storage.getLoanApplicationsByUser(userId);
        const latestApp = applications[0];

        const borrowerType = detectBorrowerType(latestApp);

        profile = await storage.createOnboardingProfile({
          userId,
          applicationId: latestApp?.id || null,
          borrowerType,
          journeyStatus: "not_started",
          currentStep: "identity_verification",
        });
      }

      res.json(profile);
    } catch (error) {
      console.error("Create onboarding profile error:", error);
      res.status(500).json({ error: "Failed to create onboarding profile" });
    }
  });

  // Update onboarding profile
  app.patch("/api/onboarding/profile/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getOnboardingProfile(req.params.id);
      if (!profile || profile.userId !== req.user!.id) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const allowedFields = [
        "journeyStatus", "currentStep", "completedSteps", "progressPercent",
        "identityVerified", "kycCleared", "documentsUploaded",
        "personalizedTips", "educationCompleted",
      ];
      const safeUpdate: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          safeUpdate[key] = req.body[key];
        }
      }

      const updated = await storage.updateOnboardingProfile(req.params.id, safeUpdate);
      res.json(updated);
    } catch (error) {
      console.error("Update onboarding profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // KBA - Start a new session
  app.post("/api/onboarding/kba/start", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { applicationId } = req.body;

      const existingSessions = await storage.getKbaSessionsByUser(userId);
      const passedSession = existingSessions.find(s => s.status === "passed");
      if (passedSession) {
        return res.json({ session: passedSession, alreadyPassed: true });
      }

      const failedCount = existingSessions.filter(s => s.status === "failed").length;
      if (failedCount >= 3) {
        return res.status(403).json({ error: "Maximum KBA attempts exceeded. Please contact support." });
      }

      const questions = generateKBAQuestions();

      const session = await storage.createKbaSession({
        userId,
        applicationId: applicationId || null,
        status: "in_progress",
        questionsData: questions.map(q => ({ id: q.id, question: q.question, choices: q.choices, correctIndex: q.correctIndex })),
        totalQuestions: questions.length,
        passingScore: 4,
        attemptNumber: failedCount + 1,
        maxAttempts: 3,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      res.json({
        session: {
          id: session.id,
          status: session.status,
          attemptNumber: session.attemptNumber,
          maxAttempts: session.maxAttempts,
          questions: questions.map(q => ({ id: q.id, question: q.question, choices: q.choices })),
        },
      });
    } catch (error) {
      console.error("Start KBA session error:", error);
      res.status(500).json({ error: "Failed to start KBA session" });
    }
  });

  // KBA - Submit answers
  app.post("/api/onboarding/kba/:id/submit", isAuthenticated, async (req, res) => {
    try {
      const session = await storage.getKbaSession(req.params.id);
      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.status !== "in_progress") {
        return res.status(400).json({ error: "Session is no longer active" });
      }

      if (session.expiresAt && new Date() > session.expiresAt) {
        await storage.updateKbaSession(session.id, { status: "expired" });
        return res.status(400).json({ error: "Session has expired" });
      }

      const { answers } = req.body;
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: "Answers array is required" });
      }

      const questionsData = session.questionsData as any[];

      let correctCount = 0;
      const gradedAnswers = answers.map((answer: { questionId: string; selectedIndex: number }) => {
        const storedQuestion = questionsData.find((q: any) => q.id === answer.questionId);
        const correct = storedQuestion ? answer.selectedIndex === storedQuestion.correctIndex : false;
        if (correct) correctCount++;
        return { questionId: answer.questionId, selectedIndex: answer.selectedIndex, correct };
      });

      const passed = correctCount >= (session.passingScore || 4);
      const status = passed ? "passed" : "failed";

      await storage.updateKbaSession(session.id, {
        status,
        answersData: gradedAnswers,
        score: correctCount,
        completedAt: new Date(),
      });

      if (passed) {
        const profile = await storage.getOnboardingProfileByUser(req.user!.id);
        if (profile) {
          const completedSteps = [...(profile.completedSteps || [])];
          if (!completedSteps.includes("kba_verification")) {
            completedSteps.push("kba_verification");
          }
          await storage.updateOnboardingProfile(profile.id, {
            identityVerified: true,
            completedSteps,
            progressPercent: Math.min(100, (profile.progressPercent || 0) + 20),
          });
        }
      }

      res.json({
        status,
        score: correctCount,
        totalQuestions: questionsData.length,
        passed,
        remainingAttempts: passed ? 0 : Math.max(0, (session.maxAttempts || 3) - (session.attemptNumber || 1)),
      });
    } catch (error) {
      console.error("Submit KBA answers error:", error);
      res.status(500).json({ error: "Failed to submit answers" });
    }
  });

  // KYC/AML - Trigger screening
  app.post("/api/onboarding/kyc/screen", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { applicationId } = req.body;

      const existing = await storage.getKycScreeningsByUser(userId);
      const recentCleared = existing.find(s => s.overallStatus === "cleared" && s.expiresAt && new Date(s.expiresAt) > new Date());
      if (recentCleared) {
        return res.json({ screening: recentCleared, alreadyCleared: true });
      }

      const screening = await storage.createKycScreening({
        userId,
        applicationId: applicationId || null,
        overallStatus: "in_progress",
      });

      simulateKycScreening(screening.id);

      res.json({ screening, message: "KYC/AML screening initiated" });
    } catch (error) {
      console.error("KYC screening error:", error);
      res.status(500).json({ error: "Failed to initiate screening" });
    }
  });

  // KYC/AML - Get screening status
  app.get("/api/onboarding/kyc/status", isAuthenticated, async (req, res) => {
    try {
      const screenings = await storage.getKycScreeningsByUser(req.user!.id);
      res.json({ screening: screenings[0] || null });
    } catch (error) {
      console.error("Get KYC status error:", error);
      res.status(500).json({ error: "Failed to get screening status" });
    }
  });

  // Onboarding Feedback
  app.post("/api/onboarding/feedback", isAuthenticated, async (req, res) => {
    try {
      const feedbackSchema = z.object({
        step: z.string().optional(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        feedbackType: z.enum(["general", "difficulty", "suggestion", "praise"]).optional(),
      });

      const validated = feedbackSchema.parse(req.body);
      const feedback = await storage.createOnboardingFeedback({
        userId: req.user!.id,
        ...validated,
      });

      res.json(feedback);
    } catch (error) {
      console.error("Submit feedback error:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // Helper: Generate KBA questions (simulated - in production, these come from credit bureaus)
  function generateKBAQuestions() {
    return [
      {
        id: "q1",
        question: "Which of the following addresses have you been associated with?",
        choices: ["123 Oak Street, Springfield", "456 Maple Avenue, Portland", "789 Pine Road, Denver", "None of the above"],
        correctIndex: 0,
      },
      {
        id: "q2",
        question: "In which of the following counties have you lived?",
        choices: ["Cook County", "King County", "Maricopa County", "None of the above"],
        correctIndex: 1,
      },
      {
        id: "q3",
        question: "Which of the following phone numbers is associated with you?",
        choices: ["(555) 123-4567", "(555) 234-5678", "(555) 345-6789", "None of the above"],
        correctIndex: 0,
      },
      {
        id: "q4",
        question: "Which financial institution have you had an account with?",
        choices: ["First National Bank", "Pacific Credit Union", "Metro Savings", "None of the above"],
        correctIndex: 2,
      },
      {
        id: "q5",
        question: "What type of vehicle have you previously registered?",
        choices: ["Sedan", "SUV", "Truck", "None of the above"],
        correctIndex: 1,
      },
    ];
  }

  // Helper: Simulate KYC/AML screening (progressive status updates)
  async function simulateKycScreening(screeningId: string) {
    try {
      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        ofacStatus: "cleared",
        ofacCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        sanctionsStatus: "cleared",
        sanctionsCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        pepStatus: "cleared",
        pepCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        adverseMediaStatus: "cleared",
        adverseMediaCheckedAt: new Date(),
        overallStatus: "cleared",
        riskLevel: "low",
        riskScore: 12,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      console.error("KYC simulation error:", error);
      try {
        await storage.updateKycScreening(screeningId, { overallStatus: "failed" });
      } catch {}
    }
  }

  // =============================================
  // Agent Pipeline Routes
  // =============================================
  app.get("/api/agent-pipeline", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const pipeline = await storage.getAgentPipeline(req.user!.id);
      res.json(pipeline);
    } catch (error) {
      console.error("Get agent pipeline error:", error);
      res.status(500).json({ error: "Failed to get agent pipeline" });
    }
  });

  // =============================================
  // Deal Rescue Escalation Routes
  // =============================================
  app.get("/api/deal-rescue", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const status = req.query.status as string | undefined;
      const escalations = await storage.getDealRescueEscalations({
        status,
        reportedByUserId: req.user!.id,
      });
      res.json(escalations);
    } catch (error) {
      console.error("Get deal rescue escalations error:", error);
      res.status(500).json({ error: "Failed to get escalations" });
    }
  });

  app.post("/api/deal-rescue", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const urgency = req.body.urgency || "medium";
      const slaHours: Record<string, number> = {
        critical: 2,
        high: 4,
        medium: 8,
        low: 24,
      };
      const hours = slaHours[urgency] || 8;
      const slaDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);

      const escalation = await storage.createDealRescueEscalation({
        ...req.body,
        reportedByUserId: req.user!.id,
        slaDeadline,
      });
      res.status(201).json(escalation);
    } catch (error) {
      console.error("Create deal rescue escalation error:", error);
      res.status(500).json({ error: "Failed to create escalation" });
    }
  });

  app.put("/api/deal-rescue/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const escalation = await storage.updateDealRescueEscalation(req.params.id, req.body);
      if (!escalation) {
        return res.status(404).json({ error: "Escalation not found" });
      }
      res.json(escalation);
    } catch (error) {
      console.error("Update deal rescue escalation error:", error);
      res.status(500).json({ error: "Failed to update escalation" });
    }
  });

  // =============================================
  // Strategy Sessions Routes
  // =============================================
  app.get("/api/strategy-sessions", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const sessions = await storage.getStrategySessions(req.user!.id);
      res.json(sessions);
    } catch (error) {
      console.error("Get strategy sessions error:", error);
      res.status(500).json({ error: "Failed to get strategy sessions" });
    }
  });

  app.post("/api/strategy-sessions", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const session = await storage.createStrategySession({
        ...req.body,
        agentUserId: req.user!.id,
      });
      res.status(201).json(session);
    } catch (error) {
      console.error("Create strategy session error:", error);
      res.status(500).json({ error: "Failed to create strategy session" });
    }
  });

  app.put("/api/strategy-sessions/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const session = await storage.updateStrategySession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Strategy session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Update strategy session error:", error);
      res.status(500).json({ error: "Failed to update strategy session" });
    }
  });

  // =============================================
  // Accelerator Routes
  // =============================================
  app.get("/api/accelerator/enrollment", isAuthenticated, async (req, res) => {
    try {
      const enrollment = await storage.getAcceleratorEnrollment(req.user!.id);
      res.json(enrollment || null);
    } catch (error) {
      console.error("Get accelerator enrollment error:", error);
      res.status(500).json({ error: "Failed to get enrollment" });
    }
  });

  app.post("/api/accelerator/enrollment", isAuthenticated, async (req, res) => {
    try {
      const enrollment = await storage.createAcceleratorEnrollment({
        ...req.body,
        userId: req.user!.id,
      });

      const defaultPhases = [
        {
          phase: 1,
          phaseName: "Financial Assessment",
          milestones: ["Review credit report", "Calculate current DTI", "Set budget"],
        },
        {
          phase: 2,
          phaseName: "Credit Optimization",
          milestones: ["Dispute errors on credit report", "Pay down high-utilization cards", "Avoid new credit inquiries"],
        },
        {
          phase: 3,
          phaseName: "Savings Plan",
          milestones: ["Open dedicated savings account", "Set up automatic transfers", "Reach 25% of down payment goal"],
        },
        {
          phase: 4,
          phaseName: "Debt Reduction",
          milestones: ["Create debt payoff plan", "Reduce DTI below 43%", "Close unnecessary accounts"],
        },
        {
          phase: 5,
          phaseName: "Pre-Approval Ready",
          milestones: ["Gather income documents", "Complete pre-approval application", "Get pre-approved"],
        },
        {
          phase: 6,
          phaseName: "Home Shopping",
          milestones: ["Connect with real estate agent", "Attend open houses", "Make an offer"],
        },
      ];

      for (const phaseData of defaultPhases) {
        for (const title of phaseData.milestones) {
          await storage.createAcceleratorMilestone({
            enrollmentId: enrollment.id,
            phase: phaseData.phase,
            title,
            category: phaseData.phaseName,
          });
        }
      }

      res.status(201).json(enrollment);
    } catch (error) {
      console.error("Create accelerator enrollment error:", error);
      res.status(500).json({ error: "Failed to create enrollment" });
    }
  });

  app.put("/api/accelerator/enrollment/:id", isAuthenticated, async (req, res) => {
    try {
      const enrollment = await storage.getAcceleratorEnrollment(req.user!.id);
      if (!enrollment || enrollment.id !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateAcceleratorEnrollment(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update accelerator enrollment error:", error);
      res.status(500).json({ error: "Failed to update enrollment" });
    }
  });

  app.get("/api/accelerator/milestones/:enrollmentId", isAuthenticated, async (req, res) => {
    try {
      const milestones = await storage.getAcceleratorMilestones(req.params.enrollmentId);
      res.json(milestones);
    } catch (error) {
      console.error("Get accelerator milestones error:", error);
      res.status(500).json({ error: "Failed to get milestones" });
    }
  });

  app.put("/api/accelerator/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const milestone = await storage.updateAcceleratorMilestone(req.params.id, req.body);
      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }
      res.json(milestone);
    } catch (error) {
      console.error("Update accelerator milestone error:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  app.get("/api/accelerator/coaching/:enrollmentId", isAuthenticated, async (req, res) => {
    try {
      const sessions = await storage.getCoachingSessions(req.params.enrollmentId);
      res.json(sessions);
    } catch (error) {
      console.error("Get coaching sessions error:", error);
      res.status(500).json({ error: "Failed to get coaching sessions" });
    }
  });

  app.post("/api/accelerator/coaching", isAuthenticated, async (req, res) => {
    try {
      const session = await storage.createCoachingSession(req.body);
      res.status(201).json(session);
    } catch (error) {
      console.error("Create coaching session error:", error);
      res.status(500).json({ error: "Failed to create coaching session" });
    }
  });

  app.put("/api/accelerator/coaching/:id", isAuthenticated, async (req, res) => {
    try {
      const session = await storage.updateCoachingSession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Coaching session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Update coaching session error:", error);
      res.status(500).json({ error: "Failed to update coaching session" });
    }
  });

  // =============================================
  // Closing Guarantee Routes
  // =============================================
  app.get("/api/closing-guarantees/:applicationId", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const guarantees = await storage.getClosingGuarantees(req.params.applicationId);
      res.json(guarantees);
    } catch (error) {
      console.error("Get closing guarantees error:", error);
      res.status(500).json({ error: "Failed to get closing guarantees" });
    }
  });

  app.post("/api/closing-guarantees", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const guarantee = await storage.createClosingGuarantee(req.body);
      res.status(201).json(guarantee);
    } catch (error) {
      console.error("Create closing guarantee error:", error);
      res.status(500).json({ error: "Failed to create closing guarantee" });
    }
  });

  app.put("/api/closing-guarantees/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const guarantee = await storage.updateClosingGuarantee(req.params.id, req.body);
      if (!guarantee) {
        return res.status(404).json({ error: "Closing guarantee not found" });
      }
      res.json(guarantee);
    } catch (error) {
      console.error("Update closing guarantee error:", error);
      res.status(500).json({ error: "Failed to update closing guarantee" });
    }
  });

  // =============================================
  // Homeowner Value Routes
  // =============================================
  app.get("/api/homeowner/profile", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      res.json(profile || null);
    } catch (error) {
      console.error("Get homeowner profile error:", error);
      res.status(500).json({ error: "Failed to get homeowner profile" });
    }
  });

  app.post("/api/homeowner/profile", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.createHomeownerProfile({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json(profile);
    } catch (error) {
      console.error("Create homeowner profile error:", error);
      res.status(500).json({ error: "Failed to create homeowner profile" });
    }
  });

  app.put("/api/homeowner/profile/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile || profile.id !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateHomeownerProfile(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Homeowner profile not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update homeowner profile error:", error);
      res.status(500).json({ error: "Failed to update homeowner profile" });
    }
  });

  app.get("/api/homeowner/refi-alerts/:profileId", isAuthenticated, async (req, res) => {
    try {
      const alerts = await storage.getRefiAlerts(req.params.profileId);
      res.json(alerts);
    } catch (error) {
      console.error("Get refi alerts error:", error);
      res.status(500).json({ error: "Failed to get refi alerts" });
    }
  });

  app.post("/api/homeowner/refi-alerts", isAuthenticated, async (req, res) => {
    try {
      const alert = await storage.createRefiAlert(req.body);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Create refi alert error:", error);
      res.status(500).json({ error: "Failed to create refi alert" });
    }
  });

  app.get("/api/homeowner/equity/:profileId", isAuthenticated, async (req, res) => {
    try {
      const snapshots = await storage.getEquitySnapshots(req.params.profileId);
      res.json(snapshots);
    } catch (error) {
      console.error("Get equity snapshots error:", error);
      res.status(500).json({ error: "Failed to get equity snapshots" });
    }
  });

  app.post("/api/homeowner/equity", isAuthenticated, async (req, res) => {
    try {
      const snapshot = await storage.createEquitySnapshot(req.body);
      res.status(201).json(snapshot);
    } catch (error) {
      console.error("Create equity snapshot error:", error);
      res.status(500).json({ error: "Failed to create equity snapshot" });
    }
  });

  // =============================================
  // Scenario Calculator Route
  // =============================================
  app.post("/api/scenario-calculator", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        purchasePrice: z.number().positive(),
        downPaymentPercent: z.number().min(0).max(100),
        creditScore: z.number().min(300).max(850),
        loanProgram: z.enum(["conventional", "fha", "va", "usda"]),
        interestRate: z.number().optional(),
        propertyTax: z.number().optional(),
        insurance: z.number().optional(),
        annualIncome: z.number().optional(),
      });

      const validated = schema.parse(req.body);

      const defaultRates: Record<string, number> = {
        conventional: 6.875,
        fha: 6.5,
        va: 6.25,
        usda: 6.375,
      };

      const purchasePrice = validated.purchasePrice;
      const downPayment = purchasePrice * (validated.downPaymentPercent / 100);
      let loanAmount = purchasePrice - downPayment;
      const ltv = (loanAmount / purchasePrice) * 100;
      const rate = validated.interestRate ?? defaultRates[validated.loanProgram];

      if (validated.loanProgram === "fha") {
        loanAmount = loanAmount * 1.0175;
      }

      const monthlyRate = rate / 12 / 100;
      const numPayments = 360;
      const factor = Math.pow(1 + monthlyRate, numPayments);
      const monthlyPrincipalInterest = loanAmount * (monthlyRate * factor) / (factor - 1);

      let monthlyPmi = 0;
      if (validated.loanProgram === "conventional" && ltv > 80) {
        monthlyPmi = (loanAmount * 0.005) / 12;
      } else if (validated.loanProgram === "fha") {
        monthlyPmi = (loanAmount * 0.0085) / 12;
      }

      const monthlyPropertyTax = validated.propertyTax ?? (purchasePrice * 0.011) / 12;
      const monthlyInsurance = validated.insurance ?? (purchasePrice * 0.0035) / 12;
      const totalMonthlyPayment = monthlyPrincipalInterest + monthlyPmi + monthlyPropertyTax + monthlyInsurance;

      let dti: number | null = null;
      if (validated.annualIncome) {
        const monthlyIncome = validated.annualIncome / 12;
        dti = (totalMonthlyPayment / monthlyIncome) * 100;
      }

      res.json({
        purchasePrice,
        downPayment,
        downPaymentPercent: validated.downPaymentPercent,
        loanAmount: Math.round(loanAmount * 100) / 100,
        interestRate: rate,
        loanProgram: validated.loanProgram,
        ltv: Math.round(ltv * 100) / 100,
        monthlyPrincipalInterest: Math.round(monthlyPrincipalInterest * 100) / 100,
        monthlyPmi: Math.round(monthlyPmi * 100) / 100,
        monthlyPropertyTax: Math.round(monthlyPropertyTax * 100) / 100,
        monthlyInsurance: Math.round(monthlyInsurance * 100) / 100,
        totalMonthlyPayment: Math.round(totalMonthlyPayment * 100) / 100,
        dti: dti !== null ? Math.round(dti * 100) / 100 : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Scenario calculator error:", error);
      res.status(500).json({ error: "Failed to calculate scenario" });
    }
  });

  // =============================================
  // Co-Branded Letter Enhancement Routes
  // =============================================
  app.get("/api/pre-approval-letters/:id/co-brand-preview", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const agentProfileId = req.query.agentProfileId as string;

      if (!agentProfileId) {
        return res.status(400).json({ error: "agentProfileId query parameter is required" });
      }

      const { db: database } = await import("./db");
      const { preApprovalLetters, coBrandProfiles } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [letter] = await database
        .select()
        .from(preApprovalLetters)
        .where(eq(preApprovalLetters.id, id))
        .limit(1);

      if (!letter) {
        return res.status(404).json({ error: "Pre-approval letter not found" });
      }

      const coBrandProfile = await storage.getCoBrandProfile(agentProfileId);

      res.json({
        letter,
        coBrand: coBrandProfile || null,
      });
    } catch (error) {
      console.error("Co-brand preview error:", error);
      res.status(500).json({ error: "Failed to get co-brand preview" });
    }
  });

  app.put("/api/pre-approval-letters/:id/co-brand", isAuthenticated, async (req, res) => {
    try {
      const userRole = (req.user as User).role;
      if (!STAFF_ROLES.includes(userRole as typeof STAFF_ROLES[number])) {
        return res.status(403).json({ error: "Only staff can add co-branding" });
      }

      const { id } = req.params;
      const coBrandSchema = z.object({
        agentName: z.string(),
        agentNmlsId: z.string().optional(),
        agentContactEmail: z.string().email().optional(),
        agentContactPhone: z.string().optional(),
        agentBrandName: z.string().optional(),
        agentLogoUrl: z.string().optional(),
      });

      const validated = coBrandSchema.parse(req.body);

      const { db: database } = await import("./db");
      const { preApprovalLetters } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [letter] = await database
        .select()
        .from(preApprovalLetters)
        .where(eq(preApprovalLetters.id, id))
        .limit(1);

      if (!letter) {
        return res.status(404).json({ error: "Pre-approval letter not found" });
      }

      res.json({
        letter,
        coBrand: validated,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Co-brand update error:", error);
      res.status(500).json({ error: "Failed to update co-branding" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
