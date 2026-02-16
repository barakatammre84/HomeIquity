import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import { registerLendingRoutes } from "./routes/lending";
import { registerDocumentRoutes } from "./routes/documents";
import { registerPropertyRoutes } from "./routes/property";
import { registerAgentBrokerRoutes } from "./routes/agent-broker";
import { registerAdminRoutes } from "./routes/admin";
import { registerTaskEngineRoutes } from "./routes/task-engine";
import { registerUnderwritingRoutes } from "./routes/underwriting";
import { registerComplianceRoutes } from "./routes/compliance";
import { registerBorrowerRoutes } from "./routes/borrower";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerStaffInviteRoutes } from "./routes/staff-invites";
import { registerCoachRoutes } from "./routes/coach";
import { registerUnderwritingRulesRoutes } from "./routes/underwriting-rules";
import { registerPolicyOpsRoutes } from "./routes/policy-ops";
import { registerRateSheetRoutes } from "./routes/rate-sheets";
import { registerIntelligenceRoutes } from "./routes/intelligence";
import { seedDatabase } from "./seed";


export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  await setupAuth(app);
  await seedDatabase();

  registerLendingRoutes(app, storage, isAuthenticated, isAdmin);
  registerDocumentRoutes(app, storage, isAuthenticated, isAdmin);
  registerPropertyRoutes(app, storage, isAuthenticated, isAdmin);
  registerAgentBrokerRoutes(app, storage, isAuthenticated, isAdmin);
  registerAdminRoutes(app, storage, isAuthenticated, isAdmin);
  await registerTaskEngineRoutes(app, storage, isAuthenticated, isAdmin);
  registerUnderwritingRoutes(app, storage, isAuthenticated, isAdmin);
  registerComplianceRoutes(app, storage, isAuthenticated, isAdmin);
  registerBorrowerRoutes(app, storage, isAuthenticated, isAdmin);
  registerNotificationRoutes(app, storage, isAuthenticated);
  registerStaffInviteRoutes(app, storage, isAuthenticated, isAdmin);
  registerCoachRoutes(app);
  registerUnderwritingRulesRoutes(app, storage, isAuthenticated, isAdmin);
  registerPolicyOpsRoutes(app, storage, isAuthenticated, isAdmin);
  registerRateSheetRoutes(app, storage, isAuthenticated, isAdmin);
  registerIntelligenceRoutes(app, storage, isAuthenticated, isAdmin);

  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const httpServer = createServer(app);

  return httpServer;
}
