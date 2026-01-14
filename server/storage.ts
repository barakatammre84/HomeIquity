import { db } from "./db";
import { eq, desc, and, gte, lte, sql, or, ilike } from "drizzle-orm";
import {
  users,
  loanApplications,
  loanOptions,
  documents,
  dealActivities,
  properties,
  savedProperties,
  urlaPersonalInfo,
  employmentHistory,
  otherIncomeSources,
  urlaAssets,
  urlaLiabilities,
  urlaPropertyInfo,
  borrowerDeclarations,
  tasks,
  taskDocuments,
  agentProfiles,
  loanMilestones,
  loanConditions,
  documentRequirementRules,
  underwritingSnapshots,
  applicationProperties,
  verifications,
  plaidLinkTokens,
  type User,
  type UpsertUser,
  type LoanApplication,
  type InsertLoanApplication,
  type LoanOption,
  type InsertLoanOption,
  type Document,
  type InsertDocument,
  type DealActivity,
  type InsertDealActivity,
  type Property,
  type InsertProperty,
  type UrlaPersonalInfo,
  type InsertUrlaPersonalInfo,
  type EmploymentHistory,
  type InsertEmploymentHistory,
  type OtherIncomeSource,
  type InsertOtherIncomeSource,
  type UrlaAsset,
  type InsertUrlaAsset,
  type UrlaLiability,
  type InsertUrlaLiability,
  type UrlaPropertyInfo,
  type InsertUrlaPropertyInfo,
  type BorrowerDeclarations,
  type InsertBorrowerDeclarations,
  type Task,
  type InsertTask,
  type TaskDocument,
  type InsertTaskDocument,
  type AgentProfile,
  type InsertAgentProfile,
  type LoanMilestone,
  type InsertLoanMilestone,
  type LoanCondition,
  type InsertLoanCondition,
  type DocumentRequirementRule,
  type InsertDocumentRequirementRule,
  type UnderwritingSnapshot,
  type InsertUnderwritingSnapshot,
  type ApplicationProperty,
  type InsertApplicationProperty,
  type Verification,
  type InsertVerification,
  type PlaidLinkToken,
  type InsertPlaidLinkToken,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;

  // Loan Applications
  createLoanApplication(data: InsertLoanApplication): Promise<LoanApplication>;
  getLoanApplication(id: string): Promise<LoanApplication | undefined>;
  getLoanApplicationWithAccess(id: string, userId: string, userRole: string): Promise<LoanApplication | undefined>;
  getLoanApplicationsByUser(userId: string): Promise<LoanApplication[]>;
  getAllLoanApplications(): Promise<LoanApplication[]>;
  updateLoanApplication(id: string, data: Partial<LoanApplication>): Promise<LoanApplication | undefined>;

  // Loan Options
  createLoanOption(data: InsertLoanOption): Promise<LoanOption>;
  getLoanOptionsByApplication(applicationId: string): Promise<LoanOption[]>;
  updateLoanOption(id: string, data: Partial<LoanOption>): Promise<LoanOption | undefined>;
  lockLoanOption(id: string): Promise<LoanOption | undefined>;

  // Documents
  createDocument(data: InsertDocument): Promise<Document>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  getDocumentsByApplication(applicationId: string): Promise<Document[]>;
  updateDocument(id: string, data: Partial<Document>): Promise<Document | undefined>;

  // Deal Activities
  createDealActivity(data: InsertDealActivity): Promise<DealActivity>;
  getDealActivitiesByApplication(applicationId: string): Promise<DealActivity[]>;

  // Properties
  createProperty(data: InsertProperty): Promise<Property>;
  getProperty(id: string): Promise<Property | undefined>;
  getAllProperties(filters?: {
    search?: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<Property[]>;
  updateProperty(id: string, data: Partial<Property>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<void>;
  getPropertiesByAgent(agentId: string): Promise<Property[]>;
  saveProperty(userId: string, propertyId: string): Promise<void>;
  getSavedProperties(userId: string): Promise<Property[]>;

  // Agent Profiles
  createAgentProfile(data: InsertAgentProfile): Promise<AgentProfile>;
  getAgentProfile(id: string): Promise<AgentProfile | undefined>;
  getAgentProfileByUserId(userId: string): Promise<AgentProfile | undefined>;
  updateAgentProfile(id: string, data: Partial<AgentProfile>): Promise<AgentProfile | undefined>;
  getAllAgentProfiles(): Promise<AgentProfile[]>;

  // Stats
  getAdminStats(): Promise<{
    totalUsers: number;
    totalApplications: number;
    totalLoanVolume: string;
    approvalRate: number;
    applicationsByStatus: { status: string; count: number }[];
    loansByType: { type: string; count: number; volume: string }[];
    recentApplications: (LoanApplication & { user: User })[];
  }>;
  getDashboardStats(userId: string): Promise<{
    totalApplications: number;
    preApprovedAmount: string;
    pendingDocuments: number;
  }>;

  // URLA Data
  getUrlaPersonalInfo(applicationId: string): Promise<UrlaPersonalInfo | undefined>;
  upsertUrlaPersonalInfo(data: InsertUrlaPersonalInfo): Promise<UrlaPersonalInfo>;
  
  getEmploymentHistory(applicationId: string): Promise<EmploymentHistory[]>;
  createEmploymentHistory(data: InsertEmploymentHistory): Promise<EmploymentHistory>;
  updateEmploymentHistory(id: string, data: Partial<EmploymentHistory>): Promise<EmploymentHistory | undefined>;
  deleteEmploymentHistory(id: string): Promise<void>;
  
  getOtherIncomeSources(applicationId: string): Promise<OtherIncomeSource[]>;
  createOtherIncomeSource(data: InsertOtherIncomeSource): Promise<OtherIncomeSource>;
  deleteOtherIncomeSource(id: string): Promise<void>;
  
  getUrlaAssets(applicationId: string): Promise<UrlaAsset[]>;
  createUrlaAsset(data: InsertUrlaAsset): Promise<UrlaAsset>;
  updateUrlaAsset(id: string, data: Partial<UrlaAsset>): Promise<UrlaAsset | undefined>;
  deleteUrlaAsset(id: string): Promise<void>;
  
  getUrlaLiabilities(applicationId: string): Promise<UrlaLiability[]>;
  createUrlaLiability(data: InsertUrlaLiability): Promise<UrlaLiability>;
  updateUrlaLiability(id: string, data: Partial<UrlaLiability>): Promise<UrlaLiability | undefined>;
  deleteUrlaLiability(id: string): Promise<void>;
  
  getUrlaPropertyInfo(applicationId: string): Promise<UrlaPropertyInfo | undefined>;
  upsertUrlaPropertyInfo(data: InsertUrlaPropertyInfo): Promise<UrlaPropertyInfo>;
  
  // Borrower Declarations
  getBorrowerDeclarations(applicationId: string): Promise<BorrowerDeclarations | undefined>;
  upsertBorrowerDeclarations(data: InsertBorrowerDeclarations): Promise<BorrowerDeclarations>;
  
  getCompleteUrlaData(applicationId: string): Promise<{
    personalInfo: UrlaPersonalInfo | undefined;
    employmentHistory: EmploymentHistory[];
    otherIncomeSources: OtherIncomeSource[];
    assets: UrlaAsset[];
    liabilities: UrlaLiability[];
    propertyInfo: UrlaPropertyInfo | undefined;
    declarations: BorrowerDeclarations | undefined;
  }>;

  // MISMO Export Data
  getMISMOLoanData(applicationId: string): Promise<{
    application: LoanApplication;
    user: User | null;
    personalInfo: UrlaPersonalInfo | null;
    employment: EmploymentHistory[];
    assets: UrlaAsset[];
    liabilities: UrlaLiability[];
    propertyInfo: UrlaPropertyInfo | null;
    declarations: BorrowerDeclarations | null;
    loanOptions: LoanOption[];
    documents: Document[];
  } | null>;
  
  // Data Quality Scoring
  getApplicationDataQuality(applicationId: string): Promise<{
    overallScore: number;
    sections: {
      name: string;
      score: number;
      missingFields: string[];
      verificationStatus: string;
    }[];
  }>;

  // Tasks
  createTask(data: InsertTask): Promise<Task>;
  getTask(id: string): Promise<Task | undefined>;
  getTasksByApplication(applicationId: string): Promise<Task[]>;
  getTasksByUser(userId: string): Promise<Task[]>;
  getAllTasks(): Promise<Task[]>;
  updateTask(id: string, data: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  
  // Task Documents
  createTaskDocument(data: InsertTaskDocument): Promise<TaskDocument>;
  getTaskDocuments(taskId: string): Promise<(TaskDocument & { document: Document })[]>;
  updateTaskDocument(id: string, data: Partial<TaskDocument>): Promise<TaskDocument | undefined>;
  deleteTaskDocument(id: string): Promise<void>;
  
  // Application Properties - multi-property support
  createApplicationProperty(data: InsertApplicationProperty): Promise<ApplicationProperty>;
  getApplicationProperties(applicationId: string): Promise<ApplicationProperty[]>;
  getCurrentProperty(applicationId: string): Promise<ApplicationProperty | undefined>;
  updateApplicationProperty(id: string, data: Partial<ApplicationProperty>): Promise<ApplicationProperty | undefined>;
  switchToProperty(applicationId: string, propertyId: string): Promise<ApplicationProperty | undefined>;
  markDealFellThrough(propertyId: string, reason: string): Promise<ApplicationProperty | undefined>;

  // Plaid Verifications
  createPlaidLinkToken(data: InsertPlaidLinkToken): Promise<PlaidLinkToken>;
  getPlaidLinkToken(id: string): Promise<PlaidLinkToken | undefined>;
  updatePlaidLinkToken(id: string, data: Partial<PlaidLinkToken>): Promise<PlaidLinkToken | undefined>;
  
  createVerification(data: InsertVerification): Promise<Verification>;
  getVerification(id: string): Promise<Verification | undefined>;
  getVerificationsByApplication(applicationId: string): Promise<Verification[]>;
  getVerificationsByUser(userId: string): Promise<Verification[]>;
  updateVerification(id: string, data: Partial<Verification>): Promise<Verification | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Loan Applications
  async createLoanApplication(data: InsertLoanApplication): Promise<LoanApplication> {
    const [application] = await db.insert(loanApplications).values(data).returning();
    return application;
  }

  async getLoanApplication(id: string): Promise<LoanApplication | undefined> {
    const [application] = await db
      .select()
      .from(loanApplications)
      .where(eq(loanApplications.id, id))
      .limit(1);
    return application;
  }

  async getLoanApplicationWithAccess(id: string, userId: string, userRole: string): Promise<LoanApplication | undefined> {
    // Staff roles get unrestricted access
    const isStaff = ["admin", "lender", "broker"].includes(userRole);
    
    if (isStaff) {
      // Staff can access any application
      const [application] = await db
        .select()
        .from(loanApplications)
        .where(eq(loanApplications.id, id))
        .limit(1);
      return application;
    }
    
    // Non-staff can only access their own applications - query scoped by userId
    const [application] = await db
      .select()
      .from(loanApplications)
      .where(and(
        eq(loanApplications.id, id),
        eq(loanApplications.userId, userId)
      ))
      .limit(1);
    return application;
  }

  async getLoanApplicationsByUser(userId: string): Promise<LoanApplication[]> {
    return await db
      .select()
      .from(loanApplications)
      .where(eq(loanApplications.userId, userId))
      .orderBy(desc(loanApplications.createdAt));
  }

  async getAllLoanApplications(): Promise<LoanApplication[]> {
    return await db
      .select()
      .from(loanApplications)
      .orderBy(desc(loanApplications.createdAt));
  }

  async updateLoanApplication(
    id: string,
    data: Partial<LoanApplication>
  ): Promise<LoanApplication | undefined> {
    const [application] = await db
      .update(loanApplications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(loanApplications.id, id))
      .returning();
    return application;
  }

  // Loan Options
  async createLoanOption(data: InsertLoanOption): Promise<LoanOption> {
    const [option] = await db.insert(loanOptions).values(data).returning();
    return option;
  }

  async getLoanOptionsByApplication(applicationId: string): Promise<LoanOption[]> {
    return await db
      .select()
      .from(loanOptions)
      .where(eq(loanOptions.applicationId, applicationId))
      .orderBy(loanOptions.isRecommended);
  }

  async updateLoanOption(id: string, data: Partial<LoanOption>): Promise<LoanOption | undefined> {
    const [option] = await db
      .update(loanOptions)
      .set(data)
      .where(eq(loanOptions.id, id))
      .returning();
    return option;
  }

  async lockLoanOption(id: string): Promise<LoanOption | undefined> {
    const lockExpiry = new Date();
    lockExpiry.setDate(lockExpiry.getDate() + 30);

    const [option] = await db
      .update(loanOptions)
      .set({
        isLocked: true,
        lockedAt: new Date(),
        lockExpiresAt: lockExpiry,
      })
      .where(eq(loanOptions.id, id))
      .returning();
    return option;
  }

  // Documents
  async createDocument(data: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(data).returning();
    return doc;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return doc;
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentsByApplication(applicationId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.applicationId, applicationId))
      .orderBy(desc(documents.createdAt));
  }

  async updateDocument(id: string, data: Partial<Document>): Promise<Document | undefined> {
    const [doc] = await db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  }

  // Deal Activities
  async createDealActivity(data: InsertDealActivity): Promise<DealActivity> {
    const [activity] = await db.insert(dealActivities).values(data).returning();
    return activity;
  }

  async getDealActivitiesByApplication(applicationId: string): Promise<DealActivity[]> {
    return await db
      .select()
      .from(dealActivities)
      .where(eq(dealActivities.applicationId, applicationId))
      .orderBy(desc(dealActivities.createdAt));
  }

  // Properties
  async createProperty(data: InsertProperty): Promise<Property> {
    const [property] = await db.insert(properties).values(data).returning();
    return property;
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);
    return property;
  }

  async getAllProperties(filters?: {
    search?: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<Property[]> {
    let query = db.select().from(properties);
    const conditions = [];

    if (filters?.type && filters.type !== "all") {
      conditions.push(eq(properties.propertyType, filters.type));
    }

    if (filters?.minPrice !== undefined) {
      conditions.push(gte(properties.price, filters.minPrice.toString()));
    }

    if (filters?.maxPrice !== undefined) {
      conditions.push(lte(properties.price, filters.maxPrice.toString()));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(properties.address, `%${filters.search}%`),
          ilike(properties.city, `%${filters.search}%`),
          ilike(properties.state, `%${filters.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(properties.createdAt));
  }

  async saveProperty(userId: string, propertyId: string): Promise<void> {
    await db.insert(savedProperties).values({ userId, propertyId });
  }

  async getSavedProperties(userId: string): Promise<Property[]> {
    const saved = await db
      .select({ property: properties })
      .from(savedProperties)
      .innerJoin(properties, eq(savedProperties.propertyId, properties.id))
      .where(eq(savedProperties.userId, userId));
    return saved.map((s) => s.property);
  }

  // Stats
  async getAdminStats() {
    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const [appCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loanApplications);

    const [volumeResult] = await db
      .select({ total: sql<string>`coalesce(sum(purchase_price::numeric), 0)::text` })
      .from(loanApplications)
      .where(eq(loanApplications.status, "approved"));

    const [approvedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loanApplications)
      .where(eq(loanApplications.status, "approved"));

    const statusCounts = await db
      .select({
        status: loanApplications.status,
        count: sql<number>`count(*)::int`,
      })
      .from(loanApplications)
      .groupBy(loanApplications.status);

    const recentApps = await db
      .select()
      .from(loanApplications)
      .orderBy(desc(loanApplications.createdAt))
      .limit(10);

    const appsWithUsers = await Promise.all(
      recentApps.map(async (app) => {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, app.userId))
          .limit(1);
        return { ...app, user };
      })
    );

    const approvalRate =
      appCount.count > 0
        ? Math.round((approvedCount.count / appCount.count) * 100)
        : 0;

    // Get loan breakdown by type from loanOptions table
    const loanTypeStats = await db
      .select({
        type: loanOptions.loanType,
        count: sql<number>`count(DISTINCT ${loanOptions.applicationId})::int`,
        volume: sql<string>`coalesce(sum(${loanOptions.loanAmount}::numeric), 0)::text`,
      })
      .from(loanOptions)
      .innerJoin(loanApplications, eq(loanOptions.applicationId, loanApplications.id))
      .where(eq(loanOptions.isRecommended, true))
      .groupBy(loanOptions.loanType);

    // Ensure all loan types are represented with defaults
    const loansByTypeMap = new Map(loanTypeStats.map(lt => [lt.type, lt]));
    const loansByType = ["conventional", "fha", "va"].map(type => ({
      type,
      count: loansByTypeMap.get(type)?.count ?? 0,
      volume: loansByTypeMap.get(type)?.volume ?? "0",
    }));

    return {
      totalUsers: userCount.count,
      totalApplications: appCount.count,
      totalLoanVolume: volumeResult.total,
      approvalRate,
      applicationsByStatus: statusCounts,
      loansByType,
      recentApplications: appsWithUsers,
    };
  }

  async getDashboardStats(userId: string) {
    const [appCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loanApplications)
      .where(eq(loanApplications.userId, userId));

    const [preApproved] = await db
      .select({ total: sql<string>`coalesce(max(pre_approval_amount::numeric), 0)::text` })
      .from(loanApplications)
      .where(
        and(
          eq(loanApplications.userId, userId),
          eq(loanApplications.status, "pre_approved")
        )
      );

    const [pendingDocs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(
        and(eq(documents.userId, userId), eq(documents.status, "uploaded"))
      );

    return {
      totalApplications: appCount.count,
      preApprovedAmount: preApproved.total,
      pendingDocuments: pendingDocs.count,
    };
  }

  // URLA Personal Info
  async getUrlaPersonalInfo(applicationId: string): Promise<UrlaPersonalInfo | undefined> {
    const [info] = await db
      .select()
      .from(urlaPersonalInfo)
      .where(eq(urlaPersonalInfo.applicationId, applicationId))
      .limit(1);
    return info;
  }

  async upsertUrlaPersonalInfo(data: InsertUrlaPersonalInfo): Promise<UrlaPersonalInfo> {
    const existing = await this.getUrlaPersonalInfo(data.applicationId);
    // Remove any timestamp fields that might have been serialized as strings from frontend
    const { createdAt, updatedAt, id, ...cleanData } = data as any;
    
    if (existing) {
      const [updated] = await db
        .update(urlaPersonalInfo)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(eq(urlaPersonalInfo.applicationId, data.applicationId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(urlaPersonalInfo).values(cleanData).returning();
    return created;
  }

  // Employment History
  async getEmploymentHistory(applicationId: string): Promise<EmploymentHistory[]> {
    return await db
      .select()
      .from(employmentHistory)
      .where(eq(employmentHistory.applicationId, applicationId))
      .orderBy(desc(employmentHistory.createdAt));
  }

  async createEmploymentHistory(data: InsertEmploymentHistory): Promise<EmploymentHistory> {
    const [record] = await db.insert(employmentHistory).values(data).returning();
    return record;
  }

  async updateEmploymentHistory(id: string, data: Partial<EmploymentHistory>): Promise<EmploymentHistory | undefined> {
    // Remove any timestamp/id fields that might have been serialized from frontend
    const { createdAt, updatedAt, id: recordId, ...cleanData } = data as any;
    const [updated] = await db
      .update(employmentHistory)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(employmentHistory.id, id))
      .returning();
    return updated;
  }

  async deleteEmploymentHistory(id: string): Promise<void> {
    await db.delete(employmentHistory).where(eq(employmentHistory.id, id));
  }

  // Other Income Sources
  async getOtherIncomeSources(applicationId: string): Promise<OtherIncomeSource[]> {
    return await db
      .select()
      .from(otherIncomeSources)
      .where(eq(otherIncomeSources.applicationId, applicationId))
      .orderBy(desc(otherIncomeSources.createdAt));
  }

  async createOtherIncomeSource(data: InsertOtherIncomeSource): Promise<OtherIncomeSource> {
    const [record] = await db.insert(otherIncomeSources).values(data).returning();
    return record;
  }

  async deleteOtherIncomeSource(id: string): Promise<void> {
    await db.delete(otherIncomeSources).where(eq(otherIncomeSources.id, id));
  }

  // URLA Assets
  async getUrlaAssets(applicationId: string): Promise<UrlaAsset[]> {
    return await db
      .select()
      .from(urlaAssets)
      .where(eq(urlaAssets.applicationId, applicationId))
      .orderBy(desc(urlaAssets.createdAt));
  }

  async createUrlaAsset(data: InsertUrlaAsset): Promise<UrlaAsset> {
    const [record] = await db.insert(urlaAssets).values(data).returning();
    return record;
  }

  async updateUrlaAsset(id: string, data: Partial<UrlaAsset>): Promise<UrlaAsset | undefined> {
    // Remove any timestamp/id fields that might have been serialized from frontend
    const { createdAt, updatedAt, id: recordId, ...cleanData } = data as any;
    const [updated] = await db
      .update(urlaAssets)
      .set(cleanData)
      .where(eq(urlaAssets.id, id))
      .returning();
    return updated;
  }

  async deleteUrlaAsset(id: string): Promise<void> {
    await db.delete(urlaAssets).where(eq(urlaAssets.id, id));
  }

  // URLA Liabilities
  async getUrlaLiabilities(applicationId: string): Promise<UrlaLiability[]> {
    return await db
      .select()
      .from(urlaLiabilities)
      .where(eq(urlaLiabilities.applicationId, applicationId))
      .orderBy(desc(urlaLiabilities.createdAt));
  }

  async createUrlaLiability(data: InsertUrlaLiability): Promise<UrlaLiability> {
    const [record] = await db.insert(urlaLiabilities).values(data).returning();
    return record;
  }

  async updateUrlaLiability(id: string, data: Partial<UrlaLiability>): Promise<UrlaLiability | undefined> {
    // Remove any timestamp/id fields that might have been serialized from frontend
    const { createdAt, updatedAt, id: recordId, ...cleanData } = data as any;
    const [updated] = await db
      .update(urlaLiabilities)
      .set(cleanData)
      .where(eq(urlaLiabilities.id, id))
      .returning();
    return updated;
  }

  async deleteUrlaLiability(id: string): Promise<void> {
    await db.delete(urlaLiabilities).where(eq(urlaLiabilities.id, id));
  }

  // URLA Property Info
  async getUrlaPropertyInfo(applicationId: string): Promise<UrlaPropertyInfo | undefined> {
    const [info] = await db
      .select()
      .from(urlaPropertyInfo)
      .where(eq(urlaPropertyInfo.applicationId, applicationId))
      .limit(1);
    return info;
  }

  async upsertUrlaPropertyInfo(data: InsertUrlaPropertyInfo): Promise<UrlaPropertyInfo> {
    const existing = await this.getUrlaPropertyInfo(data.applicationId);
    // Remove any timestamp fields that might have been serialized as strings from frontend
    const { createdAt, updatedAt, id, ...cleanData } = data as any;
    
    if (existing) {
      const [updated] = await db
        .update(urlaPropertyInfo)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(eq(urlaPropertyInfo.applicationId, data.applicationId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(urlaPropertyInfo).values(cleanData).returning();
    return created;
  }

  // Borrower Declarations
  async getBorrowerDeclarations(applicationId: string): Promise<BorrowerDeclarations | undefined> {
    const [declarations] = await db
      .select()
      .from(borrowerDeclarations)
      .where(eq(borrowerDeclarations.applicationId, applicationId))
      .limit(1);
    return declarations;
  }

  async upsertBorrowerDeclarations(data: InsertBorrowerDeclarations): Promise<BorrowerDeclarations> {
    const existing = await this.getBorrowerDeclarations(data.applicationId);
    const { createdAt, updatedAt, id, ...cleanData } = data as any;
    
    if (existing) {
      const [updated] = await db
        .update(borrowerDeclarations)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(eq(borrowerDeclarations.applicationId, data.applicationId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(borrowerDeclarations).values(cleanData).returning();
    return created;
  }

  // Get Complete URLA Data
  async getCompleteUrlaData(applicationId: string) {
    const [personalInfo, employment, income, assets, liabilities, propertyInfo, declarations] = await Promise.all([
      this.getUrlaPersonalInfo(applicationId),
      this.getEmploymentHistory(applicationId),
      this.getOtherIncomeSources(applicationId),
      this.getUrlaAssets(applicationId),
      this.getUrlaLiabilities(applicationId),
      this.getUrlaPropertyInfo(applicationId),
      this.getBorrowerDeclarations(applicationId),
    ]);

    return {
      personalInfo,
      employmentHistory: employment,
      otherIncomeSources: income,
      assets,
      liabilities,
      propertyInfo,
      declarations,
    };
  }

  // MISMO Export Data - aggregates all data needed for MISMO 3.4 XML generation
  async getMISMOLoanData(applicationId: string) {
    const application = await this.getLoanApplication(applicationId);
    if (!application) {
      return null;
    }

    const [user, urlaData, loanOpts, docs] = await Promise.all([
      application.userId ? this.getUser(application.userId) : Promise.resolve(undefined),
      this.getCompleteUrlaData(applicationId),
      this.getLoanOptionsByApplication(applicationId),
      this.getDocumentsByApplication(applicationId),
    ]);

    return {
      application,
      user: user || null,
      personalInfo: urlaData.personalInfo || null,
      employment: urlaData.employmentHistory,
      assets: urlaData.assets,
      liabilities: urlaData.liabilities,
      propertyInfo: urlaData.propertyInfo || null,
      declarations: urlaData.declarations || null,
      loanOptions: loanOpts,
      documents: docs,
    };
  }

  // Data Quality Scoring for Broker Dashboard
  async getApplicationDataQuality(applicationId: string) {
    const [application, urlaData, docs, taskList] = await Promise.all([
      this.getLoanApplication(applicationId),
      this.getCompleteUrlaData(applicationId),
      this.getDocumentsByApplication(applicationId),
      this.getTasksByApplication(applicationId),
    ]);

    const sections = [];

    // Personal Information Section
    const personalFields = [
      "firstName", "lastName", "ssn", "dateOfBirth", "email", "cellPhone",
      "currentStreet", "currentCity", "currentState", "currentZip"
    ];
    const personalMissing = personalFields.filter(f => !urlaData.personalInfo?.[f as keyof typeof urlaData.personalInfo]);
    const personalScore = Math.round(((personalFields.length - personalMissing.length) / personalFields.length) * 100);
    sections.push({
      name: "Personal Information",
      score: personalScore,
      missingFields: personalMissing,
      verificationStatus: urlaData.personalInfo?.ssn ? "verified" : "pending",
    });

    // Employment Section
    const hasCurrentEmployment = urlaData.employmentHistory.some(e => e.employmentType === "current");
    const employmentScore = hasCurrentEmployment ? 100 : 0;
    sections.push({
      name: "Employment History",
      score: employmentScore,
      missingFields: hasCurrentEmployment ? [] : ["Current Employment"],
      verificationStatus: hasCurrentEmployment ? "pending_verification" : "incomplete",
    });

    // Assets Section
    const assetsScore = urlaData.assets.length > 0 ? 100 : 0;
    sections.push({
      name: "Assets",
      score: assetsScore,
      missingFields: urlaData.assets.length > 0 ? [] : ["At least one asset account"],
      verificationStatus: urlaData.assets.length > 0 ? "pending_verification" : "incomplete",
    });

    // Liabilities Section
    const liabilitiesScore = urlaData.liabilities.length >= 0 ? 100 : 0;
    sections.push({
      name: "Liabilities",
      score: liabilitiesScore,
      missingFields: [],
      verificationStatus: "complete",
    });

    // Declarations Section
    const declarationFields = [
      "willOccupyAsPrimaryResidence", "hasRelationshipWithSeller", 
      "hasOutstandingJudgments", "hasDeclaredBankruptcy", "isUSCitizen"
    ];
    const declarationsMissing = declarationFields.filter(
      f => urlaData.declarations?.[f as keyof typeof urlaData.declarations] === null || 
           urlaData.declarations?.[f as keyof typeof urlaData.declarations] === undefined
    );
    const declarationsScore = urlaData.declarations 
      ? Math.round(((declarationFields.length - declarationsMissing.length) / declarationFields.length) * 100)
      : 0;
    sections.push({
      name: "Borrower Declarations",
      score: declarationsScore,
      missingFields: declarationsMissing,
      verificationStatus: urlaData.declarations?.declarationsVerifiedAt ? "verified" : "pending",
    });

    // Documents Section
    const requiredDocTypes = ["w2", "pay_stub", "bank_statement", "id"];
    const uploadedTypes = Array.from(new Set(docs.map(d => d.documentType)));
    const docsMissing = requiredDocTypes.filter(t => !uploadedTypes.includes(t));
    const docsVerified = docs.filter(d => d.status === "verified").length;
    const docsScore = Math.round(((requiredDocTypes.length - docsMissing.length) / requiredDocTypes.length) * 100);
    sections.push({
      name: "Documents",
      score: docsScore,
      missingFields: docsMissing,
      verificationStatus: docsVerified === docs.length && docs.length > 0 ? "verified" : "pending_verification",
    });

    // Calculate overall score
    const overallScore = Math.round(sections.reduce((sum, s) => sum + s.score, 0) / sections.length);

    return { overallScore, sections };
  }

  // Tasks
  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return task;
  }

  async getTasksByApplication(applicationId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.applicationId, applicationId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTasksByUser(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.assignedToUserId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task | undefined> {
    const { createdAt, updatedAt, id: taskId, ...cleanData } = data as any;
    const [updated] = await db
      .update(tasks)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(taskDocuments).where(eq(taskDocuments.taskId, id));
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Task Documents
  async createTaskDocument(data: InsertTaskDocument): Promise<TaskDocument> {
    const [record] = await db.insert(taskDocuments).values(data).returning();
    return record;
  }

  async getTaskDocuments(taskId: string): Promise<(TaskDocument & { document: Document })[]> {
    const results = await db
      .select({
        taskDocument: taskDocuments,
        document: documents,
      })
      .from(taskDocuments)
      .innerJoin(documents, eq(taskDocuments.documentId, documents.id))
      .where(eq(taskDocuments.taskId, taskId))
      .orderBy(desc(taskDocuments.createdAt));
    
    return results.map(r => ({
      ...r.taskDocument,
      document: r.document,
    }));
  }

  async updateTaskDocument(id: string, data: Partial<TaskDocument>): Promise<TaskDocument | undefined> {
    const { createdAt, id: docId, ...cleanData } = data as any;
    const [updated] = await db
      .update(taskDocuments)
      .set(cleanData)
      .where(eq(taskDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteTaskDocument(id: string): Promise<void> {
    await db.delete(taskDocuments).where(eq(taskDocuments.id, id));
  }

  // Agent Profiles
  async createAgentProfile(data: InsertAgentProfile): Promise<AgentProfile> {
    const [profile] = await db.insert(agentProfiles).values(data).returning();
    return profile;
  }

  async getAgentProfile(id: string): Promise<AgentProfile | undefined> {
    const [profile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.id, id))
      .limit(1);
    return profile;
  }

  async getAgentProfileByUserId(userId: string): Promise<AgentProfile | undefined> {
    const [profile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, userId))
      .limit(1);
    return profile;
  }

  async updateAgentProfile(id: string, data: Partial<AgentProfile>): Promise<AgentProfile | undefined> {
    const { createdAt, updatedAt, id: profileId, ...cleanData } = data as any;
    const [updated] = await db
      .update(agentProfiles)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(agentProfiles.id, id))
      .returning();
    return updated;
  }

  async getAllAgentProfiles(): Promise<AgentProfile[]> {
    return await db.select().from(agentProfiles).orderBy(desc(agentProfiles.createdAt));
  }

  // Property CRUD extensions
  async updateProperty(id: string, data: Partial<Property>): Promise<Property | undefined> {
    const { createdAt, updatedAt, id: propId, ...cleanData } = data as any;
    const [updated] = await db
      .update(properties)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();
    return updated;
  }

  async deleteProperty(id: string): Promise<void> {
    await db.delete(savedProperties).where(eq(savedProperties.propertyId, id));
    await db.delete(properties).where(eq(properties.id, id));
  }

  async getPropertiesByAgent(agentId: string): Promise<Property[]> {
    return await db
      .select()
      .from(properties)
      .where(eq(properties.agentId, agentId))
      .orderBy(desc(properties.createdAt));
  }

  // ============================================================================
  // LOAN PIPELINE TRACKING
  // ============================================================================

  // Loan Milestones
  async createLoanMilestone(data: InsertLoanMilestone): Promise<LoanMilestone> {
    const [milestone] = await db.insert(loanMilestones).values(data).returning();
    return milestone;
  }

  async getLoanMilestones(applicationId: string): Promise<LoanMilestone | undefined> {
    const [milestone] = await db
      .select()
      .from(loanMilestones)
      .where(eq(loanMilestones.applicationId, applicationId))
      .limit(1);
    return milestone;
  }

  async updateLoanMilestones(applicationId: string, data: Partial<LoanMilestone>): Promise<LoanMilestone | undefined> {
    const { createdAt, updatedAt, id, ...cleanData } = data as any;
    const [updated] = await db
      .update(loanMilestones)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(loanMilestones.applicationId, applicationId))
      .returning();
    return updated;
  }

  // Loan Conditions
  async createLoanCondition(data: InsertLoanCondition): Promise<LoanCondition> {
    const [condition] = await db.insert(loanConditions).values(data).returning();
    return condition;
  }

  async getLoanCondition(id: string): Promise<LoanCondition | undefined> {
    const [condition] = await db
      .select()
      .from(loanConditions)
      .where(eq(loanConditions.id, id))
      .limit(1);
    return condition;
  }

  async getLoanConditionsByApplication(applicationId: string): Promise<LoanCondition[]> {
    return await db
      .select()
      .from(loanConditions)
      .where(eq(loanConditions.applicationId, applicationId))
      .orderBy(loanConditions.priority, desc(loanConditions.createdAt));
  }

  async updateLoanCondition(id: string, data: Partial<LoanCondition>): Promise<LoanCondition | undefined> {
    const { createdAt, updatedAt, id: condId, ...cleanData } = data as any;
    const [updated] = await db
      .update(loanConditions)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(loanConditions.id, id))
      .returning();
    return updated;
  }

  async deleteLoanCondition(id: string): Promise<void> {
    await db.delete(loanConditions).where(eq(loanConditions.id, id));
  }

  async clearLoanCondition(id: string, userId: string, notes?: string): Promise<LoanCondition | undefined> {
    const [updated] = await db
      .update(loanConditions)
      .set({
        status: "cleared",
        clearedByUserId: userId,
        clearedAt: new Date(),
        clearanceNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(loanConditions.id, id))
      .returning();
    return updated;
  }

  // Document Requirement Rules
  async createDocumentRequirementRule(data: InsertDocumentRequirementRule): Promise<DocumentRequirementRule> {
    const [rule] = await db.insert(documentRequirementRules).values(data).returning();
    return rule;
  }

  async getDocumentRequirementRule(id: string): Promise<DocumentRequirementRule | undefined> {
    const [rule] = await db
      .select()
      .from(documentRequirementRules)
      .where(eq(documentRequirementRules.id, id))
      .limit(1);
    return rule;
  }

  async getAllDocumentRequirementRules(): Promise<DocumentRequirementRule[]> {
    return await db
      .select()
      .from(documentRequirementRules)
      .where(eq(documentRequirementRules.isActive, true))
      .orderBy(documentRequirementRules.priority);
  }

  async updateDocumentRequirementRule(id: string, data: Partial<DocumentRequirementRule>): Promise<DocumentRequirementRule | undefined> {
    const { createdAt, updatedAt, id: ruleId, ...cleanData } = data as any;
    const [updated] = await db
      .update(documentRequirementRules)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(documentRequirementRules.id, id))
      .returning();
    return updated;
  }

  // Underwriting Snapshots
  async createUnderwritingSnapshot(data: InsertUnderwritingSnapshot): Promise<UnderwritingSnapshot> {
    const [snapshot] = await db.insert(underwritingSnapshots).values(data).returning();
    return snapshot;
  }

  async getUnderwritingSnapshotsByApplication(applicationId: string): Promise<UnderwritingSnapshot[]> {
    return await db
      .select()
      .from(underwritingSnapshots)
      .where(eq(underwritingSnapshots.applicationId, applicationId))
      .orderBy(desc(underwritingSnapshots.createdAt));
  }

  async getLatestUnderwritingSnapshot(applicationId: string): Promise<UnderwritingSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(underwritingSnapshots)
      .where(eq(underwritingSnapshots.applicationId, applicationId))
      .orderBy(desc(underwritingSnapshots.createdAt))
      .limit(1);
    return snapshot;
  }

  // Application Properties - multi-property support
  async createApplicationProperty(data: InsertApplicationProperty): Promise<ApplicationProperty> {
    // If this is marked as current, unset current on other properties for this application
    if (data.isCurrentProperty) {
      await db
        .update(applicationProperties)
        .set({ isCurrentProperty: false, updatedAt: new Date() })
        .where(eq(applicationProperties.applicationId, data.applicationId));
    }
    const [property] = await db.insert(applicationProperties).values(data).returning();
    return property;
  }

  async getApplicationProperties(applicationId: string): Promise<ApplicationProperty[]> {
    return await db
      .select()
      .from(applicationProperties)
      .where(eq(applicationProperties.applicationId, applicationId))
      .orderBy(desc(applicationProperties.createdAt));
  }

  async getCurrentProperty(applicationId: string): Promise<ApplicationProperty | undefined> {
    const [property] = await db
      .select()
      .from(applicationProperties)
      .where(
        and(
          eq(applicationProperties.applicationId, applicationId),
          eq(applicationProperties.isCurrentProperty, true)
        )
      )
      .limit(1);
    return property;
  }

  async updateApplicationProperty(id: string, data: Partial<ApplicationProperty>): Promise<ApplicationProperty | undefined> {
    const { id: propId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(applicationProperties)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(applicationProperties.id, id))
      .returning();
    return updated;
  }

  async switchToProperty(applicationId: string, propertyId: string): Promise<ApplicationProperty | undefined> {
    // First, unset current on all properties for this application
    await db
      .update(applicationProperties)
      .set({ isCurrentProperty: false, updatedAt: new Date() })
      .where(eq(applicationProperties.applicationId, applicationId));
    
    // Then set the new property as current
    const [updated] = await db
      .update(applicationProperties)
      .set({ isCurrentProperty: true, status: "active", updatedAt: new Date() })
      .where(eq(applicationProperties.id, propertyId))
      .returning();
    return updated;
  }

  async markDealFellThrough(propertyId: string, reason: string): Promise<ApplicationProperty | undefined> {
    const [updated] = await db
      .update(applicationProperties)
      .set({ 
        status: "deal_fell_through", 
        isCurrentProperty: false,
        notes: reason,
        updatedAt: new Date() 
      })
      .where(eq(applicationProperties.id, propertyId))
      .returning();
    return updated;
  }

  // Plaid Verifications
  async createPlaidLinkToken(data: InsertPlaidLinkToken): Promise<PlaidLinkToken> {
    const [token] = await db.insert(plaidLinkTokens).values(data).returning();
    return token;
  }

  async getPlaidLinkToken(id: string): Promise<PlaidLinkToken | undefined> {
    const [token] = await db
      .select()
      .from(plaidLinkTokens)
      .where(eq(plaidLinkTokens.id, id))
      .limit(1);
    return token;
  }

  async updatePlaidLinkToken(id: string, data: Partial<PlaidLinkToken>): Promise<PlaidLinkToken | undefined> {
    const { id: tokenId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(plaidLinkTokens)
      .set(cleanData)
      .where(eq(plaidLinkTokens.id, id))
      .returning();
    return updated;
  }

  async createVerification(data: InsertVerification): Promise<Verification> {
    const [verification] = await db.insert(verifications).values(data).returning();
    return verification;
  }

  async getVerification(id: string): Promise<Verification | undefined> {
    const [verification] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.id, id))
      .limit(1);
    return verification;
  }

  async getVerificationsByApplication(applicationId: string): Promise<Verification[]> {
    return await db
      .select()
      .from(verifications)
      .where(eq(verifications.applicationId, applicationId))
      .orderBy(desc(verifications.createdAt));
  }

  async getVerificationsByUser(userId: string): Promise<Verification[]> {
    return await db
      .select()
      .from(verifications)
      .where(eq(verifications.userId, userId))
      .orderBy(desc(verifications.createdAt));
  }

  async updateVerification(id: string, data: Partial<Verification>): Promise<Verification | undefined> {
    const { id: verId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(verifications)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(verifications.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
