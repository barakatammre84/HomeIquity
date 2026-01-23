import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { pool } from "./db";

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
      role: string;
    }
  }
}

const PgSession = connectPg(session);

export function getSession() {
  const sessionStore = new PgSession({
    pool,
    tableName: "sessions",
    createTableIfMissing: true,
  });

  return session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "mortgage-ai-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}

async function setupLocalAuth() {
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, {
        id: user.id,
        email: user.email || undefined,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profileImageUrl: user.profileImageUrl || undefined,
        role: user.role,
      });
    } catch (error) {
      done(error);
    }
  });
}

async function upsertUser(userData: {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}) {
  return await storage.upsertUser({
    id: userData.id,
    email: userData.email ?? null,
    firstName: userData.firstName ?? null,
    lastName: userData.lastName ?? null,
    profileImageUrl: userData.profileImageUrl ?? null,
    role: "borrower",
  });
}

export async function setupAuth(app: Express) {
  await setupLocalAuth();

  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  app.get("/api/login", async (req, res) => {
    let demoUser = await upsertUser({
      id: "demo-user-1",
      email: "demo@mortgageai.com",
      firstName: "Demo",
      lastName: "User",
    });

    // Ensure demo user always has borrower role for consistent testing
    if (demoUser.role !== "borrower") {
      const updatedUser = await storage.updateUserRole(demoUser.id, "borrower");
      if (updatedUser) {
        demoUser = updatedUser;
      }
    }

    req.login(
      {
        id: demoUser.id,
        email: demoUser.email || undefined,
        firstName: demoUser.firstName || undefined,
        lastName: demoUser.lastName || undefined,
        profileImageUrl: demoUser.profileImageUrl || undefined,
        role: demoUser.role,
      },
      (err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed" });
        }
        res.redirect("/dashboard");
      }
    );
  });

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.redirect("/");
    });
  });

  // Test login endpoint for admin access (development only)
  app.post("/api/test-login", async (req, res) => {
    const { email, password } = req.body;

    // Predefined test accounts
    const testAccounts: Record<string, { password: string; role: string; firstName: string; lastName: string }> = {
      "admin@test.com": { password: "admin123", role: "admin", firstName: "Admin", lastName: "User" },
      "broker@test.com": { password: "broker123", role: "broker", firstName: "Broker", lastName: "User" },
      "lender@test.com": { password: "lender123", role: "lender", firstName: "Lender", lastName: "User" },
      "borrower@test.com": { password: "borrower123", role: "borrower", firstName: "Borrower", lastName: "User" },
    };

    const account = testAccounts[email];
    if (!account || account.password !== password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Create or update the test user
    const testUser = await storage.upsertUser({
      id: `test-${email.split("@")[0]}`,
      email,
      firstName: account.firstName,
      lastName: account.lastName,
      profileImageUrl: null,
      role: account.role,
    });

    // Ensure role is correct
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
          } 
        });
      }
    );
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
};

export const isAdmin: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && req.user?.role === "admin") {
    return next();
  }
  res.status(403).json({ error: "Forbidden" });
};
