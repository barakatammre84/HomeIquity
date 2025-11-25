import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Users table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 50 }).default("borrower").notNull(), // borrower, broker, admin, lender
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  loanApplications: many(loanApplications),
  documents: many(documents),
}));

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Loan Applications
export const loanApplications = pgTable("loan_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, submitted, analyzing, pre_approved, verified, underwriting, approved, denied, closed
  
  // Borrower Information
  annualIncome: decimal("annual_income", { precision: 12, scale: 2 }),
  monthlyDebts: decimal("monthly_debts", { precision: 10, scale: 2 }),
  creditScore: integer("credit_score"),
  employmentType: varchar("employment_type", { length: 50 }), // employed, self_employed, retired, other
  employmentYears: integer("employment_years"),
  employerName: varchar("employer_name", { length: 255 }),
  
  // Property Information
  propertyAddress: text("property_address"),
  propertyCity: varchar("property_city", { length: 100 }),
  propertyState: varchar("property_state", { length: 50 }),
  propertyZip: varchar("property_zip", { length: 20 }),
  propertyType: varchar("property_type", { length: 50 }), // single_family, condo, townhouse, multi_family
  propertyValue: decimal("property_value", { precision: 12, scale: 2 }),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }),
  downPayment: decimal("down_payment", { precision: 12, scale: 2 }),
  
  // Loan Preferences
  loanPurpose: varchar("loan_purpose", { length: 50 }), // purchase, refinance, cash_out
  preferredLoanType: varchar("preferred_loan_type", { length: 50 }), // conventional, fha, va
  isVeteran: boolean("is_veteran").default(false),
  isFirstTimeBuyer: boolean("is_first_time_buyer").default(false),
  
  // Calculated Values (populated by AI analysis)
  dtiRatio: decimal("dti_ratio", { precision: 5, scale: 2 }),
  ltvRatio: decimal("ltv_ratio", { precision: 5, scale: 2 }),
  preApprovalAmount: decimal("pre_approval_amount", { precision: 12, scale: 2 }),
  
  // AI Analysis
  aiAnalysis: jsonb("ai_analysis"),
  aiAnalyzedAt: timestamp("ai_analyzed_at"),
  
  // Broker reference
  referringBrokerId: varchar("referring_broker_id").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanApplicationsRelations = relations(loanApplications, ({ one, many }) => ({
  user: one(users, {
    fields: [loanApplications.userId],
    references: [users.id],
  }),
  referringBroker: one(users, {
    fields: [loanApplications.referringBrokerId],
    references: [users.id],
  }),
  loanOptions: many(loanOptions),
  documents: many(documents),
  dealActivities: many(dealActivities),
}));

export const insertLoanApplicationSchema = createInsertSchema(loanApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLoanApplication = z.infer<typeof insertLoanApplicationSchema>;
export type LoanApplication = typeof loanApplications.$inferSelect;

// Loan Options (generated scenarios)
export const loanOptions = pgTable("loan_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  loanType: varchar("loan_type", { length: 50 }).notNull(), // conventional, fha, va
  loanTerm: integer("loan_term").notNull(), // 15, 20, 30 years
  
  // Rate Information
  interestRate: decimal("interest_rate", { precision: 5, scale: 3 }).notNull(),
  apr: decimal("apr", { precision: 5, scale: 3 }).notNull(),
  
  // Points
  points: decimal("points", { precision: 5, scale: 3 }).default("0"),
  pointsCost: decimal("points_cost", { precision: 10, scale: 2 }).default("0"),
  
  // Monthly Payment Breakdown
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }).notNull(),
  principalAndInterest: decimal("principal_and_interest", { precision: 10, scale: 2 }).notNull(),
  propertyTax: decimal("property_tax", { precision: 10, scale: 2 }),
  homeInsurance: decimal("home_insurance", { precision: 10, scale: 2 }),
  pmi: decimal("pmi", { precision: 10, scale: 2 }),
  hoaFees: decimal("hoa_fees", { precision: 10, scale: 2 }),
  
  // Costs
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).notNull(),
  closingCosts: decimal("closing_costs", { precision: 10, scale: 2 }),
  cashToClose: decimal("cash_to_close", { precision: 12, scale: 2 }),
  totalInterestPaid: decimal("total_interest_paid", { precision: 12, scale: 2 }),
  
  // Down Payment
  downPaymentAmount: decimal("down_payment_amount", { precision: 12, scale: 2 }),
  downPaymentPercent: decimal("down_payment_percent", { precision: 5, scale: 2 }),
  
  // Flags
  isRecommended: boolean("is_recommended").default(false),
  isLocked: boolean("is_locked").default(false),
  lockedAt: timestamp("locked_at"),
  lockExpiresAt: timestamp("lock_expires_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const loanOptionsRelations = relations(loanOptions, ({ one }) => ({
  application: one(loanApplications, {
    fields: [loanOptions.applicationId],
    references: [loanApplications.id],
  }),
}));

export const insertLoanOptionSchema = createInsertSchema(loanOptions).omit({
  id: true,
  createdAt: true,
});

export type InsertLoanOption = z.infer<typeof insertLoanOptionSchema>;
export type LoanOption = typeof loanOptions.$inferSelect;

// Documents
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  documentType: varchar("document_type", { length: 50 }).notNull(), // w2, pay_stub, tax_return, bank_statement, id, other
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  storagePath: text("storage_path").notNull(),
  
  status: varchar("status", { length: 50 }).default("uploaded"), // uploaded, verified, rejected
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentsRelations = relations(documents, ({ one }) => ({
  application: one(loanApplications, {
    fields: [documents.applicationId],
    references: [loanApplications.id],
  }),
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Deal Activities (for tracking loan progress)
export const dealActivities = pgTable("deal_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  activityType: varchar("activity_type", { length: 50 }).notNull(), // status_change, document_uploaded, rate_locked, message, note
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  
  performedBy: varchar("performed_by").references(() => users.id),
  visibleToRoles: text("visible_to_roles").array(), // which roles can see this activity
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const dealActivitiesRelations = relations(dealActivities, ({ one }) => ({
  application: one(loanApplications, {
    fields: [dealActivities.applicationId],
    references: [loanApplications.id],
  }),
  performer: one(users, {
    fields: [dealActivities.performedBy],
    references: [users.id],
  }),
}));

export const insertDealActivitySchema = createInsertSchema(dealActivities).omit({
  id: true,
  createdAt: true,
});

export type InsertDealActivity = z.infer<typeof insertDealActivitySchema>;
export type DealActivity = typeof dealActivities.$inferSelect;

// Properties (for MLS integration)
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mlsId: varchar("mls_id", { length: 100 }),
  
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  zipCode: varchar("zip_code", { length: 20 }).notNull(),
  
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  propertyType: varchar("property_type", { length: 50 }), // single_family, condo, townhouse, multi_family
  
  bedrooms: integer("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  squareFeet: integer("square_feet"),
  lotSize: decimal("lot_size", { precision: 10, scale: 2 }),
  yearBuilt: integer("year_built"),
  
  description: text("description"),
  features: text("features").array(),
  images: text("images").array(),
  
  status: varchar("status", { length: 50 }).default("active"), // active, pending, sold
  listedAt: timestamp("listed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// Saved Properties (user favorites)
export const savedProperties = pgTable("saved_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedPropertiesRelations = relations(savedProperties, ({ one }) => ({
  user: one(users, {
    fields: [savedProperties.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [savedProperties.propertyId],
    references: [properties.id],
  }),
}));

// Pre-approval form validation schema
export const preApprovalFormSchema = z.object({
  // Step 1: Basic Info
  annualIncome: z.string().min(1, "Annual income is required"),
  employmentType: z.enum(["employed", "self_employed", "retired", "other"]),
  employmentYears: z.string().min(1, "Years employed is required"),
  
  // Step 2: Financial Details
  monthlyDebts: z.string().min(1, "Monthly debts is required"),
  creditScore: z.string().min(1, "Credit score range is required"),
  
  // Step 3: Property & Loan
  loanPurpose: z.enum(["purchase", "refinance", "cash_out"]),
  propertyType: z.enum(["single_family", "condo", "townhouse", "multi_family"]),
  purchasePrice: z.string().min(1, "Purchase price is required"),
  downPayment: z.string().min(1, "Down payment is required"),
  
  // Step 4: Additional Info
  isVeteran: z.boolean(),
  isFirstTimeBuyer: z.boolean(),
  propertyState: z.string().min(1, "Property state is required"),
});

export type PreApprovalFormData = z.infer<typeof preApprovalFormSchema>;
