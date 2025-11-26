import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import { analyzeLoanApplication } from "./gemini";
import { generateMISMO34XML, type MISMOLoanDTO } from "./mismo";
import { seedDatabase } from "./seed";
import { insertLoanApplicationSchema, insertBorrowerDeclarationsSchema } from "@shared/schema";
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

  app.post("/api/loan-applications", async (req, res) => {
    try {
      const userId = req.user?.id || "anonymous";
      
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

        await storage.updateLoanApplication(application.id, {
          status: analysisResult.isApproved ? "pre_approved" : "denied",
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

  app.get("/api/loan-applications/:id", async (req, res) => {
    try {
      const application = await storage.getLoanApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json(application);
    } catch (error) {
      console.error("Get application error:", error);
      res.status(500).json({ error: "Failed to get application" });
    }
  });

  app.get("/api/loan-applications/:id/options", async (req, res) => {
    try {
      const application = await storage.getLoanApplication(req.params.id);
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

  const httpServer = createServer(app);

  return httpServer;
}
