import type { Express } from "express";
import type { IStorage } from "../storage";
import {
  extractTaxReturnData,
  extractPayStubData,
  extractBankStatementData,
} from "../extractionService";
import { upload } from "./utils";

export function registerDocumentRoutes(
  app: Express,
  storage: IStorage,
  isAuthenticated: any,
  isAdmin: any,
) {
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
        const { taskEventEmitter } = await import("../services/taskEventEmitter");
        
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
        const { taskEventEmitter } = await import("../services/taskEventEmitter");
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
}
