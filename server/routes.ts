import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import { analyzeLoanApplication } from "./gemini";
import { seedDatabase } from "./seed";
import { insertLoanApplicationSchema } from "@shared/schema";
import { z } from "zod";

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

  // Bulk save URLA data
  app.post("/api/urla/:applicationId/save", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { personalInfo, employmentHistory, otherIncomeSources, assets, liabilities, propertyInfo } = req.body;

      const results: any = {};

      if (personalInfo) {
        results.personalInfo = await storage.upsertUrlaPersonalInfo({ ...personalInfo, applicationId });
      }

      if (propertyInfo) {
        results.propertyInfo = await storage.upsertUrlaPropertyInfo({ ...propertyInfo, applicationId });
      }

      if (employmentHistory && Array.isArray(employmentHistory)) {
        results.employmentHistory = [];
        for (const emp of employmentHistory) {
          if (emp.id) {
            const updated = await storage.updateEmploymentHistory(emp.id, emp);
            if (updated) results.employmentHistory.push(updated);
          } else {
            const created = await storage.createEmploymentHistory({ ...emp, applicationId });
            results.employmentHistory.push(created);
          }
        }
      }

      if (assets && Array.isArray(assets)) {
        results.assets = [];
        for (const asset of assets) {
          if (asset.id) {
            const updated = await storage.updateUrlaAsset(asset.id, asset);
            if (updated) results.assets.push(updated);
          } else {
            const created = await storage.createUrlaAsset({ ...asset, applicationId });
            results.assets.push(created);
          }
        }
      }

      if (liabilities && Array.isArray(liabilities)) {
        results.liabilities = [];
        for (const liability of liabilities) {
          if (liability.id) {
            const updated = await storage.updateUrlaLiability(liability.id, liability);
            if (updated) results.liabilities.push(updated);
          } else {
            const created = await storage.createUrlaLiability({ ...liability, applicationId });
            results.liabilities.push(created);
          }
        }
      }

      if (otherIncomeSources && Array.isArray(otherIncomeSources)) {
        results.otherIncomeSources = [];
        for (const income of otherIncomeSources) {
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

  const httpServer = createServer(app);

  return httpServer;
}
