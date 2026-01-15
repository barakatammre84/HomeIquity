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
  type User,
} from "@shared/schema";
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
      const applications = await storage.getLoanApplicationsByUser(userId);
      const documents = await storage.getDocumentsByUser(userId);
      const stats = await storage.getDashboardStats(userId);

      const recentOptions = [];
      for (const app of applications.slice(0, 3)) {
        const options = await storage.getLoanOptionsByApplication(app.id);
        recentOptions.push(...options);
      }

      res.json({
        applications,
        documents,
        recentOptions: recentOptions.slice(0, 5),
        stats,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  });

  app.post("/api/loan-applications", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      const formData = req.body;
      
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
      if (!["admin", "lender", "broker"].includes(userRole || "")) {
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

      res.json({
        documentId: id,
        documentType: document.documentType,
        ...extractedData,
      });
    } catch (error) {
      console.error("Document extraction error:", error);
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
      if (!["borrower", "broker", "admin", "lender"].includes(role)) {
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
      if (!["admin", "lender", "broker"].includes(userRole || "")) {
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
      if (["admin", "lender", "broker"].includes(userRole || "")) {
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

      if (userId !== requestingUserId && !["admin", "lender", "broker"].includes(userRole || "")) {
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
      const isStaff = ["admin", "lender", "broker"].includes(userRole || "");
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
      if (!["admin", "lender"].includes(userRole || "")) {
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
      if (task.assignedToUserId !== userId && !["admin", "lender", "broker"].includes(req.user?.role || "")) {
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
      if (!["admin", "lender", "broker"].includes(userRole || "")) {
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
      const isStaff = ["admin", "lender", "broker"].includes(userRole || "");
      
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
      const isStaff = ["admin", "lender", "broker"].includes(userRole || "");
      
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
      const isStaff = ["admin", "lender", "broker"].includes(userRole || "");
      
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
      const isStaff = ["admin", "lender", "broker"].includes(userRole || "");
      
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
      const isStaff = ["admin", "lender", "broker"].includes(userRole || "");

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
      const isStaff = ["admin", "lender", "broker"].includes(userRole || "");

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
      const isStaff = ["admin", "lender", "broker"].includes(userRole || "");

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
      res.json({
        disclosureText: creditService.getDisclosureText(),
        disclosureVersion: creditService.getDisclosureVersion(),
      });
    } catch (error) {
      console.error("Get disclosure error:", error);
      res.status(500).json({ error: "Failed to get disclosure" });
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
      
      if (application.userId !== user.id && !["broker", "lender", "admin"].includes(user.role)) {
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
      
      if (!["broker", "lender", "admin"].includes(user.role)) {
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
      
      if (application.userId !== user.id && !["broker", "lender", "admin"].includes(user.role)) {
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
      
      if (application.userId !== user.id && !["broker", "lender", "admin"].includes(user.role)) {
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

  // Generate adverse action notice (staff only)
  app.post("/api/loan-applications/:id/credit/adverse-action", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!["broker", "lender", "admin"].includes(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const application = await storage.getLoanApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const { 
        actionType, 
        primaryReason, 
        secondaryReasons, 
        creditPullId,
        creditScoreUsed,
        creditScoreSource,
      } = req.body;
      
      if (!actionType || !primaryReason) {
        return res.status(400).json({ error: "Action type and primary reason are required" });
      }
      
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
      
      if (application.userId !== user.id && !["broker", "lender", "admin"].includes(user.role)) {
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
      
      if (!["broker", "lender", "admin"].includes(user.role)) {
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
      
      if (!["broker", "lender", "admin"].includes(user.role)) {
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
      
      if (!["broker", "lender", "admin"].includes(user.role)) {
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
      
      if (!["broker", "lender", "admin"].includes(user.role)) {
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
      
      if (application.userId !== user.id && !["broker", "lender", "admin"].includes(user.role)) {
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

  const httpServer = createServer(app);

  return httpServer;
}
