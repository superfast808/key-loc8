import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Companies table for multi-tenant support
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug").notNull().unique(), // URL-friendly company identifier
  adminEmail: varchar("admin_email"), // Admin email for company setup
  planType: varchar("plan_type").notNull().default("basic"), // "demo", "basic", "professional", "enterprise"
  isActive: boolean("is_active").default(true),
  settings: jsonb("settings").default({}), // Company-specific settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  password: varchar("password"), // Password for authentication
  profileImageUrl: varchar("profile_image_url"),
  companyId: integer("company_id").references(() => companies.id), // Link to company for multi-tenant support
  role: varchar("role").notNull().default("officer"), // "super_admin", "admin", "officer", "viewer"
  permissions: text("permissions").array().default([]), // Array of permission strings
  customPermissions: text("custom_permissions").array().default([]), // Override permissions
  allowedLocationIds: integer("allowed_location_ids").array().default([]), // Locations the user is explicitly granted access to. Empty = no access (super admin bypasses).
  allowedSections: text("allowed_sections").array().default([]),           // Sections an officer is explicitly granted access to. Empty = no access (admin/super admin bypass).

  mobilePhone: varchar("mobile_phone"),        // Mobile number for 2FA SMS
  twoFactorEnabled: boolean("two_factor_enabled").default(false), // Whether 2FA is required on login

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Password reset tokens — one-time use, short-lived links emailed to users
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Locations table (vans and offices)
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(), // Multi-tenant isolation
  name: text("name").notNull(),
  type: text("type").notNull(), // "vehicle" | "office" | "building" | "workshop" | "depot"
  description: text("description"),
  color: varchar("color").default("#3b82f6"), // Color for location badge display
  status: text("status").notNull().default("active"), // "active" | "inactive"
});

// Key bunches table
export const keyBunches = pgTable("key_bunches", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(), // Multi-tenant isolation
  identifier: text("identifier").notNull(), // A24-001, etc. - removed unique constraint to allow same ID at different locations
  type: text("type").notNull(), // Configurable key types for different business needs
  currentTag: text("current_tag"), // Tags must be unique within company when provided
  nfcSerial: text("nfc_serial"), // NFC tag serial number - unique within company
  locationId: integer("location_id").references(() => locations.id),
  status: text("status").notNull().default("active"), // "active" | "issued" | "missing"
  keyCount: integer("key_count").notNull().default(1), // Number of keys in this bunch
  fobCount: integer("fob_count").notNull().default(0), // Number of fobs in this bunch
  keyDescription: text("key_description"), // Description of what the keys unlock
  address: text("address"), // Physical address associated with the keys
  notes: text("notes"), // Additional notes about the key bunch
  imageUrl: text("image_url"), // URL to uploaded image of the key bunch
  imageUpdatedAt: timestamp("image_updated_at"), // When the image was last updated
  documentUrl: text("document_url"), // Base64 encrypted document (PDF/Word)
  documentName: text("document_name"), // Original filename of the document
  documentType: text("document_type"), // MIME type (application/pdf, etc.)
  documentUploadedAt: timestamp("document_uploaded_at"), // When the document was uploaded
  lastUpdated: timestamp("last_updated").defaultNow(),
  isDeleted: boolean("is_deleted").default(false).notNull(), // Soft delete flag
  deletedAt: timestamp("deleted_at"), // When the key bunch was deleted
  deletedBy: integer("deleted_by").references(() => users.id), // Who deleted the key bunch
  deletionReason: text("deletion_reason"), // Reason for deletion
});

// Movement history table
export const movementHistory = pgTable("movement_history", {
  id: serial("id").primaryKey(),
  keyBunchId: integer("key_bunch_id").references(() => keyBunches.id, { onDelete: "set null" }),
  fromLocationId: integer("from_location_id").references(() => locations.id),
  toLocationId: integer("to_location_id").references(() => locations.id),
  fromBunchType: text("from_bunch_type"),
  toBunchType: text("to_bunch_type"),
  actionType: text("action_type"),
  oldTag: text("old_tag"),
  newTag: text("new_tag"),
  performedBy: integer("performed_by").references(() => users.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  notes: text("notes"),
  companyId: integer("company_id").references(() => companies.id).notNull(),
});

// Audit sessions table
export const auditSessions = pgTable("audit_sessions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(), // Multi-tenant isolation
  performedBy: integer("performed_by").references(() => users.id), // User ID reference
  locationId: integer("location_id").references(() => locations.id), // Which location was audited
  keyType: text("key_type"), // Optional filter for specific key types
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  totalExpected: integer("total_expected").notNull(),
  totalScanned: integer("total_scanned").notNull().default(0),
  missingBunches: text("missing_bunches").array(),
  status: text("status").notNull().default("in_progress"), // "in_progress" | "completed" | "paused"
  notes: text("notes"), // Audit notes
});

// Audit scans table (individual scans during audit)
export const auditScans = pgTable("audit_scans", {
  id: serial("id").primaryKey(),
  auditSessionId: integer("audit_session_id").references(() => auditSessions.id),
  keyBunchId: integer("key_bunch_id").references(() => keyBunches.id),
  nfcScanned: text("nfc_scanned"), // NFC serial number scanned
  tagScanned: text("tag_scanned"), // Plastic tag scanned (fallback)
  scanResult: text("scan_result").notNull(), // "success" | "error" | "mismatch"
  timestamp: timestamp("timestamp").defaultNow(),
  notes: text("notes"),
});

// Saved reports table (custom location reports)
export const savedReports = pgTable("saved_reports", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(), // Multi-tenant isolation
  name: text("name").notNull(), // Report name
  description: text("description"), // Optional description
  reportConfig: jsonb("report_config").notNull(), // Report configuration (columns, filters, etc.)
  createdBy: integer("created_by").references(() => users.id).notNull(), // User who created the report
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isDefault: boolean("is_default").default(false), // System-provided default reports
});

// ══════════════════════════════════════════════════════════════════
// LONE WORKING MODULE
// ══════════════════════════════════════════════════════════════════

// Jobs / Post types: "Night Shift Mobile Patrol", "145 St Vincent St Static", etc.
export const lwJobs = pgTable("lw_jobs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  jobType: varchar("job_type").notNull().default("mobile"), // "mobile" | "static"
  locationId: integer("location_id").references(() => locations.id), // Required for static jobs
  color: varchar("color").default("#3b82f6"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  deputyAreaId: integer("deputy_area_id"), // Deputy OperationalUnit ID for dedup sync
});

// Which employees are assigned to which jobs
export const lwAssignments = pgTable("lw_assignments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  jobId: integer("job_id").references(() => lwJobs.id).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: integer("assigned_by").references(() => users.id),
});

// Phone contacts — Deputy-synced employees + manually added manager/emergency contacts
// NOTE: defined before lwShifts so lwShifts can reference it
export const lwContacts = pgTable("lw_contacts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  userId: integer("user_id").references(() => users.id), // nullable — Deputy-synced people may not have a login
  contactType: varchar("contact_type").notNull().default("employee"), // "employee" | "manager" | "emergency"
  name: text("name").notNull(),
  phone: varchar("phone").notNull().default(""),
  email: varchar("email"),
  isActive: boolean("is_active").default(true).notNull(),
  alertEnabled: boolean("alert_enabled").default(true).notNull(), // if false, no calls/SMS sent when this person misses check-in
  deputyEmployeeId: integer("deputy_employee_id"), // Deputy Employee ID for dedup sync
});

// Scheduled shifts — employee + job + time window
// userId OR contactId must be set (but not necessarily both)
export const lwShifts = pgTable("lw_shifts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  jobId: integer("job_id").references(() => lwJobs.id).notNull(),
  userId: integer("user_id").references(() => users.id),         // set when employee has a keylocate login
  contactId: integer("contact_id").references(() => lwContacts.id), // set when employee is Deputy-only (no login)
  scheduledStart: timestamp("scheduled_start").notNull(),
  scheduledEnd: timestamp("scheduled_end").notNull(),
  notes: text("notes"),
  status: varchar("status").default("pending").notNull(), // "pending" | "active" | "completed" | "missed" | "cancelled"
  alertSent: boolean("alert_sent").default(false).notNull(), // Whether all alerts (employee + manager) have been fired
  employeeAlertAt: timestamp("employee_alert_at"),            // When the employee was first alerted (phase 1)
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  deputyShiftId: integer("deputy_shift_id"), // Deputy roster ID for dedup
  deputySynced: boolean("deputy_synced").default(false), // Whether imported from Deputy
});

// Actual clock-in / clock-out records
export const lwCheckIns = pgTable("lw_check_ins", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  jobId: integer("job_id").references(() => lwJobs.id).notNull(),
  shiftId: integer("shift_id").references(() => lwShifts.id), // Linked shift (optional — ad-hoc check-ins allowed)
  checkInTime: timestamp("check_in_time").defaultNow().notNull(),
  checkOutTime: timestamp("check_out_time"),
  checkInLat: text("check_in_lat"),
  checkInLng: text("check_in_lng"),
  checkOutLat: text("check_out_lat"),
  checkOutLng: text("check_out_lng"),
  status: varchar("status").default("checked_in").notNull(), // "checked_in" | "checked_out"
  notes: text("notes"),
});

// Alert records — missed check-ins, welfare checks, SOS
export const lwAlerts = pgTable("lw_alerts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  userId: integer("user_id").references(() => users.id),    // nullable — set when employee has a keylocate login
  contactId: integer("contact_id").references(() => lwContacts.id), // set when employee is Deputy-only
  shiftId: integer("shift_id").references(() => lwShifts.id),
  alertType: varchar("alert_type").notNull(), // "missed_checkin" | "welfare_check" | "sos"
  alertTime: timestamp("alert_time").defaultNow().notNull(),
  message: text("message"),
  status: varchar("status").default("pending").notNull(), // "pending" | "calling" | "acknowledged" | "resolved"
  callSid: text("call_sid"), // Twilio call SID for tracking
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => users.id),
});

// Company modules table — tracks which platform modules each company has subscribed to
export const companyModules = pgTable("company_modules", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  moduleId: varchar("module_id").notNull(), // e.g. "keylocate", "lone_working"
  isEnabled: boolean("is_enabled").default(false).notNull(),
  enabledAt: timestamp("enabled_at"),
  enabledBy: integer("enabled_by").references(() => users.id),
  notes: text("notes"), // Optional subscription notes / tier info
});

// Archived key bunches table (for deleted keys with full audit trail)
export const archivedKeyBunches = pgTable("archived_key_bunches", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id").notNull(), // Original key bunch ID
  identifier: text("identifier").notNull(),
  type: text("type").notNull(),
  currentTag: text("current_tag").notNull(),
  nfcSerial: text("nfc_serial"),
  locationId: integer("location_id"),
  locationName: text("location_name"), // Store location name at time of deletion
  status: text("status").notNull(),
  keyCount: integer("key_count").notNull(),
  fobCount: integer("fob_count").notNull(),
  keyDescription: text("key_description"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull(), // Original creation time
  lastUpdated: timestamp("last_updated").notNull(), // Last update before deletion
  deletedAt: timestamp("deleted_at").notNull().defaultNow(), // Deletion timestamp
  deletedBy: varchar("deleted_by").notNull(), // User who deleted it
  deletionReason: text("deletion_reason"), // Optional reason for deletion
});

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
  permissions: true,
  allowedLocationIds: true,
  isActive: true,
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
  permissions: true,
  allowedLocationIds: true,
  isActive: true,
});

// Company schemas
export const insertCompanySchema = createInsertSchema(companies).pick({
  name: true,
  slug: true,
  planType: true,
  settings: true,
});

// Location schema - companyId is optional (injected by backend from session)
export const insertLocationSchema = createInsertSchema(locations).pick({
  companyId: true,
  name: true,
  type: true,
  description: true,
  color: true,
}).partial({ companyId: true });

// Key Bunch schema - companyId is optional (injected by backend from session)
export const insertKeyBunchSchema = createInsertSchema(keyBunches).pick({
  companyId: true,
  identifier: true,
  type: true,
  currentTag: true,
  nfcSerial: true,
  locationId: true,
  status: true,
  keyCount: true,
  fobCount: true,
  keyDescription: true,
  address: true,
  notes: true,
  imageUrl: true,
}).partial({ companyId: true });

// Movement History schema - companyId is optional (injected by backend from session)
export const insertMovementHistorySchema = createInsertSchema(movementHistory).pick({
  companyId: true,
  keyBunchId: true,
  performedBy: true,
  actionType: true,
  fromLocationId: true,
  toLocationId: true,
  fromBunchType: true,
  toBunchType: true,
  oldTag: true,
  newTag: true,
  notes: true,
}).partial({ companyId: true });

// Audit Session schema - companyId is optional (injected by backend from session)
export const insertAuditSessionSchema = createInsertSchema(auditSessions).pick({
  companyId: true,
  performedBy: true,
  locationId: true,
  keyType: true,
  totalExpected: true,
  notes: true,
}).partial({ companyId: true });

export const insertAuditScanSchema = createInsertSchema(auditScans).pick({
  auditSessionId: true,
  keyBunchId: true,
  nfcScanned: true,
  tagScanned: true,
  scanResult: true,
  notes: true,
});

export const insertSavedReportSchema = createInsertSchema(savedReports).pick({
  companyId: true,
  name: true,
  description: true,
  reportConfig: true,
  createdBy: true,
}).partial({ companyId: true });

// Types
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

export type InsertKeyBunch = z.infer<typeof insertKeyBunchSchema>;
export type KeyBunch = typeof keyBunches.$inferSelect;

export type InsertMovementHistory = z.infer<typeof insertMovementHistorySchema>;
export type MovementHistory = typeof movementHistory.$inferSelect;

export type InsertAuditSession = z.infer<typeof insertAuditSessionSchema>;
export type AuditSession = typeof auditSessions.$inferSelect;

export type InsertAuditScan = z.infer<typeof insertAuditScanSchema>;
export type AuditScan = typeof auditScans.$inferSelect;

export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;
export type SavedReport = typeof savedReports.$inferSelect;

// Comprehensive Audit Log schema for tracking ALL application actions
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  action: text("action").notNull(), // e.g., "user_login", "key_created", "location_updated", "setting_changed"
  entityType: text("entity_type"), // e.g., "user", "key_bunch", "location", "setting", "audit_session"
  entityId: integer("entity_id"), // ID of the affected entity
  userId: integer("user_id").references(() => users.id), // Who performed the action
  keyBunchId: integer("key_bunch_id"), // For backwards compatibility with key-specific actions
  details: text("details"), // JSON string with action details
  ipAddress: text("ip_address"), // For security tracking
  userAgent: text("user_agent"), // For device tracking
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLog).pick({
  companyId: true,
  action: true,
  entityType: true,
  entityId: true,
  userId: true,
  keyBunchId: true,
  details: true,
  ipAddress: true,
  userAgent: true,
}).partial({ companyId: true, ipAddress: true, userAgent: true });

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;

// Lone Working insert schemas
export const insertLwJobSchema = createInsertSchema(lwJobs).pick({
  companyId: true, name: true, description: true, jobType: true, locationId: true, color: true, isActive: true,
}).partial({ companyId: true, description: true, locationId: true, color: true });

export const insertLwAssignmentSchema = createInsertSchema(lwAssignments).pick({
  companyId: true, userId: true, jobId: true, isActive: true, assignedBy: true,
}).partial({ companyId: true, assignedBy: true });

export const insertLwShiftSchema = createInsertSchema(lwShifts).pick({
  companyId: true, jobId: true, userId: true, scheduledStart: true, scheduledEnd: true, notes: true, createdBy: true,
}).partial({ companyId: true, notes: true, createdBy: true });

export const insertLwCheckInSchema = createInsertSchema(lwCheckIns).pick({
  companyId: true, userId: true, jobId: true, shiftId: true, checkInLat: true, checkInLng: true, notes: true,
}).partial({ companyId: true, shiftId: true, checkInLat: true, checkInLng: true, notes: true });

export const insertLwContactSchema = createInsertSchema(lwContacts).pick({
  companyId: true, userId: true, contactType: true, name: true, phone: true, isActive: true,
}).partial({ companyId: true, contactType: true, isActive: true });

export const insertLwAlertSchema = createInsertSchema(lwAlerts).pick({
  companyId: true, userId: true, shiftId: true, alertType: true, message: true,
}).partial({ companyId: true, shiftId: true, message: true });

export type InsertLwJob = z.infer<typeof insertLwJobSchema>;
export type LwJob = typeof lwJobs.$inferSelect;
export type InsertLwAssignment = z.infer<typeof insertLwAssignmentSchema>;
export type LwAssignment = typeof lwAssignments.$inferSelect;
export type InsertLwShift = z.infer<typeof insertLwShiftSchema>;
export type LwShift = typeof lwShifts.$inferSelect;
export type InsertLwCheckIn = z.infer<typeof insertLwCheckInSchema>;
export type LwCheckIn = typeof lwCheckIns.$inferSelect;
export type InsertLwContact = z.infer<typeof insertLwContactSchema>;
export type LwContact = typeof lwContacts.$inferSelect;
export type InsertLwAlert = z.infer<typeof insertLwAlertSchema>;
export type LwAlert = typeof lwAlerts.$inferSelect;

export const insertCompanyModuleSchema = createInsertSchema(companyModules).pick({
  companyId: true,
  moduleId: true,
  isEnabled: true,
  enabledBy: true,
  notes: true,
}).partial({ enabledBy: true, notes: true });

export type InsertCompanyModule = z.infer<typeof insertCompanyModuleSchema>;
export type CompanyModule = typeof companyModules.$inferSelect;

export const insertArchivedKeyBunchSchema = createInsertSchema(archivedKeyBunches).pick({
  originalId: true,
  identifier: true,
  type: true,
  currentTag: true,
  nfcSerial: true,
  locationId: true,
  locationName: true,
  status: true,
  keyCount: true,
  fobCount: true,
  keyDescription: true,
  notes: true,
  createdAt: true,
  lastUpdated: true,
  deletedBy: true,
  deletionReason: true,
});

export type InsertArchivedKeyBunch = z.infer<typeof insertArchivedKeyBunchSchema>;
export type ArchivedKeyBunch = typeof archivedKeyBunches.$inferSelect;

// ─── Uniform & Equipment Module ──────────────────────────────────────────────

// Catalogue of all item types a company stocks
export const uniformCatalogue = pgTable("uniform_catalogue", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // "uniform" | "equipment"
  hasSizes: boolean("has_sizes").default(false).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Stock levels per catalogue item + optional size variant
export const uniformStock = pgTable("uniform_stock", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  catalogueId: integer("catalogue_id").references(() => uniformCatalogue.id).notNull(),
  size: varchar("size"),                                  // null when hasSizes=false
  totalQuantity: integer("total_quantity").default(0).notNull(),
  quantityInStock: integer("quantity_in_stock").default(0).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(),
});

// One issue event (can contain multiple items)
export const uniformIssues = pgTable("uniform_issues", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  employeeId: integer("employee_id").references(() => users.id),   // null for non-login employees
  employeeName: varchar("employee_name").notNull(),
  employeeNumber: varchar("employee_number"),
  jobTitle: varchar("job_title"),
  department: varchar("department"),
  reason: varchar("reason").notNull(),  // "new_starter"|"new_item"|"replacement"|"temporary_loan"|"other"
  reasonOther: text("reason_other"),
  employeeSignature: text("employee_signature"),           // base64 PNG data URL
  issuedBy: integer("issued_by").references(() => users.id).notNull(),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  notes: text("notes"),
});

// Individual items inside a single issue event
export const uniformIssueItems = pgTable("uniform_issue_items", {
  id: serial("id").primaryKey(),
  issueId: integer("issue_id").references(() => uniformIssues.id).notNull(),
  stockId: integer("stock_id").references(() => uniformStock.id).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  // Return tracking (per line-item)
  returnedQty: integer("returned_qty").default(0).notNull(),
  returnedAt: timestamp("returned_at"),
  managerSignature: text("manager_signature"),             // base64 PNG on return
  returnedBy: integer("returned_by").references(() => users.id),
  returnNotes: text("return_notes"),
});

// Insert schemas
export const insertUniformCatalogueSchema = createInsertSchema(uniformCatalogue).omit({ id: true, createdAt: true });
export const insertUniformStockSchema = createInsertSchema(uniformStock).omit({ id: true });
export const insertUniformIssueSchema = createInsertSchema(uniformIssues).omit({ id: true, issuedAt: true });
export const insertUniformIssueItemSchema = createInsertSchema(uniformIssueItems).omit({ id: true });

export type UniformCatalogue = typeof uniformCatalogue.$inferSelect;
export type UniformStock = typeof uniformStock.$inferSelect;
export type UniformIssue = typeof uniformIssues.$inferSelect;
export type UniformIssueItem = typeof uniformIssueItems.$inferSelect;
export type InsertUniformCatalogue = z.infer<typeof insertUniformCatalogueSchema>;
export type InsertUniformStock = z.infer<typeof insertUniformStockSchema>;
export type InsertUniformIssue = z.infer<typeof insertUniformIssueSchema>;
export type InsertUniformIssueItem = z.infer<typeof insertUniformIssueItemSchema>;

// ─── Policies ────────────────────────────────────────────────────────────────

export const policies = pgTable("policies", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  fileData: text("file_data").notNull(),   // base64 encoded file
  fileName: text("file_name").notNull(),   // original filename e.g. "fire-policy.pdf"
  fileType: text("file_type").notNull(),   // MIME type e.g. "application/pdf"
  fileSize: integer("file_size"),          // bytes
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction table: which users can see which policy
export const policyPermissions = pgTable("policy_permissions", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").references(() => policies.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
});

export const insertPolicySchema = createInsertSchema(policies).omit({ id: true, createdAt: true });
export const insertPolicyPermissionSchema = createInsertSchema(policyPermissions).omit({ id: true });

export type Policy = typeof policies.$inferSelect;
export type PolicyPermission = typeof policyPermissions.$inferSelect;
export type InsertPolicy = z.infer<typeof insertPolicySchema>;

// ─── Reports Module ──────────────────────────────────────────────────────────

// Field types supported by the report builder
export type ReportFieldType =
  | "heading"
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "dropdown"
  | "checkbox"
  | "image";

// A single field within a report template (stored inside the template's `fields` JSONB)
export interface ReportField {
  id: string;                 // stable client-generated id (uuid-ish)
  type: ReportFieldType;
  label: string;
  required?: boolean;
  options?: string[];         // for dropdown
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  // Conditional follow-up text boxes. Per-option config keyed by the option value.
  // For "dropdown": key = option string. For "checkbox": key = "true" (only triggered when ticked).
  // If a key is present, a follow-up text box appears for that option with its own prompt + required flag.
  followUps?: Record<string, { label?: string; required?: boolean }>;

  // Legacy single-prompt fields — kept for backward compatibility with existing templates.
  followUpTriggers?: string[];
  followUpLabel?: string;
  followUpRequired?: boolean;
}

// Submission stores follow-up answers under this suffixed key
export const FOLLOWUP_KEY = (fieldId: string) => `${fieldId}__followup`;

// Submitted value for a single field (stored inside submission's `data` JSONB, keyed by fieldId)
export type ReportFieldValue = string | number | boolean | null;

// Report templates — admin-defined custom forms
export const reportTemplates = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  fields: jsonb("fields").notNull().default([]).$type<ReportField[]>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Per-user permissions on a template — who can fill it and who can view submissions
export const reportTemplatePermissions = pgTable("report_template_permissions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => reportTemplates.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  canFill: boolean("can_fill").default(false).notNull(),
  canView: boolean("can_view").default(false).notNull(),
});

// Submitted reports — a completed instance of a template
export const reportSubmissions = pgTable("report_submissions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => reportTemplates.id, { onDelete: "cascade" }).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  submittedBy: integer("submitted_by").references(() => users.id).notNull(),
  data: jsonb("data").notNull().default({}).$type<Record<string, ReportFieldValue>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReportTemplatePermissionSchema = createInsertSchema(reportTemplatePermissions).omit({ id: true });
export const insertReportSubmissionSchema = createInsertSchema(reportSubmissions).omit({ id: true, createdAt: true });

export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type ReportTemplatePermission = typeof reportTemplatePermissions.$inferSelect;
export type ReportSubmission = typeof reportSubmissions.$inferSelect;
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;
export type InsertReportTemplatePermission = z.infer<typeof insertReportTemplatePermissionSchema>;
export type InsertReportSubmission = z.infer<typeof insertReportSubmissionSchema>;

// ─── Assignment Instructions Module ──────────────────────────────────────────

// Template sections — company-wide definition of the assignment form structure
export const assignmentTemplateSections = pgTable("assignment_template_sections", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  type: text("type").notNull(), // "heading" | "text_input" | "textarea" | "dropdown" | "image" | "divider"
  label: text("label").notNull(),
  options: text("options").array(), // for dropdown: list of choices
  required: boolean("required").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// One assignment record per key bunch (keyed by identifier + address, deduplicated across shift types)
export const locationAssignments = pgTable("location_assignments", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => locations.id), // nullable — legacy
  companyId: integer("company_id").references(() => companies.id).notNull(),
  keyBunchIdentifier: text("key_bunch_identifier"), // e.g. "2" or "A24-001"
  keyBunchAddress: text("key_bunch_address"),       // e.g. "Wellpark, 120 Sydney Street, Glasgow"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Content values for each template section at each location
export const assignmentSectionValues = pgTable("assignment_section_values", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").references(() => locationAssignments.id).notNull(),
  sectionId: integer("section_id").references(() => assignmentTemplateSections.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  value: text("value"), // text / dropdown selection
  imageData: text("image_data"), // base64 for image sections
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audit log for assignment changes
export const assignmentAuditLog = pgTable("assignment_audit_log", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").references(() => locationAssignments.id).notNull(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  editorType: text("editor_type").notNull(), // "staff" | "customer"
  editorId: integer("editor_id").notNull(), // user.id or customerUser.id
  editorName: text("editor_name").notNull(),
  changes: jsonb("changes").notNull(), // [{sectionLabel, oldValue, newValue}]
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Customer portal users (completely separate from staff users)
export const customerUsers = pgTable("customer_users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  email: varchar("email").notNull().unique(),
  passwordHash: varchar("password_hash"),
  name: varchar("name"),
  inviteToken: varchar("invite_token"),
  inviteTokenExpiry: timestamp("invite_token_expiry"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Which assignment documents each customer can access (keyed by assignment_id)
export const customerLocationAccess = pgTable("customer_location_access", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customerUsers.id, { onDelete: "cascade" }).notNull(),
  locationId: integer("location_id").references(() => locations.id), // legacy — kept nullable
  assignmentId: integer("assignment_id").references(() => locationAssignments.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id).notNull(),
});

// Customer sessions (simple token-based auth)
// Company data backups — daily snapshots per company
export const companyBackups = pgTable("company_backups", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  triggeredBy: varchar("triggered_by").default("scheduled"), // "scheduled" | "manual"
  sizeBytes: integer("size_bytes"),
  recordCounts: text("record_counts"), // JSON string of {users: N, keys: N, ...}
  data: text("data").notNull(), // Full JSON snapshot of company data
});

export const customerSessions = pgTable("customer_sessions", {
  token: varchar("token").primaryKey(),
  customerId: integer("customer_id").references(() => customerUsers.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Insert/select types
export type AssignmentTemplateSection = typeof assignmentTemplateSections.$inferSelect;
export type LocationAssignment = typeof locationAssignments.$inferSelect;
export type AssignmentSectionValue = typeof assignmentSectionValues.$inferSelect;
export type AssignmentAuditLogEntry = typeof assignmentAuditLog.$inferSelect;
export type CustomerUser = typeof customerUsers.$inferSelect;
export type CustomerLocationAccess = typeof customerLocationAccess.$inferSelect;

// ─── Extended types for API responses
export type KeyBunchWithLocation = KeyBunch & {
  location?: Location;
  // Present on LIST responses, which exclude the heavy base64 blobs
  // (imageUrl/documentUrl are null there) and expose these flags instead.
  hasImage?: boolean;
  hasDocument?: boolean;
};

// Slim key-bunch summary attached to history entries (blobs excluded).
export type MovementHistoryKeySummary = Pick<
  KeyBunch,
  "id" | "identifier" | "type" | "status" | "currentTag"
>;

export type MovementHistoryWithDetails = MovementHistory & {
  keyBunch?: MovementHistoryKeySummary;
  fromLocation?: Location;
  toLocation?: Location;
  user?: User;
};

export type AuditSessionWithDetails = AuditSession & {
  user?: User;
  scans?: AuditScan[];
};
