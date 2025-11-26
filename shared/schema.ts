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

// Real Estate Agent Profiles
export const agentProfiles = pgTable("agent_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  bio: text("bio"),
  phoneNumber: varchar("phone_number", { length: 20 }),
  licenseNumber: varchar("license_number", { length: 50 }),
  licenseExpiry: varchar("license_expiry", { length: 10 }),
  brokerage: varchar("brokerage", { length: 255 }),
  yearsInBusiness: integer("years_in_business"),
  
  specialties: text("specialties").array(), // ['first_time_buyers', 'luxury', 'investment', 'commercial']
  serviceArea: text("service_area").array(), // list of states/counties served
  
  photoBucket: varchar("photo_bucket"), // object storage path
  photoUrl: varchar("photo_url"),
  
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
  totalReviews: integer("total_reviews").default(0),
  
  propertiesSold: integer("properties_sold").default(0),
  activeListings: integer("active_listings").default(0),
  
  socialLinks: jsonb("social_links"), // {twitter, instagram, facebook}
  website: varchar("website", { length: 255 }),
  
  isVerified: boolean("is_verified").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentProfilesRelations = relations(agentProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [agentProfiles.userId],
    references: [users.id],
  }),
  properties: many(properties),
}));

export const insertAgentProfileSchema = createInsertSchema(agentProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentProfile = z.infer<typeof insertAgentProfileSchema>;
export type AgentProfile = typeof agentProfiles.$inferSelect;

// Properties (for MLS integration)
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mlsId: varchar("mls_id", { length: 100 }),
  agentId: varchar("agent_id").references(() => agentProfiles.id),
  
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
  soldAt: timestamp("sold_at"),
  soldPrice: decimal("sold_price", { precision: 12, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const propertiesRelations = relations(properties, ({ one }) => ({
  agent: one(agentProfiles, {
    fields: [properties.agentId],
    references: [agentProfiles.id],
  }),
}));

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

// URLA Personal Information (Section 1a)
export const urlaPersonalInfo = pgTable("urla_personal_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Borrower Name
  firstName: varchar("first_name", { length: 100 }),
  middleName: varchar("middle_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  suffix: varchar("suffix", { length: 20 }),
  
  // Borrower Identity
  ssn: varchar("ssn", { length: 11 }),
  dateOfBirth: varchar("date_of_birth", { length: 10 }),
  citizenship: varchar("citizenship", { length: 50 }), // us_citizen, permanent_resident, non_permanent_resident
  
  // Alternate Names
  alternateNames: text("alternate_names"),
  
  // Credit Type
  creditType: varchar("credit_type", { length: 50 }), // individual, joint
  totalBorrowers: integer("total_borrowers"),
  coBorrowerNames: text("co_borrower_names"),
  
  // Marital Status & Dependents
  maritalStatus: varchar("marital_status", { length: 50 }), // married, separated, unmarried
  numberOfDependents: integer("number_of_dependents"),
  dependentAges: text("dependent_ages"),
  
  // Contact Information
  homePhone: varchar("home_phone", { length: 20 }),
  cellPhone: varchar("cell_phone", { length: 20 }),
  workPhone: varchar("work_phone", { length: 20 }),
  workPhoneExt: varchar("work_phone_ext", { length: 10 }),
  email: varchar("email", { length: 255 }),
  
  // Current Address
  currentStreet: text("current_street"),
  currentUnit: varchar("current_unit", { length: 20 }),
  currentCity: varchar("current_city", { length: 100 }),
  currentState: varchar("current_state", { length: 50 }),
  currentZip: varchar("current_zip", { length: 20 }),
  currentCountry: varchar("current_country", { length: 100 }),
  currentAddressYears: integer("current_address_years"),
  currentAddressMonths: integer("current_address_months"),
  currentHousingType: varchar("current_housing_type", { length: 50 }), // own, rent, no_expense
  currentRentAmount: decimal("current_rent_amount", { precision: 10, scale: 2 }),
  
  // Former Address
  formerStreet: text("former_street"),
  formerUnit: varchar("former_unit", { length: 20 }),
  formerCity: varchar("former_city", { length: 100 }),
  formerState: varchar("former_state", { length: 50 }),
  formerZip: varchar("former_zip", { length: 20 }),
  formerCountry: varchar("former_country", { length: 100 }),
  formerAddressYears: integer("former_address_years"),
  formerAddressMonths: integer("former_address_months"),
  formerHousingType: varchar("former_housing_type", { length: 50 }),
  formerRentAmount: decimal("former_rent_amount", { precision: 10, scale: 2 }),
  
  // Mailing Address
  mailingDifferent: boolean("mailing_different").default(false),
  mailingStreet: text("mailing_street"),
  mailingUnit: varchar("mailing_unit", { length: 20 }),
  mailingCity: varchar("mailing_city", { length: 100 }),
  mailingState: varchar("mailing_state", { length: 50 }),
  mailingZip: varchar("mailing_zip", { length: 20 }),
  mailingCountry: varchar("mailing_country", { length: 100 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const urlaPersonalInfoRelations = relations(urlaPersonalInfo, ({ one }) => ({
  application: one(loanApplications, {
    fields: [urlaPersonalInfo.applicationId],
    references: [loanApplications.id],
  }),
}));

export const insertUrlaPersonalInfoSchema = createInsertSchema(urlaPersonalInfo).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUrlaPersonalInfo = z.infer<typeof insertUrlaPersonalInfoSchema>;
export type UrlaPersonalInfo = typeof urlaPersonalInfo.$inferSelect;

// Employment History (Sections 1b, 1c, 1d)
export const employmentHistory = pgTable("employment_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  employmentType: varchar("employment_type", { length: 50 }).notNull(), // current, additional, previous
  
  // Employer Information
  employerName: varchar("employer_name", { length: 255 }),
  employerPhone: varchar("employer_phone", { length: 20 }),
  employerStreet: text("employer_street"),
  employerUnit: varchar("employer_unit", { length: 20 }),
  employerCity: varchar("employer_city", { length: 100 }),
  employerState: varchar("employer_state", { length: 50 }),
  employerZip: varchar("employer_zip", { length: 20 }),
  employerCountry: varchar("employer_country", { length: 100 }),
  
  // Position Details
  positionTitle: varchar("position_title", { length: 255 }),
  startDate: varchar("start_date", { length: 10 }),
  endDate: varchar("end_date", { length: 10 }),
  yearsInLineOfWork: integer("years_in_line_of_work"),
  monthsInLineOfWork: integer("months_in_line_of_work"),
  
  // Special Employment Status
  isSelfEmployed: boolean("is_self_employed").default(false),
  ownershipShareLessThan25: boolean("ownership_share_less_than_25"),
  ownershipShare25OrMore: boolean("ownership_share_25_or_more"),
  isEmployedByFamilyMember: boolean("is_employed_by_family_member").default(false),
  isEmployedByPropertySeller: boolean("is_employed_by_property_seller").default(false),
  
  // Gross Monthly Income
  baseIncome: decimal("base_income", { precision: 12, scale: 2 }),
  overtimeIncome: decimal("overtime_income", { precision: 12, scale: 2 }),
  bonusIncome: decimal("bonus_income", { precision: 12, scale: 2 }),
  commissionIncome: decimal("commission_income", { precision: 12, scale: 2 }),
  militaryEntitlements: decimal("military_entitlements", { precision: 12, scale: 2 }),
  otherIncome: decimal("other_income", { precision: 12, scale: 2 }),
  totalMonthlyIncome: decimal("total_monthly_income", { precision: 12, scale: 2 }),
  
  // Self-employed income
  monthlyIncomeOrLoss: decimal("monthly_income_or_loss", { precision: 12, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const employmentHistoryRelations = relations(employmentHistory, ({ one }) => ({
  application: one(loanApplications, {
    fields: [employmentHistory.applicationId],
    references: [loanApplications.id],
  }),
}));

export const insertEmploymentHistorySchema = createInsertSchema(employmentHistory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmploymentHistory = z.infer<typeof insertEmploymentHistorySchema>;
export type EmploymentHistory = typeof employmentHistory.$inferSelect;

// Other Income Sources (Section 1e)
export const otherIncomeSources = pgTable("other_income_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  incomeSource: varchar("income_source", { length: 100 }).notNull(),
  monthlyAmount: decimal("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const otherIncomeSourcesRelations = relations(otherIncomeSources, ({ one }) => ({
  application: one(loanApplications, {
    fields: [otherIncomeSources.applicationId],
    references: [loanApplications.id],
  }),
}));

export const insertOtherIncomeSourceSchema = createInsertSchema(otherIncomeSources).omit({
  id: true,
  createdAt: true,
});

export type InsertOtherIncomeSource = z.infer<typeof insertOtherIncomeSourceSchema>;
export type OtherIncomeSource = typeof otherIncomeSources.$inferSelect;

// Assets (Section 2a)
export const urlaAssets = pgTable("urla_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  accountType: varchar("account_type", { length: 100 }).notNull(),
  financialInstitution: varchar("financial_institution", { length: 255 }),
  accountNumber: varchar("account_number", { length: 100 }),
  cashOrMarketValue: decimal("cash_or_market_value", { precision: 12, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const urlaAssetsRelations = relations(urlaAssets, ({ one }) => ({
  application: one(loanApplications, {
    fields: [urlaAssets.applicationId],
    references: [loanApplications.id],
  }),
}));

export const insertUrlaAssetSchema = createInsertSchema(urlaAssets).omit({
  id: true,
  createdAt: true,
});

export type InsertUrlaAsset = z.infer<typeof insertUrlaAssetSchema>;
export type UrlaAsset = typeof urlaAssets.$inferSelect;

// Liabilities (Section 2)
export const urlaLiabilities = pgTable("urla_liabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  liabilityType: varchar("liability_type", { length: 100 }).notNull(),
  creditorName: varchar("creditor_name", { length: 255 }),
  accountNumber: varchar("account_number", { length: 100 }),
  unpaidBalance: decimal("unpaid_balance", { precision: 12, scale: 2 }),
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }),
  toBePaidOff: boolean("to_be_paid_off").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const urlaLiabilitiesRelations = relations(urlaLiabilities, ({ one }) => ({
  application: one(loanApplications, {
    fields: [urlaLiabilities.applicationId],
    references: [loanApplications.id],
  }),
}));

export const insertUrlaLiabilitySchema = createInsertSchema(urlaLiabilities).omit({
  id: true,
  createdAt: true,
});

export type InsertUrlaLiability = z.infer<typeof insertUrlaLiabilitySchema>;
export type UrlaLiability = typeof urlaLiabilities.$inferSelect;

// URLA Property Information (Section for Property and Loan details)
export const urlaPropertyInfo = pgTable("urla_property_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Property Address
  propertyStreet: text("property_street"),
  propertyUnit: varchar("property_unit", { length: 20 }),
  propertyCity: varchar("property_city", { length: 100 }),
  propertyState: varchar("property_state", { length: 50 }),
  propertyZip: varchar("property_zip", { length: 20 }),
  propertyCountry: varchar("property_country", { length: 100 }),
  
  // Property Details
  numberOfUnits: integer("number_of_units"),
  propertyValue: decimal("property_value", { precision: 12, scale: 2 }),
  occupancyType: varchar("occupancy_type", { length: 50 }), // primary_residence, second_home, investment
  
  // Mixed Use
  isMixedUse: boolean("is_mixed_use").default(false),
  mixedUseDescription: text("mixed_use_description"),
  
  // Manufactured Home
  isManufacturedHome: boolean("is_manufactured_home").default(false),
  manufacturedWidth: varchar("manufactured_width", { length: 50 }),
  
  // Legal Description
  legalDescription: text("legal_description"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const urlaPropertyInfoRelations = relations(urlaPropertyInfo, ({ one }) => ({
  application: one(loanApplications, {
    fields: [urlaPropertyInfo.applicationId],
    references: [loanApplications.id],
  }),
}));

export const insertUrlaPropertyInfoSchema = createInsertSchema(urlaPropertyInfo).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUrlaPropertyInfo = z.infer<typeof insertUrlaPropertyInfoSchema>;
export type UrlaPropertyInfo = typeof urlaPropertyInfo.$inferSelect;

// Borrower Declarations (URLA Section 5 / MISMO 3.4 Declarations)
export const borrowerDeclarations = pgTable("borrower_declarations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Section 5a - About This Property and Your Money for This Loan
  willOccupyAsPrimaryResidence: boolean("will_occupy_as_primary_residence"),
  hasOwnershipInterestInPast3Years: boolean("has_ownership_interest_in_past_3_years"),
  priorPropertyType: varchar("prior_property_type", { length: 50 }), // primary_residence, second_home, investment, fha_primary
  priorPropertyTitle: varchar("prior_property_title", { length: 50 }), // sole, joint_with_spouse, joint_with_other
  
  hasRelationshipWithSeller: boolean("has_relationship_with_seller"),
  isBorrowingForDownPayment: boolean("is_borrowing_for_down_payment"),
  borrowedAmount: decimal("borrowed_amount", { precision: 12, scale: 2 }),
  
  hasAppliedForMortgageOnOtherProperty: boolean("has_applied_for_mortgage_on_other_property"),
  hasCreditForMortgageOnOtherProperty: boolean("has_credit_for_mortgage_on_other_property"),
  hasPriorityLienOnSubjectProperty: boolean("has_priority_lien_on_subject_property"),
  
  // Section 5b - About Your Finances
  hasCoMakerEndorser: boolean("has_co_maker_endorser"),
  hasOutstandingJudgments: boolean("has_outstanding_judgments"),
  isDelinquentOnFederalDebt: boolean("is_delinquent_on_federal_debt"),
  isPartyToLawsuit: boolean("is_party_to_lawsuit"),
  hasConveyedTitleInLieuOfForeclosure: boolean("has_conveyed_title_in_lieu_of_foreclosure"),
  hasCompletedShortSale: boolean("has_completed_short_sale"),
  hasBeenForeclosed: boolean("has_been_foreclosed"),
  hasDeclaredBankruptcy: boolean("has_declared_bankruptcy"),
  bankruptcyTypes: text("bankruptcy_types"), // chapter_7, chapter_11, chapter_12, chapter_13
  
  // Section 5c - About This Transaction  
  hasUndisclosedDebt: boolean("has_undisclosed_debt"),
  undisclosedDebtAmount: decimal("undisclosed_debt_amount", { precision: 12, scale: 2 }),
  hasAppliedForNewCredit: boolean("has_applied_for_new_credit"),
  hasPriorityLienToBePaidOff: boolean("has_priority_lien_to_be_paid_off"),
  
  // Additional Disclosures
  isUSCitizen: boolean("is_us_citizen"),
  isPermanentResidentAlien: boolean("is_permanent_resident_alien"),
  
  // Data Quality Fields
  declarationsCompletedAt: timestamp("declarations_completed_at"),
  declarationsVerifiedAt: timestamp("declarations_verified_at"),
  declarationsVerifiedBy: varchar("declarations_verified_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const borrowerDeclarationsRelations = relations(borrowerDeclarations, ({ one }) => ({
  application: one(loanApplications, {
    fields: [borrowerDeclarations.applicationId],
    references: [loanApplications.id],
  }),
  verifiedBy: one(users, {
    fields: [borrowerDeclarations.declarationsVerifiedBy],
    references: [users.id],
  }),
}));

export const insertBorrowerDeclarationsSchema = createInsertSchema(borrowerDeclarations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBorrowerDeclarations = z.infer<typeof insertBorrowerDeclarationsSchema>;
export type BorrowerDeclarations = typeof borrowerDeclarations.$inferSelect;

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

// Tasks for document requests and workflow items
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id).notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id).notNull(),
  
  // Task Details
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: varchar("task_type", { length: 50 }).notNull(), // document_request, verification, review, action
  
  // Document Request Specific
  documentCategory: varchar("document_category", { length: 50 }), // tax_return, pay_stub, bank_statement, w2, id, other
  documentYear: varchar("document_year", { length: 10 }), // e.g., "2024", "2023"
  documentInstructions: text("document_instructions"),
  
  // Status
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, in_progress, submitted, verified, rejected, completed
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  
  // Due Date
  dueDate: timestamp("due_date"),
  
  // Verification (for document tasks)
  verificationStatus: varchar("verification_status", { length: 50 }), // pending, verified, rejected, needs_review
  verificationNotes: text("verification_notes"),
  verifiedByUserId: varchar("verified_by_user_id").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  
  // AI Analysis Results
  aiAnalysisResult: jsonb("ai_analysis_result"),
  aiAnalyzedAt: timestamp("ai_analyzed_at"),
  
  // Extracted Data (for income verification, etc.)
  extractedData: jsonb("extracted_data"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  application: one(loanApplications, {
    fields: [tasks.applicationId],
    references: [loanApplications.id],
  }),
  assignedTo: one(users, {
    fields: [tasks.assignedToUserId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [tasks.createdByUserId],
    references: [users.id],
  }),
  verifiedBy: one(users, {
    fields: [tasks.verifiedByUserId],
    references: [users.id],
  }),
  taskDocuments: many(taskDocuments),
}));

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Task Documents - links uploaded documents to specific tasks
export const taskDocuments = pgTable("task_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  
  // Document specific verification for this task
  isVerified: boolean("is_verified").default(false),
  verificationNotes: text("verification_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskDocumentsRelations = relations(taskDocuments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDocuments.taskId],
    references: [tasks.id],
  }),
  document: one(documents, {
    fields: [taskDocuments.documentId],
    references: [documents.id],
  }),
}));

export const insertTaskDocumentSchema = createInsertSchema(taskDocuments).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskDocument = z.infer<typeof insertTaskDocumentSchema>;
export type TaskDocument = typeof taskDocuments.$inferSelect;

// ============================================================================
// LOAN PIPELINE TRACKING (Fast Closing Optimization)
// ============================================================================

// Loan Pipeline Stages - tracks where each loan is in the process
export const LOAN_STAGES = [
  "draft",           // Initial form started
  "submitted",       // Application submitted
  "pre_approved",    // Instant pre-approval decision
  "doc_collection",  // Collecting required documents
  "processing",      // Documents being reviewed
  "underwriting",    // Final underwriting review
  "conditional",     // Conditional approval issued
  "clear_to_close",  // All conditions cleared
  "closing",         // Closing scheduled/in progress
  "funded",          // Loan funded
  "denied",          // Application denied
] as const;

export type LoanStage = typeof LOAN_STAGES[number];

// Loan Milestones - timestamps for key pipeline events
export const loanMilestones = pgTable("loan_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Key milestone timestamps
  submittedAt: timestamp("submitted_at"),
  preApprovedAt: timestamp("pre_approved_at"),
  docCollectionStartedAt: timestamp("doc_collection_started_at"),
  processingStartedAt: timestamp("processing_started_at"),
  underwritingStartedAt: timestamp("underwriting_started_at"),
  conditionalApprovedAt: timestamp("conditional_approved_at"),
  clearToCloseAt: timestamp("clear_to_close_at"),
  closingScheduledAt: timestamp("closing_scheduled_at"),
  fundedAt: timestamp("funded_at"),
  deniedAt: timestamp("denied_at"),
  
  // SLA tracking
  targetCloseDate: timestamp("target_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanMilestonesRelations = relations(loanMilestones, ({ one }) => ({
  application: one(loanApplications, {
    fields: [loanMilestones.applicationId],
    references: [loanApplications.id],
  }),
}));

export const insertLoanMilestoneSchema = createInsertSchema(loanMilestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLoanMilestone = z.infer<typeof insertLoanMilestoneSchema>;
export type LoanMilestone = typeof loanMilestones.$inferSelect;

// Underwriting Conditions (Stips) - things that must be cleared before closing
export const CONDITION_CATEGORIES = [
  "income",          // Income verification conditions
  "assets",          // Asset verification conditions
  "credit",          // Credit-related conditions
  "property",        // Property/appraisal conditions
  "insurance",       // Insurance requirements
  "title",           // Title-related conditions
  "compliance",      // Compliance/regulatory conditions
  "other",           // Other conditions
] as const;

export const CONDITION_PRIORITY = ["prior_to_approval", "prior_to_docs", "prior_to_funding"] as const;

export const loanConditions = pgTable("loan_conditions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Condition details
  category: varchar("category", { length: 50 }).notNull(), // income, assets, credit, property, insurance, title, compliance, other
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 50 }).default("prior_to_docs").notNull(), // prior_to_approval, prior_to_docs, prior_to_funding
  
  // Status tracking
  status: varchar("status", { length: 50 }).default("outstanding").notNull(), // outstanding, submitted, waived, cleared, not_applicable
  
  // Document linkage (if condition requires specific documents)
  requiredDocumentTypes: text("required_document_types").array(), // Array of document types needed
  linkedTaskId: varchar("linked_task_id").references(() => tasks.id),
  
  // Resolution
  clearedByUserId: varchar("cleared_by_user_id").references(() => users.id),
  clearedAt: timestamp("cleared_at"),
  clearanceNotes: text("clearance_notes"),
  
  // AI-generated flag
  isAutoGenerated: boolean("is_auto_generated").default(false),
  sourceRule: varchar("source_rule", { length: 100 }), // Which rule triggered this condition
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanConditionsRelations = relations(loanConditions, ({ one }) => ({
  application: one(loanApplications, {
    fields: [loanConditions.applicationId],
    references: [loanApplications.id],
  }),
  linkedTask: one(tasks, {
    fields: [loanConditions.linkedTaskId],
    references: [tasks.id],
  }),
  clearedBy: one(users, {
    fields: [loanConditions.clearedByUserId],
    references: [users.id],
  }),
}));

export const insertLoanConditionSchema = createInsertSchema(loanConditions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLoanCondition = z.infer<typeof insertLoanConditionSchema>;
export type LoanCondition = typeof loanConditions.$inferSelect;

// Document Requirement Templates - rules for what documents are needed
export const documentRequirementRules = pgTable("document_requirement_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule matching criteria
  ruleCode: varchar("rule_code", { length: 50 }).notNull().unique(), // e.g., "SELF_EMP_TAX", "HIGH_LTV_RESERVES"
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Trigger conditions (stored as JSON for flexibility)
  triggerConditions: jsonb("trigger_conditions").notNull(), // e.g., {"employmentType": "self_employed", "ltvRatio": {"gt": 80}}
  
  // Required documents when rule matches
  requiredDocuments: jsonb("required_documents").notNull(), // Array of {documentType, yearsRequired, description}
  
  // Condition to generate (if any)
  generateCondition: boolean("generate_condition").default(true),
  conditionCategory: varchar("condition_category", { length: 50 }),
  conditionTitle: varchar("condition_title", { length: 255 }),
  conditionDescription: text("condition_description"),
  conditionPriority: varchar("condition_priority", { length: 50 }).default("prior_to_docs"),
  
  // Rule priority (lower = runs first)
  priority: integer("priority").default(100),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDocumentRequirementRuleSchema = createInsertSchema(documentRequirementRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocumentRequirementRule = z.infer<typeof insertDocumentRequirementRuleSchema>;
export type DocumentRequirementRule = typeof documentRequirementRules.$inferSelect;

// Underwriting Snapshots - audit trail of underwriting calculations
export const underwritingSnapshots = pgTable("underwriting_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Snapshot timing
  snapshotType: varchar("snapshot_type", { length: 50 }).notNull(), // initial, update, final
  snapshotReason: varchar("snapshot_reason", { length: 255 }), // e.g., "Pre-approval", "Document update", "Final UW"
  
  // Underwriting results (stored as JSONB for flexibility)
  incomeQualification: jsonb("income_qualification"), // IncomeQualificationResult
  assetVerification: jsonb("asset_verification"), // AssetVerificationResult
  liabilityAssessment: jsonb("liability_assessment"), // LiabilityAssessmentResult
  dtiCalculation: jsonb("dti_calculation"), // DTICalculationResult
  propertyEligibility: jsonb("property_eligibility"), // PropertyEligibilityResult
  
  // Summary metrics
  totalQualifyingIncome: decimal("total_qualifying_income", { precision: 12, scale: 2 }),
  totalVerifiedAssets: decimal("total_verified_assets", { precision: 12, scale: 2 }),
  totalMonthlyDebts: decimal("total_monthly_debts", { precision: 10, scale: 2 }),
  frontEndDTI: decimal("front_end_dti", { precision: 5, scale: 2 }),
  backEndDTI: decimal("back_end_dti", { precision: 5, scale: 2 }),
  
  // Decision
  underwritingDecision: varchar("underwriting_decision", { length: 50 }), // approved, denied, conditional, needs_review
  decisionNotes: text("decision_notes"),
  
  // Conditions generated from this snapshot
  conditionsGenerated: integer("conditions_generated").default(0),
  
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const underwritingSnapshotsRelations = relations(underwritingSnapshots, ({ one }) => ({
  application: one(loanApplications, {
    fields: [underwritingSnapshots.applicationId],
    references: [loanApplications.id],
  }),
  createdBy: one(users, {
    fields: [underwritingSnapshots.createdByUserId],
    references: [users.id],
  }),
}));

export const insertUnderwritingSnapshotSchema = createInsertSchema(underwritingSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertUnderwritingSnapshot = z.infer<typeof insertUnderwritingSnapshotSchema>;
export type UnderwritingSnapshot = typeof underwritingSnapshots.$inferSelect;
