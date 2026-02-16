import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import {
  setupAuth as setupOIDCAuth,
  isAuthenticated as oidcIsAuthenticated,
  registerAuthRoutes,
} from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
      role: string;
      claims?: {
        sub: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        profile_image_url?: string;
        exp?: number;
        [key: string]: unknown;
      };
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
    }
  }
}

const isProduction =
  process.env.NODE_ENV === "production" || !!process.env.REPL_DEPLOYMENT;

export async function setupAuth(app: Express) {
  await setupOIDCAuth(app);

  registerAuthRoutes(app);

  if (isProduction) {
    app.post("/api/test-login", (_req, res) => {
      res.status(404).json({ error: "Not found" });
    });
  } else {
    setupDevTestLogin(app);
  }
}

function setupDevTestLogin(app: Express) {
  app.post("/api/test-login", async (req, res) => {
    const { email, password } = req.body;

    const testAccounts: Record<string, { password: string; role: string; firstName: string; lastName: string }> = {
      "admin@test.com": { password: "admin123", role: "admin", firstName: "Admin", lastName: "User" },
      "lo@test.com": { password: "lo123", role: "lo", firstName: "Loan", lastName: "Officer" },
      "loa@test.com": { password: "loa123", role: "loa", firstName: "Loan Officer", lastName: "Assistant" },
      "processor@test.com": { password: "processor123", role: "processor", firstName: "Loan", lastName: "Processor" },
      "underwriter@test.com": { password: "underwriter123", role: "underwriter", firstName: "Loan", lastName: "Underwriter" },
      "closer@test.com": { password: "closer123", role: "closer", firstName: "Loan", lastName: "Closer" },
      "broker@test.com": { password: "broker123", role: "broker", firstName: "Mortgage", lastName: "Broker" },
      "lender@test.com": { password: "lender123", role: "lender", firstName: "Lender", lastName: "Rep" },
      "renter@test.com": { password: "renter123", role: "aspiring_owner", firstName: "Aspiring", lastName: "Owner" },
      "buyer@test.com": { password: "buyer123", role: "active_buyer", firstName: "Active", lastName: "Buyer" },
    };

    const account = testAccounts[email];
    if (!account || account.password !== password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const testUser = await storage.upsertUser({
      id: `test-${email.split("@")[0]}`,
      email,
      firstName: account.firstName,
      lastName: account.lastName,
      profileImageUrl: null,
      role: account.role,
    });

    if (testUser.role !== account.role) {
      await storage.updateUserRole(testUser.id, account.role);
    }

    req.login(
      {
        id: testUser.id,
        email: testUser.email || undefined,
        firstName: testUser.firstName || undefined,
        lastName: testUser.lastName || undefined,
        profileImageUrl: testUser.profileImageUrl || undefined,
        role: account.role,
      },
      (err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed" });
        }
        res.json({
          success: true,
          user: {
            id: testUser.id,
            email: testUser.email,
            role: account.role,
            firstName: account.firstName,
            lastName: account.lastName,
          },
        });
      }
    );
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (user?.id && user?.role && !user?.claims) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return next();
  }

  const oidcNext = () => {
    const u = req.user as any;
    if (!u?.claims?.sub) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    authStorage.getUser(u.claims.sub).then((dbUser) => {
      if (!dbUser) {
        return res.status(401).json({ error: "User not found" });
      }
      u.id = dbUser.id;
      u.email = dbUser.email || undefined;
      u.firstName = dbUser.firstName || undefined;
      u.lastName = dbUser.lastName || undefined;
      u.profileImageUrl = dbUser.profileImageUrl || undefined;
      u.role = dbUser.role;
      next();
    }).catch((error) => {
      console.error("Error fetching user from DB:", error);
      res.status(500).json({ error: "Internal error" });
    });
  };

  (oidcIsAuthenticated as any)(req, res, oidcNext);
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  await (isAuthenticated as any)(req, res, () => {
    if (req.user?.role === "admin") {
      return next();
    }
    return res.status(403).json({ error: "Forbidden" });
  });
};
