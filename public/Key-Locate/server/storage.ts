import {
  users,
  companies,
  companyModules,
  locations,
  keyBunches,
  movementHistory,
  auditSessions,
  auditScans,
  auditLog,
  savedReports,
  policies,
  policyPermissions,
  reportTemplates,
  reportTemplatePermissions,
  reportSubmissions,
  assignmentTemplateSections,
  locationAssignments,
  assignmentSectionValues,
  assignmentAuditLog,
  customerUsers,
  customerLocationAccess,
  customerSessions,
  type AssignmentTemplateSection,
  type LocationAssignment,
  type AssignmentSectionValue,
  type AssignmentAuditLogEntry,
  type CustomerUser,
  type User,
  type InsertUser,
  type UpsertUser,
  type Company,
  type Location,
  type InsertLocation,
  type KeyBunch,
  type InsertKeyBunch,
  type KeyBunchWithLocation,
  type MovementHistory,
  type InsertMovementHistory,
  type MovementHistoryWithDetails,
  type AuditSession,
  type InsertAuditSession,
  type AuditSessionWithDetails,
  type AuditScan,
  type InsertAuditScan,
  type AuditLog,
  type InsertAuditLog,
  type SavedReport,
  type InsertSavedReport,
  type CompanyModule,
  type Policy,
  type InsertPolicy,
  type PolicyPermission,
  type ReportTemplate,
  type InsertReportTemplate,
  type ReportTemplatePermission,
  type ReportSubmission,
  type InsertReportSubmission,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, and, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { DEFAULT_STATUSES, DEFAULT_ACTIONS } from "@shared/settings";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(companyId?: number): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number, companyId?: number): Promise<void>;
  upsertUser(user: UpsertUser): Promise<User>;

  
  // Locations
  getLocations(companyId?: number): Promise<Location[]>;
  getLocation(id: number, companyId?: number): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: number, updates: Partial<Location>, companyId?: number): Promise<Location | undefined>;
  deleteLocation(id: number, companyId?: number): Promise<void>;
  
  // Key Bunches
  getKeyBunches(companyId?: number, includeDeleted?: boolean): Promise<KeyBunchWithLocation[]>;
  getKeyBunch(id: number, companyId?: number, includeDeleted?: boolean): Promise<KeyBunchWithLocation | undefined>;
  getKeyBunchByIdentifier(identifier: string, companyId?: number, includeDeleted?: boolean): Promise<KeyBunchWithLocation | undefined>;
  getKeyBunchByNFC(nfcSerial: string, companyId?: number, includeDeleted?: boolean): Promise<KeyBunch | undefined>;
  createKeyBunch(keyBunch: InsertKeyBunch): Promise<KeyBunch>;
  updateKeyBunch(id: number, updates: Partial<KeyBunch>, companyId?: number): Promise<KeyBunch | undefined>;
  deleteKeyBunch(id: number, companyId?: number, userId?: string, reason?: string): Promise<void>;
  getKeyBunchesByLocation(locationId: number, companyId?: number, includeDeleted?: boolean): Promise<KeyBunchWithLocation[]>;
  getKeyBunchesByType(type: string, companyId?: number, includeDeleted?: boolean): Promise<KeyBunchWithLocation[]>;
  getKeyBunchesByLocationAndType(companyId: number, locationId: number, type: string, includeDeleted?: boolean): Promise<KeyBunch[]>;
  checkDuplicateIdentifier(identifier: string, type: string, locationId: number | null, companyId: number, excludeId?: number): Promise<boolean>;
  
  // Movement History
  getMovementHistory(limit?: number, companyId?: number): Promise<MovementHistoryWithDetails[]>;
  createMovementHistory(movement: InsertMovementHistory): Promise<MovementHistory>;
  getKeyBunchMovementHistory(keyBunchId: number, companyId?: number): Promise<MovementHistoryWithDetails[]>;
  getDeletedKeys(companyId?: number): Promise<any[]>;
  
  // Audit Sessions
  getAuditSessions(companyId?: number): Promise<AuditSessionWithDetails[]>;
  getAuditSession(id: number, companyId?: number): Promise<AuditSessionWithDetails | undefined>;
  createAuditSession(session: InsertAuditSession): Promise<AuditSession>;
  updateAuditSession(id: number, updates: Partial<AuditSession>, companyId?: number): Promise<AuditSession | undefined>;
  getActiveAuditSession(companyId?: number): Promise<AuditSessionWithDetails | undefined>;
  
  // Audit Scans
  createAuditScan(scan: InsertAuditScan): Promise<AuditScan>;
  getAuditScans(sessionId: number): Promise<AuditScan[]>;
  
  // Dashboard Stats
  getDashboardStats(companyId?: number): Promise<{
    totalBunches: number;
    statusCounts: { statusId: string; displayName: string; color: string; count: number; }[];
    lastAuditTime: string | null;
  }>;
  
  // Audit Log
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number, keyBunchId?: number): Promise<AuditLog[]>;
  getComprehensiveAuditLogs(filters: {
    companyId: number;
    limit?: number;
    action?: string;
    entityType?: string;
    userId?: number;
    searchTerm?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]>;
  
  // System Settings
  getSystemSettings(): Promise<any>;
  updateSystemSettings(settings: any): Promise<any>;
  
  // Settings Management
  getSettings(companyId?: number): Promise<any>;
  updateSettingCategory(category: string, items: any[], companyId?: number): Promise<any>;
  addSettingItem(category: string, item: any, companyId?: number): Promise<any>;
  updateSettingItem(category: string, id: string, updates: any, companyId?: number): Promise<any>;
  deleteSettingItem(category: string, id: string, companyId?: number): Promise<any>;
  
  // Saved Reports
  getSavedReports(companyId?: number): Promise<SavedReport[]>;
  getSavedReport(id: number, companyId?: number): Promise<SavedReport | undefined>;
  createSavedReport(report: InsertSavedReport): Promise<SavedReport>;
  updateSavedReport(id: number, updates: Partial<SavedReport>, companyId?: number): Promise<SavedReport | undefined>;
  deleteSavedReport(id: number, companyId?: number): Promise<void>;

  // Platform Admin — Company Management
  getAllCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  updateCompany(id: number, updates: Partial<Company>): Promise<Company | undefined>;

  // Platform Admin — Module Management
  getCompanyModules(companyId: number): Promise<CompanyModule[]>;
  setCompanyModule(companyId: number, moduleId: string, isEnabled: boolean, enabledBy?: number, notes?: string): Promise<CompanyModule>;

  // Policies
  getPolicies(companyId: number): Promise<Policy[]>;
  getPoliciesForUser(userId: number, companyId: number): Promise<Policy[]>;
  getPolicy(id: number, companyId: number): Promise<Policy | undefined>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  updatePolicy(id: number, companyId: number, updates: Partial<Pick<Policy, 'name' | 'description' | 'fileData' | 'fileName' | 'fileType' | 'fileSize'>>): Promise<Policy | undefined>;
  deletePolicy(id: number, companyId: number): Promise<void>;
  getUserPolicyIds(userId: number, companyId: number): Promise<number[]>;
  setPolicyPermissions(userId: number, companyId: number, policyIds: number[]): Promise<void>;

  // Reports module
  getReportTemplates(companyId: number): Promise<ReportTemplate[]>;
  getReportTemplate(id: number, companyId: number): Promise<ReportTemplate | undefined>;
  getReportTemplatesForUser(userId: number, companyId: number): Promise<{ template: ReportTemplate; canFill: boolean; canView: boolean }[]>;
  createReportTemplate(data: InsertReportTemplate): Promise<ReportTemplate>;
  updateReportTemplate(id: number, companyId: number, updates: Partial<Pick<ReportTemplate, 'name' | 'description' | 'fields' | 'isActive'>>): Promise<ReportTemplate | undefined>;
  deleteReportTemplate(id: number, companyId: number): Promise<void>;
  getReportTemplatePermissions(templateId: number, companyId: number): Promise<ReportTemplatePermission[]>;
  setReportTemplatePermissions(templateId: number, companyId: number, perms: { userId: number; canFill: boolean; canView: boolean }[]): Promise<void>;
  getUserReportPermissions(userId: number, companyId: number): Promise<ReportTemplatePermission[]>;
  createReportSubmission(data: InsertReportSubmission): Promise<ReportSubmission>;
  getReportSubmissions(templateId: number, companyId: number): Promise<(ReportSubmission & { submitterName: string | null; submitterEmail: string | null })[]>;
  getReportSubmission(id: number, companyId: number): Promise<ReportSubmission | undefined>;
  deleteReportSubmission(id: number, companyId: number): Promise<void>;

  // Assignment module
  getAssignmentTemplateSections(companyId: number): Promise<AssignmentTemplateSection[]>;
  createAssignmentTemplateSection(data: Omit<AssignmentTemplateSection, 'id' | 'createdAt' | 'updatedAt'>): Promise<AssignmentTemplateSection>;
  updateAssignmentTemplateSection(id: number, companyId: number, updates: Partial<AssignmentTemplateSection>): Promise<AssignmentTemplateSection | undefined>;
  deleteAssignmentTemplateSection(id: number, companyId: number): Promise<void>;
  reorderAssignmentTemplateSections(companyId: number, orderedIds: number[]): Promise<void>;
  syncTemplateSectionToAllAssignments(sectionId: number, companyId: number): Promise<void>;

  getOrCreateLocationAssignment(companyId: number, identifier: string, address: string): Promise<LocationAssignment>;
  getAssignmentWithValues(companyId: number, identifier: string, address: string): Promise<{ assignment: LocationAssignment; sections: AssignmentTemplateSection[]; values: AssignmentSectionValue[] } | null>;
  saveAssignmentValues(assignmentId: number, companyId: number, values: { sectionId: number; value?: string | null; imageData?: string | null }[]): Promise<void>;

  logAssignmentChange(entry: Omit<AssignmentAuditLogEntry, 'id' | 'createdAt'>): Promise<void>;
  getAssignmentAuditLog(assignmentId: number, companyId: number): Promise<AssignmentAuditLogEntry[]>;

  // Customer users
  createCustomerUser(data: { companyId: number; email: string; name?: string }): Promise<CustomerUser>;
  getCustomerUser(id: number, companyId: number): Promise<CustomerUser | undefined>;
  getCustomerUserByEmail(email: string): Promise<CustomerUser | undefined>;
  getCustomerUserByInviteToken(token: string): Promise<CustomerUser | undefined>;
  updateCustomerUser(id: number, updates: Partial<CustomerUser>): Promise<CustomerUser | undefined>;
  deleteCustomerUser(id: number, companyId: number): Promise<void>;
  listCustomerUsers(companyId: number): Promise<(CustomerUser & { assignmentIds: number[]; assignmentBunches: {id: number; identifier: string; address: string}[] })[]>;
  setCustomerLocationAccess(customerId: number, companyId: number, assignmentIds: number[]): Promise<void>;
  getCustomerAssignmentIds(customerId: number, companyId: number): Promise<number[]>;
  getCustomerLocationIds(customerId: number, companyId: number): Promise<number[]>;

  createCustomerSession(customerId: number, companyId: number): Promise<string>;
  getCustomerSession(token: string): Promise<{ customerId: number; companyId: number } | null>;
  deleteCustomerSession(token: string): Promise<void>;

  // Assignment access password
  getAssignmentPassword(companyId: number): Promise<string | null>;
  setAssignmentPassword(companyId: number, passwordHash: string): Promise<void>;
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log("Storage: Looking for user with email:", email);
    try {
      // Case-insensitive email lookup using LOWER() in SQL
      const normalizedEmail = email?.toLowerCase().trim();
      const [user] = await db.select().from(users).where(sql`LOWER(${users.email}) = ${normalizedEmail}`);
      console.log("Storage: Found user:", user ? "yes" : "no", user);
      return user || undefined;
    } catch (error) {
      console.error("Storage: Database error:", error);
      return undefined;
    }
  }

  async getAllUsers(companyId?: number): Promise<User[]> {
    let query = db.select().from(users);
    
    // Filter out inactive (soft-deleted) users
    if (companyId) {
      query = query.where(and(eq(users.companyId, companyId), eq(users.isActive, true)));
    } else {
      query = query.where(eq(users.isActive, true));
    }
    
    return await query;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: number, companyId?: number): Promise<void> {
    // Soft delete: mark user as inactive to preserve audit trail
    // This prevents foreign key constraint violations with movement_history
    if (companyId !== undefined) {
      await db.update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(users.id, id), eq(users.companyId, companyId)));
    } else {
      await db.update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, id));
    }
  }




  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Normalize email to lowercase before inserting
    const normalizedUser = {
      ...insertUser,
      email: insertUser.email?.toLowerCase().trim() || null,
    };
    const [user] = await db.insert(users).values(normalizedUser).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Normalize email to lowercase before upserting
    const normalizedEmail = userData.email?.toLowerCase().trim() || null;
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        email: normalizedEmail,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: normalizedEmail,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Location operations
  async getLocations(companyId?: number): Promise<Location[]> {
    if (companyId) {
      return await db.select().from(locations).where(eq(locations.companyId, companyId)).orderBy(locations.name);
    }
    return await db.select().from(locations).orderBy(locations.name);
  }

  async getLocation(id: number, companyId?: number): Promise<Location | undefined> {
    // SECURITY: Multi-tenant data isolation
    const conditions = [eq(locations.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(locations.companyId, companyId));
    }
    
    const [location] = await db.select().from(locations).where(and(...conditions));
    return location;
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const [location] = await db.insert(locations).values(insertLocation).returning();
    return location;
  }

  async updateLocation(id: number, updates: Partial<Location>, companyId?: number): Promise<Location | undefined> {
    // SECURITY: Multi-tenant data isolation - only update if belongs to company
    const conditions = [eq(locations.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(locations.companyId, companyId));
    }
    
    const [location] = await db
      .update(locations)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return location;
  }

  async deleteLocation(id: number, companyId?: number): Promise<void> {
    // SECURITY: Multi-tenant data isolation - only delete if belongs to company
    const conditions = [eq(locations.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(locations.companyId, companyId));
    }
    
    await db.delete(locations).where(and(...conditions));
  }

  // Key Bunch operations

  // Slim column set for key-bunch LIST queries: excludes the heavy base64
  // blobs (imageUrl, documentUrl) but exposes hasImage/hasDocument flags.
  private keyBunchListColumnsSet() {
    return {
      id: keyBunches.id,
      companyId: keyBunches.companyId,
      identifier: keyBunches.identifier,
      type: keyBunches.type,
      currentTag: keyBunches.currentTag,
      nfcSerial: keyBunches.nfcSerial,
      locationId: keyBunches.locationId,
      status: keyBunches.status,
      keyCount: keyBunches.keyCount,
      fobCount: keyBunches.fobCount,
      keyDescription: keyBunches.keyDescription,
      address: keyBunches.address,
      notes: keyBunches.notes,
      imageUpdatedAt: keyBunches.imageUpdatedAt,
      documentName: keyBunches.documentName,
      documentType: keyBunches.documentType,
      documentUploadedAt: keyBunches.documentUploadedAt,
      lastUpdated: keyBunches.lastUpdated,
      isDeleted: keyBunches.isDeleted,
      deletedAt: keyBunches.deletedAt,
      deletedBy: keyBunches.deletedBy,
      deletionReason: keyBunches.deletionReason,
      hasImage: sql<boolean>`(${keyBunches.imageUrl} IS NOT NULL)`,
      hasDocument: sql<boolean>`(${keyBunches.documentUrl} IS NOT NULL)`,
    };
  }

  async getKeyBunches(companyId?: number, includeDeleted = false): Promise<KeyBunchWithLocation[]> {
    const conditions = [];
    
    // Multi-tenant filtering
    if (companyId) {
      conditions.push(eq(keyBunches.companyId, companyId));
    }
    
    // Exclude soft-deleted by default
    if (!includeDeleted) {
      conditions.push(eq(keyBunches.isDeleted, false));
    }
    
    // IMPORTANT: exclude the heavy base64 blobs (imageUrl, documentUrl) from
    // list queries — some rows carry multi-hundred-KB photos, and returning
    // them for every key made list endpoints respond with 100+ MB payloads.
    // The single-key endpoint (getKeyBunch) still returns the full row.
    let query = db
      .select({
        key_bunches: this.keyBunchListColumnsSet(),
        locations: locations,
      })
      .from(keyBunches)
      .leftJoin(locations, eq(keyBunches.locationId, locations.id))
      .orderBy(keyBunches.identifier);
      
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const result = await query;
    
    return result.map(row => ({
      ...row.key_bunches,
      imageUrl: null,
      documentUrl: null,
      location: row.locations || undefined,
    }));
  }

  async getKeyBunch(id: number, companyId?: number, includeDeleted = false): Promise<KeyBunchWithLocation | undefined> {
    // SECURITY: Multi-tenant data isolation
    const conditions = [eq(keyBunches.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(keyBunches.companyId, companyId));
    }
    
    // Exclude soft-deleted by default
    if (!includeDeleted) {
      conditions.push(eq(keyBunches.isDeleted, false));
    }
    
    const [result] = await db
      .select()
      .from(keyBunches)
      .leftJoin(locations, eq(keyBunches.locationId, locations.id))
      .where(and(...conditions));
    
    if (!result) return undefined;
    
    return {
      ...result.key_bunches,
      location: result.locations || undefined,
    };
  }

  async getKeyBunchByIdentifier(identifier: string, companyId?: number, includeDeleted = false): Promise<KeyBunchWithLocation | undefined> {
    // SECURITY: Multi-tenant data isolation
    const conditions = [eq(keyBunches.identifier, identifier)];
    if (companyId !== undefined) {
      conditions.push(eq(keyBunches.companyId, companyId));
    }
    
    // Exclude soft-deleted by default
    if (!includeDeleted) {
      conditions.push(eq(keyBunches.isDeleted, false));
    }
    
    const [result] = await db
      .select()
      .from(keyBunches)
      .leftJoin(locations, eq(keyBunches.locationId, locations.id))
      .where(and(...conditions));
    
    if (!result) return undefined;
    
    return {
      ...result.key_bunches,
      location: result.locations || undefined,
    };
  }

  async getKeyBunchByNFC(nfcSerial: string, companyId?: number, includeDeleted = false): Promise<KeyBunch | undefined> {
    const conditions = [eq(keyBunches.nfcSerial, nfcSerial)];
    
    if (companyId !== undefined) {
      conditions.push(eq(keyBunches.companyId, companyId));
    }
    
    // Exclude soft-deleted by default
    if (!includeDeleted) {
      conditions.push(eq(keyBunches.isDeleted, false));
    }
    
    const [keyBunch] = await db
      .select()
      .from(keyBunches)
      .where(and(...conditions));
    
    return keyBunch;
  }

  async createKeyBunch(insertKeyBunch: InsertKeyBunch): Promise<KeyBunch> {
    const [keyBunch] = await db.insert(keyBunches).values(insertKeyBunch).returning();
    return keyBunch;
  }

  async updateKeyBunch(id: number, updates: Partial<KeyBunch>, companyId?: number): Promise<KeyBunch | undefined> {
    // SECURITY: Multi-tenant data isolation - only update if belongs to company
    const conditions = [eq(keyBunches.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(keyBunches.companyId, companyId));
    }
    
    const [keyBunch] = await db
      .update(keyBunches)
      .set({ ...updates, lastUpdated: new Date() })
      .where(and(...conditions))
      .returning();
    return keyBunch;
  }

  async deleteKeyBunch(id: number, companyId?: number, userId?: string, reason?: string): Promise<void> {
    // SECURITY: Multi-tenant data isolation - only delete if belongs to company
    const conditions = [eq(keyBunches.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(keyBunches.companyId, companyId));
    }

    // Soft delete: Mark as deleted instead of hard delete to preserve audit trail and foreign key integrity
    await db
      .update(keyBunches)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId ? parseInt(userId) : null,
        deletionReason: reason || null,
      })
      .where(and(...conditions));
  }

  async getKeyBunchesByLocation(locationId: number, companyId?: number, includeDeleted = false): Promise<KeyBunchWithLocation[]> {
    const conditions = [eq(keyBunches.locationId, locationId)];
    
    if (companyId) {
      conditions.push(eq(keyBunches.companyId, companyId));
    }
    
    // Exclude soft-deleted by default
    if (!includeDeleted) {
      conditions.push(eq(keyBunches.isDeleted, false));
    }
    
    const result = await db
      .select({
        key_bunches: this.keyBunchListColumnsSet(),
        locations: locations,
      })
      .from(keyBunches)
      .leftJoin(locations, eq(keyBunches.locationId, locations.id))
      .where(and(...conditions))
      .orderBy(keyBunches.identifier);
    
    return result.map(row => ({
      ...row.key_bunches,
      imageUrl: null,
      documentUrl: null,
      location: row.locations || undefined,
    }));
  }

  async getKeyBunchesByType(type: string, companyId?: number, includeDeleted = false): Promise<KeyBunchWithLocation[]> {
    const conditions = [eq(keyBunches.type, type)];
    
    if (companyId) {
      conditions.push(eq(keyBunches.companyId, companyId));
    }
    
    // Exclude soft-deleted by default
    if (!includeDeleted) {
      conditions.push(eq(keyBunches.isDeleted, false));
    }
    
    const result = await db
      .select({
        key_bunches: this.keyBunchListColumnsSet(),
        locations: locations,
      })
      .from(keyBunches)
      .leftJoin(locations, eq(keyBunches.locationId, locations.id))
      .where(and(...conditions))
      .orderBy(keyBunches.identifier);
    
    return result.map(row => ({
      ...row.key_bunches,
      imageUrl: null,
      documentUrl: null,
      location: row.locations || undefined,
    }));
  }

  async getKeyBunchesByLocationAndType(companyId: number, locationId: number, type: string, includeDeleted = false): Promise<KeyBunch[]> {
    const conditions = [
      eq(keyBunches.companyId, companyId),
      eq(keyBunches.locationId, locationId)
    ];
    
    // Exclude soft-deleted by default
    if (!includeDeleted) {
      conditions.push(eq(keyBunches.isDeleted, false));
    }
    
    // If type is not "all", add type filter
    if (type && type !== "all") {
      conditions.push(eq(keyBunches.type, type));
    }
    
    const slimRows = await db
      .select(this.keyBunchListColumnsSet())
      .from(keyBunches)
      .where(and(...conditions))
      .orderBy(keyBunches.identifier);
    const allBunches = slimRows.map(row => ({ ...row, imageUrl: null, documentUrl: null }));
    
    // Filter out bunches with 0 keys AND 0 fobs - they cannot be audited
    // Use explicit numeric comparison to handle null/undefined/string values
    // Treat invalid/NaN values as 0 to avoid including corrupted data in audits
    return allBunches.filter(bunch => {
      const keyCount = Number.isFinite(Number(bunch.keyCount)) ? Number(bunch.keyCount) : 0;
      const fobCount = Number.isFinite(Number(bunch.fobCount)) ? Number(bunch.fobCount) : 0;
      return keyCount > 0 || fobCount > 0;
    });
  }

  async checkDuplicateIdentifier(
    identifier: string, 
    type: string, 
    locationId: number | null, 
    companyId: number, 
    excludeId?: number
  ): Promise<boolean> {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    
    let conditions = [
      eq(keyBunches.companyId, companyId),
      eq(keyBunches.type, type),
      eq(keyBunches.isDeleted, false), // Exclude soft-deleted items from duplicate checking
      sql`LOWER(TRIM(${keyBunches.identifier})) = ${normalizedIdentifier}` // Case-insensitive comparison
    ];

    // Include location in uniqueness check
    if (locationId !== null) {
      conditions.push(eq(keyBunches.locationId, locationId));
    } else {
      conditions.push(eq(keyBunches.locationId, null));
    }

    // Exclude current record if updating
    if (excludeId !== undefined) {
      const [existing] = await db
        .select({ id: keyBunches.id })
        .from(keyBunches)
        .where(and(...conditions));
      
      return existing ? existing.id !== excludeId : false;
    }

    const [existing] = await db
      .select({ id: keyBunches.id })
      .from(keyBunches)
      .where(and(...conditions));
    
    return !!existing;
  }

  // Movement History operations
  async getMovementHistory(limit = 50, companyId?: number): Promise<MovementHistoryWithDetails[]> {
    let query = db
      .select({
        // Movement history fields
        id: movementHistory.id,
        actionType: movementHistory.actionType,  
        keyBunchId: movementHistory.keyBunchId,
        performedBy: movementHistory.performedBy,
        fromLocationId: movementHistory.fromLocationId,
        toLocationId: movementHistory.toLocationId,
        fromBunchType: movementHistory.fromBunchType,
        toBunchType: movementHistory.toBunchType,
        oldTag: movementHistory.oldTag,
        newTag: movementHistory.newTag,
        notes: movementHistory.notes,
        timestamp: movementHistory.timestamp,
        companyId: movementHistory.companyId,
        // Key bunch fields (may be null for deleted keys).
        // IMPORTANT: exclude heavy base64 blobs (imageUrl/documentUrl) — they
        // ballooned this response to tens of MB.
        keyBunchId_ref: keyBunches.id,
        keyBunchIdentifier: keyBunches.identifier,
        keyBunchType: keyBunches.type,
        keyBunchStatus: keyBunches.status,
        keyBunchCurrentTag: keyBunches.currentTag,
        // Location fields
        fromLocation: locations,
        // User fields
        user: users,
      })
      .from(movementHistory)
      .leftJoin(keyBunches, eq(movementHistory.keyBunchId, keyBunches.id))
      .leftJoin(locations, eq(movementHistory.fromLocationId, locations.id))
      .leftJoin(users, eq(movementHistory.performedBy, users.id));

    
    // CRITICAL: Filter by company
    if (companyId) {
      query = query.where(
        eq(movementHistory.companyId, companyId)
      );
    }
    
    const result = await query
      .orderBy(desc(movementHistory.timestamp))
      .limit(limit);
    
    return result.map(row => ({
      id: row.id,
      action: row.actionType,
      keyBunchId: row.keyBunchId,
      userId: row.performedBy,
      fromLocationId: row.fromLocationId,
      toLocationId: row.toLocationId,
      notes: row.notes,
      timestamp: row.timestamp,
      keyBunch: row.keyBunchId_ref ? {
        id: row.keyBunchId_ref,
        identifier: row.keyBunchIdentifier,
        type: row.keyBunchType,
        status: row.keyBunchStatus,
        currentTag: row.keyBunchCurrentTag,
      } : undefined,
      fromLocation: row.fromLocation || undefined,
      user: row.user || undefined,
    }));
  }

  async createMovementHistory(insertMovement: InsertMovementHistory): Promise<MovementHistory> {
    const [movement] = await db.insert(movementHistory).values(insertMovement).returning();
    return movement;
  }

  async getKeyBunchMovementHistory(keyBunchId: number, companyId?: number): Promise<MovementHistoryWithDetails[]> {
    // SECURITY: Multi-tenant data isolation
    let conditions: any = eq(movementHistory.keyBunchId, keyBunchId);
    if (companyId !== undefined) {
      conditions = and(conditions, eq(movementHistory.companyId, companyId));
    }
    
    // Create aliases for locations table to join both from and to locations
    const fromLocations = alias(locations, 'fromLocations');
    const toLocations = alias(locations, 'toLocations');
    
    const result = await db
      .select({
        id: movementHistory.id,
        actionType: movementHistory.actionType,
        keyBunchId: movementHistory.keyBunchId,
        performedBy: movementHistory.performedBy,
        fromLocationId: movementHistory.fromLocationId,
        toLocationId: movementHistory.toLocationId,
        fromBunchType: movementHistory.fromBunchType,
        toBunchType: movementHistory.toBunchType,
        oldTag: movementHistory.oldTag,
        newTag: movementHistory.newTag,
        notes: movementHistory.notes,
        timestamp: movementHistory.timestamp,
        companyId: movementHistory.companyId,
        // Select only necessary keyBunch fields, excluding imageUrl/documentUrl to reduce response size
        keyBunchId_ref: keyBunches.id,
        keyBunchIdentifier: keyBunches.identifier,
        keyBunchType: keyBunches.type,
        keyBunchStatus: keyBunches.status,
        keyBunchCurrentTag: keyBunches.currentTag,
        fromLocation: fromLocations,
        toLocation: toLocations,
        user: users,
      })
      .from(movementHistory)
      .leftJoin(keyBunches, eq(movementHistory.keyBunchId, keyBunches.id))
      .leftJoin(fromLocations, eq(movementHistory.fromLocationId, fromLocations.id))
      .leftJoin(toLocations, eq(movementHistory.toLocationId, toLocations.id))
      .leftJoin(users, eq(movementHistory.performedBy, users.id))
      .where(conditions)
      .orderBy(desc(movementHistory.timestamp));
    
    return result.map(row => ({
      id: row.id,
      action: row.actionType,
      keyBunchId: row.keyBunchId,
      userId: row.performedBy,
      fromLocationId: row.fromLocationId,
      toLocationId: row.toLocationId,
      notes: row.notes,
      timestamp: row.timestamp,
      keyBunch: row.keyBunchId_ref ? {
        id: row.keyBunchId_ref,
        identifier: row.keyBunchIdentifier,
        type: row.keyBunchType,
        status: row.keyBunchStatus,
        currentTag: row.keyBunchCurrentTag,
      } : undefined,
      fromLocation: row.fromLocation || undefined,
      toLocation: row.toLocation || undefined,
      user: row.user || undefined,
    }));
  }

  async getDeletedKeys(companyId?: number): Promise<any[]> {
    // Find all "deleted" action records
    let query = db
      .select({
        id: movementHistory.id,
        keyBunchId: movementHistory.keyBunchId,
        actionType: movementHistory.actionType,
        notes: movementHistory.notes,
        timestamp: movementHistory.timestamp,
        companyId: movementHistory.companyId,
        fromLocationId: movementHistory.fromLocationId,
        fromBunchType: movementHistory.fromBunchType,
        oldTag: movementHistory.oldTag,
        performedBy: movementHistory.performedBy,
        user: users,
        fromLocation: locations,
      })
      .from(movementHistory)
      .leftJoin(users, eq(movementHistory.performedBy, users.id))
      .leftJoin(locations, eq(movementHistory.fromLocationId, locations.id))
      .where(eq(movementHistory.actionType, 'deleted'));
    
    if (companyId) {
      query = query.where(and(
        eq(movementHistory.actionType, 'deleted'),
        eq(movementHistory.companyId, companyId)
      ));
    }
    
    const deletedRecords = await query.orderBy(desc(movementHistory.timestamp));
    
    // For each deleted key, reconstruct from movement history
    const deletedKeysWithHistory = await Promise.all(
      deletedRecords.map(async (record, index) => {
        // Extract identifier from notes (format: "Key bunch A24-xxx permanently deleted...")
        const identifierMatch = record.notes?.match(/Key bunch ([^\s]+)/);
        const identifier = identifierMatch ? identifierMatch[1] : `DELETED-${record.id}`;
        
        // Get full history for this deleted key if keyBunchId exists
        let history = [];
        if (record.keyBunchId) {
          history = await this.getKeyBunchMovementHistory(record.keyBunchId);
        }
        
        return {
          id: record.keyBunchId || record.id, // Use movement history ID if key bunch ID is null
          identifier,
          type: record.fromBunchType,
          locationId: record.fromLocationId,
          location: record.fromLocation || undefined,
          deletedAt: record.timestamp,
          deletedBy: record.user || undefined,
          deletionNotes: record.notes,
          history: history,
          isDeleted: true,
        };
      })
    );
    
    return deletedKeysWithHistory;
  }

  // Audit Session operations
  async getAuditSessions(companyId?: number): Promise<AuditSessionWithDetails[]> {
    let query = db
      .select()
      .from(auditSessions)
      .leftJoin(users, eq(auditSessions.performedBy, users.id));
    
    if (companyId) {
      query = query.where(eq(auditSessions.companyId, companyId));
    }
    
    const result = await query.orderBy(desc(auditSessions.startTime));
    
    return result.map(row => ({
      ...row.audit_sessions,
      user: row.users || undefined,
    }));
  }

  async getAuditSession(id: number, companyId?: number): Promise<AuditSessionWithDetails | undefined> {
    // SECURITY: Multi-tenant data isolation
    const conditions = [eq(auditSessions.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(auditSessions.companyId, companyId));
    }
    
    const [result] = await db
      .select()
      .from(auditSessions)
      .leftJoin(users, eq(auditSessions.performedBy, users.id))
      .where(and(...conditions));
    
    if (!result) return undefined;
    
    return {
      ...result.audit_sessions,
      user: result.users || undefined,
    };
  }

  async createAuditSession(insertSession: InsertAuditSession): Promise<AuditSession> {
    const [session] = await db.insert(auditSessions).values(insertSession).returning();
    return session;
  }

  async updateAuditSession(id: number, updates: Partial<AuditSession>, companyId?: number): Promise<AuditSession | undefined> {
    // SECURITY: Multi-tenant data isolation - only update if belongs to company
    const conditions = [eq(auditSessions.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(auditSessions.companyId, companyId));
    }
    
    const [session] = await db
      .update(auditSessions)
      .set(updates)
      .where(and(...conditions))
      .returning();
    return session;
  }

  async getActiveAuditSession(companyId?: number): Promise<AuditSessionWithDetails | undefined> {
    let whereConditions = eq(auditSessions.status, "active");
    
    if (companyId) {
      whereConditions = and(whereConditions, eq(auditSessions.companyId, companyId));
    }
    
    const [result] = await db
      .select()
      .from(auditSessions)
      .leftJoin(users, eq(auditSessions.performedBy, users.id))
      .where(whereConditions);
    
    if (!result) return undefined;
    
    return {
      ...result.audit_sessions,
      user: result.users || undefined,
    };
  }

  // Audit Scan operations
  async createAuditScan(insertScan: InsertAuditScan): Promise<AuditScan> {
    const [scan] = await db.insert(auditScans).values(insertScan).returning();
    return scan;
  }

  async getAuditScans(sessionId: number): Promise<AuditScan[]> {
    return await db
      .select()
      .from(auditScans)
      .where(eq(auditScans.auditSessionId, sessionId))
      .orderBy(auditScans.timestamp);
  }

  // Dashboard Stats
  async getDashboardStats(companyId?: number): Promise<{
    totalBunches: number;
    statusCounts: { statusId: string; displayName: string; color: string; count: number; }[];
    lastAuditTime: string | null;
  }> {
    // Get total bunches count (excluding soft-deleted)
    const conditions: any[] = [eq(keyBunches.isDeleted, false)];
    if (companyId) {
      conditions.push(eq(keyBunches.companyId, companyId));
    }
    const [totalResult] = await db
      .select({ count: count() })
      .from(keyBunches)
      .where(and(...conditions));

    // Get configured statuses from settings
    const settings = await this.getSettings(companyId);
    const configuredStatuses = settings?.statuses || [];

    // Get all active (non-deleted) key bunches for the company
    const bunches = await db
      .select()
      .from(keyBunches)
      .where(and(...conditions));

    // Count bunches for each configured status
    const statusCounts = configuredStatuses.map((status: any) => {
      const count = bunches.filter(b => b.status === status.id).length;
      return {
        statusId: status.id,
        displayName: status.displayName,
        color: status.color,
        count,
      };
    });

    // Get last audit time
    let auditQuery = db
      .select({ endTime: auditSessions.endTime })
      .from(auditSessions)
      .where(eq(auditSessions.status, "completed"))
      .orderBy(desc(auditSessions.endTime))
      .limit(1);
      
    if (companyId) {
      auditQuery = auditQuery.where(and(eq(auditSessions.status, "completed"), eq(auditSessions.companyId, companyId)));
    }
    
    const [lastAuditResult] = await auditQuery;

    return {
      totalBunches: totalResult.count,
      statusCounts,
      lastAuditTime: lastAuditResult?.endTime?.toISOString() || null,
    };
  }

  // Audit Log operations
  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLog).values(insertLog).returning();
    return log;
  }

  async getAuditLogs(limit = 100, keyBunchId?: number): Promise<AuditLog[]> {
    let query = db.select().from(auditLog);
    
    if (keyBunchId) {
      query = query.where(eq(auditLog.keyBunchId, keyBunchId));
    }
    
    return await query.orderBy(desc(auditLog.timestamp)).limit(limit);
  }

  async getComprehensiveAuditLogs(filters: {
    companyId: number;
    limit?: number;
    action?: string;
    entityType?: string;
    userId?: number;
    searchTerm?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const { companyId, limit = 100, action, entityType, userId, searchTerm, startDate, endDate } = filters;
    
    // Build query with joins for user details
    const query = db
      .select({
        id: auditLog.id,
        companyId: auditLog.companyId,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        userId: auditLog.userId,
        keyBunchId: auditLog.keyBunchId,
        details: auditLog.details,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        timestamp: auditLog.timestamp,
        user: users,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id));
    
    // Build where conditions
    const conditions: any[] = [eq(auditLog.companyId, companyId)];
    
    if (action) {
      conditions.push(eq(auditLog.action, action));
    }
    
    if (entityType) {
      conditions.push(eq(auditLog.entityType, entityType));
    }
    
    if (userId) {
      conditions.push(eq(auditLog.userId, userId));
    }
    
    // Apply conditions
    const result = await query
      .where(and(...conditions))
      .orderBy(desc(auditLog.timestamp))
      .limit(limit);
    
    // Filter by search term and date range in memory (for now)
    let filteredResult = result;
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredResult = filteredResult.filter(log => 
        log.action?.toLowerCase().includes(searchLower) ||
        log.details?.toLowerCase().includes(searchLower) ||
        log.user?.username?.toLowerCase().includes(searchLower) ||
        log.user?.email?.toLowerCase().includes(searchLower)
      );
    }
    
    if (startDate) {
      filteredResult = filteredResult.filter(log => 
        new Date(log.timestamp) >= startDate
      );
    }
    
    if (endDate) {
      filteredResult = filteredResult.filter(log => 
        new Date(log.timestamp) <= endDate
      );
    }
    
    return filteredResult;
  }

  // System Settings - placeholder implementation
  async getSystemSettings(): Promise<any> {
    // For now, just return empty object
    return {};
  }

  async updateSystemSettings(settings: any): Promise<any> {
    // For now, just return the settings
    return settings;
  }

  // Settings Management - Database implementation
  async getSettings(companyId?: number): Promise<any> {
    try {
      // Get settings from the company record
      let settings = {};
      
      if (companyId) {
        const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
        if (company && company.settings) {
          settings = company.settings as any;
        }
      }

      // Always return the 4 core statuses and core action types for all companies
      const defaultSettings = {
        keyTypes: (settings as any)?.keyTypes || [],
        statuses: (settings as any)?.statuses || DEFAULT_STATUSES,
        locationTypes: (settings as any)?.locationTypes || [],
        actions: (settings as any)?.actions || DEFAULT_ACTIONS,
      };
      
      console.log("Database getSettings for company", companyId, ":", JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    } catch (error) {
      console.error("Error getting settings:", error);
      // Return default settings if database error
      return {
        keyTypes: [],
        statuses: DEFAULT_STATUSES,
        locationTypes: [],
        actions: DEFAULT_ACTIONS,
      };
    }
  }
  
  async updateSettingCategory(category: string, items: any[], companyId?: number): Promise<any> {
    if (!companyId) {
      throw new Error("Company ID required for settings update");
    }

    try {
      // Get current settings
      const currentSettings = await this.getSettings(companyId);
      
      // Update the specific category
      currentSettings[category] = items;
      
      // Save back to database
      await db
        .update(companies)
        .set({ 
          settings: currentSettings,
          updatedAt: new Date()
        })
        .where(eq(companies.id, companyId));
      
      return await this.getSettings(companyId);
    } catch (error) {
      console.error("Error updating setting category:", error);
      throw error;
    }
  }
  
  async addSettingItem(category: string, item: any, companyId?: number): Promise<any> {
    if (!companyId) {
      throw new Error("Company ID required for settings update");
    }

    try {
      // Get current settings
      const currentSettings = await this.getSettings(companyId);
      
      // Add the new item with a unique ID
      if (!currentSettings[category]) {
        currentSettings[category] = [];
      }
      
      // Generate unique ID for the new item
      const newItem = {
        ...item,
        id: item.id || `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      currentSettings[category].push(newItem);
      
      // Save back to database
      await db
        .update(companies)
        .set({ 
          settings: currentSettings,
          updatedAt: new Date()
        })
        .where(eq(companies.id, companyId));
      
      return await this.getSettings(companyId);
    } catch (error) {
      console.error("Error adding setting item:", error);
      throw error;
    }
  }
  
  async updateSettingItem(category: string, id: string, updates: any, companyId?: number): Promise<any> {
    if (!companyId) {
      throw new Error("Company ID required for settings update");
    }

    console.log("Database updateSettingItem called:", { category, id, updates, companyId });
    
    try {
      // Get current settings
      const currentSettings = await this.getSettings(companyId);
      
      // Find and update the item
      if (!currentSettings[category]) {
        throw new Error(`Category ${category} not found`);
      }
      
      const index = currentSettings[category].findIndex((item: any) => item.id === id);
      console.log("Found item at index:", index);
      
      if (index === -1) {
        throw new Error(`Item with id ${id} not found in category ${category}`);
      }
      
      console.log("Before update:", JSON.stringify(currentSettings[category][index], null, 2));
      
      // Perform the update
      currentSettings[category][index] = { 
        ...currentSettings[category][index], 
        ...updates 
      };
      
      console.log("After update:", JSON.stringify(currentSettings[category][index], null, 2));
      
      // Save back to database
      await db
        .update(companies)
        .set({ 
          settings: currentSettings,
          updatedAt: new Date()
        })
        .where(eq(companies.id, companyId));
      
      return await this.getSettings(companyId);
    } catch (error) {
      console.error("Error updating setting item:", error);
      throw error;
    }
  }
  
  async deleteSettingItem(category: string, id: string, companyId?: number): Promise<any> {
    if (!companyId) {
      throw new Error("Company ID required for settings update");
    }

    console.log("Database deleteSettingItem called:", { category, id, companyId });
    
    try {
      // Get current settings
      const currentSettings = await this.getSettings(companyId);
      
      if (!currentSettings[category]) {
        throw new Error(`Category ${category} not found`);
      }
      
      // Check if the item is a default/hardcoded item
      const itemToDelete = currentSettings[category].find((item: any) => item.id === id);
      if (itemToDelete?.isDefault) {
        throw new Error("Cannot delete default system items");
      }
      
      const initialLength = currentSettings[category].length;
      currentSettings[category] = currentSettings[category].filter((item: any) => item.id !== id);
      const finalLength = currentSettings[category].length;
      
      console.log(`Deleted item ${id} from ${category}. Items before: ${initialLength}, after: ${finalLength}`);
      
      // Save back to database
      await db
        .update(companies)
        .set({ 
          settings: currentSettings,
          updatedAt: new Date()
        })
        .where(eq(companies.id, companyId));
      
      return await this.getSettings(companyId);
    } catch (error) {
      console.error("Error deleting setting item:", error);
      throw error;
    }
  }

  // Saved Reports
  async getSavedReports(companyId?: number): Promise<SavedReport[]> {
    const conditions = [];
    if (companyId) {
      conditions.push(eq(savedReports.companyId, companyId));
    }
    
    const reports = await db
      .select()
      .from(savedReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(savedReports.createdAt));
    
    return reports;
  }

  async getSavedReport(id: number, companyId?: number): Promise<SavedReport | undefined> {
    const conditions = [eq(savedReports.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(savedReports.companyId, companyId));
    }
    
    const [report] = await db
      .select()
      .from(savedReports)
      .where(and(...conditions));
    
    return report;
  }

  async createSavedReport(report: InsertSavedReport): Promise<SavedReport> {
    const [newReport] = await db
      .insert(savedReports)
      .values(report)
      .returning();
    
    return newReport;
  }

  async updateSavedReport(id: number, updates: Partial<SavedReport>, companyId?: number): Promise<SavedReport | undefined> {
    const conditions = [eq(savedReports.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(savedReports.companyId, companyId));
    }
    
    const [updated] = await db
      .update(savedReports)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    
    return updated;
  }

  async deleteSavedReport(id: number, companyId?: number): Promise<void> {
    const conditions = [eq(savedReports.id, id)];
    if (companyId !== undefined) {
      conditions.push(eq(savedReports.companyId, companyId));
    }
    
    await db
      .delete(savedReports)
      .where(and(...conditions));
  }

  // Platform Admin — Company Management
  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(companies.name);
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async updateCompany(id: number, updates: Partial<Company>): Promise<Company | undefined> {
    const [updated] = await db
      .update(companies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updated;
  }

  // Platform Admin — Module Management
  async getCompanyModules(companyId: number): Promise<CompanyModule[]> {
    return await db
      .select()
      .from(companyModules)
      .where(eq(companyModules.companyId, companyId));
  }

  async setCompanyModule(
    companyId: number,
    moduleId: string,
    isEnabled: boolean,
    enabledBy?: number,
    notes?: string,
  ): Promise<CompanyModule> {
    const existing = await db
      .select()
      .from(companyModules)
      .where(and(eq(companyModules.companyId, companyId), eq(companyModules.moduleId, moduleId)));

    if (existing.length > 0) {
      const [updated] = await db
        .update(companyModules)
        .set({
          isEnabled,
          enabledAt: isEnabled ? new Date() : existing[0].enabledAt,
          enabledBy: enabledBy ?? existing[0].enabledBy,
          notes: notes ?? existing[0].notes,
        })
        .where(and(eq(companyModules.companyId, companyId), eq(companyModules.moduleId, moduleId)))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(companyModules)
      .values({
        companyId,
        moduleId,
        isEnabled,
        enabledAt: isEnabled ? new Date() : undefined,
        enabledBy,
        notes,
      })
      .returning();
    return created;
  }

  // ─── Policies ────────────────────────────────────────────────────────────────

  async getPolicies(companyId: number): Promise<Policy[]> {
    return await db
      .select()
      .from(policies)
      .where(eq(policies.companyId, companyId))
      .orderBy(desc(policies.createdAt));
  }

  async getPoliciesForUser(userId: number, companyId: number): Promise<Policy[]> {
    const perms = await db
      .select({ policyId: policyPermissions.policyId })
      .from(policyPermissions)
      .where(and(eq(policyPermissions.userId, userId), eq(policyPermissions.companyId, companyId)));
    const ids = perms.map(p => p.policyId);
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(policies)
      .where(and(eq(policies.companyId, companyId), inArray(policies.id, ids)))
      .orderBy(desc(policies.createdAt));
  }

  async getPolicy(id: number, companyId: number): Promise<Policy | undefined> {
    const [policy] = await db
      .select()
      .from(policies)
      .where(and(eq(policies.id, id), eq(policies.companyId, companyId)));
    return policy;
  }

  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    const [created] = await db.insert(policies).values(policy).returning();
    return created;
  }

  async updatePolicy(id: number, companyId: number, updates: Partial<Pick<Policy, 'name' | 'description' | 'fileData' | 'fileName' | 'fileType' | 'fileSize'>>): Promise<Policy | undefined> {
    const [updated] = await db
      .update(policies)
      .set(updates)
      .where(and(eq(policies.id, id), eq(policies.companyId, companyId)))
      .returning();
    return updated;
  }

  async deletePolicy(id: number, companyId: number): Promise<void> {
    await db.delete(policies).where(and(eq(policies.id, id), eq(policies.companyId, companyId)));
  }

  async getUserPolicyIds(userId: number, companyId: number): Promise<number[]> {
    const rows = await db
      .select({ policyId: policyPermissions.policyId })
      .from(policyPermissions)
      .where(and(eq(policyPermissions.userId, userId), eq(policyPermissions.companyId, companyId)));
    return rows.map(r => r.policyId);
  }

  async setPolicyPermissions(userId: number, companyId: number, policyIds: number[]): Promise<void> {
    await db
      .delete(policyPermissions)
      .where(and(eq(policyPermissions.userId, userId), eq(policyPermissions.companyId, companyId)));
    if (policyIds.length > 0) {
      await db.insert(policyPermissions).values(
        policyIds.map(policyId => ({ policyId, userId, companyId }))
      );
    }
  }

  // ─── Reports module ──────────────────────────────────────────────────────────

  async getReportTemplates(companyId: number): Promise<ReportTemplate[]> {
    return await db
      .select()
      .from(reportTemplates)
      .where(eq(reportTemplates.companyId, companyId))
      .orderBy(desc(reportTemplates.createdAt));
  }

  async getReportTemplate(id: number, companyId: number): Promise<ReportTemplate | undefined> {
    const [t] = await db
      .select()
      .from(reportTemplates)
      .where(and(eq(reportTemplates.id, id), eq(reportTemplates.companyId, companyId)));
    return t;
  }

  async getReportTemplatesForUser(userId: number, companyId: number) {
    const perms = await db
      .select()
      .from(reportTemplatePermissions)
      .where(and(eq(reportTemplatePermissions.userId, userId), eq(reportTemplatePermissions.companyId, companyId)));
    if (perms.length === 0) return [];
    const ids = perms.map(p => p.templateId);
    const templates = await db
      .select()
      .from(reportTemplates)
      .where(and(eq(reportTemplates.companyId, companyId), inArray(reportTemplates.id, ids), eq(reportTemplates.isActive, true)))
      .orderBy(desc(reportTemplates.createdAt));
    return templates.map(t => {
      const p = perms.find(p => p.templateId === t.id)!;
      return { template: t, canFill: p.canFill, canView: p.canView };
    });
  }

  async createReportTemplate(data: InsertReportTemplate): Promise<ReportTemplate> {
    const [created] = await db.insert(reportTemplates).values(data).returning();
    return created;
  }

  async updateReportTemplate(id: number, companyId: number, updates: Partial<Pick<ReportTemplate, 'name' | 'description' | 'fields' | 'isActive'>>): Promise<ReportTemplate | undefined> {
    const [updated] = await db
      .update(reportTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(reportTemplates.id, id), eq(reportTemplates.companyId, companyId)))
      .returning();
    return updated;
  }

  async deleteReportTemplate(id: number, companyId: number): Promise<void> {
    await db.delete(reportTemplates).where(and(eq(reportTemplates.id, id), eq(reportTemplates.companyId, companyId)));
  }

  async getReportTemplatePermissions(templateId: number, companyId: number): Promise<ReportTemplatePermission[]> {
    return await db
      .select()
      .from(reportTemplatePermissions)
      .where(and(eq(reportTemplatePermissions.templateId, templateId), eq(reportTemplatePermissions.companyId, companyId)));
  }

  async setReportTemplatePermissions(templateId: number, companyId: number, perms: { userId: number; canFill: boolean; canView: boolean }[]): Promise<void> {
    await db
      .delete(reportTemplatePermissions)
      .where(and(eq(reportTemplatePermissions.templateId, templateId), eq(reportTemplatePermissions.companyId, companyId)));
    const toInsert = perms.filter(p => p.canFill || p.canView);
    if (toInsert.length > 0) {
      await db.insert(reportTemplatePermissions).values(
        toInsert.map(p => ({ templateId, userId: p.userId, companyId, canFill: p.canFill, canView: p.canView }))
      );
    }
  }

  async getUserReportPermissions(userId: number, companyId: number): Promise<ReportTemplatePermission[]> {
    return await db
      .select()
      .from(reportTemplatePermissions)
      .where(and(eq(reportTemplatePermissions.userId, userId), eq(reportTemplatePermissions.companyId, companyId)));
  }

  async createReportSubmission(data: InsertReportSubmission): Promise<ReportSubmission> {
    const [created] = await db.insert(reportSubmissions).values(data).returning();
    return created;
  }

  async getReportSubmissions(templateId: number, companyId: number) {
    const rows = await db
      .select({
        id: reportSubmissions.id,
        templateId: reportSubmissions.templateId,
        companyId: reportSubmissions.companyId,
        submittedBy: reportSubmissions.submittedBy,
        data: reportSubmissions.data,
        createdAt: reportSubmissions.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(reportSubmissions)
      .leftJoin(users, eq(reportSubmissions.submittedBy, users.id))
      .where(and(eq(reportSubmissions.templateId, templateId), eq(reportSubmissions.companyId, companyId)))
      .orderBy(desc(reportSubmissions.createdAt));
    return rows.map(r => ({
      id: r.id,
      templateId: r.templateId,
      companyId: r.companyId,
      submittedBy: r.submittedBy,
      data: r.data,
      createdAt: r.createdAt,
      submitterName: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
      submitterEmail: r.email,
    }));
  }

  async getReportSubmission(id: number, companyId: number): Promise<ReportSubmission | undefined> {
    const [s] = await db
      .select()
      .from(reportSubmissions)
      .where(and(eq(reportSubmissions.id, id), eq(reportSubmissions.companyId, companyId)));
    return s;
  }

  async deleteReportSubmission(id: number, companyId: number): Promise<void> {
    await db
      .delete(reportSubmissions)
      .where(and(eq(reportSubmissions.id, id), eq(reportSubmissions.companyId, companyId)));
  }

  // ─── Assignment Template ───────────────────────────────────────────────────

  async getAssignmentTemplateSections(companyId: number): Promise<AssignmentTemplateSection[]> {
    return db.select().from(assignmentTemplateSections)
      .where(and(eq(assignmentTemplateSections.companyId, companyId), eq(assignmentTemplateSections.isActive, true)))
      .orderBy(assignmentTemplateSections.sortOrder);
  }

  async createAssignmentTemplateSection(data: Omit<AssignmentTemplateSection, 'id' | 'createdAt' | 'updatedAt'>): Promise<AssignmentTemplateSection> {
    const [created] = await db.insert(assignmentTemplateSections).values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateAssignmentTemplateSection(id: number, companyId: number, updates: Partial<AssignmentTemplateSection>): Promise<AssignmentTemplateSection | undefined> {
    const [updated] = await db.update(assignmentTemplateSections)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(assignmentTemplateSections.id, id), eq(assignmentTemplateSections.companyId, companyId)))
      .returning();
    return updated;
  }

  async deleteAssignmentTemplateSection(id: number, companyId: number): Promise<void> {
    await db.update(assignmentTemplateSections)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(assignmentTemplateSections.id, id), eq(assignmentTemplateSections.companyId, companyId)));
  }

  async reorderAssignmentTemplateSections(companyId: number, orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(assignmentTemplateSections)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(assignmentTemplateSections.id, orderedIds[i]), eq(assignmentTemplateSections.companyId, companyId)));
    }
  }

  async syncTemplateSectionToAllAssignments(sectionId: number, companyId: number): Promise<void> {
    // Get all location assignments for this company
    const allAssignments = await db.select().from(locationAssignments)
      .where(eq(locationAssignments.companyId, companyId));
    // For each assignment, ensure a value row exists for this section
    for (const assignment of allAssignments) {
      const existing = await db.select().from(assignmentSectionValues)
        .where(and(
          eq(assignmentSectionValues.assignmentId, assignment.id),
          eq(assignmentSectionValues.sectionId, sectionId)
        ));
      if (existing.length === 0) {
        await db.insert(assignmentSectionValues).values({
          assignmentId: assignment.id,
          sectionId,
          companyId,
          value: null,
          imageData: null,
          updatedAt: new Date(),
        });
      }
    }
  }

  // ─── Location Assignments ──────────────────────────────────────────────────

  async getOrCreateLocationAssignment(companyId: number, identifier: string, address: string): Promise<LocationAssignment> {
    const [existing] = await db.select().from(locationAssignments)
      .where(and(
        eq(locationAssignments.companyId, companyId),
        eq(locationAssignments.keyBunchIdentifier, identifier),
        eq(locationAssignments.keyBunchAddress, address)
      ));
    if (existing) return existing;
    // Create assignment + seed section values for all active template sections
    const [created] = await db.insert(locationAssignments).values({
      companyId,
      locationId: null,
      keyBunchIdentifier: identifier,
      keyBunchAddress: address,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    const sections = await this.getAssignmentTemplateSections(companyId);
    if (sections.length > 0) {
      await db.insert(assignmentSectionValues).values(
        sections.map(s => ({ assignmentId: created.id, sectionId: s.id, companyId, value: null, imageData: null, updatedAt: new Date() }))
      );
    }
    return created;
  }

  async getAssignmentWithValues(companyId: number, identifier: string, address: string): Promise<{ assignment: LocationAssignment; sections: AssignmentTemplateSection[]; values: AssignmentSectionValue[] } | null> {
    const assignment = await this.getOrCreateLocationAssignment(companyId, identifier, address);
    const sections = await this.getAssignmentTemplateSections(companyId);
    const values = await db.select().from(assignmentSectionValues)
      .where(and(eq(assignmentSectionValues.assignmentId, assignment.id), eq(assignmentSectionValues.companyId, companyId)));
    return { assignment, sections, values };
  }

  async saveAssignmentValues(assignmentId: number, companyId: number, values: { sectionId: number; value?: string | null; imageData?: string | null }[]): Promise<void> {
    for (const v of values) {
      const existing = await db.select().from(assignmentSectionValues)
        .where(and(eq(assignmentSectionValues.assignmentId, assignmentId), eq(assignmentSectionValues.sectionId, v.sectionId)));
      if (existing.length > 0) {
        await db.update(assignmentSectionValues)
          .set({ value: v.value ?? null, imageData: v.imageData ?? null, updatedAt: new Date() })
          .where(and(eq(assignmentSectionValues.assignmentId, assignmentId), eq(assignmentSectionValues.sectionId, v.sectionId)));
      } else {
        await db.insert(assignmentSectionValues).values({
          assignmentId, sectionId: v.sectionId, companyId,
          value: v.value ?? null, imageData: v.imageData ?? null, updatedAt: new Date(),
        });
      }
    }
    await db.update(locationAssignments).set({ updatedAt: new Date() }).where(eq(locationAssignments.id, assignmentId));
  }

  // ─── Assignment Audit Log ──────────────────────────────────────────────────

  async logAssignmentChange(entry: Omit<AssignmentAuditLogEntry, 'id' | 'createdAt'>): Promise<void> {
    await db.insert(assignmentAuditLog).values({ ...entry, createdAt: new Date() });
  }

  async getAssignmentAuditLog(assignmentId: number, companyId: number): Promise<AssignmentAuditLogEntry[]> {
    return db.select().from(assignmentAuditLog)
      .where(and(eq(assignmentAuditLog.assignmentId, assignmentId), eq(assignmentAuditLog.companyId, companyId)))
      .orderBy(desc(assignmentAuditLog.createdAt));
  }

  // ─── Customer Users ────────────────────────────────────────────────────────

  async createCustomerUser(data: { companyId: number; email: string; name?: string }): Promise<CustomerUser> {
    const crypto = await import('crypto');
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const [user] = await db.insert(customerUsers).values({
      ...data,
      name: data.name ?? null,
      passwordHash: null,
      inviteToken,
      inviteTokenExpiry: expiry,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return user;
  }

  async getCustomerUser(id: number, companyId: number): Promise<CustomerUser | undefined> {
    const [user] = await db.select().from(customerUsers)
      .where(and(eq(customerUsers.id, id), eq(customerUsers.companyId, companyId)));
    return user;
  }

  async getCustomerUserByEmail(email: string): Promise<CustomerUser | undefined> {
    const [user] = await db.select().from(customerUsers).where(eq(customerUsers.email, email));
    return user;
  }

  async getCustomerUserByInviteToken(token: string): Promise<CustomerUser | undefined> {
    const [user] = await db.select().from(customerUsers).where(eq(customerUsers.inviteToken, token));
    return user;
  }

  async updateCustomerUser(id: number, updates: Partial<CustomerUser>): Promise<CustomerUser | undefined> {
    const [updated] = await db.update(customerUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customerUsers.id, id))
      .returning();
    return updated;
  }

  async deleteCustomerUser(id: number, companyId: number): Promise<void> {
    await db.delete(customerLocationAccess).where(eq(customerLocationAccess.customerId, id));
    await db.delete(customerSessions).where(eq(customerSessions.customerId, id));
    await db.delete(customerUsers).where(and(eq(customerUsers.id, id), eq(customerUsers.companyId, companyId)));
  }

  async listCustomerUsers(companyId: number): Promise<(CustomerUser & { assignmentIds: number[]; assignmentBunches: {id: number; identifier: string; address: string}[] })[]> {
    const users = await db.select().from(customerUsers)
      .where(eq(customerUsers.companyId, companyId))
      .orderBy(customerUsers.createdAt);
    const result = await Promise.all(users.map(async (u) => {
      const assignmentIds = await this.getCustomerAssignmentIds(u.id, companyId);
      let assignmentBunches: {id: number; identifier: string; address: string}[] = [];
      if (assignmentIds.length > 0) {
        const rows = await db.select().from(locationAssignments)
          .where(inArray(locationAssignments.id, assignmentIds));
        assignmentBunches = rows
          .filter(r => r.keyBunchIdentifier && r.keyBunchAddress)
          .map(r => ({ id: r.id, identifier: r.keyBunchIdentifier!, address: r.keyBunchAddress! }));
      }
      return { ...u, assignmentIds, assignmentBunches };
    }));
    return result;
  }

  async setCustomerLocationAccess(customerId: number, companyId: number, assignmentIds: number[]): Promise<void> {
    await db.delete(customerLocationAccess).where(and(
      eq(customerLocationAccess.customerId, customerId),
      eq(customerLocationAccess.companyId, companyId)
    ));
    if (assignmentIds.length > 0) {
      await db.insert(customerLocationAccess).values(
        assignmentIds.map(assignmentId => ({ customerId, assignmentId, companyId, locationId: null }))
      );
    }
  }

  async getCustomerAssignmentIds(customerId: number, companyId: number): Promise<number[]> {
    const rows = await db.select().from(customerLocationAccess)
      .where(and(eq(customerLocationAccess.customerId, customerId), eq(customerLocationAccess.companyId, companyId)));
    return rows.map(r => r.assignmentId).filter((id): id is number => id !== null);
  }

  // Legacy stub
  async getCustomerLocationIds(customerId: number, companyId: number): Promise<number[]> {
    return this.getCustomerAssignmentIds(customerId, companyId);
  }

  // ─── Customer Sessions ─────────────────────────────────────────────────────

  async createCustomerSession(customerId: number, companyId: number): Promise<string> {
    const crypto = await import('crypto');
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await db.insert(customerSessions).values({ token, customerId, companyId, expiresAt });
    return token;
  }

  async getCustomerSession(token: string): Promise<{ customerId: number; companyId: number } | null> {
    const [session] = await db.select().from(customerSessions).where(eq(customerSessions.token, token));
    if (!session || session.expiresAt < new Date()) return null;
    return { customerId: session.customerId, companyId: session.companyId };
  }

  async deleteCustomerSession(token: string): Promise<void> {
    await db.delete(customerSessions).where(eq(customerSessions.token, token));
  }

  // ─── Assignment Access Password ────────────────────────────────────────────

  async getAssignmentPassword(companyId: number): Promise<string | null> {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) return null;
    const settings = (company.settings as any) ?? {};
    return settings.assignmentPasswordHash ?? null;
  }

  async setAssignmentPassword(companyId: number, passwordHash: string): Promise<void> {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    const settings = (company?.settings as any) ?? {};
    await db.update(companies).set({ settings: { ...settings, assignmentPasswordHash: passwordHash } }).where(eq(companies.id, companyId));
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private locations: Map<number, Location>;
  private keyBunches: Map<number, KeyBunch>;
  private archivedKeyBunches: Map<number, any>;
  private movementHistory: Map<number, MovementHistory>;
  private auditSessions: Map<number, AuditSession>;
  private auditScans: Map<number, AuditScan>;
  private auditLogs: Map<number, AuditLog>;
  private currentUserId: number;
  private currentLocationId: number;
  private currentKeyBunchId: number;
  private currentArchivedId: number;
  private currentMovementId: number;
  private currentAuditSessionId: number;
  private currentAuditScanId: number;
  private currentAuditLogId: number;
  private systemSettings: any;

  constructor() {
    this.users = new Map();
    this.locations = new Map();
    this.keyBunches = new Map();
    this.archivedKeyBunches = new Map();
    this.movementHistory = new Map();
    this.auditSessions = new Map();
    this.auditScans = new Map();
    this.auditLogs = new Map();
    this.currentUserId = 1;
    this.currentLocationId = 1;
    this.currentKeyBunchId = 1;
    this.currentArchivedId = 1;
    this.currentMovementId = 1;
    this.currentAuditSessionId = 1;
    this.currentAuditScanId = 1;
    this.currentAuditLogId = 1;
    this.systemSettings = {};
    
    this.initializeData();
  }

  private generateKeyDescription(identifier: string, type: string): string {
    const descriptions = {
      day_shift: ["Client property access", "Office spaces", "Common areas", "Service entrances"],
      night_shift: ["After-hours access", "Emergency entry", "Maintenance access", "Secure areas"],
      lock_ups: ["Storage areas", "Equipment rooms", "Restricted access", "Archive storage"],
      static: ["Building access", "Fixed facilities", "Permanent installations", "Main entrances"]
    };
    
    const typeDescriptions = descriptions[type as keyof typeof descriptions] || ["General access"];
    const randomDesc = typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
    
    return `${identifier} - ${randomDesc}`;
  }

  private initializeData() {
    // Create super admin user
    const superAdmin: User = {
      id: "super-admin-1",
      email: "admin@company.com",
      firstName: "System",
      lastName: "Administrator",
      profileImageUrl: null,
      role: "super_admin",
      permissions: [], // Empty array means all permissions for super admin
      allowedLocationIds: [], // Empty array means all locations for super admin
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(superAdmin.id, superAdmin);

    // Create sample users with different roles
    const sampleUsers = [
      {
        id: "admin-1",
        email: "manager@company.com",
        firstName: "Business",
        lastName: "Manager",
        role: "admin" as const,
        allowedLocationIds: [1, 2, 3], // Can access Vehicle 1, Vehicle 2, Vehicle 3
      },
      {
        id: "officer-1", 
        email: "staff1@company.com",
        firstName: "Key",
        lastName: "Handler",
        role: "officer" as const,
        allowedLocationIds: [1, 6], // Can access Vehicle 1 and Main Office
      },
      {
        id: "officer-2",
        email: "staff2@company.com", 
        firstName: "Field",
        lastName: "Operator",
        role: "officer" as const,
        allowedLocationIds: [4, 5], // Can access Vehicle 4 and Vehicle 5
      },
      {
        id: "viewer-1",
        email: "supervisor@company.com",
        firstName: "Operations",
        lastName: "Supervisor", 
        role: "viewer" as const,
        allowedLocationIds: [], // Can view all locations but limited actions
      },
    ];

    sampleUsers.forEach(userData => {
      const user: User = {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: null,
        role: userData.role,
        permissions: [], // Will use default role permissions
        allowedLocationIds: userData.allowedLocationIds,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(user.id, user);
    });

    // Create sample locations
    const locationData = [
      { name: "Vehicle 1", type: "vehicle", description: "Mobile Unit - Registration: ABC123", status: "active" },
      { name: "Vehicle 2", type: "vehicle", description: "Mobile Unit - Registration: DEF456", status: "active" },
      { name: "Vehicle 3", type: "vehicle", description: "Mobile Unit - Registration: GHI789", status: "active" },
      { name: "Vehicle 4", type: "vehicle", description: "Mobile Unit - Registration: JKL012", status: "active" },
      { name: "Vehicle 5", type: "vehicle", description: "Mobile Unit - Registration: MNO345", status: "active" },
      { name: "Main Office", type: "office", description: "Central office and administration", status: "active" },
      { name: "Storage Facility", type: "building", description: "Key storage and backup location", status: "active" }
    ];

    locationData.forEach(data => {      
      const newLocation: Location = { 
        id: this.currentLocationId++,
        ...data,
      };
      this.locations.set(newLocation.id, newLocation);
    });

    // Create sample key bunches - assign by type to specific locations
    const bunchTypes = ["day_shift", "night_shift", "lock_ups", "static"];
    
    // Define location assignments based on key type:
    // Day shift → Vehicle 1 (id: 1), Night shift → Vehicle 2 (id: 2), Lock ups → Vehicle 3 (id: 3), Static → Main Office (id: 6)
    const locationByType = {
      "day_shift": 1,    // Vehicle 1
      "night_shift": 2,  // Vehicle 2  
      "lock_ups": 3,     // Vehicle 3
      "static": 6        // Main Office
    };
    
    // Create ~40 keys of each type (160 total keys)
    bunchTypes.forEach(type => {
      const locationId = locationByType[type as keyof typeof locationByType];
      const keysPerType = type === "static" ? 30 : 40; // Fewer static keys since they're building-specific
      
      for (let i = 1; i <= keysPerType; i++) {
        const identifier = `A24-${String(this.currentKeyBunchId).padStart(3, '0')}`;
        const status = Math.random() > 0.95 ? "missing" : Math.random() > 0.85 ? "issued" : "active";
        
        const keyBunch: KeyBunch = {
          id: this.currentKeyBunchId++,
          identifier,
          type,
          currentTag: `TAG-${Math.floor(Math.random() * 90000) + 10000}`,
          locationId,
          status,
          keyCount: Math.floor(Math.random() * 15) + 1, // 1-15 keys per bunch
          fobCount: Math.floor(Math.random() * 5), // 0-4 fobs per bunch
          keyDescription: this.generateKeyDescription(identifier, type),
          notes: null,
          nfcSerial: null,
          lastUpdated: new Date(),
        };
        
        this.keyBunches.set(keyBunch.id, keyBunch);
      }
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Case-insensitive email comparison
    const normalizedEmail = email?.toLowerCase().trim();
    return Array.from(this.users.values()).find(user => user.email?.toLowerCase() === normalizedEmail);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === username);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = { 
      id: (++this.currentUserId).toString(),
      email: insertUser.email?.toLowerCase().trim() || null, // Normalize email to lowercase
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      profileImageUrl: insertUser.profileImageUrl || null,
      role: insertUser.role || "officer",
      permissions: insertUser.permissions || [],
      allowedLocationIds: insertUser.allowedLocationIds || [],
      isActive: insertUser.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = await this.getUser(userData.id);
    
    if (existingUser) {
      return await this.updateUser(userData.id, {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        role: userData.role,
        permissions: userData.permissions,
        allowedLocationIds: userData.allowedLocationIds,
        isActive: userData.isActive,
      }) as User;
    } else {
      const user: User = {
        id: userData.id,
        email: userData.email || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
        role: userData.role || "officer",
        permissions: userData.permissions || [],
        allowedLocationIds: userData.allowedLocationIds || [],
        isActive: userData.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(user.id, user);
      return user;
    }
  }

  // Locations
  async getLocations(): Promise<Location[]> {
    return Array.from(this.locations.values());
  }

  async getLocation(id: number): Promise<Location | undefined> {
    return this.locations.get(id);
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const id = this.currentLocationId++;
    const location: Location = { 
      ...insertLocation, 
      id,
      description: insertLocation.description || null,
      status: insertLocation.status || "active"
    };
    this.locations.set(id, location);
    return location;
  }

  async updateLocation(id: number, updates: Partial<Location>): Promise<Location | undefined> {
    const location = this.locations.get(id);
    if (!location) return undefined;
    
    const updatedLocation = { ...location, ...updates };
    this.locations.set(id, updatedLocation);
    return updatedLocation;
  }

  // Key Bunches
  async getKeyBunches(companyId?: number, includeDeleted = false): Promise<KeyBunchWithLocation[]> {
    let bunches = Array.from(this.keyBunches.values());
    
    // Filter by company if specified
    if (companyId) {
      bunches = bunches.filter(b => b.companyId === companyId);
    }
    
    // Exclude soft-deleted by default
    if (!includeDeleted) {
      bunches = bunches.filter(b => !(b as any).isDeleted);
    }
    
    return bunches.map(bunch => ({
      ...bunch,
      location: this.locations.get(bunch.locationId || 0),
    }));
  }

  async getKeyBunch(id: number, companyId?: number, includeDeleted = false): Promise<KeyBunchWithLocation | undefined> {
    const bunch = this.keyBunches.get(id);
    if (!bunch) return undefined;
    
    // Filter by company if specified
    if (companyId && bunch.companyId !== companyId) return undefined;
    
    // Exclude soft-deleted by default
    if (!includeDeleted && (bunch as any).isDeleted) return undefined;
    
    return {
      ...bunch,
      location: this.locations.get(bunch.locationId || 0),
    };
  }

  async getKeyBunchByIdentifier(identifier: string, companyId?: number, includeDeleted = false): Promise<KeyBunchWithLocation | undefined> {
    let bunch = Array.from(this.keyBunches.values()).find(b => {
      const matchesIdentifier = b.identifier === identifier;
      const matchesCompany = !companyId || b.companyId === companyId;
      const matchesDeletedFilter = includeDeleted || !(b as any).isDeleted;
      return matchesIdentifier && matchesCompany && matchesDeletedFilter;
    });
    
    if (!bunch) return undefined;
    
    return {
      ...bunch,
      location: this.locations.get(bunch.locationId || 0),
    };
  }

  async getKeyBunchByNFC(nfcSerial: string, companyId?: number, includeDeleted = false): Promise<KeyBunch | undefined> {
    return Array.from(this.keyBunches.values()).find(kb => {
      const matchesNFC = kb.nfcSerial === nfcSerial;
      const matchesCompany = !companyId || kb.companyId === companyId;
      const matchesDeletedFilter = includeDeleted || !(kb as any).isDeleted;
      return matchesNFC && matchesCompany && matchesDeletedFilter;
    });
  }

  async createKeyBunch(insertKeyBunch: InsertKeyBunch): Promise<KeyBunch> {
    const id = this.currentKeyBunchId++;
    const keyBunch: KeyBunch = { 
      ...insertKeyBunch, 
      id,
      status: insertKeyBunch.status || "active",
      locationId: insertKeyBunch.locationId || null,
      keyCount: insertKeyBunch.keyCount || 1,
      fobCount: insertKeyBunch.fobCount || 0,
      keyDescription: insertKeyBunch.keyDescription || null,
      notes: insertKeyBunch.notes || null,
      nfcSerial: insertKeyBunch.nfcSerial || null,
      lastUpdated: new Date(),
    };
    this.keyBunches.set(id, keyBunch);
    return keyBunch;
  }

  async updateKeyBunch(id: number, updates: Partial<KeyBunch>): Promise<KeyBunch | undefined> {
    const keyBunch = this.keyBunches.get(id);
    if (!keyBunch) return undefined;
    
    const updatedKeyBunch = { 
      ...keyBunch, 
      ...updates,
      lastUpdated: new Date(),
    };
    this.keyBunches.set(id, updatedKeyBunch);
    return updatedKeyBunch;
  }

  async deleteKeyBunch(id: number, companyId?: number, userId?: string, reason?: string): Promise<void> {
    const keyBunch = this.keyBunches.get(id);
    if (!keyBunch) return;
    
    // Verify company ownership if specified
    if (companyId && keyBunch.companyId !== companyId) return;

    // Soft delete: Mark as deleted instead of removing from memory
    const updatedBunch = {
      ...keyBunch,
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId ? parseInt(userId) : null,
      deletionReason: reason || null,
    };
    this.keyBunches.set(id, updatedBunch as any);
  }

  async getKeyBunchesByLocation(locationId: number, companyId?: number, includeDeleted = false): Promise<KeyBunchWithLocation[]> {
    let bunches = Array.from(this.keyBunches.values()).filter(b => {
      const matchesLocation = b.locationId === locationId;
      const matchesCompany = !companyId || b.companyId === companyId;
      const matchesDeletedFilter = includeDeleted || !(b as any).isDeleted;
      return matchesLocation && matchesCompany && matchesDeletedFilter;
    });
    
    return bunches.map(bunch => ({
      ...bunch,
      location: this.locations.get(bunch.locationId || 0),
    }));
  }

  async getKeyBunchesByType(type: string, companyId?: number, includeDeleted = false): Promise<KeyBunchWithLocation[]> {
    let bunches = Array.from(this.keyBunches.values()).filter(b => {
      const matchesType = b.type === type;
      const matchesCompany = !companyId || b.companyId === companyId;
      const matchesDeletedFilter = includeDeleted || !(b as any).isDeleted;
      return matchesType && matchesCompany && matchesDeletedFilter;
    });
    
    return bunches.map(bunch => ({
      ...bunch,
      location: this.locations.get(bunch.locationId || 0),
    }));
  }

  async checkDuplicateIdentifier(
    identifier: string, 
    type: string, 
    locationId: number | null, 
    companyId: number, 
    excludeId?: number
  ): Promise<boolean> {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    
    const duplicate = Array.from(this.keyBunches.values()).find(bunch => {
      // Skip if this is the same record being updated
      if (excludeId !== undefined && bunch.id === excludeId) {
        return false;
      }
      
      // Skip soft-deleted items
      if ((bunch as any).isDeleted) {
        return false;
      }
      
      // Check if identifier, type, location, and company match
      return (
        bunch.identifier.trim().toLowerCase() === normalizedIdentifier &&
        bunch.type === type &&
        bunch.locationId === locationId &&
        bunch.companyId === companyId
      );
    });
    
    return !!duplicate;
  }

  // Movement History
  async getMovementHistory(limit = 50): Promise<MovementHistoryWithDetails[]> {
    const movements = Array.from(this.movementHistory.values())
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, limit);
    
    return movements.map(movement => {
      // For deleted keys, create a mock keyBunch object from the notes if it doesn't exist
      let keyBunch = movement.keyBunchId ? this.keyBunches.get(movement.keyBunchId) : undefined;
      
      // If keyBunch doesn't exist (deleted) and it's a deletion action, parse from notes
      if (!keyBunch && movement.action === "deleted" && movement.notes) {
        const notesParts = movement.notes.split(' | ');
        const parsedData: any = {};
        
        notesParts.forEach(part => {
          if (part.includes('Key bunch ') && part.includes(' deleted')) {
            parsedData.identifier = part.match(/Key bunch ([A-Z0-9-]+)/)?.[1];
          } else if (part.startsWith('Tag: ')) {
            parsedData.currentTag = part.replace('Tag: ', '').replace('No tag', null);
          } else if (part.startsWith('Keys: ')) {
            const counts = part.match(/Keys: (\d+), Fobs: (\d+)/);
            parsedData.keyCount = counts ? parseInt(counts[1]) : 1;
            parsedData.fobCount = counts ? parseInt(counts[2]) : 0;
          } else if (part.startsWith('Type: ')) {
            parsedData.type = part.replace('Type: ', '');
          } else if (part.startsWith('Description: ')) {
            parsedData.keyDescription = part.replace('Description: ', '');
          } else if (part.startsWith('NFC: ')) {
            parsedData.nfcSerial = part.replace('NFC: ', '');
          }
        });
        
        if (parsedData.identifier) {
          keyBunch = {
            id: movement.keyBunchId || 0,
            identifier: parsedData.identifier,
            type: parsedData.type || 'unknown',
            currentTag: parsedData.currentTag || null,
            keyCount: parsedData.keyCount || 1,
            fobCount: parsedData.fobCount || 0,
            keyDescription: parsedData.keyDescription || null,
            nfcSerial: parsedData.nfcSerial || null,
            locationId: movement.fromLocationId,
            status: 'deleted',
            lastUpdated: movement.timestamp || new Date(),
          };
        }
      }
      
      return {
        ...movement,
        keyBunch: keyBunch,
        fromLocation: this.locations.get(movement.fromLocationId || 0),
        toLocation: this.locations.get(movement.toLocationId || 0),
        user: this.users.get(movement.userId || ''),
      };
    });
  }

  async createMovementHistory(insertMovement: InsertMovementHistory): Promise<MovementHistory> {
    const id = this.currentMovementId++;
    const movement: MovementHistory = { 
      id,
      action: insertMovement.action,
      keyBunchId: insertMovement.keyBunchId || null,
      userId: insertMovement.userId || null,
      fromLocationId: insertMovement.fromLocationId || null,
      toLocationId: insertMovement.toLocationId || null,
      notes: insertMovement.notes || null,
      timestamp: new Date(),
    };
    this.movementHistory.set(id, movement);
    return movement;
  }

  async getKeyBunchMovementHistory(keyBunchId: number): Promise<MovementHistoryWithDetails[]> {
    const movements = Array.from(this.movementHistory.values())
      .filter(m => m.keyBunchId === keyBunchId)
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    
    return movements.map(movement => ({
      ...movement,
      keyBunch: this.keyBunches.get(movement.keyBunchId || 0),
      fromLocation: this.locations.get(movement.fromLocationId || 0),
      toLocation: this.locations.get(movement.toLocationId || 0),
      user: this.users.get(movement.userId || ''),
    }));
  }

  // Audit Sessions
  async getAuditSessions(): Promise<AuditSessionWithDetails[]> {
    const sessions = Array.from(this.auditSessions.values())
      .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());
    
    return sessions.map(session => ({
      ...session,
      user: this.users.get(String(session.performedBy || 0)),
      scans: Array.from(this.auditScans.values()).filter(s => s.auditSessionId === session.id),
    }));
  }

  async getAuditSession(id: number): Promise<AuditSessionWithDetails | undefined> {
    const session = this.auditSessions.get(id);
    if (!session) return undefined;
    
    return {
      ...session,
      user: this.users.get(String(session.performedBy || 0)),
      scans: Array.from(this.auditScans.values()).filter(s => s.auditSessionId === session.id),
    };
  }

  async createAuditSession(insertSession: InsertAuditSession): Promise<AuditSession> {
    const id = this.currentAuditSessionId++;
    const session: AuditSession = { 
      ...insertSession, 
      id,
      performedBy: insertSession.performedBy || null,
      startTime: new Date(),
      endTime: null,
      totalScanned: 0,
      missingBunches: [],
      status: "in_progress",
    };
    this.auditSessions.set(id, session);
    return session;
  }

  async updateAuditSession(id: number, updates: Partial<AuditSession>): Promise<AuditSession | undefined> {
    const session = this.auditSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.auditSessions.set(id, updatedSession);
    return updatedSession;
  }

  async getActiveAuditSession(): Promise<AuditSessionWithDetails | undefined> {
    const activeSession = Array.from(this.auditSessions.values()).find(s => s.status === "in_progress");
    if (!activeSession) return undefined;
    
    return {
      ...activeSession,
      user: this.users.get(String(activeSession.performedBy || 0)),
      scans: Array.from(this.auditScans.values()).filter(s => s.auditSessionId === activeSession.id),
    };
  }

  // Audit Scans
  async createAuditScan(insertScan: InsertAuditScan): Promise<AuditScan> {
    const id = this.currentAuditScanId++;
    const scan: AuditScan = { 
      ...insertScan, 
      id,
      auditSessionId: insertScan.auditSessionId || null,
      keyBunchId: insertScan.keyBunchId || null,
      tagScanned: insertScan.tagScanned || null,
      notes: insertScan.notes || null,
      timestamp: new Date(),
    };
    this.auditScans.set(id, scan);
    return scan;
  }

  async getAuditScans(sessionId: number): Promise<AuditScan[]> {
    return Array.from(this.auditScans.values())
      .filter(s => s.auditSessionId === sessionId)
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  }

  // Dashboard Stats
  async getDashboardStats(companyId?: number): Promise<{
    totalBunches: number;
    statusCounts: { statusId: string; displayName: string; color: string; count: number; }[];
    lastAuditTime: string | null;
  }> {
    // Filter out soft-deleted key bunches
    let bunches = Array.from(this.keyBunches.values()).filter(b => !(b as any).isDeleted);
    
    // Filter by company if specified
    if (companyId) {
      bunches = bunches.filter(b => b.companyId === companyId);
    }
    
    const totalBunches = bunches.length;

    // Get configured statuses from settings
    const settings = await this.getSettings(companyId);
    const configuredStatuses = settings?.statuses || [];

    // Count bunches for each configured status
    const statusCounts = configuredStatuses.map((status: any) => {
      const count = bunches.filter(b => b.status === status.id).length;
      return {
        statusId: status.id,
        displayName: status.displayName,
        color: status.color,
        count,
      };
    });
    
    const lastAudit = Array.from(this.auditSessions.values())
      .filter(s => s.status === "completed")
      .sort((a, b) => new Date(b.endTime || 0).getTime() - new Date(a.endTime || 0).getTime())[0];
    
    const lastAuditTime = lastAudit?.endTime ? new Date(lastAudit.endTime).toISOString() : null;
    
    return {
      totalBunches,
      statusCounts,
      lastAuditTime,
    };
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const log: AuditLog = {
      id: this.currentAuditLogId++,
      companyId: insertLog.companyId || 1,
      action: insertLog.action,
      entityType: insertLog.entityType || null,
      entityId: insertLog.entityId || null,
      keyBunchId: insertLog.keyBunchId || null,
      userId: insertLog.userId || null,
      details: insertLog.details || null,
      ipAddress: insertLog.ipAddress || null,
      userAgent: insertLog.userAgent || null,
      timestamp: new Date(),
    };
    this.auditLogs.set(log.id, log);
    return log;
  }

  async getAuditLogs(limit = 100, keyBunchId?: number): Promise<AuditLog[]> {
    let logs = Array.from(this.auditLogs.values());
    
    if (keyBunchId) {
      logs = logs.filter(log => log.keyBunchId === keyBunchId);
    }
    
    return logs
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, limit);
  }

  async getComprehensiveAuditLogs(filters: {
    companyId: number;
    limit?: number;
    action?: string;
    entityType?: string;
    userId?: number;
    searchTerm?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const { companyId, limit = 100, action, entityType, userId, searchTerm, startDate, endDate } = filters;
    
    let logs = Array.from(this.auditLogs.values());
    
    // SECURITY: Filter by company for multi-tenant data isolation
    logs = logs.filter(log => (log as any).companyId === companyId);
    
    if (action) {
      logs = logs.filter(log => log.action === action);
    }
    
    if (entityType) {
      logs = logs.filter(log => (log as any).entityType === entityType);
    }
    
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      logs = logs.filter(log => 
        log.action?.toLowerCase().includes(searchLower) ||
        log.details?.toLowerCase().includes(searchLower)
      );
    }
    
    if (startDate) {
      logs = logs.filter(log => new Date(log.timestamp || 0) >= startDate);
    }
    
    if (endDate) {
      logs = logs.filter(log => new Date(log.timestamp || 0) <= endDate);
    }
    
    // Sort and limit
    return logs
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, limit)
      .map(log => ({
        ...log,
        user: log.userId ? this.users.get(String(log.userId)) : undefined,
      }));
  }

  // Settings Management - in-memory implementation for MemStorage
  async getSettings(): Promise<any> {
    // Always return the 4 core statuses for all companies
    if (!this.systemSettings.keyTypes) {
      this.systemSettings.keyTypes = [];
    }
    if (!this.systemSettings.statuses || this.systemSettings.statuses.length === 0) {
      this.systemSettings.statuses = DEFAULT_STATUSES;
    }
    if (!this.systemSettings.locationTypes) {
      this.systemSettings.locationTypes = [];
    }
    if (!this.systemSettings.actions) {
      this.systemSettings.actions = [];
    }
    
    const settings = {
      keyTypes: this.systemSettings.keyTypes,
      statuses: this.systemSettings.statuses,
      locationTypes: this.systemSettings.locationTypes,
      actions: this.systemSettings.actions,
    };
    
    console.log("Current systemSettings:", JSON.stringify(this.systemSettings, null, 2));
    return settings;
  }

  async updateSettingCategory(category: string, items: any[]): Promise<any> {
    this.systemSettings[category] = items;
    return await this.getSettings();
  }

  async addSettingItem(category: string, item: any): Promise<any> {
    if (!this.systemSettings[category]) {
      this.systemSettings[category] = [];
    }
    this.systemSettings[category].push(item);
    return await this.getSettings();
  }

  async updateSettingItem(category: string, id: string, updates: any): Promise<any> {
    console.log("Storage updateSettingItem called:", { category, id, updates });
    
    // Ensure category exists and is initialized as empty
    if (!this.systemSettings[category]) {
      console.log("Category doesn't exist, initializing as empty");
      this.systemSettings[category] = [];
    }
    
    const index = this.systemSettings[category].findIndex((item: any) => item.id === id);
    console.log("Found item at index:", index);
    
    if (index !== -1) {
      console.log("Before update:", JSON.stringify(this.systemSettings[category][index], null, 2));
      // Perform the update
      this.systemSettings[category][index] = { 
        ...this.systemSettings[category][index], 
        ...updates 
      };
      console.log("After update:", JSON.stringify(this.systemSettings[category][index], null, 2));
      console.log("Full category after update:", JSON.stringify(this.systemSettings[category], null, 2));
    } else {
      console.log("Item not found, current items:", this.systemSettings[category]);
    }
    
    // Return fresh settings
    return await this.getSettings();
  }

  async deleteSettingItem(category: string, id: string): Promise<any> {
    console.log("Storage deleteSettingItem called:", { category, id });
    if (!this.systemSettings[category]) {
      this.systemSettings[category] = [];
    }
    
    // Check if the item is a default/hardcoded item
    const itemToDelete = this.systemSettings[category].find((item: any) => item.id === id);
    if (itemToDelete?.isDefault) {
      throw new Error("Cannot delete default system items");
    }
    
    const beforeCount = this.systemSettings[category].length;
    this.systemSettings[category] = this.systemSettings[category].filter((item: any) => item.id !== id);
    const afterCount = this.systemSettings[category].length;
    
    console.log("Delete operation:", { beforeCount, afterCount, deleted: beforeCount - afterCount });
    return await this.getSettings();
  }

  // System Settings - placeholder implementation
  async getSystemSettings(): Promise<any> {
    // For now, just return empty object
    return {};
  }

  async updateSystemSettings(settings: any): Promise<any> {
    // For now, just return the settings
    return settings;
  }

  // Saved Reports
  async getSavedReports(companyId?: number): Promise<SavedReport[]> {
    const conditions = [];
    if (companyId) {
      conditions.push(eq(savedReports.companyId, companyId));
    }
    
    const reports = await db
      .select()
      .from(savedReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(savedReports.createdAt));
    
    return reports;
  }

  async getSavedReport(id: number, companyId?: number): Promise<SavedReport | undefined> {
    const conditions = [eq(savedReports.id, id)];
    if (companyId) {
      conditions.push(eq(savedReports.companyId, companyId));
    }
    
    const [report] = await db
      .select()
      .from(savedReports)
      .where(and(...conditions));
    
    return report || undefined;
  }

  async createSavedReport(report: InsertSavedReport): Promise<SavedReport> {
    const [newReport] = await db
      .insert(savedReports)
      .values(report)
      .returning();
    
    return newReport;
  }

  async updateSavedReport(id: number, updates: Partial<SavedReport>, companyId?: number): Promise<SavedReport | undefined> {
    const conditions = [eq(savedReports.id, id)];
    if (companyId) {
      conditions.push(eq(savedReports.companyId, companyId));
    }
    
    const [updatedReport] = await db
      .update(savedReports)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    
    return updatedReport || undefined;
  }

  async deleteSavedReport(id: number, companyId?: number): Promise<void> {
    const conditions = [eq(savedReports.id, id)];
    if (companyId) {
      conditions.push(eq(savedReports.companyId, companyId));
    }
    
    await db
      .delete(savedReports)
      .where(and(...conditions));
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(companies.name);
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async updateCompany(id: number, updates: Partial<Company>): Promise<Company | undefined> {
    const [updated] = await db
      .update(companies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updated;
  }

  async getCompanyModules(companyId: number): Promise<CompanyModule[]> {
    return await db
      .select()
      .from(companyModules)
      .where(eq(companyModules.companyId, companyId));
  }

  async setCompanyModule(
    companyId: number,
    moduleId: string,
    isEnabled: boolean,
    enabledBy?: number,
    notes?: string,
  ): Promise<CompanyModule> {
    const existing = await db
      .select()
      .from(companyModules)
      .where(and(eq(companyModules.companyId, companyId), eq(companyModules.moduleId, moduleId)));

    if (existing.length > 0) {
      const [updated] = await db
        .update(companyModules)
        .set({
          isEnabled,
          enabledAt: isEnabled ? new Date() : existing[0].enabledAt,
          enabledBy: enabledBy ?? existing[0].enabledBy,
          notes: notes ?? existing[0].notes,
        })
        .where(and(eq(companyModules.companyId, companyId), eq(companyModules.moduleId, moduleId)))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(companyModules)
      .values({
        companyId,
        moduleId,
        isEnabled,
        enabledAt: isEnabled ? new Date() : undefined,
        enabledBy,
        notes,
      })
      .returning();
    return created;
  }

  async getPolicies(companyId: number): Promise<Policy[]> {
    return await db.select().from(policies).where(eq(policies.companyId, companyId)).orderBy(desc(policies.createdAt));
  }

  async getPoliciesForUser(userId: number, companyId: number): Promise<Policy[]> {
    const perms = await db.select({ policyId: policyPermissions.policyId }).from(policyPermissions).where(and(eq(policyPermissions.userId, userId), eq(policyPermissions.companyId, companyId)));
    const ids = perms.map(p => p.policyId);
    if (ids.length === 0) return [];
    return await db.select().from(policies).where(and(eq(policies.companyId, companyId), inArray(policies.id, ids))).orderBy(desc(policies.createdAt));
  }

  async getPolicy(id: number, companyId: number): Promise<Policy | undefined> {
    const [policy] = await db.select().from(policies).where(and(eq(policies.id, id), eq(policies.companyId, companyId)));
    return policy;
  }

  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    const [created] = await db.insert(policies).values(policy).returning();
    return created;
  }

  async deletePolicy(id: number, companyId: number): Promise<void> {
    await db.delete(policies).where(and(eq(policies.id, id), eq(policies.companyId, companyId)));
  }

  async getUserPolicyIds(userId: number, companyId: number): Promise<number[]> {
    const rows = await db.select({ policyId: policyPermissions.policyId }).from(policyPermissions).where(and(eq(policyPermissions.userId, userId), eq(policyPermissions.companyId, companyId)));
    return rows.map(r => r.policyId);
  }

  async setPolicyPermissions(userId: number, companyId: number, policyIds: number[]): Promise<void> {
    await db.delete(policyPermissions).where(and(eq(policyPermissions.userId, userId), eq(policyPermissions.companyId, companyId)));
    if (policyIds.length > 0) {
      await db.insert(policyPermissions).values(policyIds.map(policyId => ({ policyId, userId, companyId })));
    }
  }

  async getReportTemplates(): Promise<any[]> { throw new Error("Not implemented in MemStorage"); }
  async getReportTemplate(): Promise<any> { throw new Error("Not implemented"); }
  async getReportTemplatesForUser(): Promise<any[]> { throw new Error("Not implemented"); }
  async createReportTemplate(): Promise<any> { throw new Error("Not implemented"); }
  async updateReportTemplate(): Promise<any> { throw new Error("Not implemented"); }
  async deleteReportTemplate(): Promise<void> { throw new Error("Not implemented"); }
  async getReportTemplatePermissions(): Promise<any[]> { throw new Error("Not implemented"); }
  async setReportTemplatePermissions(): Promise<void> { throw new Error("Not implemented"); }
  async getUserReportPermissions(): Promise<any[]> { throw new Error("Not implemented"); }
  async createReportSubmission(): Promise<any> { throw new Error("Not implemented"); }
  async getReportSubmissions(): Promise<any[]> { throw new Error("Not implemented"); }
  async getReportSubmission(): Promise<any> { throw new Error("Not implemented"); }
  async deleteReportSubmission(): Promise<void> { throw new Error("Not implemented"); }
  async getAssignmentTemplateSections(companyId: number): Promise<AssignmentTemplateSection[]> { throw new Error("Not implemented in MemStorage"); }
  async createAssignmentTemplateSection(data: any): Promise<AssignmentTemplateSection> { throw new Error("Not implemented"); }
  async updateAssignmentTemplateSection(id: number, companyId: number, updates: any): Promise<AssignmentTemplateSection | undefined> { throw new Error("Not implemented"); }
  async deleteAssignmentTemplateSection(id: number, companyId: number): Promise<void> { throw new Error("Not implemented"); }
  async reorderAssignmentTemplateSections(companyId: number, orderedIds: number[]): Promise<void> { throw new Error("Not implemented"); }
  async syncTemplateSectionToAllAssignments(sectionId: number, companyId: number): Promise<void> { throw new Error("Not implemented"); }
  async getOrCreateLocationAssignment(companyId: number, identifier: string, address: string): Promise<LocationAssignment> { throw new Error("Not implemented"); }
  async getAssignmentWithValues(companyId: number, identifier: string, address: string): Promise<any> { throw new Error("Not implemented"); }
  async saveAssignmentValues(assignmentId: number, companyId: number, values: any[]): Promise<void> { throw new Error("Not implemented"); }
  async logAssignmentChange(entry: any): Promise<void> { throw new Error("Not implemented"); }
  async getAssignmentAuditLog(assignmentId: number, companyId: number): Promise<AssignmentAuditLogEntry[]> { throw new Error("Not implemented"); }
  async createCustomerUser(data: any): Promise<CustomerUser> { throw new Error("Not implemented"); }
  async getCustomerUser(id: number, companyId: number): Promise<CustomerUser | undefined> { throw new Error("Not implemented"); }
  async getCustomerUserByEmail(email: string): Promise<CustomerUser | undefined> { throw new Error("Not implemented"); }
  async getCustomerUserByInviteToken(token: string): Promise<CustomerUser | undefined> { throw new Error("Not implemented"); }
  async updateCustomerUser(id: number, updates: any): Promise<CustomerUser | undefined> { throw new Error("Not implemented"); }
  async deleteCustomerUser(id: number, companyId: number): Promise<void> { throw new Error("Not implemented"); }
  async listCustomerUsers(companyId: number): Promise<any[]> { throw new Error("Not implemented"); }
  async setCustomerLocationAccess(customerId: number, companyId: number, assignmentIds: number[]): Promise<void> { throw new Error("Not implemented"); }
  async getCustomerAssignmentIds(customerId: number, companyId: number): Promise<number[]> { throw new Error("Not implemented"); }
  async getCustomerLocationIds(customerId: number, companyId: number): Promise<number[]> { throw new Error("Not implemented"); }
  async createCustomerSession(customerId: number, companyId: number): Promise<string> { throw new Error("Not implemented"); }
  async getCustomerSession(token: string): Promise<any> { throw new Error("Not implemented"); }
  async deleteCustomerSession(token: string): Promise<void> { throw new Error("Not implemented"); }
  async getAssignmentPassword(companyId: number): Promise<string | null> { throw new Error("Not implemented"); }
  async setAssignmentPassword(companyId: number, passwordHash: string): Promise<void> { throw new Error("Not implemented"); }
}

export const storage = new DatabaseStorage();
