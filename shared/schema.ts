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

// Role system - Mortgage Industry Specific Roles
// Staff Roles (Internal & Partner)
export const STAFF_ROLES = [
  "admin",           // Tech/Ops Lead - Full system access
  "lo",              // Loan Officer - Sales & lead qualification
  "loa",             // Loan Officer Assistant - Document collection & appointments
  "processor",       // Processor - File bundling & pre-underwriting
  "underwriter",     // Underwriter - Final loan decisions
  "closer",          // Closer/Funder - Wire management & final docs
] as const;

// Client Roles
export const CLIENT_ROLES = [
  "aspiring_owner",  // Renter exploring homeownership (sandbox mode)
  "active_buyer",    // Borrower in buying process
] as const;

// All roles combined
export const ALL_ROLES = [...STAFF_ROLES, ...CLIENT_ROLES] as const;
export type UserRole = typeof ALL_ROLES[number];

// Role display names for UI
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  admin: "Tech/Ops Lead",
  lo: "Loan Officer",
  loa: "Loan Officer Assistant",
  processor: "Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
  aspiring_owner: "Aspiring Owner",
  active_buyer: "Active Buyer",
};

// Role descriptions for UI
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Full system access, user management, configuration",
  lo: "Sales & lead qualification, client relationships",
  loa: "Document collection, appointments, client updates",
  processor: "File bundling, pre-underwriting, condition management",
  underwriter: "Final loan approval/denial, risk assessment",
  closer: "Wire management, final document sign-off",
  aspiring_owner: "Explore homeownership, sandbox mode, gap calculator",
  active_buyer: "Apply for mortgages, upload documents, track progress",
};

// Helper to check if role is staff
export function isStaffRole(role: string): boolean {
  return STAFF_ROLES.includes(role as typeof STAFF_ROLES[number]);
}

// Helper to check if role is client
export function isClientRole(role: string): boolean {
  return CLIENT_ROLES.includes(role as typeof CLIENT_ROLES[number]);
}

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
  role: varchar("role", { length: 50 }).default("aspiring_owner").notNull(), // See ALL_ROLES constant
  // Partner tracking - for external loan officers using the platform
  isPartner: boolean("is_partner").default(false),
  partnerCompanyName: varchar("partner_company_name", { length: 255 }),
  nmlsId: varchar("nmls_id", { length: 20 }), // NMLS license number for loan officers
  // Referral link system for LOs
  referralCode: varchar("referral_code", { length: 20 }).unique(), // Unique code for LO referral links (e.g., "JOHN-SMITH-LO")
  referredByUserId: varchar("referred_by_user_id"), // Who referred this user (references users.id)
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
  applicationProperties: many(applicationProperties),
}));

export const insertLoanApplicationSchema = createInsertSchema(loanApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLoanApplication = z.infer<typeof insertLoanApplicationSchema>;
export type LoanApplication = typeof loanApplications.$inferSelect;

// Deal Team Members - tracks all professionals working on a loan application
export const dealTeamRoles = [
  "loan_officer",
  "loan_processor", 
  "underwriter",
  "closer",
  "real_estate_agent",
  "title_agent",
  "appraiser",
  "insurance_agent",
  "attorney",
  "escrow_officer",
] as const;

export const dealTeamRoleLabels: Record<typeof dealTeamRoles[number], string> = {
  loan_officer: "Loan Officer",
  loan_processor: "Loan Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
  real_estate_agent: "Real Estate Agent",
  title_agent: "Title Agent",
  appraiser: "Appraiser",
  insurance_agent: "Insurance Agent",
  attorney: "Attorney",
  escrow_officer: "Escrow Officer",
};

export const dealTeamMembers = pgTable("deal_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Team member can be internal staff user OR external partner
  userId: varchar("user_id").references(() => users.id), // Internal staff user (nullable)
  
  // Team role on this deal
  teamRole: varchar("team_role", { length: 50 }).notNull(), // loan_officer, processor, real_estate_agent, title_agent, etc.
  
  // For external partners (when userId is null)
  externalName: varchar("external_name", { length: 255 }),
  externalEmail: varchar("external_email", { length: 255 }),
  externalPhone: varchar("external_phone", { length: 50 }),
  externalCompany: varchar("external_company", { length: 255 }),
  
  // Status
  isPrimary: boolean("is_primary").default(false), // Primary contact for this role
  isActive: boolean("is_active").default(true).notNull(),
  
  // Assignment info
  assignedBy: varchar("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_deal_team_application").on(table.applicationId),
  index("idx_deal_team_user").on(table.userId),
  index("idx_deal_team_role").on(table.teamRole),
]);

export const dealTeamMembersRelations = relations(dealTeamMembers, ({ one }) => ({
  application: one(loanApplications, {
    fields: [dealTeamMembers.applicationId],
    references: [loanApplications.id],
  }),
  user: one(users, {
    fields: [dealTeamMembers.userId],
    references: [users.id],
  }),
  assignedByUser: one(users, {
    fields: [dealTeamMembers.assignedBy],
    references: [users.id],
  }),
}));

export const insertDealTeamMemberSchema = createInsertSchema(dealTeamMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDealTeamMember = z.infer<typeof insertDealTeamMemberSchema>;
export type DealTeamMember = typeof dealTeamMembers.$inferSelect;

// Application Properties - supports multiple properties per application
// When deals fall through, borrowers can add new properties without starting over
export const applicationProperties = pgTable("application_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Property Details
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  propertyType: varchar("property_type", { length: 50 }), // single_family, condo, townhouse, multi_family
  
  // Pricing
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).notNull(),
  downPayment: decimal("down_payment", { precision: 12, scale: 2 }),
  
  // Status
  status: varchar("status", { length: 50 }).default("active").notNull(), // active, offer_pending, offer_rejected, deal_fell_through, closed
  isCurrentProperty: boolean("is_current_property").default(true).notNull(),
  
  // Offer tracking
  offerAmount: decimal("offer_amount", { precision: 12, scale: 2 }),
  offerDate: timestamp("offer_date"),
  offerStatus: varchar("offer_status", { length: 50 }), // pending, accepted, rejected, countered, withdrawn
  
  // Notes about why deal fell through (for record keeping)
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const applicationPropertiesRelations = relations(applicationProperties, ({ one }) => ({
  application: one(loanApplications, {
    fields: [applicationProperties.applicationId],
    references: [loanApplications.id],
  }),
}));

export const insertApplicationPropertySchema = createInsertSchema(applicationProperties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplicationProperty = z.infer<typeof insertApplicationPropertySchema>;
export type ApplicationProperty = typeof applicationProperties.$inferSelect;

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
  
  // Requesting Team - who is requesting this document
  requestingTeam: varchar("requesting_team", { length: 50 }), // processing, underwriting, title, closing
  isCustomRequest: boolean("is_custom_request").default(false), // true for custom/unique document requests
  
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
// DOCUMENT PACKAGES (Lender-Ready Document Organization)
// ============================================================================

// Document Package Types
export const DOCUMENT_PACKAGE_TYPES = [
  "initial_submission",    // Initial lender submission
  "condition_response",    // Response to underwriting conditions
  "final_package",         // Final closing package
  "title_package",         // Title company package
  "custom",                // Custom package
] as const;

export type DocumentPackageType = typeof DOCUMENT_PACKAGE_TYPES[number];

// Document Package - organizes documents for lender delivery
export const documentPackages = pgTable("document_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id).notNull(),
  
  // Package Details
  name: varchar("name", { length: 255 }).notNull(),
  packageType: varchar("package_type", { length: 50 }).notNull(), // initial_submission, condition_response, final_package, title_package, custom
  description: text("description"),
  
  // Organization
  sections: jsonb("sections"), // Array of section names for organizing documents
  
  // Status
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, ready, sent, acknowledged
  
  // Delivery
  recipientType: varchar("recipient_type", { length: 50 }), // lender, title, underwriter, investor
  recipientName: varchar("recipient_name", { length: 255 }),
  sentAt: timestamp("sent_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  
  // Notes
  internalNotes: text("internal_notes"),
  deliveryNotes: text("delivery_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentPackagesRelations = relations(documentPackages, ({ one, many }) => ({
  application: one(loanApplications, {
    fields: [documentPackages.applicationId],
    references: [loanApplications.id],
  }),
  createdBy: one(users, {
    fields: [documentPackages.createdByUserId],
    references: [users.id],
  }),
  items: many(documentPackageItems),
}));

// Document Package Items - links documents to packages with organization
export const documentPackageItems = pgTable("document_package_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => documentPackages.id).notNull(),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  
  // Organization within package
  sectionName: varchar("section_name", { length: 100 }), // e.g., "Income Documents", "Asset Documents"
  displayOrder: integer("display_order").default(0),
  customLabel: varchar("custom_label", { length: 255 }), // Override default document name
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentPackageItemsRelations = relations(documentPackageItems, ({ one }) => ({
  package: one(documentPackages, {
    fields: [documentPackageItems.packageId],
    references: [documentPackages.id],
  }),
  document: one(documents, {
    fields: [documentPackageItems.documentId],
    references: [documents.id],
  }),
}));

export const insertDocumentPackageSchema = createInsertSchema(documentPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentPackageItemSchema = createInsertSchema(documentPackageItems).omit({
  id: true,
  createdAt: true,
});

export type InsertDocumentPackage = z.infer<typeof insertDocumentPackageSchema>;
export type DocumentPackage = typeof documentPackages.$inferSelect;
export type InsertDocumentPackageItem = z.infer<typeof insertDocumentPackageItemSchema>;
export type DocumentPackageItem = typeof documentPackageItems.$inferSelect;

// ============================================================================
// DOCUMENT INTELLIGENCE ENGINE (Underwriting-Aware OCR + Classification)
// ============================================================================
// This is the backbone of automated document processing. 
// Rule #1: Build ENGINES, not features.
// Everything operates at PAGE level, not file level.

// A. Document Taxonomy - All mortgage document types the classifier recognizes
export const DOCUMENT_TYPE_TAXONOMY = [
  // Identity / Compliance
  "drivers_license",
  "passport",
  "green_card",
  "ssn_card",
  "itin_letter",
  // Income - W2/Employment
  "paystub",
  "w2",
  "1099_misc",
  "1099_nec",
  // Income - Tax Returns
  "tax_return_1040",
  "schedule_c",
  "schedule_e",
  "schedule_k1",
  "business_tax_return_1120",
  "business_tax_return_1120s",
  "business_tax_return_1065",
  // Income - Self-Employed
  "profit_loss_statement",
  "social_security_award_letter",
  // Assets
  "bank_statement_checking",
  "bank_statement_savings",
  "business_bank_statement",
  "retirement_statement_401k",
  "retirement_statement_ira",
  "brokerage_statement",
  "gift_letter",
  // Liabilities
  "mortgage_statement",
  "heloc_statement",
  "auto_loan_statement",
  "student_loan_statement",
  "credit_card_statement",
  // Property / Transaction
  "purchase_contract",
  "lease_agreement",
  "hoa_statement",
  "homeowners_insurance_binder",
  "earnest_money_receipt",
  "appraisal_report",
  "title_commitment",
  // Other
  "letter_of_explanation",
  "divorce_decree",
  "bankruptcy_discharge",
  "unknown",
] as const;

export type DocumentTypeTaxonomy = typeof DOCUMENT_TYPE_TAXONOMY[number];

// B. Raw Document Upload (Immutable - Never mutate for audit + fraud)
export const documentUploads = pgTable("document_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  
  // Original file metadata
  originalFileName: varchar("original_file_name", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  
  // Upload source tracking
  uploadSource: varchar("upload_source", { length: 50 }).notNull(), // web, mobile, api, email
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  
  // Storage references (never modify after creation)
  rawFileUri: text("raw_file_uri").notNull(),  // Original file in object storage
  checksum: varchar("checksum", { length: 128 }).notNull(), // SHA-256 for integrity
  
  // Processing status
  processingStatus: varchar("processing_status", { length: 50 }).default("pending").notNull(), // pending, processing, completed, failed
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  processingError: text("processing_error"),
  
  // Metadata
  pageCount: integer("page_count"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_doc_uploads_loan").on(table.loanId),
  index("idx_doc_uploads_borrower").on(table.borrowerId),
  index("idx_doc_uploads_status").on(table.processingStatus),
]);

export const documentUploadsRelations = relations(documentUploads, ({ one, many }) => ({
  loan: one(loanApplications, {
    fields: [documentUploads.loanId],
    references: [loanApplications.id],
  }),
  borrower: one(users, {
    fields: [documentUploads.borrowerId],
    references: [users.id],
  }),
  pages: many(documentPages),
}));

// C. Document Page Entity (CRITICAL - All intelligence happens at page level)
export const documentPages = pgTable("document_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uploadId: varchar("upload_id").references(() => documentUploads.id).notNull(),
  
  // Page identification
  pageNumber: integer("page_number").notNull(), // 1-indexed
  
  // Processed image storage
  imageUri: text("image_uri").notNull(), // Cleaned/normalized page image
  thumbnailUri: text("thumbnail_uri"), // Smaller preview
  
  // Image dimensions (for layout analysis)
  width: integer("width"),
  height: integer("height"),
  
  // Raw OCR text (before field extraction)
  rawOcrText: text("raw_ocr_text"),
  ocrConfidence: decimal("ocr_confidence", { precision: 5, scale: 4 }), // 0.0-1.0
  ocrEngine: varchar("ocr_engine", { length: 50 }), // gemini, tesseract, etc.
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_doc_pages_upload").on(table.uploadId),
]);

export const documentPagesRelations = relations(documentPages, ({ one, many }) => ({
  upload: one(documentUploads, {
    fields: [documentPages.uploadId],
    references: [documentUploads.id],
  }),
  classifications: many(pageClassifications),
  extractedFields: many(extractedFields),
}));

// D. Page Classification Output (Never trust file names - classify each page)
export const pageClassifications = pgTable("page_classifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").references(() => documentPages.id).notNull(),
  
  // Classification result
  documentType: varchar("document_type", { length: 100 }).notNull(), // From DOCUMENT_TYPE_TAXONOMY
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(), // 0.0-1.0
  
  // Alternative classifications (top 3)
  alternativeTypes: jsonb("alternative_types"), // [{type, confidence}, ...]
  
  // Classification method tracking
  modelVersion: varchar("model_version", { length: 100 }).notNull(),
  classificationMethod: varchar("classification_method", { length: 50 }).notNull(), // rule_based, ml_classifier, hybrid
  
  // Human review status
  humanReviewed: boolean("human_reviewed").default(false),
  humanCorrectedType: varchar("human_corrected_type", { length: 100 }),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  
  classifiedAt: timestamp("classified_at").defaultNow().notNull(),
}, (table) => [
  index("idx_page_class_page").on(table.pageId),
  index("idx_page_class_type").on(table.documentType),
  index("idx_page_class_confidence").on(table.confidence),
]);

export const pageClassificationsRelations = relations(pageClassifications, ({ one }) => ({
  page: one(documentPages, {
    fields: [pageClassifications.pageId],
    references: [documentPages.id],
  }),
  reviewer: one(users, {
    fields: [pageClassifications.reviewedByUserId],
    references: [users.id],
  }),
}));

// E. Logical Document (Reassembled from classified pages)
export const logicalDocuments = pgTable("logical_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  
  // Document identification
  documentType: varchar("document_type", { length: 100 }).notNull(), // From DOCUMENT_TYPE_TAXONOMY
  
  // Aggregated confidence (average of page confidences)
  aggregatedConfidence: decimal("aggregated_confidence", { precision: 5, scale: 4 }).notNull(),
  
  // Status workflow
  status: varchar("status", { length: 50 }).default("needs_review").notNull(), // accepted, needs_review, rejected
  
  // Document period (for statements/returns)
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  taxYear: integer("tax_year"),
  
  // Institution/employer info (extracted)
  institutionName: varchar("institution_name", { length: 255 }),
  accountNumberMasked: varchar("account_number_masked", { length: 50 }),
  
  // Completeness
  expectedPageCount: integer("expected_page_count"),
  actualPageCount: integer("actual_page_count"),
  isComplete: boolean("is_complete").default(false),
  
  // Human review
  verifiedByUserId: varchar("verified_by_user_id").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  verificationNotes: text("verification_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_logical_docs_loan").on(table.loanId),
  index("idx_logical_docs_borrower").on(table.borrowerId),
  index("idx_logical_docs_type").on(table.documentType),
  index("idx_logical_docs_status").on(table.status),
]);

export const logicalDocumentsRelations = relations(logicalDocuments, ({ one, many }) => ({
  loan: one(loanApplications, {
    fields: [logicalDocuments.loanId],
    references: [loanApplications.id],
  }),
  borrower: one(users, {
    fields: [logicalDocuments.borrowerId],
    references: [users.id],
  }),
  verifier: one(users, {
    fields: [logicalDocuments.verifiedByUserId],
    references: [users.id],
  }),
  pages: many(logicalDocumentPages),
  extractedFields: many(extractedFields),
  completenessChecks: many(completenessChecks),
}));

// Link table: Logical Document to Pages
export const logicalDocumentPages = pgTable("logical_document_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logicalDocumentId: varchar("logical_document_id").references(() => logicalDocuments.id).notNull(),
  pageId: varchar("page_id").references(() => documentPages.id).notNull(),
  pageOrder: integer("page_order").notNull(), // Order within the logical document
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_logical_doc_pages_doc").on(table.logicalDocumentId),
  index("idx_logical_doc_pages_page").on(table.pageId),
]);

export const logicalDocumentPagesRelations = relations(logicalDocumentPages, ({ one }) => ({
  logicalDocument: one(logicalDocuments, {
    fields: [logicalDocumentPages.logicalDocumentId],
    references: [logicalDocuments.id],
  }),
  page: one(documentPages, {
    fields: [logicalDocumentPages.pageId],
    references: [documentPages.id],
  }),
}));

// ============================================================================
// OCR & FIELD EXTRACTION SCHEMAS
// ============================================================================

// F. Extracted Field (NON-NEGOTIABLE STRUCTURE)
// Rule: If a value has no confidence or no source page → it does not exist
export const extractedFields = pgTable("extracted_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logicalDocumentId: varchar("logical_document_id").references(() => logicalDocuments.id),
  pageId: varchar("page_id").references(() => documentPages.id).notNull(),
  
  // Field identification
  fieldName: varchar("field_name", { length: 255 }).notNull(), // e.g., "grossMonthlyIncome", "employerName"
  fieldCategory: varchar("field_category", { length: 100 }), // income, asset, liability, identity, property
  
  // Extracted value (polymorphic - store as string, parse based on type)
  valueString: text("value_string"),
  valueNumeric: decimal("value_numeric", { precision: 18, scale: 4 }),
  valueDate: timestamp("value_date"),
  valueBoolean: boolean("value_boolean"),
  valueType: varchar("value_type", { length: 50 }).notNull(), // string, number, date, boolean, currency
  
  // Confidence & source (REQUIRED - no field exists without these)
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(), // 0.0-1.0
  boundingBox: jsonb("bounding_box"), // {x, y, width, height} on source page
  
  // MISMO Mapping (Everything maps to MISMO or fails)
  mismoPath: varchar("mismo_path", { length: 500 }), // e.g., "MISMO.Income.EmploymentIncome.GrossMonthlyIncome"
  
  // Extraction metadata
  extractionMethod: varchar("extraction_method", { length: 50 }).notNull(), // regex, ml_extraction, template_match, gemini
  modelVersion: varchar("model_version", { length: 100 }),
  
  // Human verification
  humanVerified: boolean("human_verified").default(false),
  humanCorrectedValue: text("human_corrected_value"),
  verifiedByUserId: varchar("verified_by_user_id").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
}, (table) => [
  index("idx_extracted_fields_doc").on(table.logicalDocumentId),
  index("idx_extracted_fields_page").on(table.pageId),
  index("idx_extracted_fields_name").on(table.fieldName),
  index("idx_extracted_fields_mismo").on(table.mismoPath),
  index("idx_extracted_fields_confidence").on(table.confidence),
]);

export const extractedFieldsRelations = relations(extractedFields, ({ one }) => ({
  logicalDocument: one(logicalDocuments, {
    fields: [extractedFields.logicalDocumentId],
    references: [logicalDocuments.id],
  }),
  page: one(documentPages, {
    fields: [extractedFields.pageId],
    references: [documentPages.id],
  }),
  verifier: one(users, {
    fields: [extractedFields.verifiedByUserId],
    references: [users.id],
  }),
}));

// G. Completeness Check (Eliminate huge processor time)
export const completenessChecks = pgTable("completeness_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logicalDocumentId: varchar("logical_document_id").references(() => logicalDocuments.id).notNull(),
  
  // Check result
  documentType: varchar("document_type", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // complete, incomplete, unable_to_determine
  
  // Missing items (what's wrong)
  missingItems: jsonb("missing_items").notNull(), // [{item: "page 2 of 3", severity: "high"}, ...]
  
  // Expected vs actual
  expectedPages: integer("expected_pages"),
  foundPages: integer("found_pages"),
  
  // Required fields check
  requiredFieldsFound: jsonb("required_fields_found"), // [{field, found: boolean}, ...]
  requiredFieldsMissing: text("required_fields_missing").array(),
  
  // Continuity checks (for statements)
  balanceContinuityValid: boolean("balance_continuity_valid"),
  dateRangeContinuous: boolean("date_range_continuous"),
  
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
}, (table) => [
  index("idx_completeness_doc").on(table.logicalDocumentId),
  index("idx_completeness_status").on(table.status),
]);

export const completenessChecksRelations = relations(completenessChecks, ({ one }) => ({
  logicalDocument: one(logicalDocuments, {
    fields: [completenessChecks.logicalDocumentId],
    references: [logicalDocuments.id],
  }),
}));

// ============================================================================
// MISMO-CANONICAL DATA MODEL (Everything feeds this)
// ============================================================================
// If it doesn't map → it doesn't exist.

// H. Income Stream (Normalized from multiple document types)
export const INCOME_TYPES = [
  "w2",
  "self_employed",
  "rental",
  "bonus",
  "commission",
  "overtime",
  "social_security",
  "pension",
  "disability",
  "alimony",
  "child_support",
  "investment",
  "other",
] as const;

export type IncomeType = typeof INCOME_TYPES[number];

export const incomeStreams = pgTable("income_streams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  
  // Income type and source
  incomeType: varchar("income_type", { length: 50 }).notNull(), // From INCOME_TYPES
  employerName: varchar("employer_name", { length: 255 }),
  
  // Amounts
  monthlyAmount: decimal("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  annualAmount: decimal("annual_amount", { precision: 14, scale: 2 }),
  
  // Stability assessment
  stability: varchar("stability", { length: 50 }).notNull(), // stable, variable, declining, increasing
  yearsAtEmployer: decimal("years_at_employer", { precision: 4, scale: 1 }),
  
  // === TREND & VOLATILITY ANALYZER (Enhancement #1) ===
  trendSlope: decimal("trend_slope", { precision: 8, scale: 4 }), // YoY % change
  volatilityScore: decimal("volatility_score", { precision: 5, scale: 2 }), // Std dev of monthly income
  trendDirection: varchar("trend_direction", { length: 20 }), // increasing, stable, declining
  trendAnalysisInputs: jsonb("trend_analysis_inputs"), // Raw monthly values used for trend calc
  
  // === RELIABILITY & SEASONING (Enhancement #2 & #3) ===
  reliabilityScore: decimal("reliability_score", { precision: 5, scale: 2 }), // 0-100 score
  seasoningMonths: integer("seasoning_months"), // How long this income has existed
  seasoningStatus: varchar("seasoning_status", { length: 30 }), // qualified, insufficient, pending
  
  // === QUALIFICATION STATUS ===
  qualificationStatus: varchar("qualification_status", { length: 30 }), // included, excluded, capped, prorated
  qualificationReason: text("qualification_reason"), // Why it was included/excluded
  qualifiedAmount: decimal("qualified_amount", { precision: 12, scale: 2 }), // Amount after applying rules
  
  // Source documents that support this income
  sourceDocumentIds: text("source_document_ids").array(),
  
  // Calculation details
  calculationMethod: text("calculation_method"), // How the monthly amount was derived
  calculationInputs: jsonb("calculation_inputs"), // Raw values used in calculation
  
  // MISMO Mapping (Required)
  mismoPath: varchar("mismo_path", { length: 500 }).notNull(), // e.g., "MISMO.Income.EmploymentIncome"
  
  // Verification
  verificationSource: varchar("verification_source", { length: 50 }), // ocr, plaid, voe, manual
  verificationDate: timestamp("verification_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_income_borrower").on(table.borrowerId),
  index("idx_income_loan").on(table.loanId),
  index("idx_income_type").on(table.incomeType),
  index("idx_income_qualification").on(table.qualificationStatus),
]);

export const incomeStreamsRelations = relations(incomeStreams, ({ one }) => ({
  borrower: one(users, {
    fields: [incomeStreams.borrowerId],
    references: [users.id],
  }),
  loan: one(loanApplications, {
    fields: [incomeStreams.loanId],
    references: [loanApplications.id],
  }),
}));

// I. Assets (Normalized)
export const ASSET_TYPES = [
  "checking",
  "savings",
  "money_market",
  "cd",
  "retirement_401k",
  "retirement_ira",
  "brokerage",
  "mutual_fund",
  "stock",
  "bond",
  "gift",
  "trust",
  "real_estate_equity",
  "business_asset",
  "other",
] as const;

export type AssetType = typeof ASSET_TYPES[number];

export const canonicalAssets = pgTable("canonical_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  
  // Asset type and institution
  assetType: varchar("asset_type", { length: 50 }).notNull(), // From ASSET_TYPES
  institutionName: varchar("institution_name", { length: 255 }),
  accountNumberMasked: varchar("account_number_masked", { length: 50 }),
  
  // Values
  cashValue: decimal("cash_value", { precision: 14, scale: 2 }).notNull(),
  marketValue: decimal("market_value", { precision: 14, scale: 2 }),
  
  // For retirement accounts
  vestedAmount: decimal("vested_amount", { precision: 14, scale: 2 }),
  
  // For gifts
  giftDonorName: varchar("gift_donor_name", { length: 255 }),
  giftDonorRelationship: varchar("gift_donor_relationship", { length: 100 }),
  
  // Source documents
  sourceDocumentIds: text("source_document_ids").array(),
  
  // MISMO Mapping (Required)
  mismoPath: varchar("mismo_path", { length: 500 }).notNull(), // e.g., "MISMO.Asset.LiquidAsset"
  
  // Verification
  verificationSource: varchar("verification_source", { length: 50 }).notNull(), // ocr, plaid, manual
  verifiedAt: timestamp("verified_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_assets_borrower").on(table.borrowerId),
  index("idx_assets_loan").on(table.loanId),
  index("idx_assets_type").on(table.assetType),
]);

export const canonicalAssetsRelations = relations(canonicalAssets, ({ one }) => ({
  borrower: one(users, {
    fields: [canonicalAssets.borrowerId],
    references: [users.id],
  }),
  loan: one(loanApplications, {
    fields: [canonicalAssets.loanId],
    references: [loanApplications.id],
  }),
}));

// J. Liabilities (Normalized)
export const LIABILITY_TYPES = [
  "first_mortgage",
  "second_mortgage",
  "heloc",
  "auto_loan",
  "student_loan",
  "credit_card",
  "personal_loan",
  "installment_loan",
  "child_support",
  "alimony",
  "other",
] as const;

export type LiabilityType = typeof LIABILITY_TYPES[number];

export const canonicalLiabilities = pgTable("canonical_liabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  
  // Liability type and creditor
  liabilityType: varchar("liability_type", { length: 50 }).notNull(), // From LIABILITY_TYPES
  creditorName: varchar("creditor_name", { length: 255 }),
  accountNumberMasked: varchar("account_number_masked", { length: 50 }),
  
  // Amounts
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }).notNull(),
  remainingBalance: decimal("remaining_balance", { precision: 14, scale: 2 }),
  creditLimit: decimal("credit_limit", { precision: 14, scale: 2 }),
  
  // For determining if paid by closing
  willBePaidOff: boolean("will_be_paid_off").default(false),
  monthsRemaining: integer("months_remaining"),
  
  // Source (credit report or document)
  sourceType: varchar("source_type", { length: 50 }).notNull(), // credit_report, document, manual
  sourceDocumentIds: text("source_document_ids").array(),
  
  // MISMO Mapping (Required)
  mismoPath: varchar("mismo_path", { length: 500 }).notNull(), // e.g., "MISMO.Liability.MonthlyPaymentAmount"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_liabilities_borrower").on(table.borrowerId),
  index("idx_liabilities_loan").on(table.loanId),
  index("idx_liabilities_type").on(table.liabilityType),
]);

export const canonicalLiabilitiesRelations = relations(canonicalLiabilities, ({ one }) => ({
  borrower: one(users, {
    fields: [canonicalLiabilities.borrowerId],
    references: [users.id],
  }),
  loan: one(loanApplications, {
    fields: [canonicalLiabilities.loanId],
    references: [loanApplications.id],
  }),
}));

// ============================================================================
// UNDERWRITING EVENT ENGINE (This is the secret sauce)
// ============================================================================
// This replaces humans asking "what's next?"
// Event-based architecture for automatic workflow triggering

// K. Underwriting Event Definitions (Rules)
export const UNDERWRITING_TRIGGER_TYPES = [
  "document_detected",
  "field_extracted",
  "threshold_exceeded",
  "document_complete",
  "income_calculated",
  "dti_changed",
  "anomaly_detected",
  "manual_trigger",
] as const;

export const UNDERWRITING_ACTION_TYPES = [
  "request_document",
  "enable_income_logic",
  "recalculate_dti",
  "flag_for_review",
  "create_condition",
  "send_notification",
  "update_status",
] as const;

export const underwritingEventRules = pgTable("underwriting_event_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule identification
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  ruleDescription: text("rule_description"),
  
  // Trigger condition
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // From UNDERWRITING_TRIGGER_TYPES
  triggerCondition: jsonb("trigger_condition").notNull(), // Expression to evaluate
  // Example: { documentType: "schedule_e" } or { fieldName: "largeDeposit", operator: ">", value: 5000 }
  
  // Actions to take when triggered
  actions: jsonb("actions").notNull(), // Array of {type, params}
  // Example: [{ type: "request_document", params: { documentType: "lease_agreement" }}]
  
  // Priority and ordering
  priority: integer("priority").default(0).notNull(),
  
  // Rule applicability
  applicableLoanTypes: text("applicable_loan_types").array(), // conventional, fha, va, etc. or null for all
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_uw_rules_trigger").on(table.triggerType),
  index("idx_uw_rules_active").on(table.isActive),
]);

// L. Underwriting Event Log (What happened)
export const underwritingEventLog = pgTable("underwriting_event_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  
  // What rule triggered this
  ruleId: varchar("rule_id").references(() => underwritingEventRules.id),
  
  // Event details
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  triggerData: jsonb("trigger_data"), // The data that triggered the event
  
  // Actions taken
  actionsTaken: jsonb("actions_taken").notNull(), // What was done
  
  // Result
  status: varchar("status", { length: 50 }).notNull(), // success, partial, failed
  errorMessage: text("error_message"),
  
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
}, (table) => [
  index("idx_uw_events_loan").on(table.loanId),
  index("idx_uw_events_rule").on(table.ruleId),
  index("idx_uw_events_trigger").on(table.triggerType),
]);

export const underwritingEventLogRelations = relations(underwritingEventLog, ({ one }) => ({
  loan: one(loanApplications, {
    fields: [underwritingEventLog.loanId],
    references: [loanApplications.id],
  }),
  rule: one(underwritingEventRules, {
    fields: [underwritingEventLog.ruleId],
    references: [underwritingEventRules.id],
  }),
}));

// ============================================================================
// DTI / DSCR CALCULATION SCHEMAS
// ============================================================================
// DTI = function(data), not function(docs)
// This allows recalculation when docs change, what-if scenarios, clean AUS submissions

// M. Underwriting Snapshot (Point-in-time calculation inputs)
export const underwritingSnapshots = pgTable("underwriting_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  
  // Snapshot type
  snapshotType: varchar("snapshot_type", { length: 50 }).notNull(), // initial, update, final, what_if
  
  // Aggregated income (from incomeStreams)
  totalMonthlyIncome: decimal("total_monthly_income", { precision: 12, scale: 2 }).notNull(),
  incomeBreakdown: jsonb("income_breakdown"), // {w2: x, selfEmployed: y, rental: z}
  
  // Aggregated liabilities (from canonicalLiabilities)
  totalMonthlyLiabilities: decimal("total_monthly_liabilities", { precision: 12, scale: 2 }).notNull(),
  liabilityBreakdown: jsonb("liability_breakdown"),
  
  // Housing expense
  proposedHousingExpense: decimal("proposed_housing_expense", { precision: 10, scale: 2 }).notNull(), // PITI
  
  // Aggregated assets (for reserves calculation)
  totalLiquidAssets: decimal("total_liquid_assets", { precision: 14, scale: 2 }),
  totalRetirementAssets: decimal("total_retirement_assets", { precision: 14, scale: 2 }),
  
  // Source document IDs (for audit trail)
  sourceDocumentIds: text("source_document_ids").array(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_uw_snapshots_loan").on(table.loanId),
  index("idx_uw_snapshots_borrower").on(table.borrowerId),
  index("idx_uw_snapshots_type").on(table.snapshotType),
]);

export const underwritingSnapshotsRelations = relations(underwritingSnapshots, ({ one, many }) => ({
  loan: one(loanApplications, {
    fields: [underwritingSnapshots.loanId],
    references: [loanApplications.id],
  }),
  borrower: one(users, {
    fields: [underwritingSnapshots.borrowerId],
    references: [users.id],
  }),
  results: many(underwritingResults),
}));

// N. Underwriting Result (Calculated outputs)
// Explanation is REQUIRED for regulators & lenders
export const underwritingResults = pgTable("underwriting_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  
  // DTI Calculations
  frontEndDti: decimal("front_end_dti", { precision: 5, scale: 2 }).notNull(), // Housing / Income
  backEndDti: decimal("back_end_dti", { precision: 5, scale: 2 }).notNull(), // (Housing + Debts) / Income
  
  // DSCR (for rental/investment properties)
  dscr: decimal("dscr", { precision: 5, scale: 3 }), // Rental Income / PITIA
  
  // LTV
  ltv: decimal("ltv", { precision: 5, scale: 2 }),
  cltv: decimal("cltv", { precision: 5, scale: 2 }),
  
  // Reserves
  monthsOfReserves: decimal("months_of_reserves", { precision: 4, scale: 1 }),
  reservesRequired: decimal("reserves_required", { precision: 4, scale: 1 }),
  
  // Overall eligibility
  eligibilityStatus: varchar("eligibility_status", { length: 50 }).notNull(), // eligible, ineligible, manual_review
  
  // Confidence (How reliable is this calculation?)
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(), // Based on source field confidences
  
  // Explanation (REQUIRED - not optional)
  explanation: jsonb("explanation").notNull(), // Array of {category, message, impact}
  // Example: [{ category: "income", message: "Self-employed income requires 24-month history", impact: "warning" }]
  
  // Findings that need attention
  findings: jsonb("findings"), // Array of {type, severity, description, recommendation}
  
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_uw_results_snapshot").on(table.snapshotId),
  index("idx_uw_results_loan").on(table.loanId),
  index("idx_uw_results_eligibility").on(table.eligibilityStatus),
]);

export const underwritingResultsRelations = relations(underwritingResults, ({ one }) => ({
  snapshot: one(underwritingSnapshots, {
    fields: [underwritingResults.snapshotId],
    references: [underwritingSnapshots.id],
  }),
  loan: one(loanApplications, {
    fields: [underwritingResults.loanId],
    references: [loanApplications.id],
  }),
}));

// ============================================================================
// FRAUD & ANOMALY ENGINE (Passive at first)
// ============================================================================
// Build the hooks now even if rules come later

// O. Anomaly Detection
export const ANOMALY_CATEGORIES = [
  "identity",           // Name mismatch, SSN issues
  "income",             // Income inconsistencies
  "document_integrity", // Edited PDFs, font mismatches
  "asset_mismatch",     // Balance discrepancies
  "employment",         // Employer name changes
  "transaction",        // Unusual cash flows
  "address",            // Address inconsistencies
  "timing",             // Suspicious document dates
] as const;

export const ANOMALY_SEVERITY = ["low", "medium", "high", "critical"] as const;

export const anomalies = pgTable("anomalies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  
  // Anomaly classification
  category: varchar("category", { length: 50 }).notNull(), // From ANOMALY_CATEGORIES
  severity: varchar("severity", { length: 20 }).notNull(), // From ANOMALY_SEVERITY
  
  // Description
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  
  // Evidence
  sourceDocumentIds: text("source_document_ids").array(),
  evidenceDetails: jsonb("evidence_details"), // Specific data points that triggered anomaly
  
  // Detection method
  detectionMethod: varchar("detection_method", { length: 100 }).notNull(), // rule_based, ml_model, cross_validation
  detectionRuleId: varchar("detection_rule_id", { length: 100 }),
  
  // Resolution
  status: varchar("status", { length: 50 }).default("open").notNull(), // open, investigating, resolved, false_positive
  resolution: text("resolution"),
  resolvedByUserId: varchar("resolved_by_user_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
}, (table) => [
  index("idx_anomalies_loan").on(table.loanId),
  index("idx_anomalies_category").on(table.category),
  index("idx_anomalies_severity").on(table.severity),
  index("idx_anomalies_status").on(table.status),
]);

export const anomaliesRelations = relations(anomalies, ({ one }) => ({
  loan: one(loanApplications, {
    fields: [anomalies.loanId],
    references: [loanApplications.id],
  }),
  resolver: one(users, {
    fields: [anomalies.resolvedByUserId],
    references: [users.id],
  }),
}));

// ============================================================================
// AUDIT & COMPLIANCE LAYER (From Day 1)
// ============================================================================
// Required for: FCRA, SOC 2, State regulators, Lender onboarding
// Immutable storage required

// P. Audit Event Log
export const AUDIT_ACTOR_ROLES = [
  "borrower",
  "loan_officer",
  "processor",
  "underwriter",
  "admin",
  "system",       // Automated actions
  "integration",  // Third-party integrations
] as const;

export const AUDIT_EVENT_CATEGORIES = [
  "document",      // Document upload, view, delete
  "data_access",   // PII access
  "decision",      // Underwriting decisions
  "consent",       // Credit consent, disclosures
  "export",        // Data export, GSE submission
  "authentication",// Login, logout, session
  "modification",  // Data changes
] as const;

export const auditEvents = pgTable("audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Actor identification
  actorId: varchar("actor_id").references(() => users.id), // null for system actions
  actorRole: varchar("actor_role", { length: 50 }).notNull(), // From AUDIT_ACTOR_ROLES
  actorEmail: varchar("actor_email", { length: 255 }),
  
  // What happened
  eventCategory: varchar("event_category", { length: 50 }).notNull(), // From AUDIT_EVENT_CATEGORIES
  action: varchar("action", { length: 255 }).notNull(), // e.g., "document.upload", "credit.pull", "application.submit"
  
  // Entity affected
  entityType: varchar("entity_type", { length: 100 }).notNull(), // loan_application, document, user, etc.
  entityId: varchar("entity_id", { length: 255 }).notNull(),
  
  // Context
  loanId: varchar("loan_id").references(() => loanApplications.id), // null for non-loan events
  
  // Details (careful not to log PII)
  details: jsonb("details"), // Additional context (no PII!)
  
  // Request context
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 255 }),
  
  // Timestamp (critical for audit)
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  
  // Immutability marker (for compliance)
  eventHash: varchar("event_hash", { length: 128 }), // SHA-256 of event content
  previousEventHash: varchar("previous_event_hash", { length: 128 }), // Chain hash for tamper detection
}, (table) => [
  index("idx_audit_actor").on(table.actorId),
  index("idx_audit_category").on(table.eventCategory),
  index("idx_audit_action").on(table.action),
  index("idx_audit_entity").on(table.entityType, table.entityId),
  index("idx_audit_loan").on(table.loanId),
  index("idx_audit_timestamp").on(table.timestamp),
]);

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  actor: one(users, {
    fields: [auditEvents.actorId],
    references: [users.id],
  }),
  loan: one(loanApplications, {
    fields: [auditEvents.loanId],
    references: [loanApplications.id],
  }),
}));

// ============================================================================
// DTI/DSCR ENGINE - INSTITUTIONAL GRADE UNDERWRITING
// ============================================================================

// A. SEASONING RULES - Time-based qualification logic
export const SEASONING_ACTIONS = [
  "include",       // Full amount qualifies
  "exclude",       // Do not count this income
  "cap",           // Cap at a percentage
  "prorate",       // Prorate based on months
  "flag_review",   // Include but flag for manual review
] as const;

export type SeasoningAction = typeof SEASONING_ACTIONS[number];

export const seasoningRules = pgTable("seasoning_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule identity
  ruleName: varchar("rule_name", { length: 100 }).notNull(),
  incomeType: varchar("income_type", { length: 50 }).notNull(), // From INCOME_TYPES
  productType: varchar("product_type", { length: 50 }), // null = applies to all products
  
  // Seasoning requirements
  minimumMonths: integer("minimum_months").notNull(),
  optimalMonths: integer("optimal_months"), // Full qualification threshold
  
  // Action when insufficient seasoning
  insufficientAction: varchar("insufficient_action", { length: 30 }).notNull(), // From SEASONING_ACTIONS
  insufficientCapPercent: decimal("insufficient_cap_percent", { precision: 5, scale: 2 }), // If action = cap
  
  // Additional conditions
  conditions: jsonb("conditions"), // Extra criteria (e.g., declining trend)
  
  // Rule metadata
  priority: integer("priority").default(100), // Lower = higher priority
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_seasoning_income_type").on(table.incomeType),
  index("idx_seasoning_product").on(table.productType),
  index("idx_seasoning_active").on(table.isActive),
]);

// B. BUSINESS CASH FLOW ADJUSTMENTS - Self-employed edge cases
export const CASH_FLOW_ADJUSTMENT_TYPES = [
  "depreciation_addback",
  "amortization_addback",
  "depletion_addback",
  "meals_disallowance",
  "one_time_expense",
  "one_time_income",
  "business_use_of_home",
  "owner_compensation_adjustment",
  "partnership_distribution",
  "s_corp_distribution",
] as const;

export type CashFlowAdjustmentType = typeof CASH_FLOW_ADJUSTMENT_TYPES[number];

export const cashFlowAdjustments = pgTable("cash_flow_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incomeStreamId: varchar("income_stream_id").references(() => incomeStreams.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  
  // Adjustment details
  adjustmentType: varchar("adjustment_type", { length: 50 }).notNull(), // From CASH_FLOW_ADJUSTMENT_TYPES
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  direction: varchar("direction", { length: 10 }).notNull(), // add, subtract
  
  // Documentation & justification
  justification: text("justification").notNull(),
  sourceDocumentIds: text("source_document_ids").array(),
  taxFormLine: varchar("tax_form_line", { length: 50 }), // e.g., "Schedule C Line 13"
  
  // Verification
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cfa_income_stream").on(table.incomeStreamId),
  index("idx_cfa_loan").on(table.loanId),
  index("idx_cfa_type").on(table.adjustmentType),
]);

export const cashFlowAdjustmentsRelations = relations(cashFlowAdjustments, ({ one }) => ({
  incomeStream: one(incomeStreams, {
    fields: [cashFlowAdjustments.incomeStreamId],
    references: [incomeStreams.id],
  }),
  loan: one(loanApplications, {
    fields: [cashFlowAdjustments.loanId],
    references: [loanApplications.id],
  }),
  verifier: one(users, {
    fields: [cashFlowAdjustments.verifiedBy],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [cashFlowAdjustments.createdBy],
    references: [users.id],
  }),
}));

// C. PORTFOLIO STRESS TESTING - Multi-property DSCR
export const portfolioStressTests = pgTable("portfolio_stress_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id),
  
  // Portfolio metrics
  totalProperties: integer("total_properties").notNull(),
  totalGrossRent: decimal("total_gross_rent", { precision: 14, scale: 2 }).notNull(),
  totalPitia: decimal("total_pitia", { precision: 14, scale: 2 }).notNull(),
  
  // Base DSCR
  baseDscr: decimal("base_dscr", { precision: 6, scale: 3 }).notNull(),
  
  // Stress scenarios
  vacancyShockPercent: decimal("vacancy_shock_percent", { precision: 5, scale: 2 }).default("10.00"),
  stressedDscrVacancy: decimal("stressed_dscr_vacancy", { precision: 6, scale: 3 }),
  
  rateShockBps: integer("rate_shock_bps").default(200), // Basis points
  stressedDscrRate: decimal("stressed_dscr_rate", { precision: 6, scale: 3 }),
  
  combinedShockDscr: decimal("combined_shock_dscr", { precision: 6, scale: 3 }),
  
  // Property-level breakdown (JSONB)
  propertyBreakdown: jsonb("property_breakdown"), // Array of per-property DSCR calculations
  
  // Assessment
  stressTestResult: varchar("stress_test_result", { length: 30 }), // pass, marginal, fail
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }),
  recommendations: jsonb("recommendations"), // Array of improvement suggestions
  
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => [
  index("idx_pst_borrower").on(table.borrowerId),
  index("idx_pst_loan").on(table.loanId),
  index("idx_pst_result").on(table.stressTestResult),
]);

export const portfolioStressTestsRelations = relations(portfolioStressTests, ({ one }) => ({
  borrower: one(users, {
    fields: [portfolioStressTests.borrowerId],
    references: [users.id],
  }),
  loan: one(loanApplications, {
    fields: [portfolioStressTests.loanId],
    references: [loanApplications.id],
  }),
  snapshot: one(underwritingSnapshots, {
    fields: [portfolioStressTests.snapshotId],
    references: [underwritingSnapshots.id],
  }),
}));

// D. PRODUCT RULES - FHA/VA/Conv/HELOC abstraction (DO NOT HARDCODE)
export const PRODUCT_TYPES = [
  "conventional_conforming",
  "conventional_jumbo",
  "fha",
  "va",
  "usda",
  "heloc",
  "heloan",
  "dscr_investor",
  "bank_statement",
  "asset_depletion",
] as const;

export type ProductType = typeof PRODUCT_TYPES[number];

export const STUDENT_LOAN_TREATMENTS = [
  "actual_payment",           // Use payment on credit report
  "ibr_payment",              // Use IBR/PAYE payment if documented
  "one_percent_balance",      // 1% of outstanding balance
  "half_percent_balance",     // 0.5% of outstanding balance
  "fully_amortized",          // Calculate 10-year fully amortized payment
] as const;

export const RENTAL_INCOME_TREATMENTS = [
  "seventy_five_percent",     // 75% of gross rent (conventional)
  "full_offset",              // Full PITIA offset (FHA standard)
  "net_cash_flow",            // Net positive = income, negative = liability
  "dscr_only",                // Use only for DSCR, not DTI
  "excluded",                 // Do not count rental income
] as const;

export const productRules = pgTable("product_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Product identification
  productType: varchar("product_type", { length: 50 }).notNull(), // From PRODUCT_TYPES
  ruleName: varchar("rule_name", { length: 100 }).notNull(),
  ruleVersion: varchar("rule_version", { length: 20 }).default("1.0"),
  
  // DTI Limits
  frontEndDtiMax: decimal("front_end_dti_max", { precision: 5, scale: 2 }), // Housing ratio
  backEndDtiMax: decimal("back_end_dti_max", { precision: 5, scale: 2 }).notNull(), // Total DTI
  dtiExceptionAllowed: boolean("dti_exception_allowed").default(false),
  dtiExceptionMax: decimal("dti_exception_max", { precision: 5, scale: 2 }),
  
  // DSCR Requirements (for investor products)
  minDscr: decimal("min_dscr", { precision: 5, scale: 2 }),
  minStressedDscr: decimal("min_stressed_dscr", { precision: 5, scale: 2 }),
  
  // Income Treatment Rules
  rentalIncomeTreatment: varchar("rental_income_treatment", { length: 50 }), // From RENTAL_INCOME_TREATMENTS
  vacancyFactor: decimal("vacancy_factor", { precision: 5, scale: 2 }).default("25.00"),
  
  studentLoanTreatment: varchar("student_loan_treatment", { length: 50 }), // From STUDENT_LOAN_TREATMENTS
  studentLoanBalancePercent: decimal("student_loan_balance_percent", { precision: 5, scale: 3 }),
  
  // Self-Employment Rules
  selfEmploymentMinMonths: integer("self_employment_min_months").default(24),
  selfEmploymentDeclineRule: varchar("self_employment_decline_rule", { length: 50 }), // use_lower, average, exclude
  
  // Reserve Requirements
  minReserveMonths: integer("min_reserve_months"),
  reserveCalculationMethod: varchar("reserve_calculation_method", { length: 50 }),
  
  // Credit Requirements
  minCreditScore: integer("min_credit_score"),
  
  // Additional Rules (flexible JSONB)
  additionalRules: jsonb("additional_rules"), // Product-specific edge cases
  
  // Metadata
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date").defaultNow(),
  expirationDate: timestamp("expiration_date"),
  guidelineSource: varchar("guideline_source", { length: 255 }), // e.g., "Fannie Mae Selling Guide 2024"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_product_rules_type").on(table.productType),
  index("idx_product_rules_active").on(table.isActive),
]);

// E. STRUCTURED EXPLANATIONS - Regulator & Lender gold
export const underwritingExplanations = pgTable("underwriting_explanations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  resultId: varchar("result_id").references(() => underwritingResults.id),
  
  // Explanation identity
  ruleId: varchar("rule_id", { length: 100 }).notNull(), // Which rule produced this
  category: varchar("category", { length: 50 }).notNull(), // income, liability, dti, dscr, credit
  
  // Structured explanation
  input: jsonb("input").notNull(), // What went into the calculation
  output: jsonb("output").notNull(), // What came out
  reasoning: text("reasoning").notNull(), // Human-readable explanation
  
  // Impact
  dtiImpact: decimal("dti_impact", { precision: 6, scale: 3 }), // How much this affected DTI
  dscrImpact: decimal("dscr_impact", { precision: 6, scale: 3 }), // How much this affected DSCR
  
  // Flags
  isOverride: boolean("is_override").default(false),
  overrideJustification: text("override_justification"),
  overrideApprovedBy: varchar("override_approved_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_uw_exp_snapshot").on(table.snapshotId),
  index("idx_uw_exp_result").on(table.resultId),
  index("idx_uw_exp_rule").on(table.ruleId),
  index("idx_uw_exp_category").on(table.category),
]);

export const underwritingExplanationsRelations = relations(underwritingExplanations, ({ one }) => ({
  snapshot: one(underwritingSnapshots, {
    fields: [underwritingExplanations.snapshotId],
    references: [underwritingSnapshots.id],
  }),
  result: one(underwritingResults, {
    fields: [underwritingExplanations.resultId],
    references: [underwritingResults.id],
  }),
  overrideApprover: one(users, {
    fields: [underwritingExplanations.overrideApprovedBy],
    references: [users.id],
  }),
}));

// F. CONFIDENCE DECOMPOSITION - Tells reviewers WHAT is weak
export const confidenceBreakdowns = pgTable("confidence_breakdowns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  resultId: varchar("result_id").references(() => underwritingResults.id),
  
  // Component scores (0-100)
  incomeConfidence: decimal("income_confidence", { precision: 5, scale: 2 }).notNull(),
  documentConfidence: decimal("document_confidence", { precision: 5, scale: 2 }).notNull(),
  stabilityConfidence: decimal("stability_confidence", { precision: 5, scale: 2 }).notNull(),
  assetConfidence: decimal("asset_confidence", { precision: 5, scale: 2 }).notNull(),
  liabilityConfidence: decimal("liability_confidence", { precision: 5, scale: 2 }).notNull(),
  propertyConfidence: decimal("property_confidence", { precision: 5, scale: 2 }),
  
  // Composite score
  overallConfidence: decimal("overall_confidence", { precision: 5, scale: 2 }).notNull(),
  
  // Weighted factors used
  weights: jsonb("weights").notNull(), // { income: 0.3, document: 0.25, ... }
  
  // Weak points identification
  weakestComponent: varchar("weakest_component", { length: 50 }).notNull(),
  remediationSuggestions: jsonb("remediation_suggestions"), // How to improve confidence
  
  // Thresholds
  autoApproveThreshold: decimal("auto_approve_threshold", { precision: 5, scale: 2 }).default("90.00"),
  loReviewThreshold: decimal("lo_review_threshold", { precision: 5, scale: 2 }).default("80.00"),
  
  // Resulting action
  recommendedAction: varchar("recommended_action", { length: 50 }), // auto_approve, lo_review, manual_uw
  
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => [
  index("idx_conf_snapshot").on(table.snapshotId),
  index("idx_conf_result").on(table.resultId),
  index("idx_conf_overall").on(table.overallConfidence),
  index("idx_conf_action").on(table.recommendedAction),
]);

export const confidenceBreakdownsRelations = relations(confidenceBreakdowns, ({ one }) => ({
  snapshot: one(underwritingSnapshots, {
    fields: [confidenceBreakdowns.snapshotId],
    references: [underwritingSnapshots.id],
  }),
  result: one(underwritingResults, {
    fields: [confidenceBreakdowns.resultId],
    references: [underwritingResults.id],
  }),
}));

// G. WHAT-IF SCENARIOS - Run hypotheticals without mutating loan data
export const whatIfScenarios = pgTable("what_if_scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  baseSnapshotId: varchar("base_snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  
  // Scenario metadata
  scenarioName: varchar("scenario_name", { length: 100 }).notNull(),
  scenarioType: varchar("scenario_type", { length: 50 }).notNull(), // income_change, payoff, down_payment, rate_change
  
  // Hypothetical changes (delta from base)
  incomeChanges: jsonb("income_changes"), // { incomeStreamId: newAmount }
  liabilityPayoffs: jsonb("liability_payoffs"), // { liabilityId: payoffAmount }
  downPaymentChange: decimal("down_payment_change", { precision: 14, scale: 2 }),
  interestRateChange: decimal("interest_rate_change", { precision: 5, scale: 3 }),
  loanAmountChange: decimal("loan_amount_change", { precision: 14, scale: 2 }),
  
  // Calculated results
  resultingDti: decimal("resulting_dti", { precision: 6, scale: 3 }),
  resultingFrontEndDti: decimal("resulting_front_end_dti", { precision: 6, scale: 3 }),
  resultingDscr: decimal("resulting_dscr", { precision: 6, scale: 3 }),
  resultingLtv: decimal("resulting_ltv", { precision: 6, scale: 3 }),
  resultingPayment: decimal("resulting_payment", { precision: 12, scale: 2 }),
  
  // Comparison to base
  dtiDelta: decimal("dti_delta", { precision: 6, scale: 3 }),
  dscrDelta: decimal("dscr_delta", { precision: 6, scale: 3 }),
  paymentDelta: decimal("payment_delta", { precision: 12, scale: 2 }),
  
  // Would this qualify?
  wouldQualify: boolean("would_qualify"),
  qualificationIssues: jsonb("qualification_issues"), // Array of remaining issues
  
  // User interaction
  createdBy: varchar("created_by").references(() => users.id),
  sharedWithBorrower: boolean("shared_with_borrower").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_whatif_loan").on(table.loanId),
  index("idx_whatif_base_snapshot").on(table.baseSnapshotId),
  index("idx_whatif_type").on(table.scenarioType),
]);

export const whatIfScenariosRelations = relations(whatIfScenarios, ({ one }) => ({
  loan: one(loanApplications, {
    fields: [whatIfScenarios.loanId],
    references: [loanApplications.id],
  }),
  baseSnapshot: one(underwritingSnapshots, {
    fields: [whatIfScenarios.baseSnapshotId],
    references: [underwritingSnapshots.id],
  }),
  creator: one(users, {
    fields: [whatIfScenarios.createdBy],
    references: [users.id],
  }),
}));

// H. DECISION FREEZE & VERSIONING - Audit-critical
export const underwritingDecisions = pgTable("underwriting_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  resultId: varchar("result_id").references(() => underwritingResults.id).notNull(),
  
  // Version control
  decisionVersion: integer("decision_version").notNull(),
  inputsHash: varchar("inputs_hash", { length: 64 }).notNull(), // SHA-256 of all inputs
  rulesVersion: varchar("rules_version", { length: 50 }).notNull(), // Which rule set was used
  
  // Decision output (frozen)
  decision: varchar("decision", { length: 50 }).notNull(), // approved, denied, suspended, conditional
  decisionReason: text("decision_reason"),
  conditions: jsonb("conditions"), // Array of conditions if conditional
  
  // Frozen metrics at decision time
  frozenDti: decimal("frozen_dti", { precision: 6, scale: 3 }).notNull(),
  frozenDscr: decimal("frozen_dscr", { precision: 6, scale: 3 }),
  frozenLtv: decimal("frozen_ltv", { precision: 6, scale: 3 }),
  frozenCreditScore: integer("frozen_credit_score"),
  frozenTotalIncome: decimal("frozen_total_income", { precision: 14, scale: 2 }),
  frozenTotalLiabilities: decimal("frozen_total_liabilities", { precision: 14, scale: 2 }),
  
  // Full input snapshot (for dispute resolution)
  fullInputsJson: jsonb("full_inputs_json").notNull(),
  
  // Decision actor
  decidedBy: varchar("decided_by").references(() => users.id), // null = automated
  decisionType: varchar("decision_type", { length: 30 }).notNull(), // automated, manual, override
  
  // Immutability proof
  previousDecisionId: varchar("previous_decision_id"),
  decisionHash: varchar("decision_hash", { length: 64 }), // Hash of this decision
  
  decidedAt: timestamp("decided_at").defaultNow(),
}, (table) => [
  index("idx_uw_decision_loan").on(table.loanId),
  index("idx_uw_decision_snapshot").on(table.snapshotId),
  index("idx_uw_decision_result").on(table.resultId),
  index("idx_uw_decision_version").on(table.decisionVersion),
  index("idx_uw_decision_hash").on(table.inputsHash),
  index("idx_uw_decision_type").on(table.decisionType),
]);

export const underwritingDecisionsRelations = relations(underwritingDecisions, ({ one }) => ({
  loan: one(loanApplications, {
    fields: [underwritingDecisions.loanId],
    references: [loanApplications.id],
  }),
  snapshot: one(underwritingSnapshots, {
    fields: [underwritingDecisions.snapshotId],
    references: [underwritingSnapshots.id],
  }),
  result: one(underwritingResults, {
    fields: [underwritingDecisions.resultId],
    references: [underwritingResults.id],
  }),
  decider: one(users, {
    fields: [underwritingDecisions.decidedBy],
    references: [users.id],
  }),
}));

// I. UNDERWRITING RULES DSL - Data-driven guideline management
export const RULE_TRIGGER_TYPES = [
  "income_evaluated",
  "liability_evaluated", 
  "dti_calculated",
  "dscr_calculated",
  "document_processed",
  "field_extracted",
  "threshold_exceeded",
  "seasoning_checked",
  "stability_assessed",
  "portfolio_analyzed",
] as const;

export const RULE_ACTION_TYPES = [
  "set_qualification_status",
  "apply_cap",
  "apply_proration",
  "require_document",
  "flag_for_review",
  "trigger_recalculation",
  "add_condition",
  "adjust_confidence",
  "log_explanation",
  "escalate_to_underwriter",
] as const;

export const underwritingRulesDsl = pgTable("underwriting_rules_dsl", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule identity
  ruleCode: varchar("rule_code", { length: 50 }).notNull().unique(),
  ruleName: varchar("rule_name", { length: 200 }).notNull(),
  ruleDescription: text("rule_description"),
  
  // Scope
  productTypes: text("product_types").array(), // null = all products
  incomeTypes: text("income_types").array(), // null = all income types
  
  // Trigger
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // From RULE_TRIGGER_TYPES
  triggerConditions: jsonb("trigger_conditions").notNull(), // DSL condition object
  
  // Conditions (DSL syntax stored as structured JSONB)
  conditionsDsl: jsonb("conditions_dsl").notNull(), // The actual rule logic
  /*
    Example DSL:
    {
      "operator": "AND",
      "conditions": [
        { "field": "income.seasoningMonths", "operator": "<", "value": 24 },
        { "field": "income.type", "operator": "IN", "value": ["self_employment", "commission"] }
      ]
    }
  */
  
  // Actions
  actions: jsonb("actions").notNull(), // Array of actions to execute
  /*
    Example:
    [
      { "type": "set_qualification_status", "status": "excluded", "reason": "Insufficient seasoning" },
      { "type": "log_explanation", "category": "income", "ruleId": "SE_SEASON_001" }
    ]
  */
  
  // Execution control
  priority: integer("priority").default(100), // Lower = runs first
  stopOnMatch: boolean("stop_on_match").default(false), // If true, stop processing further rules
  
  // Versioning
  version: integer("version").default(1),
  previousVersionId: varchar("previous_version_id"),
  
  // Metadata
  category: varchar("category", { length: 50 }), // income, liability, dti, dscr, document, credit
  guidelineReference: varchar("guideline_reference", { length: 255 }), // e.g., "FNMA B3-3.1-09"
  
  // Lifecycle
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date").defaultNow(),
  expirationDate: timestamp("expiration_date"),
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rules_dsl_code").on(table.ruleCode),
  index("idx_rules_dsl_trigger").on(table.triggerType),
  index("idx_rules_dsl_category").on(table.category),
  index("idx_rules_dsl_priority").on(table.priority),
  index("idx_rules_dsl_active").on(table.isActive),
]);

export const underwritingRulesDslRelations = relations(underwritingRulesDsl, ({ one }) => ({
  creator: one(users, {
    fields: [underwritingRulesDsl.createdBy],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [underwritingRulesDsl.approvedBy],
    references: [users.id],
  }),
}));

// J. RULE EXECUTION LOG - Track every rule that fired
export const ruleExecutionLog = pgTable("rule_execution_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  ruleId: varchar("rule_id").references(() => underwritingRulesDsl.id).notNull(),
  
  // Execution details
  ruleCode: varchar("rule_code", { length: 50 }).notNull(),
  ruleVersion: integer("rule_version").notNull(),
  
  // What triggered it
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  triggerContext: jsonb("trigger_context"), // The data that triggered the rule
  
  // Evaluation
  conditionsMet: boolean("conditions_met").notNull(),
  evaluationDetails: jsonb("evaluation_details"), // Step-by-step condition evaluation
  
  // Actions taken
  actionsExecuted: jsonb("actions_executed"), // What actions were performed
  actionResults: jsonb("action_results"), // Results of each action
  
  // Impact
  impactedEntities: jsonb("impacted_entities"), // Which income streams, liabilities, etc.
  
  executedAt: timestamp("executed_at").defaultNow(),
}, (table) => [
  index("idx_rule_exec_snapshot").on(table.snapshotId),
  index("idx_rule_exec_rule").on(table.ruleId),
  index("idx_rule_exec_code").on(table.ruleCode),
  index("idx_rule_exec_met").on(table.conditionsMet),
]);

export const ruleExecutionLogRelations = relations(ruleExecutionLog, ({ one }) => ({
  snapshot: one(underwritingSnapshots, {
    fields: [ruleExecutionLog.snapshotId],
    references: [underwritingSnapshots.id],
  }),
  rule: one(underwritingRulesDsl, {
    fields: [ruleExecutionLog.ruleId],
    references: [underwritingRulesDsl.id],
  }),
}));

// ============================================================================
// DOCUMENT INTELLIGENCE ENGINE - ZOD SCHEMAS & TYPES
// ============================================================================

export const insertDocumentUploadSchema = createInsertSchema(documentUploads).omit({
  id: true,
  createdAt: true,
});
export const insertDocumentPageSchema = createInsertSchema(documentPages).omit({
  id: true,
  createdAt: true,
});
export const insertPageClassificationSchema = createInsertSchema(pageClassifications).omit({
  id: true,
});
export const insertLogicalDocumentSchema = createInsertSchema(logicalDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertLogicalDocumentPageSchema = createInsertSchema(logicalDocumentPages).omit({
  id: true,
  createdAt: true,
});
export const insertExtractedFieldSchema = createInsertSchema(extractedFields).omit({
  id: true,
});
export const insertCompletenessCheckSchema = createInsertSchema(completenessChecks).omit({
  id: true,
});
export const insertIncomeStreamSchema = createInsertSchema(incomeStreams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCanonicalAssetSchema = createInsertSchema(canonicalAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCanonicalLiabilitySchema = createInsertSchema(canonicalLiabilities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUnderwritingEventRuleSchema = createInsertSchema(underwritingEventRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUnderwritingEventLogSchema = createInsertSchema(underwritingEventLog).omit({
  id: true,
});
export const insertUnderwritingSnapshotSchema = createInsertSchema(underwritingSnapshots).omit({
  id: true,
  createdAt: true,
});
export const insertUnderwritingResultSchema = createInsertSchema(underwritingResults).omit({
  id: true,
});
export const insertAnomalySchema = createInsertSchema(anomalies).omit({
  id: true,
});
export const insertAuditEventSchema = createInsertSchema(auditEvents).omit({
  id: true,
});

// Type exports
export type InsertDocumentUpload = z.infer<typeof insertDocumentUploadSchema>;
export type DocumentUpload = typeof documentUploads.$inferSelect;
export type InsertDocumentPage = z.infer<typeof insertDocumentPageSchema>;
export type DocumentPage = typeof documentPages.$inferSelect;
export type InsertPageClassification = z.infer<typeof insertPageClassificationSchema>;
export type PageClassification = typeof pageClassifications.$inferSelect;
export type InsertLogicalDocument = z.infer<typeof insertLogicalDocumentSchema>;
export type LogicalDocument = typeof logicalDocuments.$inferSelect;
export type InsertLogicalDocumentPage = z.infer<typeof insertLogicalDocumentPageSchema>;
export type LogicalDocumentPage = typeof logicalDocumentPages.$inferSelect;
export type InsertExtractedField = z.infer<typeof insertExtractedFieldSchema>;
export type ExtractedField = typeof extractedFields.$inferSelect;
export type InsertCompletenessCheck = z.infer<typeof insertCompletenessCheckSchema>;
export type CompletenessCheck = typeof completenessChecks.$inferSelect;
export type InsertIncomeStream = z.infer<typeof insertIncomeStreamSchema>;
export type IncomeStream = typeof incomeStreams.$inferSelect;
export type InsertCanonicalAsset = z.infer<typeof insertCanonicalAssetSchema>;
export type CanonicalAsset = typeof canonicalAssets.$inferSelect;
export type InsertCanonicalLiability = z.infer<typeof insertCanonicalLiabilitySchema>;
export type CanonicalLiability = typeof canonicalLiabilities.$inferSelect;
export type InsertUnderwritingEventRule = z.infer<typeof insertUnderwritingEventRuleSchema>;
export type UnderwritingEventRule = typeof underwritingEventRules.$inferSelect;
export type InsertUnderwritingEventLog = z.infer<typeof insertUnderwritingEventLogSchema>;
export type UnderwritingEventLog = typeof underwritingEventLog.$inferSelect;
export type InsertUnderwritingSnapshot = z.infer<typeof insertUnderwritingSnapshotSchema>;
export type UnderwritingSnapshot = typeof underwritingSnapshots.$inferSelect;
export type InsertUnderwritingResult = z.infer<typeof insertUnderwritingResultSchema>;
export type UnderwritingResult = typeof underwritingResults.$inferSelect;
export type InsertAnomaly = z.infer<typeof insertAnomalySchema>;
export type Anomaly = typeof anomalies.$inferSelect;
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEvents.$inferSelect;

// DTI/DSCR ENGINE - Zod Schemas
export const insertSeasoningRuleSchema = createInsertSchema(seasoningRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCashFlowAdjustmentSchema = createInsertSchema(cashFlowAdjustments).omit({
  id: true,
  createdAt: true,
});
export const insertPortfolioStressTestSchema = createInsertSchema(portfolioStressTests).omit({
  id: true,
  calculatedAt: true,
});
export const insertProductRuleSchema = createInsertSchema(productRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUnderwritingExplanationSchema = createInsertSchema(underwritingExplanations).omit({
  id: true,
  createdAt: true,
});
export const insertConfidenceBreakdownSchema = createInsertSchema(confidenceBreakdowns).omit({
  id: true,
  calculatedAt: true,
});
export const insertWhatIfScenarioSchema = createInsertSchema(whatIfScenarios).omit({
  id: true,
  createdAt: true,
});
export const insertUnderwritingDecisionSchema = createInsertSchema(underwritingDecisions).omit({
  id: true,
  decidedAt: true,
});
export const insertUnderwritingRuleDslSchema = createInsertSchema(underwritingRulesDsl).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRuleExecutionLogSchema = createInsertSchema(ruleExecutionLog).omit({
  id: true,
  executedAt: true,
});

// DTI/DSCR ENGINE - Type Exports
export type InsertSeasoningRule = z.infer<typeof insertSeasoningRuleSchema>;
export type SeasoningRule = typeof seasoningRules.$inferSelect;
export type InsertCashFlowAdjustment = z.infer<typeof insertCashFlowAdjustmentSchema>;
export type CashFlowAdjustment = typeof cashFlowAdjustments.$inferSelect;
export type InsertPortfolioStressTest = z.infer<typeof insertPortfolioStressTestSchema>;
export type PortfolioStressTest = typeof portfolioStressTests.$inferSelect;
export type InsertProductRule = z.infer<typeof insertProductRuleSchema>;
export type ProductRule = typeof productRules.$inferSelect;
export type InsertUnderwritingExplanation = z.infer<typeof insertUnderwritingExplanationSchema>;
export type UnderwritingExplanation = typeof underwritingExplanations.$inferSelect;
export type InsertConfidenceBreakdown = z.infer<typeof insertConfidenceBreakdownSchema>;
export type ConfidenceBreakdown = typeof confidenceBreakdowns.$inferSelect;
export type InsertWhatIfScenario = z.infer<typeof insertWhatIfScenarioSchema>;
export type WhatIfScenario = typeof whatIfScenarios.$inferSelect;
export type InsertUnderwritingDecision = z.infer<typeof insertUnderwritingDecisionSchema>;
export type UnderwritingDecision = typeof underwritingDecisions.$inferSelect;
export type InsertUnderwritingRuleDsl = z.infer<typeof insertUnderwritingRuleDslSchema>;
export type UnderwritingRuleDsl = typeof underwritingRulesDsl.$inferSelect;
export type InsertRuleExecutionLog = z.infer<typeof insertRuleExecutionLogSchema>;
export type RuleExecutionLog = typeof ruleExecutionLog.$inferSelect;

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

// NOTE: underwritingSnapshots moved to DOCUMENT INTELLIGENCE ENGINE section above

// ============================================================================
// PLAID VERIFICATION SYSTEM
// ============================================================================

// Plaid Link tokens for verification sessions
export const plaidLinkTokens = pgTable("plaid_link_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  linkToken: text("link_token").notNull(),
  verificationType: varchar("verification_type", { length: 50 }).notNull(), // employment, identity, income, assets
  
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, completed, expired, failed
  expiresAt: timestamp("expires_at").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const plaidLinkTokensRelations = relations(plaidLinkTokens, ({ one }) => ({
  user: one(users, {
    fields: [plaidLinkTokens.userId],
    references: [users.id],
  }),
  application: one(loanApplications, {
    fields: [plaidLinkTokens.applicationId],
    references: [loanApplications.id],
  }),
}));

// Verification records - stores results from Plaid verification
export const verifications = pgTable("verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Verification Type
  verificationType: varchar("verification_type", { length: 50 }).notNull(), // employment, identity, income, assets
  
  // Plaid References
  plaidItemId: varchar("plaid_item_id", { length: 255 }),
  plaidAccessToken: text("plaid_access_token"), // encrypted in production
  plaidVerificationId: varchar("plaid_verification_id", { length: 255 }),
  
  // Status
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, in_progress, verified, failed, expired
  verificationMethod: varchar("verification_method", { length: 50 }), // plaid_payroll, plaid_bank, manual, document
  
  // Employment Verification Data
  employerName: varchar("employer_name", { length: 255 }),
  employerAddress: text("employer_address"),
  jobTitle: varchar("job_title", { length: 255 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isCurrentEmployer: boolean("is_current_employer"),
  employmentStatus: varchar("employment_status", { length: 50 }), // active, inactive, on_leave
  
  // Income Data (from employment verification)
  annualIncome: decimal("annual_income", { precision: 12, scale: 2 }),
  payFrequency: varchar("pay_frequency", { length: 50 }), // weekly, biweekly, semimonthly, monthly
  lastPayDate: timestamp("last_pay_date"),
  lastPayAmount: decimal("last_pay_amount", { precision: 10, scale: 2 }),
  
  // Identity Verification Data
  identityVerified: boolean("identity_verified").default(false),
  identityMatchScore: integer("identity_match_score"), // 0-100
  addressVerified: boolean("address_verified").default(false),
  ssnVerified: boolean("ssn_verified").default(false),
  dateOfBirthVerified: boolean("date_of_birth_verified").default(false),
  
  // Full Response (stored as JSONB for complete audit trail)
  rawResponse: jsonb("raw_response"),
  
  // Review
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  // Timestamps
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const verificationsRelations = relations(verifications, ({ one }) => ({
  application: one(loanApplications, {
    fields: [verifications.applicationId],
    references: [loanApplications.id],
  }),
  user: one(users, {
    fields: [verifications.userId],
    references: [users.id],
  }),
  reviewedBy: one(users, {
    fields: [verifications.reviewedByUserId],
    references: [users.id],
  }),
}));

export const insertVerificationSchema = createInsertSchema(verifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Verification = typeof verifications.$inferSelect;

export const insertPlaidLinkTokenSchema = createInsertSchema(plaidLinkTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPlaidLinkToken = z.infer<typeof insertPlaidLinkTokenSchema>;
export type PlaidLinkToken = typeof plaidLinkTokens.$inferSelect;

// ================================
// Learning Center & FAQ System
// ================================

// Content Categories - shared between articles and FAQs
export const contentCategories = pgTable("content_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }), // lucide icon name
  color: varchar("color", { length: 20 }), // hex color code
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contentCategoriesRelations = relations(contentCategories, ({ many }) => ({
  articles: many(articles),
  faqs: many(faqs),
}));

export const insertContentCategorySchema = createInsertSchema(contentCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContentCategory = z.infer<typeof insertContentCategorySchema>;
export type ContentCategory = typeof contentCategories.$inferSelect;

// Articles - Learning Center content
export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic Info
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt"), // Short summary for cards/previews
  content: text("content").notNull(), // Full article content (supports markdown)
  
  // Media
  featuredImage: varchar("featured_image", { length: 500 }),
  
  // Organization
  categoryId: varchar("category_id").references(() => contentCategories.id),
  tags: text("tags").array(), // Array of tag strings for filtering
  
  // SEO
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  
  // Publishing
  status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, published, archived
  publishedAt: timestamp("published_at"),
  
  // Author
  authorId: varchar("author_id").references(() => users.id),
  
  // Metrics
  viewCount: integer("view_count").default(0),
  readTimeMinutes: integer("read_time_minutes").default(5),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_articles_category").on(table.categoryId),
  index("idx_articles_status").on(table.status),
  index("idx_articles_published_at").on(table.publishedAt),
]);

export const articlesRelations = relations(articles, ({ one }) => ({
  category: one(contentCategories, {
    fields: [articles.categoryId],
    references: [contentCategories.id],
  }),
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
}));

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;

// FAQs - Frequently Asked Questions with search
export const faqs = pgTable("faqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Question & Answer
  question: text("question").notNull(),
  answer: text("answer").notNull(), // Supports markdown
  
  // Organization
  categoryId: varchar("category_id").references(() => contentCategories.id),
  tags: text("tags").array(), // For filtering and search
  
  // Search optimization
  searchKeywords: text("search_keywords").array(), // Additional keywords for search matching
  
  // Display
  displayOrder: integer("display_order").default(0),
  isPopular: boolean("is_popular").default(false), // Featured FAQs
  
  // Publishing
  status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, published, archived
  
  // Author
  authorId: varchar("author_id").references(() => users.id),
  
  // Metrics
  helpfulCount: integer("helpful_count").default(0),
  notHelpfulCount: integer("not_helpful_count").default(0),
  viewCount: integer("view_count").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_faqs_category").on(table.categoryId),
  index("idx_faqs_status").on(table.status),
  index("idx_faqs_popular").on(table.isPopular),
]);

export const faqsRelations = relations(faqs, ({ one }) => ({
  category: one(contentCategories, {
    fields: [faqs.categoryId],
    references: [contentCategories.id],
  }),
  author: one(users, {
    fields: [faqs.authorId],
    references: [users.id],
  }),
}));

export const insertFaqSchema = createInsertSchema(faqs).omit({
  id: true,
  helpfulCount: true,
  notHelpfulCount: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFaq = z.infer<typeof insertFaqSchema>;
export type Faq = typeof faqs.$inferSelect;

// =============================================================================
// MORTGAGE RATES
// =============================================================================

// Mortgage Rate Programs - defines the loan program types
export const mortgageRatePrograms = pgTable("mortgage_rate_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "30-yr fixed", "15-yr fixed", "5/6m ARM"
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  description: text("description"),
  termYears: integer("term_years"), // 30, 20, 15, 10, etc.
  isAdjustable: boolean("is_adjustable").default(false), // true for ARMs
  adjustmentPeriod: varchar("adjustment_period", { length: 20 }), // "6m", "1y" for ARMs
  loanType: varchar("loan_type", { length: 50 }), // conventional, fha, va, usda
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMortgageRateProgramSchema = createInsertSchema(mortgageRatePrograms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMortgageRateProgram = z.infer<typeof insertMortgageRateProgramSchema>;
export type MortgageRateProgram = typeof mortgageRatePrograms.$inferSelect;

// Mortgage Rates - the actual rate data by location and program
export const mortgageRates = pgTable("mortgage_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Location targeting
  state: varchar("state", { length: 2 }), // null means national/default
  zipcode: varchar("zipcode", { length: 10 }), // null means state-wide or national
  
  // Program reference
  programId: varchar("program_id").references(() => mortgageRatePrograms.id).notNull(),
  
  // Rate data
  rate: decimal("rate", { precision: 6, scale: 3 }).notNull(), // e.g., 5.750
  apr: decimal("apr", { precision: 6, scale: 3 }).notNull(), // e.g., 5.957
  points: decimal("points", { precision: 5, scale: 2 }), // e.g., 2.21
  pointsCost: decimal("points_cost", { precision: 10, scale: 2 }), // e.g., 3542.00
  
  // Assumptions
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).default("160000"), // Default loan amount for calculation
  downPaymentPercent: integer("down_payment_percent").default(20),
  creditScoreMin: integer("credit_score_min").default(760),
  
  // Status and timestamps
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date").defaultNow(),
  expiresAt: timestamp("expires_at"),
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_mortgage_rates_location").on(table.state, table.zipcode),
  index("idx_mortgage_rates_program").on(table.programId),
  index("idx_mortgage_rates_active").on(table.isActive),
]);

export const mortgageRatesRelations = relations(mortgageRates, ({ one }) => ({
  program: one(mortgageRatePrograms, {
    fields: [mortgageRates.programId],
    references: [mortgageRatePrograms.id],
  }),
  createdByUser: one(users, {
    fields: [mortgageRates.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [mortgageRates.updatedBy],
    references: [users.id],
  }),
}));

export const insertMortgageRateSchema = createInsertSchema(mortgageRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMortgageRate = z.infer<typeof insertMortgageRateSchema>;
export type MortgageRate = typeof mortgageRates.$inferSelect;

// =============================================================================
// CREDIT & FCRA COMPLIANCE
// =============================================================================

// Credit Consents - FCRA-compliant consent capture before any credit action
export const creditConsents = pgTable("credit_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Consent Details
  consentType: varchar("consent_type", { length: 50 }).notNull(), // credit_pull, soft_pull, hard_pull, monitoring
  disclosureVersion: varchar("disclosure_version", { length: 50 }).notNull(), // e.g., "FCRA-2024-v1"
  disclosureText: text("disclosure_text").notNull(), // Full text of disclosure shown
  
  // Borrower Agreement
  consentGiven: boolean("consent_given").notNull(),
  consentTimestamp: timestamp("consent_timestamp").notNull(),
  
  // Identity Verification
  borrowerFullName: varchar("borrower_full_name", { length: 255 }).notNull(),
  borrowerSSNLast4: varchar("borrower_ssn_last4", { length: 4 }), // Last 4 digits for verification
  borrowerDOB: varchar("borrower_dob", { length: 10 }), // YYYY-MM-DD
  
  // Audit Trail
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  signatureType: varchar("signature_type", { length: 50 }).default("electronic"), // electronic, esignature
  
  // Status
  isActive: boolean("is_active").default(true),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_credit_consents_application").on(table.applicationId),
  index("idx_credit_consents_user").on(table.userId),
]);

export const creditConsentsRelations = relations(creditConsents, ({ one, many }) => ({
  application: one(loanApplications, {
    fields: [creditConsents.applicationId],
    references: [loanApplications.id],
  }),
  user: one(users, {
    fields: [creditConsents.userId],
    references: [users.id],
  }),
  creditPulls: many(creditPulls),
}));

export const insertCreditConsentSchema = createInsertSchema(creditConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCreditConsent = z.infer<typeof insertCreditConsentSchema>;
export type CreditConsent = typeof creditConsents.$inferSelect;

// Draft Consent Progress - For save & resume functionality
export const draftConsentProgress = pgTable("draft_consent_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Saved form data
  consentType: varchar("consent_type", { length: 50 }).default("hard_pull"),
  borrowerFullName: varchar("borrower_full_name", { length: 255 }),
  borrowerSSNLast4: varchar("borrower_ssn_last4", { length: 4 }),
  borrowerDOB: varchar("borrower_dob", { length: 10 }),
  
  // Progress tracking
  disclosureRead: boolean("disclosure_read").default(false),
  acknowledged: boolean("acknowledged").default(false),
  currentStep: integer("current_step").default(1),
  totalSteps: integer("total_steps").default(3),
  
  // State-specific tracking
  stateDisclosuresReviewed: text("state_disclosures_reviewed").array(),
  additionalAcknowledgments: jsonb("additional_acknowledgments"),
  
  // Timestamps
  lastSavedAt: timestamp("last_saved_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Drafts expire after 7 days
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_draft_consent_application").on(table.applicationId),
  index("idx_draft_consent_user").on(table.userId),
]);

export const draftConsentProgressRelations = relations(draftConsentProgress, ({ one }) => ({
  application: one(loanApplications, {
    fields: [draftConsentProgress.applicationId],
    references: [loanApplications.id],
  }),
  user: one(users, {
    fields: [draftConsentProgress.userId],
    references: [users.id],
  }),
}));

export const insertDraftConsentProgressSchema = createInsertSchema(draftConsentProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDraftConsentProgress = z.infer<typeof insertDraftConsentProgressSchema>;
export type DraftConsentProgress = typeof draftConsentProgress.$inferSelect;

// Credit Pulls - Records of credit bureau inquiries
export const creditPulls = pgTable("credit_pulls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  consentId: varchar("consent_id").references(() => creditConsents.id).notNull(),
  requestedBy: varchar("requested_by").references(() => users.id).notNull(),
  
  // Pull Type
  pullType: varchar("pull_type", { length: 50 }).notNull(), // soft, hard, tri_merge
  bureaus: text("bureaus").array(), // ['experian', 'equifax', 'transunion']
  
  // Status
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, processing, completed, failed, expired
  
  // Credit Report Data (encrypted/tokenized in production)
  externalRequestId: varchar("external_request_id", { length: 255 }), // Credit bureau reference
  
  // Scores (when completed)
  experianScore: integer("experian_score"),
  equifaxScore: integer("equifax_score"),
  transunionScore: integer("transunion_score"),
  representativeScore: integer("representative_score"), // Middle score used for underwriting
  
  // Report Summary
  totalTradelines: integer("total_tradelines"),
  openTradelines: integer("open_tradelines"),
  totalDebt: decimal("total_debt", { precision: 12, scale: 2 }),
  monthlyPayments: decimal("monthly_payments", { precision: 10, scale: 2 }),
  derogatoryCount: integer("derogatory_count"),
  inquiryCount30Days: integer("inquiry_count_30_days"),
  inquiryCount90Days: integer("inquiry_count_90_days"),
  
  // Report Storage (reference to secure storage, not the report itself)
  reportStorageRef: varchar("report_storage_ref", { length: 500 }),
  
  // Encrypted Raw Response (AES-256-GCM encrypted)
  encryptedRawResponse: text("encrypted_raw_response"), // Base64 encoded encrypted data
  encryptionKeyId: varchar("encryption_key_id", { length: 100 }), // Reference to key used
  encryptionIV: varchar("encryption_iv", { length: 48 }), // Base64 encoded IV
  
  // Vendor Response Metadata (for reconciliation)
  vendorRequestId: varchar("vendor_request_id", { length: 255 }),
  vendorResponseHash: varchar("vendor_response_hash", { length: 64 }), // SHA-256 of raw response
  vendorBillingRef: varchar("vendor_billing_ref", { length: 255 }),
  
  // Error Handling
  errorCode: varchar("error_code", { length: 50 }),
  errorMessage: text("error_message"),
  
  // Timestamps
  requestedAt: timestamp("requested_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"), // Credit reports typically valid for 120 days
  archivedAt: timestamp("archived_at"), // For FCRA retention compliance
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_credit_pulls_application").on(table.applicationId),
  index("idx_credit_pulls_consent").on(table.consentId),
  index("idx_credit_pulls_status").on(table.status),
]);

export const creditPullsRelations = relations(creditPulls, ({ one, many }) => ({
  application: one(loanApplications, {
    fields: [creditPulls.applicationId],
    references: [loanApplications.id],
  }),
  consent: one(creditConsents, {
    fields: [creditPulls.consentId],
    references: [creditConsents.id],
  }),
  requestedByUser: one(users, {
    fields: [creditPulls.requestedBy],
    references: [users.id],
  }),
  adverseActions: many(adverseActions),
}));

export const insertCreditPullSchema = createInsertSchema(creditPulls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCreditPull = z.infer<typeof insertCreditPullSchema>;
export type CreditPull = typeof creditPulls.$inferSelect;

// Adverse Actions - FCRA-required notices when credit is used against applicant
export const adverseActions = pgTable("adverse_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  creditPullId: varchar("credit_pull_id").references(() => creditPulls.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Action Type
  actionType: varchar("action_type", { length: 50 }).notNull(), // denial, counteroffer, rate_adjustment, terms_change
  
  // Reasons (FCRA requires specific reasons)
  primaryReason: varchar("primary_reason", { length: 255 }).notNull(),
  secondaryReasons: text("secondary_reasons").array(),
  
  // Credit Information Used
  creditScoreUsed: integer("credit_score_used"),
  creditScoreSource: varchar("credit_score_source", { length: 50 }), // experian, equifax, transunion
  scoreRangeLow: integer("score_range_low"),
  scoreRangeHigh: integer("score_range_high"),
  
  // Required Disclosures
  bureauName: varchar("bureau_name", { length: 100 }),
  bureauAddress: text("bureau_address"),
  bureauPhone: varchar("bureau_phone", { length: 20 }),
  bureauWebsite: varchar("bureau_website", { length: 255 }),
  
  // Notice Details
  noticeText: text("notice_text").notNull(), // Full adverse action notice
  
  // Delivery
  deliveryMethod: varchar("delivery_method", { length: 50 }), // email, mail, both, in_app
  deliveredAt: timestamp("delivered_at"),
  deliveryConfirmation: varchar("delivery_confirmation", { length: 255 }),
  
  // FCRA Compliance
  noticeDate: timestamp("notice_date").notNull(), // Date notice was generated
  fcraCompliant: boolean("fcra_compliant").default(true),
  
  // Staff Actions
  generatedBy: varchar("generated_by").references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_adverse_actions_application").on(table.applicationId),
  index("idx_adverse_actions_user").on(table.userId),
  index("idx_adverse_actions_credit_pull").on(table.creditPullId),
]);

export const adverseActionsRelations = relations(adverseActions, ({ one }) => ({
  application: one(loanApplications, {
    fields: [adverseActions.applicationId],
    references: [loanApplications.id],
  }),
  creditPull: one(creditPulls, {
    fields: [adverseActions.creditPullId],
    references: [creditPulls.id],
  }),
  user: one(users, {
    fields: [adverseActions.userId],
    references: [users.id],
  }),
  generatedByUser: one(users, {
    fields: [adverseActions.generatedBy],
    references: [users.id],
  }),
  reviewedByUser: one(users, {
    fields: [adverseActions.reviewedBy],
    references: [users.id],
  }),
}));

export const insertAdverseActionSchema = createInsertSchema(adverseActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdverseAction = z.infer<typeof insertAdverseActionSchema>;
export type AdverseAction = typeof adverseActions.$inferSelect;

// Credit Audit Log - Immutable record of every credit-related action
export const creditAuditLog = pgTable("credit_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  applicationId: varchar("application_id").references(() => loanApplications.id),
  userId: varchar("user_id").references(() => users.id),
  consentId: varchar("consent_id").references(() => creditConsents.id),
  creditPullId: varchar("credit_pull_id").references(() => creditPulls.id),
  adverseActionId: varchar("adverse_action_id").references(() => adverseActions.id),
  
  // Action Details
  action: varchar("action", { length: 100 }).notNull(), // consent_given, consent_revoked, pull_requested, pull_completed, adverse_action_generated, etc.
  actionDetails: jsonb("action_details"), // Additional context
  
  // Actor
  performedBy: varchar("performed_by").references(() => users.id),
  performedByRole: varchar("performed_by_role", { length: 50 }),
  
  // Audit Trail
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Cryptographic Integrity (append-only chain)
  entryHash: varchar("entry_hash", { length: 64 }).notNull(), // SHA-256 of this entry's content
  previousEntryHash: varchar("previous_entry_hash", { length: 64 }), // Hash of previous entry (chain)
  sequenceNumber: integer("sequence_number"), // Per-application sequence for ordering
  
  // Timestamp (immutable)
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_credit_audit_application").on(table.applicationId),
  index("idx_credit_audit_timestamp").on(table.timestamp),
  index("idx_credit_audit_action").on(table.action),
  index("idx_credit_audit_entry_hash").on(table.entryHash),
]);

export const creditAuditLogRelations = relations(creditAuditLog, ({ one }) => ({
  application: one(loanApplications, {
    fields: [creditAuditLog.applicationId],
    references: [loanApplications.id],
  }),
  user: one(users, {
    fields: [creditAuditLog.userId],
    references: [users.id],
  }),
  consent: one(creditConsents, {
    fields: [creditAuditLog.consentId],
    references: [creditConsents.id],
  }),
  creditPull: one(creditPulls, {
    fields: [creditAuditLog.creditPullId],
    references: [creditPulls.id],
  }),
  adverseAction: one(adverseActions, {
    fields: [creditAuditLog.adverseActionId],
    references: [adverseActions.id],
  }),
  performedByUser: one(users, {
    fields: [creditAuditLog.performedBy],
    references: [users.id],
  }),
}));

export const insertCreditAuditLogSchema = createInsertSchema(creditAuditLog).omit({
  id: true,
});

export type InsertCreditAuditLog = z.infer<typeof insertCreditAuditLogSchema>;
export type CreditAuditLog = typeof creditAuditLog.$inferSelect;

// Broker Commissions - tracks commission payments to referring brokers/loan officers
export const brokerCommissions = pgTable("broker_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to broker and application
  brokerId: varchar("broker_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Commission Details
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull(), // e.g., 0.0100 = 1%
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  
  // Payment Status
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, approved, paid, cancelled
  
  // Payment Details
  paidAt: timestamp("paid_at"),
  paidBy: varchar("paid_by").references(() => users.id),
  paymentReference: varchar("payment_reference", { length: 255 }),
  paymentMethod: varchar("payment_method", { length: 50 }), // check, wire, ach
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_broker_commissions_broker").on(table.brokerId),
  index("idx_broker_commissions_application").on(table.applicationId),
  index("idx_broker_commissions_status").on(table.status),
]);

export const brokerCommissionsRelations = relations(brokerCommissions, ({ one }) => ({
  broker: one(users, {
    fields: [brokerCommissions.brokerId],
    references: [users.id],
  }),
  application: one(loanApplications, {
    fields: [brokerCommissions.applicationId],
    references: [loanApplications.id],
  }),
  paidByUser: one(users, {
    fields: [brokerCommissions.paidBy],
    references: [users.id],
  }),
}));

export const insertBrokerCommissionSchema = createInsertSchema(brokerCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrokerCommission = z.infer<typeof insertBrokerCommissionSchema>;
export type BrokerCommission = typeof brokerCommissions.$inferSelect;

// Calculator Results - stores user calculator inputs/results for follow-up
export const calculatorResults = pgTable("calculator_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  calculatorType: varchar("calculator_type", { length: 50 }).notNull(), // rent_vs_buy, affordability, mortgage
  inputs: jsonb("inputs").notNull(),
  results: jsonb("results").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_calculator_results_user").on(table.userId),
  index("idx_calculator_results_type").on(table.calculatorType),
]);

export const calculatorResultsRelations = relations(calculatorResults, ({ one }) => ({
  user: one(users, {
    fields: [calculatorResults.userId],
    references: [users.id],
  }),
}));

export const insertCalculatorResultSchema = createInsertSchema(calculatorResults).omit({
  id: true,
  createdAt: true,
});

export type InsertCalculatorResult = z.infer<typeof insertCalculatorResultSchema>;
export type CalculatorResult = typeof calculatorResults.$inferSelect;

// ===== ASPIRING OWNER JOURNEY =====

// Homeownership Goals - Main tracking for aspiring owner journey
export const homeownershipGoals = pgTable("homeownership_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Current Financial Status (entered by user or pulled from Plaid)
  currentCreditScore: integer("current_credit_score"),
  currentMonthlySavings: decimal("current_monthly_savings", { precision: 10, scale: 2 }),
  currentSavingsBalance: decimal("current_savings_balance", { precision: 12, scale: 2 }).default("0"),
  monthlyIncome: decimal("monthly_income", { precision: 10, scale: 2 }),
  monthlyDebts: decimal("monthly_debts", { precision: 10, scale: 2 }),
  currentRent: decimal("current_rent", { precision: 10, scale: 2 }),
  
  // Target Goals
  targetCreditScore: integer("target_credit_score").default(640),
  targetDownPayment: decimal("target_down_payment", { precision: 12, scale: 2 }),
  targetHomePrice: decimal("target_home_price", { precision: 12, scale: 2 }),
  targetMonthlyPayment: decimal("target_monthly_payment", { precision: 10, scale: 2 }),
  
  // Journey Status
  journeyStartDate: timestamp("journey_start_date").defaultNow(),
  currentPhase: varchar("current_phase", { length: 50 }).default("discovery"), // discovery, credit_cleanup, saving, ready
  journeyDay: integer("journey_day").default(1),
  
  // Progress Tracking
  creditScoreChange: integer("credit_score_change").default(0), // cumulative change since start
  savingsProgress: decimal("savings_progress", { precision: 12, scale: 2 }).default("0"), // total saved toward goal
  
  // Preferred location
  targetCity: varchar("target_city", { length: 100 }),
  targetState: varchar("target_state", { length: 50 }),
  targetZipCode: varchar("target_zip_code", { length: 20 }),
  
  // Linked agent (if referred)
  referringAgentId: varchar("referring_agent_id").references(() => agentProfiles.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_homeownership_goals_user").on(table.userId),
  index("idx_homeownership_goals_phase").on(table.currentPhase),
]);

export const homeownershipGoalsRelations = relations(homeownershipGoals, ({ one, many }) => ({
  user: one(users, {
    fields: [homeownershipGoals.userId],
    references: [users.id],
  }),
  referringAgent: one(agentProfiles, {
    fields: [homeownershipGoals.referringAgentId],
    references: [agentProfiles.id],
  }),
  creditActions: many(creditActions),
  savingsTransactions: many(savingsTransactions),
  journeyMilestones: many(journeyMilestones),
}));

export const insertHomeownershipGoalSchema = createInsertSchema(homeownershipGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertHomeownershipGoal = z.infer<typeof insertHomeownershipGoalSchema>;
export type HomeownershipGoal = typeof homeownershipGoals.$inferSelect;

// Credit Actions - Track credit improvement actions
export const creditActions = pgTable("credit_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => homeownershipGoals.id).notNull(),
  
  // Action Details
  actionType: varchar("action_type", { length: 50 }).notNull(), // pay_down_card, dispute_error, authorized_user, secured_card, on_time_payment
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  
  // Impact
  estimatedPointsGain: integer("estimated_points_gain"),
  actualPointsGain: integer("actual_points_gain"),
  priority: varchar("priority", { length: 20 }).default("medium"), // high, medium, low
  
  // Status
  status: varchar("status", { length: 50 }).default("pending"), // pending, in_progress, completed, skipped
  completedAt: timestamp("completed_at"),
  
  // Related account info (if applicable)
  creditorName: varchar("creditor_name", { length: 255 }),
  accountBalance: decimal("account_balance", { precision: 10, scale: 2 }),
  recommendedPayment: decimal("recommended_payment", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_credit_actions_goal").on(table.goalId),
  index("idx_credit_actions_status").on(table.status),
]);

export const creditActionsRelations = relations(creditActions, ({ one }) => ({
  goal: one(homeownershipGoals, {
    fields: [creditActions.goalId],
    references: [homeownershipGoals.id],
  }),
}));

export const insertCreditActionSchema = createInsertSchema(creditActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCreditAction = z.infer<typeof insertCreditActionSchema>;
export type CreditAction = typeof creditActions.$inferSelect;

// Savings Transactions - Track savings deposits and round-ups
export const savingsTransactions = pgTable("savings_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => homeownershipGoals.id).notNull(),
  
  // Transaction Details
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // manual_deposit, round_up, recurring, bonus
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }),
  
  // Running Total
  runningBalance: decimal("running_balance", { precision: 12, scale: 2 }).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_savings_transactions_goal").on(table.goalId),
]);

export const savingsTransactionsRelations = relations(savingsTransactions, ({ one }) => ({
  goal: one(homeownershipGoals, {
    fields: [savingsTransactions.goalId],
    references: [homeownershipGoals.id],
  }),
}));

export const insertSavingsTransactionSchema = createInsertSchema(savingsTransactions).omit({
  id: true,
  createdAt: true,
});

export type InsertSavingsTransaction = z.infer<typeof insertSavingsTransactionSchema>;
export type SavingsTransaction = typeof savingsTransactions.$inferSelect;

// Journey Milestones - Track achieved milestones
export const journeyMilestones = pgTable("journey_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => homeownershipGoals.id).notNull(),
  
  // Milestone Details
  milestoneType: varchar("milestone_type", { length: 50 }).notNull(), 
  // Types: first_deposit, credit_score_up_10, credit_score_up_25, savings_500, savings_1000, 
  // savings_2500, savings_5000, day_7, day_14, day_30, target_credit_reached, target_savings_reached
  
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  celebrationMessage: text("celebration_message"),
  
  // Achievement
  achievedAt: timestamp("achieved_at").defaultNow(),
  pointsAwarded: integer("points_awarded").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_journey_milestones_goal").on(table.goalId),
  index("idx_journey_milestones_type").on(table.milestoneType),
]);

export const journeyMilestonesRelations = relations(journeyMilestones, ({ one }) => ({
  goal: one(homeownershipGoals, {
    fields: [journeyMilestones.goalId],
    references: [homeownershipGoals.id],
  }),
}));

export const insertJourneyMilestoneSchema = createInsertSchema(journeyMilestones).omit({
  id: true,
  createdAt: true,
});

export type InsertJourneyMilestone = z.infer<typeof insertJourneyMilestoneSchema>;
export type JourneyMilestone = typeof journeyMilestones.$inferSelect;

// Application Invites - Referral links for LOs and agents to send to affluent clients
export const applicationInvites = pgTable("application_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Referrer Info (LO or Agent)
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  referrerType: varchar("referrer_type", { length: 20 }).notNull(), // 'lo', 'loa', 'agent'
  
  // Client Info (optional pre-fill)
  clientName: varchar("client_name", { length: 255 }),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 20 }),
  
  // Link Details
  token: varchar("token", { length: 64 }).unique().notNull(), // Unique URL token
  message: text("message"), // Optional personal message from referrer
  
  // Status tracking
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, clicked, applied, expired
  
  // Timestamps
  expiresAt: timestamp("expires_at").notNull(),
  clickedAt: timestamp("clicked_at"),
  appliedAt: timestamp("applied_at"),
  loanApplicationId: varchar("loan_application_id").references(() => loanApplications.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_application_invites_referrer").on(table.referrerId),
  index("idx_application_invites_token").on(table.token),
  index("idx_application_invites_status").on(table.status),
]);

export const applicationInvitesRelations = relations(applicationInvites, ({ one }) => ({
  referrer: one(users, {
    fields: [applicationInvites.referrerId],
    references: [users.id],
  }),
  loanApplication: one(loanApplications, {
    fields: [applicationInvites.loanApplicationId],
    references: [loanApplications.id],
  }),
}));

export const insertApplicationInviteSchema = createInsertSchema(applicationInvites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplicationInvite = z.infer<typeof insertApplicationInviteSchema>;
export type ApplicationInvite = typeof applicationInvites.$inferSelect;

// ===== RATE LOCK SYSTEM =====

// Rate Lock History - Track all rate locks with full audit trail
export const rateLocks = pgTable("rate_locks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  loanOptionId: varchar("loan_option_id").references(() => loanOptions.id).notNull(),
  
  // Rate Details at time of lock
  interestRate: decimal("interest_rate", { precision: 5, scale: 3 }).notNull(),
  points: decimal("points", { precision: 5, scale: 3 }),
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).notNull(),
  loanType: varchar("loan_type", { length: 50 }).notNull(),
  loanTerm: integer("loan_term").notNull(),
  
  // Lock Details
  lockPeriodDays: integer("lock_period_days").notNull(), // 30, 45, 60 days
  lockedAt: timestamp("locked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  
  // Status
  status: varchar("status", { length: 50 }).default("active").notNull(), // active, extended, expired, cancelled, exercised
  
  // Extension tracking
  extensionCount: integer("extension_count").default(0),
  originalExpiresAt: timestamp("original_expires_at"),
  extensionFee: decimal("extension_fee", { precision: 10, scale: 2 }),
  
  // Audit
  lockedBy: varchar("locked_by").references(() => users.id).notNull(),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rate_locks_application").on(table.applicationId),
  index("idx_rate_locks_status").on(table.status),
  index("idx_rate_locks_expires").on(table.expiresAt),
]);

export const rateLocksRelations = relations(rateLocks, ({ one }) => ({
  application: one(loanApplications, {
    fields: [rateLocks.applicationId],
    references: [loanApplications.id],
  }),
  loanOption: one(loanOptions, {
    fields: [rateLocks.loanOptionId],
    references: [loanOptions.id],
  }),
  lockedByUser: one(users, {
    fields: [rateLocks.lockedBy],
    references: [users.id],
  }),
  cancelledByUser: one(users, {
    fields: [rateLocks.cancelledBy],
    references: [users.id],
  }),
}));

export const insertRateLockSchema = createInsertSchema(rateLocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRateLock = z.infer<typeof insertRateLockSchema>;
export type RateLock = typeof rateLocks.$inferSelect;

// ===== ECONSENT SYSTEM =====

// Consent Types - Define available consent types
export const CONSENT_TYPES = [
  "credit_authorization",    // Authorize credit pull
  "econsent",               // Electronic signature consent  
  "privacy_policy",         // Privacy policy acknowledgment
  "terms_of_service",       // Terms acceptance
  "disclosure",             // General disclosures
  "appraisal_waiver",       // Waive right to appraisal copy timing
  "title_acknowledgment",   // Title company selection acknowledgment
  "rate_lock_agreement",    // Rate lock terms
  "intent_to_proceed",      // TRID intent to proceed
  "loan_estimate_receipt",  // Acknowledge loan estimate receipt
] as const;

export type ConsentType = typeof CONSENT_TYPES[number];

// Consent Templates - Define consent content per type/state
export const consentTemplates = pgTable("consent_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Type and Version
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  version: varchar("version", { length: 20 }).notNull(), // e.g., "1.0.0"
  
  // State-specific (null = federal/all states)
  state: varchar("state", { length: 2 }),
  
  // Content
  title: varchar("title", { length: 255 }).notNull(),
  shortDescription: text("short_description"),
  fullText: text("full_text").notNull(), // Full legal text
  
  // Regulatory
  regulatoryReference: varchar("regulatory_reference", { length: 255 }), // e.g., "TRID Section 4", "FCRA 604"
  requiredForLoanTypes: text("required_for_loan_types").array(), // ['conventional', 'fha', 'va']
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  expirationDate: timestamp("expiration_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_consent_templates_type").on(table.consentType),
  index("idx_consent_templates_state").on(table.state),
  index("idx_consent_templates_active").on(table.isActive),
]);

export const insertConsentTemplateSchema = createInsertSchema(consentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConsentTemplate = z.infer<typeof insertConsentTemplateSchema>;
export type ConsentTemplate = typeof consentTemplates.$inferSelect;

// Borrower Consents - Audit trail of all consents given
export const borrowerConsents = pgTable("borrower_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  userId: varchar("user_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id),
  templateId: varchar("template_id").references(() => consentTemplates.id),
  
  // Consent Details
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  templateVersion: varchar("template_version", { length: 20 }),
  
  // Consent Capture
  consentGiven: boolean("consent_given").notNull(),
  consentMethod: varchar("consent_method", { length: 50 }).notNull(), // 'click', 'signature', 'verbal', 'paper'
  
  // Digital Signature (if applicable)
  signatureData: text("signature_data"), // Base64 signature image or typed name
  signatureType: varchar("signature_type", { length: 20 }), // 'drawn', 'typed', 'none'
  
  // Audit Trail - Immutable
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  browserFingerprint: varchar("browser_fingerprint", { length: 64 }),
  
  // Timing
  consentedAt: timestamp("consented_at").defaultNow().notNull(),
  
  // Revocation (if applicable)
  isRevoked: boolean("is_revoked").default(false),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  
  // Hash for tamper evidence
  contentHash: varchar("content_hash", { length: 64 }), // SHA-256 of consent content at time of signing
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_borrower_consents_user").on(table.userId),
  index("idx_borrower_consents_application").on(table.applicationId),
  index("idx_borrower_consents_type").on(table.consentType),
]);

export const borrowerConsentsRelations = relations(borrowerConsents, ({ one }) => ({
  user: one(users, {
    fields: [borrowerConsents.userId],
    references: [users.id],
  }),
  application: one(loanApplications, {
    fields: [borrowerConsents.applicationId],
    references: [loanApplications.id],
  }),
  template: one(consentTemplates, {
    fields: [borrowerConsents.templateId],
    references: [consentTemplates.id],
  }),
}));

export const insertBorrowerConsentSchema = createInsertSchema(borrowerConsents).omit({
  id: true,
  createdAt: true,
});

export type InsertBorrowerConsent = z.infer<typeof insertBorrowerConsentSchema>;
export type BorrowerConsent = typeof borrowerConsents.$inferSelect;

// ===== PARTNER API INTEGRATIONS =====

// Partner Service Types
export const PARTNER_SERVICE_TYPES = [
  "credit_report",     // Credit bureau pull
  "title_search",      // Title search/insurance
  "appraisal",         // Property appraisal
  "flood_cert",        // Flood certification
  "verification_employment", // VOE
  "verification_income",     // VOI
  "verification_assets",     // VOA
  "tax_transcripts",   // IRS transcripts
  "homeowners_insurance", // HOI quote
] as const;

export type PartnerServiceType = typeof PARTNER_SERVICE_TYPES[number];

// Partner Service Providers
export const partnerProviders = pgTable("partner_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Provider Details
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).unique().notNull(), // e.g., 'experian', 'first_american_title'
  serviceType: varchar("service_type", { length: 50 }).notNull(),
  
  // API Configuration (encrypted in production)
  apiBaseUrl: varchar("api_base_url", { length: 255 }),
  apiVersion: varchar("api_version", { length: 20 }),
  
  // Credentials (stored in secrets, reference only)
  credentialSecretKey: varchar("credential_secret_key", { length: 100 }), // Key in secrets store
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isTestMode: boolean("is_test_mode").default(true).notNull(),
  
  // Pricing
  baseFee: decimal("base_fee", { precision: 10, scale: 2 }),
  
  // Contact
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  
  // SLA
  expectedTurnaroundHours: integer("expected_turnaround_hours"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_partner_providers_type").on(table.serviceType),
  index("idx_partner_providers_code").on(table.code),
]);

export const insertPartnerProviderSchema = createInsertSchema(partnerProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPartnerProvider = z.infer<typeof insertPartnerProviderSchema>;
export type PartnerProvider = typeof partnerProviders.$inferSelect;

// Partner Orders - Track all third-party service orders
export const partnerOrders = pgTable("partner_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  providerId: varchar("provider_id").references(() => partnerProviders.id).notNull(),
  
  // Order Details
  serviceType: varchar("service_type", { length: 50 }).notNull(),
  orderReference: varchar("order_reference", { length: 100 }), // External order ID from provider
  
  // Status
  status: varchar("status", { length: 50 }).default("pending").notNull(), 
  // pending, submitted, in_progress, completed, failed, cancelled
  
  // Request/Response
  requestPayload: jsonb("request_payload"), // Sanitized request (no PII)
  responsePayload: jsonb("response_payload"), // Sanitized response
  resultSummary: jsonb("result_summary"), // Key findings/data extracted
  
  // For credit reports specifically
  creditScoreExperian: integer("credit_score_experian"),
  creditScoreEquifax: integer("credit_score_equifax"),
  creditScoreTransUnion: integer("credit_score_transunion"),
  
  // For appraisals
  appraisedValue: decimal("appraised_value", { precision: 12, scale: 2 }),
  
  // For title
  titleStatus: varchar("title_status", { length: 50 }), // clear, liens_found, issues_found
  
  // Fees
  fee: decimal("fee", { precision: 10, scale: 2 }),
  feePaidByBorrower: boolean("fee_paid_by_borrower").default(true),
  
  // Timing
  orderedAt: timestamp("ordered_at").defaultNow(),
  orderedBy: varchar("ordered_by").references(() => users.id).notNull(),
  submittedAt: timestamp("submitted_at"),
  completedAt: timestamp("completed_at"),
  
  // Error handling
  errorCode: varchar("error_code", { length: 50 }),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  
  // Document storage
  resultDocumentPath: text("result_document_path"), // Path to stored report/document
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_partner_orders_application").on(table.applicationId),
  index("idx_partner_orders_provider").on(table.providerId),
  index("idx_partner_orders_status").on(table.status),
  index("idx_partner_orders_type").on(table.serviceType),
]);

export const partnerOrdersRelations = relations(partnerOrders, ({ one }) => ({
  application: one(loanApplications, {
    fields: [partnerOrders.applicationId],
    references: [loanApplications.id],
  }),
  provider: one(partnerProviders, {
    fields: [partnerOrders.providerId],
    references: [partnerProviders.id],
  }),
  orderedByUser: one(users, {
    fields: [partnerOrders.orderedBy],
    references: [users.id],
  }),
}));

export const insertPartnerOrderSchema = createInsertSchema(partnerOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPartnerOrder = z.infer<typeof insertPartnerOrderSchema>;
export type PartnerOrder = typeof partnerOrders.$inferSelect;

// ===== ANALYTICS & SLA TRACKING =====

// Application Milestones - Track key dates for cycle time analysis
export const applicationMilestones = pgTable("application_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Pipeline Stage Timestamps
  applicationReceivedAt: timestamp("application_received_at"),
  documentCollectionStartedAt: timestamp("document_collection_started_at"),
  documentCollectionCompletedAt: timestamp("document_collection_completed_at"),
  submittedToProcessingAt: timestamp("submitted_to_processing_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  submittedToUnderwritingAt: timestamp("submitted_to_underwriting_at"),
  conditionalApprovalAt: timestamp("conditional_approval_at"),
  clearToCloseAt: timestamp("clear_to_close_at"),
  closingScheduledAt: timestamp("closing_scheduled_at"),
  closedAt: timestamp("closed_at"),
  fundedAt: timestamp("funded_at"),
  
  // Denial tracking
  deniedAt: timestamp("denied_at"),
  denialReason: text("denial_reason"),
  
  // Withdrawal tracking
  withdrawnAt: timestamp("withdrawn_at"),
  withdrawalReason: text("withdrawal_reason"),
  
  // Calculated cycle times (in hours, updated by trigger/job)
  totalCycleTimeHours: decimal("total_cycle_time_hours", { precision: 10, scale: 2 }),
  processingTimeHours: decimal("processing_time_hours", { precision: 10, scale: 2 }),
  underwritingTimeHours: decimal("underwriting_time_hours", { precision: 10, scale: 2 }),
  closingTimeHours: decimal("closing_time_hours", { precision: 10, scale: 2 }),
  
  // SLA tracking
  slaTargetDate: timestamp("sla_target_date"),
  isSlaMet: boolean("is_sla_met"),
  slaBreachReason: text("sla_breach_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_application_milestones_app").on(table.applicationId),
]);

export const applicationMilestonesRelations = relations(applicationMilestones, ({ one }) => ({
  application: one(loanApplications, {
    fields: [applicationMilestones.applicationId],
    references: [loanApplications.id],
  }),
}));

export const insertApplicationMilestoneSchema = createInsertSchema(applicationMilestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplicationMilestone = z.infer<typeof insertApplicationMilestoneSchema>;
export type ApplicationMilestone = typeof applicationMilestones.$inferSelect;

// SLA Configurations - Define SLA targets
export const slaConfigurations = pgTable("sla_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // SLA Details
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Targets (in business hours)
  applicationToProcessingHours: integer("application_to_processing_hours").default(24),
  processingToUnderwritingHours: integer("processing_to_underwriting_hours").default(48),
  underwritingDecisionHours: integer("underwriting_decision_hours").default(72),
  conditionalToCtcHours: integer("conditional_to_ctc_hours").default(48),
  ctcToClosingHours: integer("ctc_to_closing_hours").default(72),
  totalApplicationToCloseHours: integer("total_application_to_close_hours").default(360), // 15 business days
  
  // Loan type specific
  loanType: varchar("loan_type", { length: 50 }), // null = all types
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sla_configurations_active").on(table.isActive),
]);

export const insertSlaConfigurationSchema = createInsertSchema(slaConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSlaConfiguration = z.infer<typeof insertSlaConfigurationSchema>;
export type SlaConfiguration = typeof slaConfigurations.$inferSelect;

// Daily Analytics Snapshots - Pre-computed metrics for dashboard
export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Date
  snapshotDate: timestamp("snapshot_date").notNull(),
  
  // Pipeline Metrics
  totalApplications: integer("total_applications").default(0),
  applicationsInPipeline: integer("applications_in_pipeline").default(0),
  applicationsProcessing: integer("applications_processing").default(0),
  applicationsUnderwriting: integer("applications_underwriting").default(0),
  applicationsApproved: integer("applications_approved").default(0),
  applicationsDenied: integer("applications_denied").default(0),
  applicationsWithdrawn: integer("applications_withdrawn").default(0),
  applicationsClosed: integer("applications_closed").default(0),
  applicationsFunded: integer("applications_funded").default(0),
  
  // Volume Metrics
  newApplicationsToday: integer("new_applications_today").default(0),
  closedVolumeToday: decimal("closed_volume_today", { precision: 14, scale: 2 }).default("0"),
  fundedVolumeToday: decimal("funded_volume_today", { precision: 14, scale: 2 }).default("0"),
  
  // Cycle Time Metrics (averages in hours)
  avgTotalCycleTime: decimal("avg_total_cycle_time", { precision: 10, scale: 2 }),
  avgProcessingTime: decimal("avg_processing_time", { precision: 10, scale: 2 }),
  avgUnderwritingTime: decimal("avg_underwriting_time", { precision: 10, scale: 2 }),
  
  // SLA Metrics
  slaComplianceRate: decimal("sla_compliance_rate", { precision: 5, scale: 2 }), // percentage
  loansAtRiskOfSlaBreach: integer("loans_at_risk_of_sla_breach").default(0),
  
  // Conversion Metrics
  applicationToApprovalRate: decimal("application_to_approval_rate", { precision: 5, scale: 2 }),
  approvalToCloseRate: decimal("approval_to_close_rate", { precision: 5, scale: 2 }),
  pullThroughRate: decimal("pull_through_rate", { precision: 5, scale: 2 }), // app to funded
  
  // Staff Metrics
  avgLoansPerLO: decimal("avg_loans_per_lo", { precision: 5, scale: 1 }),
  avgLoansPerProcessor: decimal("avg_loans_per_processor", { precision: 5, scale: 1 }),
  avgLoansPerUnderwriter: decimal("avg_loans_per_underwriter", { precision: 5, scale: 1 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_analytics_snapshots_date").on(table.snapshotDate),
]);

export const insertAnalyticsSnapshotSchema = createInsertSchema(analyticsSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalyticsSnapshot = z.infer<typeof insertAnalyticsSnapshotSchema>;
export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;

// ============================================================================
// PRE-APPROVAL LETTER GENERATOR (Lender-Grade, Broker-Safe)
// ============================================================================

// Disclaimer Versions - versioned legal text with counsel approval
// Critical for legal defense - every letter stores which version was used
export const disclaimerVersions = pgTable("disclaimer_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Version identifier (e.g., "2026.01")
  version: varchar("version", { length: 20 }).notNull().unique(),
  
  // Disclaimer types
  disclaimerType: varchar("disclaimer_type", { length: 50 }).notNull(), // primary, broker_role, document_reliance, change_in_circumstance, system_generated
  
  // The actual disclaimer text
  text: text("text").notNull(),
  
  // Legal approval tracking
  approvedByCounsel: boolean("approved_by_counsel").default(false),
  counselApprovalDate: timestamp("counsel_approval_date"),
  counselName: varchar("counsel_name", { length: 255 }),
  
  // Effective dates
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"), // null = currently active
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => [
  index("idx_disclaimer_versions_type_version").on(table.disclaimerType, table.version),
  index("idx_disclaimer_versions_effective").on(table.effectiveFrom, table.effectiveTo),
]);

export const insertDisclaimerVersionSchema = createInsertSchema(disclaimerVersions).omit({
  id: true,
  createdAt: true,
});

// Pre-Approval Product Types
export const PRE_APPROVAL_PRODUCT_TYPES = ["CONV", "FHA", "VA", "HELOC", "DSCR"] as const;
export type PreApprovalProductType = typeof PRE_APPROVAL_PRODUCT_TYPES[number];

// Pre-Approval Occupancy Types
export const PRE_APPROVAL_OCCUPANCY_TYPES = ["Primary", "Second", "Investment"] as const;
export type PreApprovalOccupancyType = typeof PRE_APPROVAL_OCCUPANCY_TYPES[number];

// Pre-Approval Letter Status
export const PRE_APPROVAL_LETTER_STATUS = [
  "draft",       // Letter being prepared
  "issued",      // Letter issued to borrower
  "superseded",  // Replaced by newer letter
  "expired",     // Past expiration date
  "revoked",     // Manually revoked due to change in circumstances
] as const;
export type PreApprovalLetterStatus = typeof PRE_APPROVAL_LETTER_STATUS[number];

// Pre-Approval Letters - the controlled credit artifact
// Key rule: The letter references a frozen underwriting snapshot — never live data
export const preApprovalLetters = pgTable("pre_approval_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Letter identification
  letterNumber: varchar("letter_number", { length: 50 }).notNull().unique(), // Human-readable letter ID
  
  // Borrower info (frozen at time of letter generation)
  borrowerName: varchar("borrower_name", { length: 255 }).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  // Loan terms (non-binding)
  loanAmount: decimal("loan_amount", { precision: 14, scale: 2 }).notNull(),
  productType: varchar("product_type", { length: 20 }).notNull(), // CONV, FHA, VA, HELOC, DSCR
  occupancy: varchar("occupancy", { length: 20 }).notNull(), // Primary, Second, Investment
  loanPurpose: varchar("loan_purpose", { length: 50 }), // Purchase, Refinance, Cash-Out
  
  // ⚠️ Rate is NOT included unless locked - per spec
  rateLockedAt: timestamp("rate_locked_at"), // Only populated if rate is locked
  lockedRate: decimal("locked_rate", { precision: 5, scale: 3 }), // Only if locked
  
  // Frozen underwriting snapshot reference (CRITICAL)
  underwritingSnapshotId: varchar("underwriting_snapshot_id").references(() => underwritingDecisions.id).notNull(),
  
  // Disclaimer versions used (for legal defense)
  primaryDisclaimerId: varchar("primary_disclaimer_id").references(() => disclaimerVersions.id).notNull(),
  brokerRoleDisclaimerId: varchar("broker_role_disclaimer_id").references(() => disclaimerVersions.id).notNull(),
  documentRelianceDisclaimerId: varchar("document_reliance_disclaimer_id").references(() => disclaimerVersions.id).notNull(),
  changeInCircumstanceDisclaimerId: varchar("change_in_circumstance_disclaimer_id").references(() => disclaimerVersions.id).notNull(),
  systemGeneratedDisclaimerId: varchar("system_generated_disclaimer_id").references(() => disclaimerVersions.id).notNull(),
  
  // Expiration
  expirationDate: timestamp("expiration_date").notNull(),
  
  // Letter status
  status: varchar("status", { length: 20 }).notNull().default("issued"),
  
  // Generation info
  generatedBySystem: boolean("generated_by_system").default(true),
  generatedAt: timestamp("generated_at").defaultNow(),
  
  // Company info (frozen at generation)
  companyLegalName: varchar("company_legal_name", { length: 255 }).notNull(),
  companyNmlsId: varchar("company_nmls_id", { length: 50 }).notNull(),
  companyContactInfo: text("company_contact_info"),
  
  // LO info (optional)
  loanOfficerId: varchar("loan_officer_id").references(() => users.id),
  loanOfficerNmlsId: varchar("loan_officer_nmls_id", { length: 50 }),
  
  // PDF storage
  pdfStorageKey: varchar("pdf_storage_key", { length: 500 }), // Object storage key
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  watermarkApplied: boolean("watermark_applied").default(true), // "Pre-Approval — Subject to Lender Review"
  
  // Lock against edits (once issued, cannot be modified)
  isLocked: boolean("is_locked").default(true),
  
  // Revocation info (if revoked)
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by").references(() => users.id),
  revocationReason: text("revocation_reason"),
  
  // Superseded info (if replaced by newer letter)
  supersededAt: timestamp("superseded_at"),
  supersededBy: varchar("superseded_by"), // references another preApprovalLetters.id
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pre_approval_letters_application").on(table.applicationId),
  index("idx_pre_approval_letters_borrower").on(table.borrowerName),
  index("idx_pre_approval_letters_status").on(table.status),
  index("idx_pre_approval_letters_expiration").on(table.expirationDate),
  index("idx_pre_approval_letters_snapshot").on(table.underwritingSnapshotId),
]);

export const preApprovalLettersRelations = relations(preApprovalLetters, ({ one, many }) => ({
  application: one(loanApplications, {
    fields: [preApprovalLetters.applicationId],
    references: [loanApplications.id],
  }),
  underwritingSnapshot: one(underwritingDecisions, {
    fields: [preApprovalLetters.underwritingSnapshotId],
    references: [underwritingDecisions.id],
  }),
  loanOfficer: one(users, {
    fields: [preApprovalLetters.loanOfficerId],
    references: [users.id],
  }),
  conditions: many(preApprovalConditions),
}));

export const insertPreApprovalLetterSchema = createInsertSchema(preApprovalLetters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Pre-Approval Conditions - auto-generated from rules engine
// These are the conditions attached to each pre-approval letter
// Uses CONDITION_CATEGORIES from underwriting conditions (line ~2942) plus additional pre-approval specific categories
export const PRE_APPROVAL_CONDITION_CATEGORIES = [
  ...CONDITION_CATEGORIES,
  "lender_underwriting",  // Final lender underwriting approval
  "appraisal",            // Satisfactory appraisal
  "verification",         // Verification of unchanged financial condition
  "documentation",        // Additional documentation if requested
] as const;
export type PreApprovalConditionCategory = typeof PRE_APPROVAL_CONDITION_CATEGORIES[number];

export const preApprovalConditions = pgTable("pre_approval_conditions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  letterId: varchar("letter_id").references(() => preApprovalLetters.id).notNull(),
  
  // Condition details
  category: varchar("category", { length: 50 }).notNull(),
  conditionText: text("condition_text").notNull(),
  
  // Source of condition
  autoGenerated: boolean("auto_generated").default(true), // From rules engine
  sourceRuleId: varchar("source_rule_id").references(() => underwritingRulesDsl.id), // Which rule generated this
  
  // Standard conditions (always included)
  isStandardCondition: boolean("is_standard_condition").default(false),
  
  // Ordering
  displayOrder: integer("display_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_pre_approval_conditions_letter").on(table.letterId),
  index("idx_pre_approval_conditions_category").on(table.category),
]);

export const preApprovalConditionsRelations = relations(preApprovalConditions, ({ one }) => ({
  letter: one(preApprovalLetters, {
    fields: [preApprovalConditions.letterId],
    references: [preApprovalLetters.id],
  }),
  sourceRule: one(underwritingRulesDsl, {
    fields: [preApprovalConditions.sourceRuleId],
    references: [underwritingRulesDsl.id],
  }),
}));

export const insertPreApprovalConditionSchema = createInsertSchema(preApprovalConditions).omit({
  id: true,
  createdAt: true,
});

// Letter Generation Log - audit trail of letter creation events
// Tracks every letter generation attempt for compliance
export const LETTER_GENERATION_EVENTS = [
  "generation_started",    // Letter generation initiated
  "validation_passed",     // All trigger conditions met
  "validation_failed",     // Trigger conditions not met
  "pdf_generated",         // PDF successfully created
  "pdf_failed",            // PDF generation failed
  "letter_issued",         // Letter officially issued
  "letter_revoked",        // Letter revoked
  "letter_superseded",     // Letter replaced by new version
  "letter_expired",        // Letter expired automatically
  "reanalysis_triggered",  // Re-analysis triggered (new snapshot needed)
] as const;
export type LetterGenerationEvent = typeof LETTER_GENERATION_EVENTS[number];

export const letterGenerationLogs = pgTable("letter_generation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  letterId: varchar("letter_id").references(() => preApprovalLetters.id), // null if generation failed
  
  // Event details
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventDetails: jsonb("event_details"), // Additional event context
  
  // Trigger conditions evaluation
  triggerConditions: jsonb("trigger_conditions"), // What conditions were checked
  conditionsMet: boolean("conditions_met"),
  failedConditions: jsonb("failed_conditions"), // Which conditions failed
  
  // For reanalysis events
  reanalysisReason: varchar("reanalysis_reason", { length: 100 }), // new_document, credit_expired, employment_change, liability_change, lo_request
  previousSnapshotId: varchar("previous_snapshot_id").references(() => underwritingDecisions.id),
  newSnapshotId: varchar("new_snapshot_id").references(() => underwritingDecisions.id),
  
  // Actor
  triggeredBy: varchar("triggered_by").references(() => users.id),
  triggeredBySystem: boolean("triggered_by_system").default(false),
  
  // Timing
  eventAt: timestamp("event_at").defaultNow(),
  processingTimeMs: integer("processing_time_ms"),
  
  // Error tracking
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
}, (table) => [
  index("idx_letter_generation_logs_application").on(table.applicationId),
  index("idx_letter_generation_logs_letter").on(table.letterId),
  index("idx_letter_generation_logs_event").on(table.eventType),
  index("idx_letter_generation_logs_time").on(table.eventAt),
]);

export const letterGenerationLogsRelations = relations(letterGenerationLogs, ({ one }) => ({
  application: one(loanApplications, {
    fields: [letterGenerationLogs.applicationId],
    references: [loanApplications.id],
  }),
  letter: one(preApprovalLetters, {
    fields: [letterGenerationLogs.letterId],
    references: [preApprovalLetters.id],
  }),
  triggeredByUser: one(users, {
    fields: [letterGenerationLogs.triggeredBy],
    references: [users.id],
  }),
}));

export const insertLetterGenerationLogSchema = createInsertSchema(letterGenerationLogs).omit({
  id: true,
});

// Standard Pre-Approval Conditions (seeded data)
// These are the conditions that ALWAYS appear on every pre-approval letter
export const STANDARD_PRE_APPROVAL_CONDITIONS = [
  { category: "lender_underwriting", text: "Final lender underwriting approval", order: 1 },
  { category: "appraisal", text: "Satisfactory appraisal of the subject property", order: 2 },
  { category: "verification", text: "Verification of unchanged financial condition prior to closing", order: 3 },
  { category: "documentation", text: "Receipt of any additional documentation as requested by the lender", order: 4 },
  { category: "title", text: "Clear and marketable title to the subject property", order: 5 },
  { category: "insurance", text: "Proof of adequate homeowner's insurance", order: 6 },
] as const;

// Type exports
export type InsertDisclaimerVersion = z.infer<typeof insertDisclaimerVersionSchema>;
export type DisclaimerVersion = typeof disclaimerVersions.$inferSelect;
export type InsertPreApprovalLetter = z.infer<typeof insertPreApprovalLetterSchema>;
export type PreApprovalLetter = typeof preApprovalLetters.$inferSelect;
export type InsertPreApprovalCondition = z.infer<typeof insertPreApprovalConditionSchema>;
export type PreApprovalCondition = typeof preApprovalConditions.$inferSelect;
export type InsertLetterGenerationLog = z.infer<typeof insertLetterGenerationLogSchema>;
export type LetterGenerationLog = typeof letterGenerationLogs.$inferSelect;
