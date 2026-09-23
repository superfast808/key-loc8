import type { Express, Request, Response } from "express";
import twilio from "twilio";
import { registerLoneWorkingRoutes, startAlertChecker } from "./loneWorkingRoutes";
import { registerUniformRoutes } from "./uniformRoutes";
import { startDeputySync, runDeputySync } from "./deputySync";
import { createCompanyBackup, listCompanyBackups, getBackup, startBackupScheduler } from "./backupService";
import { createServer, type Server } from "http";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { companyService } from "./companyService";
import { 
  insertLocationSchema, 
  insertKeyBunchSchema, 
  insertMovementHistorySchema,
  insertAuditSessionSchema,
  insertAuditScanSchema,
  insertPolicySchema,
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { PERMISSIONS, hasPermission, canAccessLocation, ROLE_PERMISSIONS, type Role } from "@shared/permissions";
import { DEFAULT_KEY_TYPES, DEFAULT_STATUSES, DEFAULT_LOCATION_TYPES, DEFAULT_ACTIONS, type AppSettings } from "@shared/settings";

// Simple session management for demo
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Generate a secure random password for new users
function generateSecurePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const randomBytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  return password;
}

// Hash a password using bcrypt
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Verify a password against a hash
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Helper to normalize type to ID (handles both ID and display name inputs)
async function normalizeTypeToId(typeValue: string, companyId: number): Promise<string> {
  if (!typeValue) return typeValue;
  
  const settings = await storage.getSettings(companyId);
  if (!settings?.keyTypes) return typeValue;
  
  // First check if it's already an ID
  const byId = settings.keyTypes.find((t: any) => t.id === typeValue);
  if (byId) return byId.id;
  
  // Then check if it's a display name or name (legacy data)
  const byName = settings.keyTypes.find((t: any) => 
    t.displayName === typeValue || t.name === typeValue
  );
  return byName ? byName.id : typeValue;
}

// Centralized NFC tag uniqueness validation
async function assertNfcAvailable(nfcSerial: string | null | undefined, companyId: number, exemptKeyId?: number): Promise<void> {
  // Skip validation if no NFC serial provided
  if (!nfcSerial || typeof nfcSerial !== 'string' || !nfcSerial.trim()) {
    return;
  }
  
  const trimmedSerial = nfcSerial.trim();
  
  // Check if NFC tag is already linked to another key bunch (within same company, excluding soft-deleted)
  const existingKeyBunch = await storage.getKeyBunchByNFC(trimmedSerial, companyId, false);
  
  // If tag exists and belongs to a different key bunch, throw conflict error
  if (existingKeyBunch && existingKeyBunch.id !== exemptKeyId) {
    const error: any = new Error(`NFC tag is already linked to key bunch ${existingKeyBunch.identifier}. Each NFC tag can only be linked to one key bunch.`);
    error.status = 409;
    error.conflict = true;
    error.existingKeyBunch = existingKeyBunch;
    throw error;
  }
}

// Comprehensive audit logging helper
async function logAuditEvent(params: {
  companyId: number;
  userId?: number;
  action: string;
  entityType?: string;
  entityId?: number;
  keyBunchId?: number;
  details?: any;
  req?: any;
}) {
  try {
    const { companyId, userId, action, entityType, entityId, keyBunchId, details, req } = params;
    
    await storage.createAuditLog({
      companyId,
      userId: userId || undefined,
      action,
      entityType,
      entityId,
      keyBunchId,
      details: details ? JSON.stringify(details) : undefined,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw - audit logging failures shouldn't break the app
  }
}

// We'll define this after setupAuth is called
let requireAuth: any;

// Permission middleware
const requirePermission = (permission: string) => {
  return async (req: any, res: Response, next: Function) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Super admin has all permissions
    if (user.role === 'super_admin') {
      return next();
    }

    // Combine role-based permissions with custom permissions
    const rolePermissions = ROLE_PERMISSIONS[user.role as Role] || [];
    const customPermissions = user.customPermissions || [];
    const userPermissions = [...rolePermissions, ...customPermissions];
    
    if (!hasPermission(userPermissions, permission as any)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration — stored in PostgreSQL so sessions survive server restarts/deploys
  const PgStore = connectPg(session);
  const sessionStore = new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    tableName: "sessions",
    ttl: SESSION_DURATION / 1000, // connect-pg-simple expects seconds
  });

  app.use(session({
    secret: process.env.SESSION_SECRET || 'demo-key-management-secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: SESSION_DURATION
    }
  }));

  // Simple authentication middleware
  requireAuth = async (req: any, res: Response, next: Function) => {
    const sessionId = req.session?.userId;
    
    if (!sessionId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUser(sessionId);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    req.user = user;
    next();
  };

  // Authentication routes
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    console.log("Login endpoint hit with:", req.body);
    try {
      const { email, password } = req.body;
      
      // Make email case-insensitive by converting to lowercase
      const normalizedEmail = email?.toLowerCase().trim();
      
      // Find user by email
      const user = await storage.getUserByEmail(normalizedEmail);
      console.log("Login attempt - user found:", user ? "yes" : "no");
      if (!user || !user.isActive) {
        console.log("Login failed - user not found or inactive");
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log("Login attempt - verifying password");
      let isValidPassword = false;
      let needsPasswordUpgrade = false;
      
      // Check if password is already hashed (starts with $2a$ or $2b$ for bcrypt)
      const isHashed = user.password?.startsWith('$2a$') || user.password?.startsWith('$2b$');
      
      if (isHashed) {
        // Use bcrypt verification for hashed passwords
        isValidPassword = await verifyPassword(password, user.password || '');
      } else {
        // Legacy plain-text password - compare directly
        isValidPassword = password === user.password;
        if (isValidPassword) {
          needsPasswordUpgrade = true;
          console.log("Plain-text password matched - will upgrade to bcrypt");
        }
      }
      
      if (!isValidPassword) {
        console.log("Login failed - password mismatch");
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Auto-upgrade plain-text passwords to hashed passwords on successful login
      if (needsPasswordUpgrade) {
        const hashedPassword = await hashPassword(password);
        await storage.updateUser(user.id, { password: hashedPassword });
        console.log(`Password upgraded to bcrypt for user ${user.email}`);
      }

      // If 2FA is enabled and mobile is on file, send OTP and halt login
      if (user.twoFactorEnabled && user.mobilePhone) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        (req.session as any).pendingUserId = user.id;
        (req.session as any).pendingOtp = otp;
        (req.session as any).pendingOtpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes

        try {
          const smsFrom = process.env.TWILIO_SMS_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await client.messages.create({
            body: `Your keylocate verification code is: ${otp}. This code expires in 5 minutes.`,
            from: smsFrom,
            to: user.mobilePhone,
          });
        } catch (smsErr) {
          console.error("2FA SMS failed:", smsErr);
          return res.status(500).json({ message: "Failed to send verification code. Please try again." });
        }

        return res.json({ requiresTwoFactor: true });
      }

      // Normal login (no 2FA)
      (req.session as any).userId = user.id;
      res.json({ message: "Login successful", user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // 2FA verification endpoint
  app.post('/api/auth/2fa/verify', async (req: Request, res: Response) => {
    try {
      const { otp } = req.body;
      const pendingUserId = (req.session as any).pendingUserId;
      const pendingOtp = (req.session as any).pendingOtp;
      const pendingOtpExpiry = (req.session as any).pendingOtpExpiry;

      if (!pendingUserId || !pendingOtp) {
        return res.status(400).json({ message: "No pending verification. Please log in again." });
      }
      if (Date.now() > pendingOtpExpiry) {
        delete (req.session as any).pendingUserId;
        delete (req.session as any).pendingOtp;
        delete (req.session as any).pendingOtpExpiry;
        return res.status(400).json({ message: "Verification code has expired. Please log in again." });
      }
      if (otp !== pendingOtp) {
        return res.status(401).json({ message: "Invalid verification code. Please try again." });
      }

      // OTP correct — complete login
      (req.session as any).userId = pendingUserId;
      delete (req.session as any).pendingUserId;
      delete (req.session as any).pendingOtp;
      delete (req.session as any).pendingOtpExpiry;

      res.json({ message: "Login successful" });
    } catch (error) {
      console.error("2FA verify error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // 2FA resend code endpoint
  app.post('/api/auth/2fa/resend', async (req: Request, res: Response) => {
    try {
      const pendingUserId = (req.session as any).pendingUserId;
      if (!pendingUserId) {
        return res.status(400).json({ message: "No pending verification. Please log in again." });
      }
      const user = await storage.getUser(pendingUserId);
      if (!user?.mobilePhone) {
        return res.status(400).json({ message: "No mobile number on file." });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      (req.session as any).pendingOtp = otp;
      (req.session as any).pendingOtpExpiry = Date.now() + 5 * 60 * 1000;

      const smsFrom = process.env.TWILIO_SMS_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `Your keylocate verification code is: ${otp}. This code expires in 5 minutes.`,
        from: smsFrom,
        to: user.mobilePhone,
      });

      res.json({ message: "Code resent" });
    } catch (error) {
      console.error("2FA resend error:", error);
      res.status(500).json({ message: "Failed to resend code" });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ message: "Logout successful" });
    });
  });

  app.get('/api/auth/user', requireAuth, async (req: any, res: Response) => {
    try {
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });



  // User management routes (super admin only)
  app.get('/api/users', requireAuth, requirePermission(PERMISSIONS.USER_VIEW), async (req: any, res: Response) => {
    try {
      const user = req.user;
      // CRITICAL: Only return users from the same company
      const users = await storage.getAllUsers(user.companyId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', requireAuth, requirePermission(PERMISSIONS.USER_CREATE), async (req: any, res: Response) => {
    try {
      const userData = req.body;
      
      // Inject companyId from session
      userData.companyId = req.user.companyId;
      
      // Generate a secure random password if not provided or empty
      let temporaryPassword = null;
      if (!userData.password || userData.password.trim() === '') {
        temporaryPassword = generateSecurePassword(16);
        userData.password = temporaryPassword;
      } else {
        // Keep the plain password to potentially return it
        temporaryPassword = userData.password;
      }
      
      // Hash the password before storing
      userData.password = await hashPassword(userData.password);
      
      const user = await storage.createUser(userData);
      
      // Return the temporary password to the admin so they can communicate it to the user
      // Note: In production, this should be sent via secure email to the user directly
      res.json({
        ...user,
        temporaryPassword: temporaryPassword // Only returned on creation, not stored
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch('/api/users/:id', requireAuth, requirePermission(PERMISSIONS.USER_EDIT), async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Handle password updates - any user with USER_EDIT permission can reset passwords
      if (updates.password !== undefined) {
        // Remove password from updates if it's empty (keep existing password)
        if (!updates.password || updates.password.trim() === '') {
          delete updates.password;
        } else {
          // Hash the new password before storing
          console.log(`Admin ${req.user.email} is resetting password for user ${id}`);
          updates.password = await hashPassword(updates.password);
        }
      }
      
      const user = await storage.updateUser(parseInt(id), updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post('/api/users/:id/change-password', requireAuth, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;
      
      // Users can only change their own password unless they're super admin
      if (req.user.id !== parseInt(id) && req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "You can only change your own password" });
      }
      
      // Get the user to verify current password
      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password (unless super admin is changing someone else's password)
      if (req.user.id === parseInt(id)) {
        const isValid = await verifyPassword(currentPassword, user.password || '');
        if (!isValid) {
          return res.status(401).json({ message: "Current password is incorrect" });
        }
      }
      
      // Hash and update password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(parseInt(id), { password: hashedPassword });
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // ── Forgot-password flow (public, no auth) ─────────────────────────────────
  // Always returns 200 to avoid leaking which emails are registered. If the
  // email matches an active user we generate a one-time token, persist its
  // hash, and email a reset link via SendGrid.
  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body || {};
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email is required" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const user = await storage.getUserByEmail(normalizedEmail);

      if (user && user.isActive) {
        const { db } = await import('./db');
        const { passwordResetTokens } = await import('@shared/schema');
        const { sendPasswordResetEmail, isEmailConfigured } = await import('./email');

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes

        await db.insert(passwordResetTokens).values({
          userId: user.id,
          tokenHash,
          expiresAt,
        });

        // Build a public-facing URL from TRUSTED server-side config only.
        // Never use Origin/Referer headers — those are attacker-controlled on
        // a public endpoint and would allow exfiltrating the reset token.
        const appBaseUrl =
          process.env.APP_BASE_URL?.replace(/\/$/, '') ||
          (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
          (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}` : null);

        if (!appBaseUrl) {
          console.error('[forgot-password] No trusted base URL configured (set APP_BASE_URL)');
          return res.json({ message: "If an account exists for that email, a reset link has been sent." });
        }
        const resetUrl = `${appBaseUrl}/auth/reset-password?token=${rawToken}`;

        if (!isEmailConfigured()) {
          console.warn(`[forgot-password] Email not configured. Reset URL for ${normalizedEmail}: ${resetUrl}`);
        } else {
          try {
            await sendPasswordResetEmail(user.email!, resetUrl, user.firstName);
            console.log(`[forgot-password] Sent reset email to ${normalizedEmail}`);
          } catch (mailErr: any) {
            console.error(`[forgot-password] SendGrid error for ${normalizedEmail}:`, mailErr?.response?.body || mailErr?.message || mailErr);
          }
        }
      } else {
        console.log(`[forgot-password] No active user for ${normalizedEmail} — returning 200 anyway`);
      }

      // Always respond the same to prevent email enumeration
      res.json({ message: "If an account exists for that email, a reset link has been sent." });
    } catch (error) {
      console.error("Error in forgot-password:", error);
      // Still return 200 to avoid leaking info, but log server-side
      res.json({ message: "If an account exists for that email, a reset link has been sent." });
    }
  });

  // Validate a reset token before showing the new-password form on the client
  app.get('/api/auth/reset-password/validate', async (req: Request, res: Response) => {
    try {
      const token = String(req.query.token || '');
      if (!token) return res.status(400).json({ valid: false, message: "Missing token" });

      const { db } = await import('./db');
      const { passwordResetTokens } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));

      if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ valid: false, message: "This reset link is invalid or has expired." });
      }
      res.json({ valid: true });
    } catch (error) {
      console.error("Error validating reset token:", error);
      res.status(500).json({ valid: false, message: "Failed to validate token" });
    }
  });

  // Consume a reset token and set a new password
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body || {};
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: "Reset token is required" });
      }
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const { db } = await import('./db');
      const { passwordResetTokens } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const { and, isNull, gt } = await import('drizzle-orm');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Atomically claim the token: only one concurrent request can succeed.
      const claimed = await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .returning();

      if (claimed.length === 0) {
        return res.status(400).json({ message: "This reset link is invalid or has expired." });
      }
      const row = claimed[0];

      const hashed = await hashPassword(newPassword);
      await storage.updateUser(row.userId, { password: hashed });

      console.log(`[reset-password] Password reset successfully for user ${row.userId}`);
      res.json({ message: "Password reset successfully. You can now sign in with your new password." });
    } catch (error) {
      console.error("Error in reset-password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.delete('/api/users/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      
      // Only super admins can delete users
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only super admins can delete users" });
      }
      
      // Prevent deleting yourself
      if (req.user.id === parseInt(id)) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }
      
      // Delete user with company scoping for multi-tenant isolation
      await storage.deleteUser(parseInt(id), req.user.companyId);
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });



  // Dashboard Stats
  app.get("/api/dashboard/stats", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const stats = await storage.getDashboardStats(user.companyId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Locations
  // Location bulk operations
  app.post("/api/locations/:id/move-type", requireAuth, async (req: any, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const { bunchType, targetLocationId } = req.body;
      const companyId = req.user?.companyId;

      // SECURITY: Verify source location belongs to company
      const sourceLocation = await storage.getLocation(locationId, companyId);
      if (!sourceLocation) {
        return res.status(404).json({ message: "Source location not found or access denied" });
      }

      // SECURITY: Verify target location belongs to company
      const targetLocation = await storage.getLocation(targetLocationId, companyId);
      if (!targetLocation) {
        return res.status(404).json({ message: "Target location not found or access denied" });
      }

      // SECURITY: Get key bunches filtered by company
      const keyBunches = await storage.getKeyBunchesByLocation(locationId, companyId);
      const filteredBunches = keyBunches.filter(kb => kb.type === bunchType);

      // Move each key bunch to the target location with company validation
      for (const bunch of filteredBunches) {
        // SECURITY: Update with company validation
        await storage.updateKeyBunch(bunch.id, { locationId: targetLocationId }, companyId);
        
        // Create movement history
        await storage.createMovementHistory({
          keyBunchId: bunch.id,
          performedBy: parseInt(req.user?.id) || 1,
          companyId: companyId,
          actionType: "move",
          fromLocationId: locationId,
          toLocationId: targetLocationId,
          notes: `Bulk moved ${bunchType} keys`,
        });
      }

      res.json({ success: true, movedCount: filteredBunches.length });
    } catch (error) {
      console.error("Failed to move keys by type:", error);
      res.status(500).json({ message: "Failed to move keys" });
    }
  });

  app.post("/api/locations/:id/bulk-transfer", requireAuth, async (req: any, res) => {
    try {
      const sourceLocationId = parseInt(req.params.id);
      const { targetLocationId, bunchType } = req.body;
      const companyId = req.user?.companyId;

      // SECURITY: Verify source location belongs to company
      const sourceLocation = await storage.getLocation(sourceLocationId, companyId);
      if (!sourceLocation) {
        return res.status(404).json({ message: "Source location not found or access denied" });
      }

      // SECURITY: Verify target location belongs to company
      const targetLocation = await storage.getLocation(targetLocationId, companyId);
      if (!targetLocation) {
        return res.status(404).json({ message: "Target location not found or access denied" });
      }

      // SECURITY: Get key bunches filtered by company
      let keyBunches = await storage.getKeyBunchesByLocation(sourceLocationId, companyId);
      
      if (bunchType !== "all") {
        keyBunches = keyBunches.filter(kb => kb.type === bunchType);
      }

      // Transfer each key bunch with company validation
      for (const bunch of keyBunches) {
        // SECURITY: Update with company validation
        await storage.updateKeyBunch(bunch.id, { locationId: targetLocationId }, companyId);
        
        // Create movement history
        await storage.createMovementHistory({
          keyBunchId: bunch.id,
          performedBy: parseInt(req.user?.id) || 1,
          companyId: companyId,
          actionType: "move",
          fromLocationId: sourceLocationId,
          toLocationId: targetLocationId,
          notes: `Bulk transfer of ${bunchType} keys`,
        });
      }

      res.json({ success: true, transferredCount: keyBunches.length });
    } catch (error) {
      console.error("Failed bulk transfer:", error);
      res.status(500).json({ message: "Failed to complete bulk transfer" });
    }
  });

  // Location routes with access control
  app.get("/api/locations", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const companyLocations = await storage.getLocations(user.companyId);
      
      // Super admin can see all locations in their company
      if (user.role === 'super_admin') {
        return res.json(companyLocations);
      }
      
      // All other roles must be explicitly granted access to each location.
      // Empty allowedLocationIds means no location access.
      const userLocations = companyLocations.filter(location => 
        user.allowedLocationIds.includes(location.id)
      );
      
      res.json(userLocations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.get("/api/locations/all", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      // CRITICAL: Filter locations by company for data isolation
      const locations = await storage.getLocations(user.companyId);

      // Super admin sees every location in their company. Everyone else only
      // sees locations they've been explicitly granted access to.
      if (user.role === 'super_admin') {
        return res.json(locations);
      }
      const allowed = user.allowedLocationIds || [];
      res.json(locations.filter(l => allowed.includes(l.id)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  // Location Export - MUST be before :id route
  app.get("/api/locations/export", requireAuth, requirePermission(PERMISSIONS.REPORTS_EXPORT), async (req: any, res) => {
    try {
      const companyId = req.user?.companyId;
      const locations = await storage.getLocations(companyId);
      const keyBunches = await storage.getKeyBunches(companyId);
      
      // Get settings for display names
      const settings = await storage.getSettings(companyId);
      
      // Helper to get type display name
      const getTypeDisplayName = (typeId: string) => {
        const keyType = settings?.keyTypes?.find((t: any) => t.id === typeId);
        return keyType?.displayName || typeId;
      };
      
      const getLocationName = (locationId: number | null) => {
        if (!locationId) return "No Location";
        const location = locations.find(l => l.id === locationId);
        return location?.name || "Unknown";
      };
      
      // Build CSV data
      const csvRows = [
        // Header row
        ['Location Name', 'Location Type', 'Key Set ID', 'Key Type', 'Tag', 'Keys', 'Fobs', 'Description', 'Address', 'Notes'].join(',')
      ];
      
      // Add location rows with their key bunches
      for (const location of locations) {
        const locationKeyBunches = keyBunches.filter(kb => kb.locationId === location.id && !kb.isDeleted);
        
        if (locationKeyBunches.length === 0) {
          // Location with no keys
          csvRows.push([
            `"${location.name}"`,
            `"${location.type}"`,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            ''
          ].join(','));
        } else {
          // Location with keys
          for (const kb of locationKeyBunches) {
            csvRows.push([
              `"${location.name}"`,
              `"${location.type}"`,
              `"${kb.identifier}"`,
              `"${getTypeDisplayName(kb.type)}"`,
              `"${kb.currentTag || ''}"`,
              kb.keyCount || 0,
              kb.fobCount || 0,
              `"${(kb.keyDescription || '').replace(/"/g, '""')}"`,
              `"${(kb.address || '').replace(/"/g, '""')}"`,
              `"${(kb.notes || '').replace(/"/g, '""')}"`,
            ].join(','));
          }
        }
      }
      
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="locations-export-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvRows.join('\n'));
    } catch (error) {
      console.error("Error exporting locations:", error);
      res.status(500).json({ message: "Failed to export locations" });
    }
  });

  app.get("/api/locations/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user?.companyId;
      
      // SECURITY: Multi-tenant data isolation - only return if belongs to user's company
      const location = await storage.getLocation(id, companyId);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch location" });
    }
  });

  app.post("/api/locations", requireAuth, requirePermission(PERMISSIONS.LOCATION_CREATE), async (req: any, res) => {
    try {
      const user = req.user;
      const validatedData = insertLocationSchema.parse(req.body);
      // Inject the user's company ID for data isolation
      const location = await storage.createLocation({
        ...validatedData,
        companyId: user.companyId
      });
      
      // Log audit event
      await logAuditEvent({
        companyId: user.companyId,
        userId: user.id,
        action: "location_created",
        entityType: "location",
        entityId: location.id,
        details: {
          name: location.name,
          type: location.type
        },
        req
      });
      
      res.status(201).json(location);
    } catch (error) {
      console.error("Location creation error:", error);
      res.status(400).json({ message: "Invalid location data", error: error.message });
    }
  });

  app.patch("/api/locations/:id", requireAuth, requirePermission(PERMISSIONS.LOCATION_EDIT), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user?.companyId;
      
      // SECURITY: Multi-tenant data isolation - only update if belongs to user's company
      const location = await storage.updateLocation(id, req.body, companyId);
      if (!location) {
        return res.status(404).json({ message: "Location not found or access denied" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", requireAuth, requirePermission(PERMISSIONS.LOCATION_EDIT), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user?.companyId;
      
      // SECURITY: Verify location belongs to company before checking key bunches
      const location = await storage.getLocation(id, companyId);
      if (!location) {
        return res.status(404).json({ message: "Location not found or access denied" });
      }
      
      // Check if location has any key bunches
      const keyBunches = await storage.getKeyBunchesByLocation(id, companyId);
      if (keyBunches.length > 0) {
        return res.status(400).json({ 
          message: `Cannot delete location. It contains ${keyBunches.length} key bunches. Please move or remove all key bunches first.` 
        });
      }
      
      // SECURITY: Multi-tenant data isolation - only delete if belongs to company
      await storage.deleteLocation(id, companyId);
      res.json({ message: "Location deleted successfully" });
    } catch (error) {
      console.error("Error deleting location:", error);
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  // Saved Reports Management
  app.get("/api/saved-reports", requireAuth, requirePermission(PERMISSIONS.REPORTS_VIEW), async (req: any, res) => {
    try {
      const companyId = req.user?.companyId;
      const reports = await storage.getSavedReports(companyId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching saved reports:", error);
      res.status(500).json({ message: "Failed to fetch saved reports" });
    }
  });

  app.get("/api/saved-reports/:id", requireAuth, requirePermission(PERMISSIONS.REPORTS_VIEW), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user?.companyId;
      
      const report = await storage.getSavedReport(id, companyId);
      if (!report) {
        return res.status(404).json({ message: "Report not found or access denied" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching saved report:", error);
      res.status(500).json({ message: "Failed to fetch saved report" });
    }
  });

  app.post("/api/saved-reports", requireAuth, requirePermission(PERMISSIONS.REPORTS_CREATE), async (req: any, res) => {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.id;
      
      const reportData = {
        ...req.body,
        companyId,
        createdBy: userId,
      };
      
      const report = await storage.createSavedReport(reportData);
      
      // Log audit event
      await logAuditEvent({
        companyId,
        userId,
        action: "report_created",
        entityType: "saved_report",
        entityId: report.id,
        details: {
          name: report.name,
        },
        req
      });
      
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating saved report:", error);
      res.status(500).json({ message: "Failed to create saved report" });
    }
  });

  app.patch("/api/saved-reports/:id", requireAuth, requirePermission(PERMISSIONS.REPORTS_EDIT), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user?.companyId;
      
      const report = await storage.updateSavedReport(id, req.body, companyId);
      if (!report) {
        return res.status(404).json({ message: "Report not found or access denied" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error updating saved report:", error);
      res.status(500).json({ message: "Failed to update saved report" });
    }
  });

  app.delete("/api/saved-reports/:id", requireAuth, requirePermission(PERMISSIONS.REPORTS_DELETE), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user?.companyId;
      const userId = req.user?.id;
      
      // Verify report exists and belongs to company
      const report = await storage.getSavedReport(id, companyId);
      if (!report) {
        return res.status(404).json({ message: "Report not found or access denied" });
      }
      
      // Don't allow deleting default reports
      if (report.isDefault) {
        return res.status(400).json({ message: "Cannot delete default system reports" });
      }
      
      await storage.deleteSavedReport(id, companyId);
      
      // Log audit event
      await logAuditEvent({
        companyId,
        userId,
        action: "report_deleted",
        entityType: "saved_report",
        entityId: id,
        details: {
          name: report.name,
        },
        req
      });
      
      res.json({ message: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting saved report:", error);
      res.status(500).json({ message: "Failed to delete saved report" });
    }
  });

  // Key Bunches
  // Key bunch routes with location filtering
  // Global NFC tag lookup — returns key bunch info for any NFC serial scanned anywhere in the app
  app.get("/api/nfc/lookup", requireAuth, async (req: any, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const serial = (req.query.serial as string || "").trim();
      if (!serial) return res.status(400).json({ message: "serial required" });
      const keyBunch = await storage.getKeyBunchByNFC(serial, companyId, false);
      if (!keyBunch) return res.status(404).json({ found: false });
      // Fetch location name
      const location = keyBunch.locationId ? await storage.getLocation(keyBunch.locationId, companyId) : null;
      res.json({
        found: true,
        id: keyBunch.id,
        identifier: keyBunch.identifier,
        address: keyBunch.address,
        type: keyBunch.type,
        status: keyBunch.status,
        locationName: location?.name ?? null,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/key-bunches", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const companyKeyBunches = await storage.getKeyBunches(user.companyId);
      
      // Super admin can see all key bunches in their company
      if (user.role === 'super_admin') {
        return res.json(companyKeyBunches);
      }
      
      // All other roles see only key bunches at locations they've been explicitly granted access to.
      const userKeyBunches = companyKeyBunches.filter(bunch => 
        bunch.locationId && user.allowedLocationIds.includes(bunch.locationId)
      );
      
      res.json(userKeyBunches);
    } catch (error) {
      console.error("Error fetching key bunches:", error);
      res.status(500).json({ message: "Failed to fetch key bunches" });
    }
  });

  // NOTE: Original endpoint kept for compatibility, but a stale Service Worker
  // on user devices was caching `/api/key-bunches/all` and serving an empty
  // array, never letting requests reach the server. We added a new path below
  // (`/api/keys/list`) that the frontend now uses to bypass that cache.
  app.get("/api/key-bunches/all", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { type, locationId, status, search } = req.query;
      let bunches = await storage.getKeyBunches(user.companyId);

      // Restrict to the user's allowed locations (super admin bypasses).
      if (user.role !== 'super_admin') {
        const allowed = user.allowedLocationIds || [];
        bunches = bunches.filter(b => b.locationId && allowed.includes(b.locationId));
      }

      // Apply filters
      if (type && type !== "all") {
        bunches = bunches.filter(b => b.type === type);
      }
      if (locationId && locationId !== "all") {
        bunches = bunches.filter(b => b.locationId === parseInt(locationId as string));
      }
      if (status && status !== "all") {
        bunches = bunches.filter(b => b.status === status);
      }
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        bunches = bunches.filter(b => 
          b.identifier.toLowerCase().includes(searchTerm) ||
          (b.currentTag || '').toLowerCase().includes(searchTerm)
        );
      }
      
      res.json(bunches);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch key bunches" });
    }
  });

  app.get("/api/keys/list", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const bunches = await storage.getKeyBunches(user.companyId);

      // Super admin sees every key bunch in their company. Everyone else only
      // sees key bunches at locations they've been explicitly granted access to.
      if (user.role === 'super_admin') {
        return res.json(bunches);
      }
      const allowed = user.allowedLocationIds || [];
      res.json(bunches.filter(b => b.locationId && allowed.includes(b.locationId)));
    } catch (error) {
      console.error("Error fetching key bunches:", error);
      res.status(500).json({ message: "Failed to fetch key bunches" });
    }
  });

  app.get("/api/key-bunches/deleted/all", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      // CRITICAL: Filter deleted keys by company for multi-tenant data isolation
      const deletedKeys = await storage.getDeletedKeys(user.companyId);
      res.json(deletedKeys);
    } catch (error) {
      console.error("Error fetching deleted keys:", error);
      res.status(500).json({ message: "Failed to fetch deleted keys" });
    }
  });

  app.get("/api/key-bunches/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user?.companyId;
      
      // SECURITY: Multi-tenant data isolation - only return if belongs to user's company
      const keyBunch = await storage.getKeyBunch(id, companyId);
      if (!keyBunch) {
        return res.status(404).json({ message: "Key bunch not found" });
      }
      res.json(keyBunch);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch key bunch" });
    }
  });

  app.post("/api/key-bunches", requireAuth, requirePermission(PERMISSIONS.KEY_CREATE), async (req: any, res) => {
    try {
      const validatedData = insertKeyBunchSchema.parse(req.body);
      const companyId = req.user.companyId;
      
      // Normalize type to ID to handle legacy data with display names
      const normalizedType = await normalizeTypeToId(validatedData.type, companyId);
      
      // Check for duplicate identifier+type+location combination
      const isDuplicate = await storage.checkDuplicateIdentifier(
        validatedData.identifier,
        normalizedType,
        validatedData.locationId || null,
        companyId
      );
      
      if (isDuplicate) {
        return res.status(409).json({ 
          message: "A key bunch with this identifier and type already exists at this location" 
        });
      }
      
      // Validate NFC tag uniqueness before creating
      await assertNfcAvailable(validatedData.nfcSerial, companyId);
      
      const keyBunch = await storage.createKeyBunch({
        ...validatedData,
        type: normalizedType,
        companyId
      });
      
      // Log audit event
      await logAuditEvent({
        companyId,
        userId: req.user.id,
        action: "key_created",
        entityType: "key_bunch",
        entityId: keyBunch.id,
        keyBunchId: keyBunch.id,
        details: {
          identifier: keyBunch.identifier,
          type: normalizedType,
          locationId: keyBunch.locationId,
          status: keyBunch.status
        },
        req
      });
      
      res.status(201).json(keyBunch);
    } catch (error: any) {
      // Handle NFC conflict errors
      if (error.status === 409 && error.conflict) {
        return res.status(409).json({
          message: error.message,
          existingKeyBunch: error.existingKeyBunch,
          conflict: true
        });
      }
      res.status(400).json({ message: error.message || "Invalid key bunch data" });
    }
  });

  app.patch("/api/key-bunches/:id", requireAuth, requirePermission(PERMISSIONS.KEY_EDIT), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const companyId = req.user?.companyId;
      
      // SECURITY: Get original key bunch with company validation
      const originalBunch = await storage.getKeyBunch(id, companyId);
      if (!originalBunch) {
        return res.status(404).json({ message: "Key bunch not found or access denied" });
      }
      
      // Check for duplicate if identifier, type, or location is being changed
      const identifierChanged = updates.identifier && updates.identifier !== originalBunch.identifier;
      const typeChanged = updates.type && updates.type !== originalBunch.type;
      const locationChanged = updates.locationId !== undefined && updates.locationId !== originalBunch.locationId;
      
      if (identifierChanged || typeChanged || locationChanged) {
        const newIdentifier = updates.identifier || originalBunch.identifier;
        const newType = updates.type ? await normalizeTypeToId(updates.type, req.user.companyId) : originalBunch.type;
        const newLocationId = updates.locationId !== undefined ? updates.locationId : originalBunch.locationId;
        
        const isDuplicate = await storage.checkDuplicateIdentifier(
          newIdentifier,
          newType,
          newLocationId,
          req.user.companyId,
          id  // Exclude current record
        );
        
        if (isDuplicate) {
          return res.status(409).json({ 
            message: "A key bunch with this identifier and type already exists at this location" 
          });
        }
      }
      
      // Normalise empty string to null so we never store "" in place of an NFC value
      if (updates.nfcSerial === '') {
        updates.nfcSerial = null;
      }

      // Validate NFC tag uniqueness if nfcSerial is being updated
      if (updates.nfcSerial !== undefined && updates.nfcSerial !== originalBunch.nfcSerial) {
        await assertNfcAvailable(updates.nfcSerial, companyId, id);
      }
      
      // Normalize type in updates if present
      if (updates.type) {
        updates.type = await normalizeTypeToId(updates.type, req.user.companyId);
      }
      
      // Auto-set imageUpdatedAt timestamp when imageUrl is updated
      if (updates.imageUrl !== undefined) {
        updates.imageUpdatedAt = new Date();
      }
      
      // Auto-set documentUploadedAt timestamp when documentUrl is updated
      if (updates.documentUrl !== undefined) {
        updates.documentUploadedAt = new Date();
      }
      
      // SECURITY: Multi-tenant data isolation - only update if belongs to company
      const updatedKeyBunch = await storage.updateKeyBunch(id, updates, companyId);
      
      // Create audit log for status changes (especially missing status)
      if (updates.status && updates.status !== originalBunch.status) {
        await storage.createMovementHistory({
          keyBunchId: id,
          userId: "audit-system",
          action: "status_change",
          fromLocationId: null,
          toLocationId: null,
          notes: `Status changed from ${originalBunch.status} to ${updates.status}`,
        });
        
        // Also create audit log entry
        await storage.createAuditLog({
          keyBunchId: id,
          userId: "audit-system",
          action: "status_change",
          details: `Status changed from ${originalBunch.status} to ${updates.status}`,
        });
      }
      
      // Create audit log for all field changes
      const changes = [];
      if (updates.identifier && updates.identifier !== originalBunch.identifier) {
        changes.push(`Identifier: ${originalBunch.identifier} → ${updates.identifier}`);
      }
      if (updates.currentTag !== undefined && updates.currentTag !== originalBunch.currentTag) {
        changes.push(`Seal: ${originalBunch.currentTag || 'None'} → ${updates.currentTag || 'None'}`);
      }
      if (updates.keyCount !== undefined && updates.keyCount !== originalBunch.keyCount) {
        changes.push(`Keys: ${originalBunch.keyCount} → ${updates.keyCount}`);
      }
      if (updates.fobCount !== undefined && updates.fobCount !== originalBunch.fobCount) {
        changes.push(`Fobs: ${originalBunch.fobCount} → ${updates.fobCount}`);
      }
      if (updates.keyDescription !== undefined && updates.keyDescription !== originalBunch.keyDescription) {
        changes.push(`Description: ${originalBunch.keyDescription || 'None'} → ${updates.keyDescription || 'None'}`);
      }
      if (updates.notes !== undefined && updates.notes !== originalBunch.notes) {
        changes.push(`Notes: ${originalBunch.notes || 'None'} → ${updates.notes || 'None'}`);
      }
      
      if (changes.length > 0) {
        await storage.createMovementHistory({
          keyBunchId: id,
          performedBy: parseInt(req.user?.id) || 1,
          companyId: req.user?.companyId || 1,
          actionType: "audit_edit",
          fromLocationId: null,
          toLocationId: null,
          notes: `Key details updated: ${changes.join(', ')}`,
        });
      }
      
      res.json(updatedKeyBunch);
    } catch (error: any) {
      // Handle NFC conflict errors
      if (error.status === 409 && error.conflict) {
        return res.status(409).json({
          message: error.message,
          existingKeyBunch: error.existingKeyBunch,
          conflict: true
        });
      }
      console.error("Error updating key bunch:", error);
      res.status(500).json({ message: "Failed to update key bunch", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Delete Key Bunch (Creates history entry and permanently deletes)
  app.delete("/api/key-bunches/:id", requireAuth, requirePermission(PERMISSIONS.KEY_EDIT), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const companyId = req.user?.companyId;
      
      // SECURITY: Get original key bunch with company validation
      const originalBunch = await storage.getKeyBunch(id, companyId);
      if (!originalBunch) {
        return res.status(404).json({ message: "Key bunch not found or access denied" });
      }
      
      // Create deletion movement history record BEFORE deleting the key bunch
      // This preserves the audit trail with all key bunch data
      await storage.createMovementHistory({
        keyBunchId: id,
        performedBy: parseInt(req.user?.id) || 1,
        companyId: originalBunch.companyId,
        actionType: "deleted",
        fromLocationId: originalBunch.locationId,
        toLocationId: null,
        notes: `Key bunch ${originalBunch.identifier} permanently deleted. ${reason ? `Reason: ${reason}` : ''}`,
      });
      
      // SECURITY: Multi-tenant data isolation - only delete if belongs to company
      await storage.deleteKeyBunch(id, companyId, req.user?.id || "1", reason);
      
      res.json({ message: "Key bunch deleted successfully" });
    } catch (error) {
      console.error("Error deleting key bunch:", error);
      res.status(500).json({ message: "Failed to delete key bunch" });
    }
  });

  // Replace Tag
  app.post("/api/key-bunches/:id/replace-tag", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { newTag, performedBy, notes } = req.body;
      const companyId = req.user?.companyId;
      
      // SECURITY: Multi-tenant data isolation - verify ownership
      const keyBunch = await storage.getKeyBunch(id, companyId);
      if (!keyBunch) {
        return res.status(404).json({ message: "Key bunch not found or access denied" });
      }

      const oldTag = keyBunch.currentTag;
      
      // SECURITY: Update with company validation
      const updatedKeyBunch = await storage.updateKeyBunch(id, { currentTag: newTag }, companyId);
      
      // Create movement history record for audit logging
      await storage.createMovementHistory({
        keyBunchId: id,
        performedBy: parseInt(performedBy) || 1,
        companyId: keyBunch.companyId,
        actionType: "tag_replace",
        oldTag: oldTag,
        newTag: newTag,
        fromLocationId: null,
        toLocationId: null,
        notes: `Tag replaced from ${oldTag} to ${newTag}. ${notes || ''}`,
      });

      res.json(updatedKeyBunch);
    } catch (error) {
      res.status(500).json({ message: "Failed to replace tag" });
    }
  });

  // Move Key Bunch
  app.post("/api/key-bunches/:id/move", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { toLocationId, toBunchType, performedBy, notes } = req.body;
      const companyId = req.user?.companyId;
      
      // SECURITY: Multi-tenant data isolation - verify ownership
      const keyBunch = await storage.getKeyBunch(id, companyId);
      if (!keyBunch) {
        return res.status(404).json({ message: "Key bunch not found or access denied" });
      }

      const fromLocationId = keyBunch.locationId;
      const fromBunchType = keyBunch.type;
      
      // Get settings to resolve type names
      const settings = await storage.getSettings(keyBunch.companyId);
      const fromTypeName = settings.keyTypes?.find((t: any) => t.id === fromBunchType)?.displayName || fromBunchType;
      const toTypeName = toBunchType ? settings.keyTypes?.find((t: any) => t.id === toBunchType)?.displayName || toBunchType : fromTypeName;
      
      // Get location names for movement history
      const fromLocation = fromLocationId ? await storage.getLocation(fromLocationId, companyId) : null;
      const toLocation = toLocationId ? await storage.getLocation(toLocationId, companyId) : null;
      const fromLocationName = fromLocation?.name || 'Unknown';
      const toLocationName = toLocation?.name || 'Unknown';
      
      // Update key bunch location and/or type
      const updates: any = {};
      if (toLocationId) updates.locationId = toLocationId;
      if (toBunchType) updates.type = toBunchType;
      
      // SECURITY: Update with company validation
      const updatedKeyBunch = await storage.updateKeyBunch(id, updates, companyId);
      
      // Create movement history record with proper display names
      let movementNotes = '';
      if (toLocationId && toBunchType) {
        // Both location and type changed
        movementNotes = `Moved from ${fromLocationName} to ${toLocationName} and changed type from ${fromTypeName} to ${toTypeName}`;
      } else if (toLocationId) {
        // Only location changed
        movementNotes = `Moved from ${fromLocationName} to ${toLocationName}`;
      } else if (toBunchType) {
        // Only type changed
        movementNotes = `Type changed from ${fromTypeName} to ${toTypeName}`;
      }
      if (notes && notes.trim()) {
        movementNotes += `. ${notes.trim()}`;
      }
      
      await storage.createMovementHistory({
        keyBunchId: id,
        performedBy: parseInt(req.user?.id) || 1,
        companyId: keyBunch.companyId,
        actionType: "move",
        fromLocationId,
        toLocationId: toLocationId || fromLocationId,
        notes: movementNotes,
      });

      res.json(updatedKeyBunch);
    } catch (error) {
      res.status(500).json({ message: "Failed to move key bunch" });
    }
  });

  // Movement History
  app.get("/api/movement-history", requireAuth, requirePermission(PERMISSIONS.HISTORY_VIEW), async (req: any, res) => {
    try {
      const { limit, action, entityType, userId, search, startDate, endDate } = req.query;
      const user = req.user;
      
      // Get comprehensive audit logs (from audit_log table)
      const auditLogs = await storage.getComprehensiveAuditLogs({
        companyId: user.companyId,
        limit: limit ? parseInt(limit as string) : 100,
        action: action as string,
        entityType: entityType as string,
        userId: userId ? parseInt(userId as string) : undefined,
        searchTerm: search as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      // Get movement history (key-specific actions)
      const movements = await storage.getMovementHistory(limit ? parseInt(limit as string) : 100, user.companyId);
      
      // Merge and sort by timestamp
      const combined = [
        ...auditLogs.map((log: any) => ({
          id: `audit_${log.id}`,
          action: log.action,
          timestamp: log.timestamp,
          user: log.user,
          details: log.details,
          entityType: log.entityType,
          entityId: log.entityId,
          keyBunchId: log.keyBunchId,
          source: 'audit_log'
        })),
        ...movements.map((m: any) => ({
          id: `movement_${m.id}`,
          action: m.action,
          timestamp: m.timestamp,
          user: m.user,
          keyBunch: m.keyBunch,
          fromLocation: m.fromLocation,
          toLocation: m.toLocation,
          notes: m.notes,
          keyBunchId: m.keyBunchId,
          source: 'movement_history'
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(combined.slice(0, limit ? parseInt(limit as string) : 100));
    } catch (error) {
      console.error("Error fetching movement history:", error);
      res.status(500).json({ message: "Failed to fetch movement history" });
    }
  });

  app.get("/api/key-bunches/:id/history", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user?.companyId;
      
      // SECURITY: Multi-tenant data isolation - filter history by company
      const history = await storage.getKeyBunchMovementHistory(id, companyId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch key bunch history" });
    }
  });

  // Audit Sessions
  app.get("/api/audit/sessions", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      // CRITICAL: Filter audit sessions by company for data isolation
      const sessions = await storage.getAuditSessions(user.companyId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit sessions" });
    }
  });

  app.get("/api/audit/active", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      // CRITICAL: Filter active audit session by company for data isolation
      const activeSession = await storage.getActiveAuditSession(user.companyId);
      res.json(activeSession || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active audit session" });
    }
  });

  app.post("/api/audit/start", requireAuth, async (req: any, res) => {
    try {
      const { locationId, keyType } = req.body;
      const companyId = req.user.companyId;
      
      // Normalize type to ID to handle legacy data with display names
      const normalizedKeyType = keyType && keyType !== "all" ? await normalizeTypeToId(keyType, companyId) : keyType;
      
      // Calculate total expected keys for this location and type
      const expectedKeys = await storage.getKeyBunchesByLocationAndType(companyId, locationId, normalizedKeyType);
      
      // Add required fields to the request body
      const requestData = {
        ...req.body,
        totalExpected: expectedKeys.length,
        performedBy: req.user.id
      };
      
      const validatedData = insertAuditSessionSchema.parse(requestData);
      
      // Create audit session with companyId from user session
      const session = await storage.createAuditSession({
        ...validatedData,
        companyId
      });
      res.status(201).json(session);
    } catch (error) {
      console.error("Audit start error:", error);
      res.status(400).json({ message: "Invalid audit session data" });
    }
  });

  app.patch("/api/audit/sessions/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user?.companyId;
      
      // SECURITY: Multi-tenant data isolation - only update if belongs to company
      const session = await storage.updateAuditSession(id, req.body, companyId);
      if (!session) {
        return res.status(404).json({ message: "Audit session not found or access denied" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update audit session" });
    }
  });

  // Audit Scans
  app.post("/api/audit/scan", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertAuditScanSchema.parse(req.body);
      const companyId = req.user?.companyId;
      const scan = await storage.createAuditScan(validatedData);
      
      // Update session scan count with company validation
      if (validatedData.auditSessionId) {
        const session = await storage.getAuditSession(validatedData.auditSessionId, companyId);
        if (session) {
          await storage.updateAuditSession(session.id, {
            totalScanned: (session.scans?.length || 0) + 1
          }, companyId);
        }
      }
      
      res.status(201).json(scan);
    } catch (error) {
      res.status(400).json({ message: "Invalid audit scan data" });
    }
  });

  app.get("/api/audit/sessions/:id/scans", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user?.companyId;
      
      // SECURITY: Verify session belongs to company before returning scans
      const session = await storage.getAuditSession(id, companyId);
      if (!session) {
        return res.status(404).json({ message: "Audit session not found or access denied" });
      }
      
      const scans = await storage.getAuditScans(id);
      res.json(scans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit scans" });
    }
  });

  // Audit completion endpoint
  app.post("/api/audit/:sessionId/complete", requireAuth, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const { totalScanned, notes, presentKeys, missingKeys } = req.body;
      const companyId = req.user?.companyId;
      
      // SECURITY: Update audit session with company validation
      const session = await storage.updateAuditSession(sessionId, {
        status: "completed",
        endTime: new Date(),
        totalScanned,
        notes,
      }, companyId);

      // Get company settings for status updates
      const settings = await storage.getSettings(companyId);
      const auditEditAction = settings.actions?.find((a: any) => 
        a.displayName === "Audit Edit" || a.name === "audit_edit" || a.id === "audit_edit"
      );
      
      if (!auditEditAction) {
        throw new Error("Audit Edit action not found in company settings");
      }

      const userName = req.user?.firstName && req.user?.lastName 
        ? `${req.user.firstName} ${req.user.lastName}` 
        : req.user?.username || "Unknown";

      // Get the "Present" and "Missing" statuses from company settings
      const presentStatus = settings.statuses?.find((s: any) => 
        s.displayName === "Present" || s.name === "Present" || s.id === "active"
      );
      const missingStatus = settings.statuses?.find((s: any) => 
        s.displayName === "Missing" || s.name === "Missing" || s.id === "missing"
      );

      if (!presentStatus || !missingStatus) {
        throw new Error("Required statuses not found in company settings");
      }

      // Get all scanned keys from this audit session (NFC mode)
      const scans = await storage.getAuditScans(sessionId);
      const scannedKeyBunchIds = new Set(scans.map((scan: any) => scan.keyBunchId).filter(Boolean));

      // Combine NFC scanned keys + manual checklist present keys
      const allPresentKeyIds = new Set(scannedKeyBunchIds);
      if (presentKeys && presentKeys.length > 0) {
        presentKeys.forEach((key: any) => allPresentKeyIds.add(key.id));
      }

      // Mark all present keys (NFC scanned + manual checked) as "Present" and clear notes
      for (const keyBunchId of Array.from(allPresentKeyIds)) {
        const keyBunch = await storage.getKeyBunch(keyBunchId, companyId);
        if (keyBunch) {
          // Update status to Present and CLEAR notes field
          await storage.updateKeyBunch(keyBunchId, {
            status: presentStatus.id,
            notes: "", // Clear notes when marked as present
          }, companyId);

          // Create movement history entry
          await storage.createMovementHistory({
            companyId,
            keyBunchId: keyBunchId,
            performedBy: req.user?.id || null,
            actionType: "audit_edit",
            fromLocationId: keyBunch.locationId,
            toLocationId: null,
            notes: `Key marked as present during audit completion by ${userName}`,
          });
        }
      }

      // Create movement history entries for keys marked as missing during audit
      if (missingKeys && missingKeys.length > 0) {
        for (const missingKey of missingKeys) {
          // SECURITY: Verify key bunch belongs to company
          const keyBunch = await storage.getKeyBunch(missingKey.id, companyId);
          if (keyBunch) {
            // Save the reason exactly as entered to key bunch notes (no duplication)
            const updatedNotes = missingKey.reason && missingKey.reason.trim() 
              ? missingKey.reason.trim() 
              : "";
            
            // SECURITY: Update with company validation
            await storage.updateKeyBunch(missingKey.id, {
              status: missingStatus.id,
              notes: updatedNotes,
            }, companyId);
            
            // Build movement history notes with context
            let movementNotes = `Key marked as missing during audit by ${userName}`;
            if (missingKey.reason && missingKey.reason.trim()) {
              movementNotes += `. Reason: ${missingKey.reason.trim()}`;
            }
            
            // Create movement history entry
            await storage.createMovementHistory({
              companyId,
              keyBunchId: missingKey.id,
              performedBy: req.user?.id || null,
              actionType: "audit_edit",
              fromLocationId: keyBunch.locationId,
              toLocationId: null,
              notes: movementNotes,
            });
          }
        }
      }

      res.json(session);
    } catch (error) {
      console.error("Audit completion error:", error);
      res.status(500).json({ message: "Failed to complete audit" });
    }
  });

  // Audit verification endpoint - checks if location has recent completed audit
  app.get("/api/audit/verification/:locationId", requireAuth, async (req: any, res) => {
    try {
      const locationId = parseInt(req.params.locationId);
      const companyId = req.user?.companyId;
      
      // SECURITY: Get audit sessions filtered by company
      const auditSessions = await storage.getAuditSessions(companyId);
      const completedAudits = auditSessions
        .filter((session: any) => session.status === "completed" && session.endTime)
        .sort((a: any, b: any) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

      if (completedAudits.length === 0) {
        return res.json({
          isVerified: false,
          message: "No completed audits found. Please complete an audit before bulk moving keys.",
          lastAuditDate: null,
        });
      }

      const lastAudit = completedAudits[0];
      const auditDate = new Date(lastAudit.endTime);
      const hoursSinceAudit = Math.floor((Date.now() - auditDate.getTime()) / (1000 * 60 * 60));
      const daysSinceAudit = Math.floor(hoursSinceAudit / 24);
      
      // Consider audit valid if completed within last 24 hours (for tight control)
      const isVerified = hoursSinceAudit <= 24;

      res.json({
        isVerified,
        lastAuditDate: auditDate.toISOString(),
        daysSinceAudit,
        hoursSinceAudit,
        auditSessionId: lastAudit.id,
        message: isVerified 
          ? `Audit completed ${hoursSinceAudit} hours ago - bulk move authorized`
          : `Last audit was ${daysSinceAudit} days ago - new audit required for bulk move (must be within 24 hours)`,
      });
    } catch (error) {
      console.error("Audit verification error:", error);
      res.status(500).json({ message: "Failed to verify audit status" });
    }
  });

  // Key Issue and Return endpoints
  app.post("/api/key-bunches/:id/issue", requireAuth, requirePermission(PERMISSIONS.KEY_ISSUE), async (req: any, res) => {
    try {
      const bunchId = parseInt(req.params.id);
      const { officerName, purpose, newTag, notes } = req.body;
      const companyId = req.user?.companyId;
      
      console.log("Key issue request:", { bunchId, officerName, purpose, newTag, notes });
      
      // SECURITY: Multi-tenant data isolation - verify ownership
      const keyBunch = await storage.getKeyBunch(bunchId, companyId);
      if (!keyBunch) {
        return res.status(404).json({ message: "Key bunch not found or access denied" });
      }

      // Get the logged-in user's name
      const userName = req.user?.firstName && req.user?.lastName 
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || officerName;

      // Get settings to find the correct "Issued" status ID
      const settings = await storage.getSettings(keyBunch.companyId);
      const issuedStatus = settings.statuses?.find((s: any) => 
        s.displayName === "Issued" || s.name === "Issued" || s.id === "issued"
      );
      
      if (!issuedStatus) {
        return res.status(500).json({ message: "Issued status not found in settings" });
      }

      // REPLACE notes with purpose exactly as entered (no prefix, no append)
      const updatedNotes = purpose && purpose.trim() ? purpose.trim() : "";

      // Update key bunch status, clear tag, and REPLACE notes
      const updateData: any = {
        status: issuedStatus.id,
        currentTag: "", // Clear tag when issued (tag is broken)
        lastUpdated: new Date(),
        notes: updatedNotes,
      };
      
      console.log("Updating key bunch with:", updateData);
      // SECURITY: Update with company validation
      const updatedBunch = await storage.updateKeyBunch(bunchId, updateData, companyId);
      console.log("Updated bunch result:", updatedBunch);

      // Create movement history record using the logged-in user's name
      await storage.createMovementHistory({
        keyBunchId: bunchId,
        performedBy: parseInt(req.user?.id) || 1,
        companyId: keyBunch.companyId,
        actionType: "issue",
        fromLocationId: keyBunch.locationId,
        toLocationId: null,
        oldTag: keyBunch.currentTag,
        newTag: newTag || "",
        notes: `Issued by ${userName} for ${purpose || 'general use'}. ${newTag ? `New tag: ${newTag}. ` : ''}${notes || ''}`,
      });

      res.json(updatedBunch);
    } catch (error) {
      console.error("Issue error:", error);
      res.status(500).json({ message: "Failed to issue keys" });
    }
  });

  app.post("/api/key-bunches/:id/return", requireAuth, requirePermission(PERMISSIONS.KEY_RETURN), async (req: any, res) => {
    try {
      const bunchId = parseInt(req.params.id);
      const { officerName, newTag, notes } = req.body;
      const companyId = req.user?.companyId;
      
      console.log("Key return request:", { bunchId, officerName, newTag, notes });
      
      // SECURITY: Multi-tenant data isolation - verify ownership
      const keyBunch = await storage.getKeyBunch(bunchId, companyId);
      if (!keyBunch) {
        return res.status(404).json({ message: "Key bunch not found or access denied" });
      }

      // Get the logged-in user's name
      const userName = req.user?.firstName && req.user?.lastName 
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || officerName;

      // Get settings to find the correct "Present" status ID
      const settings = await storage.getSettings(keyBunch.companyId);
      const presentStatus = settings.statuses?.find((s: any) => 
        s.displayName === "Present" || s.name === "Present" || s.id === "active"
      );
      
      if (!presentStatus) {
        return res.status(500).json({ message: "Present status not found in settings" });
      }

      const updateData: any = {
        status: presentStatus.id,
        notes: "", // CLEAR notes when key is returned
        lastUpdated: new Date(),
      };
      
      // Only update tag if a new one is provided
      if (newTag && newTag.trim()) {
        updateData.currentTag = newTag.trim();
      }
      
      console.log("Updating key bunch with:", updateData);
      // SECURITY: Update with company validation
      const updatedBunch = await storage.updateKeyBunch(bunchId, updateData, companyId);
      console.log("Updated bunch result:", updatedBunch);

      // Create movement history record using the logged-in user's name
      await storage.createMovementHistory({
        keyBunchId: bunchId,
        performedBy: parseInt(req.user?.id) || 1,
        companyId: keyBunch.companyId,
        actionType: "return",
        fromLocationId: null,
        toLocationId: keyBunch.locationId,
        oldTag: keyBunch.currentTag,
        newTag: newTag || keyBunch.currentTag,
        notes: `Returned by ${userName}. ${newTag ? `New tag: ${newTag}. ` : ''}${notes || ''}`,
      });

      res.json(updatedBunch);
    } catch (error) {
      console.error("Return error:", error);
      res.status(500).json({ message: "Failed to return keys" });
    }
  });

  // Audit log endpoint (singular - legacy)
  app.get("/api/audit-log", requireAuth, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const keyBunchId = req.query.keyBunchId ? parseInt(req.query.keyBunchId as string) : undefined;
      
      const logs = await storage.getAuditLogs(limit, keyBunchId);
      res.json(logs);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Audit logs endpoint (plural - used by frontend)
  app.get("/api/audit-logs", requireAuth, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const keyBunchId = req.query.keyBunchId ? parseInt(req.query.keyBunchId as string) : undefined;
      
      const logs = await storage.getAuditLogs(limit, keyBunchId);
      res.json(logs);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Company setup route (no auth required for initial setup)
  app.post('/api/companies/setup', async (req: any, res: Response) => {
    try {
      const { name, slug, planType, settings } = req.body;
      
      // Validate input
      if (!name || !slug) {
        return res.status(400).json({ message: "Company name and slug are required" });
      }

      // Check if slug is available, if not make it unique
      let finalSlug = slug;
      const isAvailable = await companyService.isSlugAvailable(slug);
      if (!isAvailable) {
        // Generate a unique slug by appending timestamp
        finalSlug = `${slug}-${Date.now()}`;
        const isUniqueSlugAvailable = await companyService.isSlugAvailable(finalSlug);
        if (!isUniqueSlugAvailable) {
          return res.status(400).json({ message: "Unable to generate unique company identifier" });
        }
      }

      // Create company with a new admin user
      const { email, firstName, lastName, password } = req.body;
      
      if (!email || !firstName || !password) {
        return res.status(400).json({ message: "Email, first name, and password are required" });
      }

      // Create company and admin user
      const result = await companyService.createCompanyWithAdmin({
        name,
        slug: finalSlug,
        planType: planType || "basic",
        settings: settings || {}
      }, {
        email,
        firstName,
        lastName,
        password
      });

      // Automatically log in the new user
      (req.session as any).userId = result.user.id;

      res.json({ company: result.company, user: result.user });
    } catch (error) {
      console.error("Error creating company:", error);
      if (error.message && error.message.includes("email address already exists")) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create company" });
      }
    }
  });

  app.get('/api/companies/current', requireAuth, async (req: any, res: Response) => {
    try {
      const company = await companyService.getUserCompany(req.user.id);
      if (!company) {
        return res.status(404).json({ message: "No company found for user" });
      }
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.get('/api/companies/check-slug/:slug', async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const isAvailable = await companyService.isSlugAvailable(slug);
      res.json({ available: isAvailable });
    } catch (error) {
      console.error("Error checking slug:", error);
      res.status(500).json({ message: "Failed to check slug availability" });
    }
  });

  // Settings routes
  // Allow all authenticated users to read settings (needed for display names throughout the app)
  app.get('/api/settings', requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      const settings = await storage.getSettings(companyId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post('/api/settings/:category', requireAuth, requirePermission(PERMISSIONS.SYSTEM_ADMIN), async (req: any, res: Response) => {
    try {
      const { category } = req.params;
      const newItem = req.body;
      const companyId = req.user.companyId;
      
      // Prevent adding new statuses - only 4 core statuses allowed
      if (category === 'statuses') {
        return res.status(403).json({ message: "Cannot add new statuses. Only the 4 core statuses (Present, Missing, Issued, Inactive) are allowed." });
      }
      
      // Prevent adding new action types - only core action types allowed
      if (category === 'action-types' || category === 'actions') {
        return res.status(403).json({ message: "Cannot add new action types. Only the core action types (Issue, Return, Move, Audit Edit, Deleted) are allowed." });
      }
      
      // Convert hyphenated category names to camelCase for storage
      const categoryMap: { [key: string]: string } = {
        'key-types': 'keyTypes',
        'statuses': 'statuses',
        'location-types': 'locationTypes',
        'action-types': 'actions'
      };
      
      const storageCategory = categoryMap[category] || category;
      
      await storage.addSettingItem(storageCategory, newItem, companyId);
      res.json({ message: "Setting item created successfully", item: newItem });
    } catch (error) {
      console.error("Error creating setting item:", error);
      res.status(500).json({ message: "Failed to create setting item" });
    }
  });

  app.patch('/api/settings/:category/:id', requireAuth, requirePermission(PERMISSIONS.SYSTEM_ADMIN), async (req: any, res: Response) => {
    try {
      const { category, id } = req.params;
      const updates = req.body;
      
      // Convert hyphenated category names to camelCase for storage
      const categoryMap: { [key: string]: string } = {
        'key-types': 'keyTypes',
        'statuses': 'statuses',
        'location-types': 'locationTypes',
        'action-types': 'actions'
      };
      
      const storageCategory = categoryMap[category] || category;
      console.log("Updating setting item:", { category, storageCategory, id, updates });
      
      const companyId = req.user.companyId;
      const result = await storage.updateSettingItem(storageCategory, id, updates, companyId);
      console.log("Setting item updated:", result);
      
      res.json({ message: "Setting item updated successfully", item: updates });
    } catch (error) {
      console.error("Error updating setting item:", error);
      res.status(500).json({ message: "Failed to update setting item" });
    }
  });

  app.delete('/api/settings/:category/:id', requireAuth, requirePermission(PERMISSIONS.SYSTEM_ADMIN), async (req: any, res: Response) => {
    try {
      const { category, id } = req.params;
      
      // Prevent deleting statuses - only 4 core statuses allowed
      if (category === 'statuses') {
        return res.status(403).json({ message: "Cannot delete statuses. Only the 4 core statuses (Present, Missing, Issued, Inactive) are allowed." });
      }
      
      // Prevent deleting action types - only core action types allowed
      if (category === 'action-types' || category === 'actions') {
        return res.status(403).json({ message: "Cannot delete action types. Only the core action types (Issue, Return, Move, Audit Edit, Deleted) are allowed." });
      }
      
      // Convert hyphenated category names to camelCase for storage
      const categoryMap: { [key: string]: string } = {
        'key-types': 'keyTypes',
        'statuses': 'statuses',
        'location-types': 'locationTypes',
        'action-types': 'actions'
      };
      
      const storageCategory = categoryMap[category] || category;
      console.log("Deleting setting item:", { category, storageCategory, id });
      
      if (!id || id === "undefined") {
        return res.status(400).json({ message: "Invalid item ID" });
      }
      
      const companyId = req.user.companyId;
      await storage.deleteSettingItem(storageCategory, id, companyId);
      res.json({ message: "Setting item deleted successfully" });
    } catch (error) {
      console.error("Error deleting setting item:", error);
      res.status(500).json({ message: "Failed to delete setting item" });
    }
  });

  // NFC Management Routes
  app.post("/api/key-bunches/:id/link-nfc", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { nfcSerial } = req.body;
      
      const numericId = parseInt(id);
      if (isNaN(numericId)) {
        return res.status(400).json({ message: "Invalid key bunch ID" });
      }

      if (!nfcSerial || typeof nfcSerial !== 'string') {
        return res.status(400).json({ message: "NFC serial number is required" });
      }

      // Check if NFC tag is already linked to another key bunch (within same company)
      const companyId = req.user?.companyId;
      const existingKeyBunch = await storage.getKeyBunchByNFC(nfcSerial, companyId);
      if (existingKeyBunch && existingKeyBunch.id !== numericId) {
        return res.status(409).json({ 
          message: `NFC tag is already linked to key bunch ${existingKeyBunch.identifier}. Each NFC tag can only be linked to one key bunch.`,
          existingKeyBunch,
          conflict: true
        });
      }

      // SECURITY: Update with company validation
      const keyBunch = await storage.updateKeyBunch(numericId, { nfcSerial }, companyId);
      if (!keyBunch) {
        return res.status(404).json({ message: "Key bunch not found or access denied" });
      }

      // Log the NFC linking
      await storage.createMovementHistory({
        keyBunchId: numericId,
        performedBy: parseInt(req.user.id),
        companyId: companyId,
        actionType: "issue",
        fromLocationId: null,
        toLocationId: null,
        notes: `NFC tag ${nfcSerial} linked to key bunch`
      });

      res.json(keyBunch);
    } catch (error) {
      console.error("Error linking NFC tag:", error);
      res.status(500).json({ message: "Failed to link NFC tag" });
    }
  });

  app.delete("/api/key-bunches/:id/unlink-nfc", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const numericId = parseInt(id);
      if (isNaN(numericId)) {
        return res.status(400).json({ message: "Invalid key bunch ID" });
      }

      const companyId = req.user?.companyId;
      // SECURITY: Update with company validation
      const keyBunch = await storage.updateKeyBunch(numericId, { nfcSerial: null }, companyId);
      if (!keyBunch) {
        return res.status(404).json({ message: "Key bunch not found or access denied" });
      }

      // Log the NFC unlinking
      await storage.createMovementHistory({
        keyBunchId: numericId,
        performedBy: parseInt(req.user.id),
        companyId: companyId,
        actionType: "issue",
        fromLocationId: null,
        toLocationId: null,
        notes: "NFC tag unlinked from key bunch"
      });

      res.json(keyBunch);
    } catch (error) {
      console.error("Error unlinking NFC tag:", error);
      res.status(500).json({ message: "Failed to unlink NFC tag" });
    }
  });

  // NFC Audit Scan endpoint
  app.post("/api/audit/nfc-scan", requireAuth, async (req: any, res) => {
    try {
      const { auditSessionId, nfcSerial } = req.body;
      const companyId = req.user?.companyId;
      
      console.log("NFC Scan Request:", { auditSessionId, nfcSerial, companyId });
      
      if (!auditSessionId || !nfcSerial) {
        return res.status(400).json({ message: "Audit session ID and NFC serial are required" });
      }

      // Find key bunch by NFC serial (with company scoping for multi-tenant security)
      const keyBunch = await storage.getKeyBunchByNFC(nfcSerial, companyId);
      console.log("Found key bunch:", keyBunch ? `${keyBunch.identifier} (ID: ${keyBunch.id})` : "Not found");
      
      if (!keyBunch) {
        return res.status(404).json({ 
          message: "Key bunch not found for this NFC tag",
          nfcSerial 
        });
      }

      // Create audit scan record
      console.log("Creating audit scan...");
      const scan = await storage.createAuditScan({
        auditSessionId,
        keyBunchId: keyBunch.id,
        nfcScanned: nfcSerial,
        scanResult: "success",
        notes: `NFC scan successful for ${keyBunch.identifier}`
      });
      console.log("Audit scan created:", scan.id);

      // Update session scan count
      console.log("Updating session scan count...");
      const session = await storage.getAuditSession(auditSessionId);
      if (session) {
        await storage.updateAuditSession(session.id, {
          totalScanned: (session.totalScanned || 0) + 1
        });
        console.log("Session updated, total scanned:", (session.totalScanned || 0) + 1);
      }

      res.json({ scan, keyBunch });
    } catch (error: any) {
      console.error("Error processing NFC scan:", error);
      console.error("Error stack:", error.stack);
      console.error("Error message:", error.message);
      res.status(500).json({ message: "Failed to process NFC scan", error: error.message });
    }
  });

  // CSV Bulk Upload Routes
  app.get("/api/key-bunches/csv/template", requireAuth, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const settings = await storage.getSettings(companyId) as AppSettings;
      const locations = await storage.getLocations(companyId);

      // Create CSV header
      const headers = [
        "identifier",
        "type",
        "currentTag",
        "nfcSerial",
        "locationName",
        "status",
        "keyCount",
        "fobCount",
        "keyDescription",
        "address",
        "notes"
      ];

      // Create example rows with valid values (using display names)
      const exampleRows = [
        [
          "A24-001",
          settings.keyTypes?.[0]?.displayName || "Day Shift",
          "TAG-001",
          "",
          locations[0]?.name || "Main Office",
          settings.statuses?.[0]?.displayName || "Active",
          "3",
          "1",
          "Front door access keys",
          "23 bolerno place",
          "Original set with spare"
        ],
        [
          "A24-002",
          settings.keyTypes?.[1]?.displayName || "Night Shift",
          "",
          "NFC123456",
          locations[1]?.name || "Vehicle 1",
          settings.statuses?.[0]?.displayName || "Active",
          "2",
          "0",
          "After hours access",
          "Building A - Red 43",
          ""
        ]
      ];

      // Build CSV content
      const csvLines = [
        headers.join(","),
        ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(","))
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="key-bunches-template.csv"');
      res.send(csvLines.join('\n'));
    } catch (error) {
      console.error("Error generating CSV template:", error);
      res.status(500).json({ message: "Failed to generate CSV template" });
    }
  });

  app.post("/api/key-bunches/csv/validate", requireAuth, async (req: any, res) => {
    try {
      const { csvData } = req.body;
      
      if (!csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ message: "Invalid CSV data format" });
      }

      const companyId = req.user.companyId;
      const settings = await storage.getSettings(companyId) as AppSettings;
      const locations = await storage.getLocations(companyId);
      const existingBunches = await storage.getKeyBunches(companyId);

      const validatedRows = [];
      const errors = [];

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const rowNumber = i + 2; // +2 because header is row 1 and array is 0-indexed
        const rowErrors = [];

        // Validate required fields
        if (!row.identifier?.trim()) {
          rowErrors.push("Identifier is required");
        }
        if (!row.type?.trim()) {
          rowErrors.push("Type is required");
        }

        // Map display name to type ID using normalization helper
        let typeId = row.type;
        if (row.type) {
          const normalizedTypeId = await normalizeTypeToId(row.type, companyId);
          // Verify it's a valid type in company settings
          const typeMatch = settings.keyTypes?.find((t: any) => t.id === normalizedTypeId);
          if (typeMatch) {
            typeId = normalizedTypeId;
          } else {
            rowErrors.push(`Invalid type "${row.type}". Must be one of: ${settings.keyTypes?.map((t: any) => t.displayName).join(", ")}`);
          }
        }

        // Map display name to status ID (exact match, case-sensitive)
        let statusId = row.status || settings.statuses?.[0]?.id || "active";
        if (row.status) {
          const statusMatch = settings.statuses?.find((s: any) => 
            s.displayName === row.status || s.id === row.status
          );
          if (statusMatch) {
            statusId = statusMatch.id;
          } else {
            rowErrors.push(`Invalid status "${row.status}". Must be one of: ${settings.statuses?.map((s: any) => s.displayName).join(", ")}`);
          }
        }

        // Validate location exists
        const location = locations.find((l: any) => l.name === row.locationName);
        if (row.locationName && !location) {
          rowErrors.push(`Location "${row.locationName}" not found`);
        }

        // Check for duplicate identifier+type+location against existing bunches
        if (row.identifier?.trim() && typeId && !rowErrors.length) {
          // Normalize identifier: remove NBSP, zero-width spaces, collapse whitespace, lowercase
          const normalizedIdentifier = row.identifier
            .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
            .replace(/\u200B/g, '') // Remove zero-width spaces
            .replace(/\uFEFF/g, '') // Remove zero-width no-break spaces
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim()
            .toLowerCase();
          
          const locationId = location?.id || null;
          
          const duplicateIdentifier = existingBunches.find((b: any) => {
            const existingNormalized = b.identifier
              .replace(/\u00A0/g, ' ')
              .replace(/\u200B/g, '')
              .replace(/\uFEFF/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
            
            return existingNormalized === normalizedIdentifier &&
              b.type === typeId &&
              b.locationId === locationId &&
              b.companyId === companyId;
          });
          
          if (duplicateIdentifier) {
            rowErrors.push(`A key bunch with identifier "${row.identifier}" and this type already exists at this location`);
          }

          // Check for duplicate identifier+type+location within CSV
          const duplicateInCSV = validatedRows.find((r: any) => {
            const csvNormalized = r.identifier
              .replace(/\u00A0/g, ' ')
              .replace(/\u200B/g, '')
              .replace(/\uFEFF/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
            
            return csvNormalized === normalizedIdentifier &&
              r.type === typeId &&
              r.locationId === locationId;
          });
          
          if (duplicateInCSV) {
            rowErrors.push(`Duplicate identifier "${row.identifier}" with same type and location found in CSV at row ${duplicateInCSV.rowNumber}`);
          }
        }

        // Check for duplicate current tag within existing bunches (only if tag is provided)
        if (row.currentTag?.trim()) {
          const duplicateTag = existingBunches.find((b: any) => 
            b.currentTag === row.currentTag.trim() && b.companyId === companyId
          );
          if (duplicateTag) {
            rowErrors.push(`Tag "${row.currentTag}" already exists for key bunch ${duplicateTag.identifier}`);
          }

          // Check for duplicate current tag within CSV
          const duplicateInCSV = validatedRows.find((r: any) => r.currentTag === row.currentTag.trim());
          if (duplicateInCSV) {
            rowErrors.push(`Duplicate tag "${row.currentTag}" found in CSV at row ${duplicateInCSV.rowNumber}`);
          }
        }

        // Validate numeric fields
        if (row.keyCount && isNaN(parseInt(row.keyCount))) {
          rowErrors.push("Key count must be a number");
        }
        if (row.fobCount && isNaN(parseInt(row.fobCount))) {
          rowErrors.push("Fob count must be a number");
        }

        if (rowErrors.length > 0) {
          errors.push({
            row: rowNumber,
            errors: rowErrors,
            data: row
          });
        } else {
          validatedRows.push({
            ...row,
            type: typeId,
            status: statusId,
            currentTag: row.currentTag?.trim() || null,
            locationId: location?.id,
            keyCount: parseInt(row.keyCount) || 1,
            fobCount: parseInt(row.fobCount) || 0,
            rowNumber
          });
        }
      }

      res.json({
        valid: errors.length === 0,
        validatedRows,
        errors,
        summary: {
          total: csvData.length,
          valid: validatedRows.length,
          invalid: errors.length
        }
      });
    } catch (error) {
      console.error("Error validating CSV:", error);
      res.status(500).json({ message: "Failed to validate CSV data" });
    }
  });

  app.post("/api/key-bunches/csv/upload", requireAuth, requirePermission(PERMISSIONS.KEY_CREATE), async (req: any, res) => {
    try {
      const { validatedRows } = req.body;
      
      console.log("CSV Upload - Received validatedRows:", validatedRows);
      console.log("CSV Upload - Array length:", validatedRows?.length);
      
      if (!validatedRows || !Array.isArray(validatedRows)) {
        return res.status(400).json({ message: "Invalid data format" });
      }

      const companyId = req.user.companyId;
      const createdBunches = [];
      const failed = [];

      for (const row of validatedRows) {
        console.log("CSV Upload - Processing row:", row);
        try {
          // Validate NFC tag uniqueness before creating
          await assertNfcAvailable(row.nfcSerial || null, companyId);
          
          const keyBunch = await storage.createKeyBunch({
            companyId,
            identifier: row.identifier,
            type: row.type,
            currentTag: row.currentTag || null,
            nfcSerial: row.nfcSerial || null,
            locationId: row.locationId || null,
            status: row.status,
            keyCount: row.keyCount || 1,
            fobCount: row.fobCount || 0,
            keyDescription: row.keyDescription || null,
            address: row.address || null,
            notes: row.notes || null,
          });

          console.log("CSV Upload - Created key bunch:", keyBunch.id, keyBunch.identifier);
          createdBunches.push(keyBunch);

          // Create movement history entry
          await storage.createMovementHistory({
            keyBunchId: keyBunch.id,
            performedBy: req.user.id,
            actionType: "created",
            notes: `Bulk uploaded via CSV`,
            companyId
          });
        } catch (error: any) {
          console.error("CSV Upload - Error creating key bunch:", error);
          failed.push({
            row: row.rowNumber,
            identifier: row.identifier,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        created: createdBunches.length,
        failed: failed.length,
        createdBunches,
        failedRows: failed
      });
    } catch (error) {
      console.error("Error uploading CSV:", error);
      res.status(500).json({ message: "Failed to upload CSV data" });
    }
  });

  // Help Guide endpoint
  app.get("/api/help/guide", requireAuth, async (req: any, res) => {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const guidePath = path.join(process.cwd(), "EMPLOYEE_GUIDE.md");
      const content = await fs.readFile(guidePath, "utf-8");
      res.json({ content });
    } catch (error: any) {
      console.error("Error reading employee guide:", error);
      res.status(500).json({ message: "Failed to load employee guide" });
    }
  });

  // Help AI Assistant endpoint
  app.post("/api/help/chat", requireAuth, async (req: any, res) => {
    try {
      const { message, conversationHistory = [] } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }

      const { getUncachableOpenAIClient } = await import("./openaiClient");
      const openai = await getUncachableOpenAIClient();

      const systemPrompt = `You are a helpful assistant for the keylocate Key Management System. You help users understand how to use the application.

Key information about keylocate:
- It's a digital system for tracking physical keys across multiple locations
- Supports issuing keys to staff/customers, returning keys, moving keys between locations
- Has an audit system for verifying key presence at locations
- Supports NFC tag scanning for keys
- Has role-based permissions: Officer (basic user), Administrator, and Super Administrator
- All actions are logged in a complete audit trail
- Mobile-responsive for use on phones and tablets

Core features:
- Key Bunch Management: Track individual key sets with identifiers, types, tags, locations, statuses
- Location Management: Manage physical locations (vans, offices, warehouses)
- Audit System: Real-time auditing with NFC scanning support
- Movement History: Complete audit trail of all key movements
- Bulk Operations: CSV upload and bulk moves
- Customizable Settings: Admins can customize key types, location types, statuses

Common workflows:
1. Issue keys: Find key → Click Issue → Fill form (who, contact, notes) → Submit
2. Return keys: Find issued key → Click Return → Select location → Submit
3. Conduct audit: Select location → Start Audit → Scan/mark each key → Complete Audit
4. Add new key: Key Bunches → Add Key Bunch → Fill all fields → Create

Answer questions clearly and concisely. If you're not sure about something specific to their company's setup, suggest they check with their administrator. Be friendly and helpful.`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: message }
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 800,
      });

      const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

      res.json({ reply });
    } catch (error: any) {
      console.error("Error in help chat:", error);
      res.status(500).json({ message: "Failed to get AI response", error: error.message });
    }
  });

  // ─── Platform Admin Bootstrap (one-time setup, locked once a platform admin exists) ───
  app.post("/api/platform/bootstrap", async (req: any, res: Response) => {
    try {
      // Only allowed if no platform admins exist yet
      const allUsers = await storage.getAllUsers();
      const existingPlatformAdmin = allUsers.find(
        (u: any) => !u.companyId && u.role === "super_admin"
      );
      if (existingPlatformAdmin) {
        return res.status(403).json({ message: "Platform admin already exists" });
      }

      const { email, password, firstName, lastName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const hashed = await hashPassword(password);
      const user = await storage.createUser({
        email: email.toLowerCase().trim(),
        password: hashed,
        firstName: firstName || "Platform",
        lastName: lastName || "Admin",
        role: "super_admin",
        companyId: null as any,
        isActive: true,
        permissions: [],
        allowedLocationIds: [],
      } as any);

      res.json({ message: "Platform admin created", userId: user.id });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to create platform admin", error: error.message });
    }
  });

  // ─── Company Module endpoint (for any authenticated user — returns their company's modules) ───
  app.get("/api/company/modules", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.json([]); // Platform admins have no company modules
      const modules = await storage.getCompanyModules(companyId);
      res.json(modules);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch modules" });
    }
  });

  // ─── Platform Admin routes (only users with no companyId and super_admin role) ───
  function requirePlatformAdmin(req: any, res: Response, next: Function) {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "super_admin" || req.user.companyId) {
      return res.status(403).json({ message: "Platform admin access required" });
    }
    next();
  }

  // List all companies
  app.get("/api/platform/companies", requireAuth, requirePlatformAdmin, async (req: any, res: Response) => {
    try {
      const allCompanies = await storage.getAllCompanies();
      // Attach module data to each company
      const companiesWithModules = await Promise.all(
        allCompanies.map(async (company) => {
          const modules = await storage.getCompanyModules(company.id);
          return { ...company, modules };
        })
      );
      res.json(companiesWithModules);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Get a single company with its modules
  app.get("/api/platform/companies/:id", requireAuth, requirePlatformAdmin, async (req: any, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const modules = await storage.getCompanyModules(id);
      res.json({ ...company, modules });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  // Update company details (plan type, active status, etc.)
  app.patch("/api/platform/companies/:id", requireAuth, requirePlatformAdmin, async (req: any, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateCompany(id, req.body);
      if (!updated) return res.status(404).json({ message: "Company not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // Enable or disable a module for a company
  app.patch("/api/platform/companies/:id/modules/:moduleId", requireAuth, requirePlatformAdmin, async (req: any, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const { moduleId } = req.params;
      const { isEnabled, notes } = req.body;

      if (typeof isEnabled !== "boolean") {
        return res.status(400).json({ message: "isEnabled must be a boolean" });
      }

      const result = await storage.setCompanyModule(
        companyId,
        moduleId,
        isEnabled,
        req.user.id,
        notes,
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update module" });
    }
  });

  // ─── Uniform & Equipment Module routes ───────────────────────────────────────
  registerUniformRoutes(app, requireAuth);

  // ─── Lone Working Module routes ───────────────────────────────────────────────
  registerLoneWorkingRoutes(app, requireAuth, requirePermission, PERMISSIONS);
  startAlertChecker();
  startDeputySync();

  // ─── Deputy Sync API ──────────────────────────────────────────────────────────
  // Deputy connection test: GET /api/deputy/test
  app.get("/api/deputy/test", requireAuth, async (req: any, res: Response) => {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Admin only" });
    }
    const token = process.env.DEPUTY_API_TOKEN;
    if (!token) return res.json({ ok: false, error: "DEPUTY_API_TOKEN not set" });
    try {
      const r = await fetch("https://bee43b10084250.uk.deputy.com/api/v1/me", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const body = await r.text();
      res.json({ ok: r.ok, status: r.status, token_length: token.length, body: body.slice(0, 500) });
    } catch (e: any) {
      res.json({ ok: false, error: e.message });
    }
  });

  // Manual trigger: POST /api/deputy/sync
  app.post("/api/deputy/sync", requireAuth, async (req: any, res: Response) => {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Admin only" });
    }
    try {
      const result = await runDeputySync(req.user.companyId);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── Policies Module ─────────────────────────────────────────────────────────

  // GET /api/policies — admins see all; officers see only their permitted ones
  app.get("/api/policies", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const role = req.user.role;
      let result;
      if (role === "admin" || role === "super_admin") {
        result = await storage.getPolicies(companyId);
      } else {
        result = await storage.getPoliciesForUser(req.user.id, companyId);
      }
      // Strip file data from list view to keep payloads small
      const stripped = result.map(({ fileData, ...rest }) => rest);
      res.json(stripped);
    } catch (e: any) {
      console.error("GET /api/policies error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/policies/:id/file — returns the file (base64 data URI or raw bytes)
  app.get("/api/policies/:id/file", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const id = parseInt(req.params.id);
      const role = req.user.role;
      const policy = await storage.getPolicy(id, companyId);
      if (!policy) return res.status(404).json({ message: "Not found" });
      // Only admins can access any policy; everyone else needs explicit permission
      if (role !== "admin" && role !== "super_admin") {
        const ids = await storage.getUserPolicyIds(req.user.id, companyId);
        if (!ids.includes(id)) return res.status(403).json({ message: "Access denied" });
      }
      const buffer = Buffer.from(policy.fileData, "base64");
      res.setHeader("Content-Type", policy.fileType);
      res.setHeader("Content-Disposition", `inline; filename="${policy.fileName}"`);
      res.send(buffer);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/policies — admin only, upload a new policy
  app.post("/api/policies", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") {
        return res.status(403).json({ message: "Admin only" });
      }
      const { name, description, fileData, fileName, fileType, fileSize } = req.body;
      if (!name || !fileData || !fileName || !fileType) {
        return res.status(400).json({ message: "name, fileData, fileName, fileType required" });
      }
      const policy = await storage.createPolicy({
        companyId,
        name,
        description: description ?? null,
        fileData,
        fileName,
        fileType,
        fileSize: fileSize ?? null,
        uploadedBy: req.user.id,
      });
      const { fileData: _, ...safe } = policy;
      res.status(201).json(safe);
    } catch (e: any) {
      console.error("POST /api/policies error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/policies/:id — admin only, update name/description and optionally replace file
  app.patch("/api/policies/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") {
        return res.status(403).json({ message: "Admin only" });
      }
      const id = parseInt(req.params.id);
      const { name, description, fileData, fileName, fileType, fileSize } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (fileData !== undefined) {
        updates.fileData = fileData;
        updates.fileName = fileName;
        updates.fileType = fileType;
        updates.fileSize = fileSize ?? null;
      }
      const updated = await storage.updatePolicy(id, companyId, updates);
      if (!updated) return res.status(404).json({ message: "Policy not found" });
      const { fileData: _, ...safe } = updated;
      res.json(safe);
    } catch (e: any) {
      console.error("PATCH /api/policies/:id error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/policies/:id — admin only
  app.delete("/api/policies/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") {
        return res.status(403).json({ message: "Admin only" });
      }
      const id = parseInt(req.params.id);
      await storage.deletePolicy(id, companyId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/users/:id/policy-ids — admin sees which policies a user has access to
  app.get("/api/users/:id/policy-ids", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") {
        return res.status(403).json({ message: "Admin only" });
      }
      const userId = parseInt(req.params.id);
      const ids = await storage.getUserPolicyIds(userId, companyId);
      res.json(ids);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PUT /api/users/:id/policies — admin sets which policies a user can access
  app.put("/api/users/:id/policies", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") {
        return res.status(403).json({ message: "Admin only" });
      }
      const userId = parseInt(req.params.id);
      const { policyIds } = req.body;
      if (!Array.isArray(policyIds)) return res.status(400).json({ message: "policyIds must be an array" });
      await storage.setPolicyPermissions(userId, companyId, policyIds);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // ASSIGNMENT INSTRUCTIONS MODULE
  // ═══════════════════════════════════════════════════════════

  const bcrypt = await import('bcrypt');

  // ── Template Sections (admin only) ──────────────────────────

  app.get("/api/assignments/template", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const sections = await storage.getAssignmentTemplateSections(companyId);
      res.json(sections);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/assignments/template", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") return res.status(403).json({ message: "Admin only" });
      const { type, label, options, required, sortOrder } = req.body;
      if (!type || !label) return res.status(400).json({ message: "type and label required" });
      const sections = await storage.getAssignmentTemplateSections(companyId);
      const nextOrder = sortOrder ?? sections.length;
      const section = await storage.createAssignmentTemplateSection({ companyId, type, label, options: options ?? null, required: required ?? false, isActive: true, sortOrder: nextOrder });
      // Sync the new section to all existing location assignments
      await storage.syncTemplateSectionToAllAssignments(section.id, companyId);
      res.status(201).json(section);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/assignments/template/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      const { label, options, required } = req.body;
      const updated = await storage.updateAssignmentTemplateSection(id, companyId, { label, options, required });
      if (!updated) return res.status(404).json({ message: "Section not found" });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/assignments/template/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      await storage.deleteAssignmentTemplateSection(id, companyId);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/assignments/template/reorder", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") return res.status(403).json({ message: "Admin only" });
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) return res.status(400).json({ message: "orderedIds must be an array" });
      await storage.reorderAssignmentTemplateSections(companyId, orderedIds);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Key Bunch Assignment Content ─────────────────────────────
  // Key: ?identifier=X&address=Y

  // List all unique (identifier, address) pairs from key bunches in this company
  app.get("/api/assignments/keybunches", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const allBunches = await storage.getKeyBunches(companyId);
      const active = allBunches.filter((b: any) => !b.isDeleted);
      // Deduplicate by (identifier, address) — ignore bunches with no identifier or no address
      const seen = new Set<string>();
      const unique: Array<{ identifier: string; address: string }> = [];
      for (const b of active) {
        const id = (b as any).identifier?.trim();
        const addr = (b as any).address?.trim();
        if (!id || !addr) continue;
        const key = `${id}|||${addr}`;
        if (!seen.has(key)) { seen.add(key); unique.push({ identifier: id, address: addr }); }
      }
      // Sort by identifier then address
      unique.sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }) || a.address.localeCompare(b.address));
      res.json(unique);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/assignments/keybunch", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const { identifier, address } = req.query as { identifier?: string; address?: string };
      if (!identifier || !address) return res.status(400).json({ message: "identifier and address required" });
      const result = await storage.getAssignmentWithValues(companyId, identifier, address);
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/assignments/keybunch", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const { identifier, address } = req.query as { identifier?: string; address?: string };
      if (!identifier || !address) return res.status(400).json({ message: "identifier and address required" });
      const { values, changes } = req.body;
      if (!Array.isArray(values)) return res.status(400).json({ message: "values must be an array" });
      const result = await storage.getAssignmentWithValues(companyId, identifier, address);
      if (!result) return res.status(404).json({ message: "Assignment not found" });
      await storage.saveAssignmentValues(result.assignment.id, companyId, values);
      if (changes && changes.length > 0) {
        const editorName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
        await storage.logAssignmentChange({
          assignmentId: result.assignment.id,
          locationId: 0,
          companyId,
          editorType: 'staff',
          editorId: req.user.id,
          editorName,
          changes,
        });
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/assignments/keybunch/history", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const { identifier, address } = req.query as { identifier?: string; address?: string };
      if (!identifier || !address) return res.status(400).json({ message: "identifier and address required" });
      const assignment = await storage.getOrCreateLocationAssignment(companyId, identifier, address);
      const log = await storage.getAssignmentAuditLog(assignment.id, companyId);
      res.json(log);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Access Password ─────────────────────────────────────────

  app.get("/api/assignments/access-password/check", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const hash = await storage.getAssignmentPassword(companyId);
      res.json({ hasPassword: !!hash });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/assignments/access-password/verify", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const { password } = req.body;
      const hash = await storage.getAssignmentPassword(companyId);
      if (!hash) return res.json({ valid: true }); // no password set = always accessible
      const valid = await bcrypt.compare(password, hash);
      res.json({ valid });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/assignments/access-password/set", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") return res.status(403).json({ message: "Admin only" });
      const { password } = req.body;
      if (!password) return res.status(400).json({ message: "password required" });
      const hash = await bcrypt.hash(password, 10);
      await storage.setAssignmentPassword(companyId, hash);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Customer Users (admin management) ──────────────────────

  app.get("/api/assignments/customers", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") return res.status(403).json({ message: "Admin only" });
      const customers = await storage.listCustomerUsers(companyId);
      res.json(customers.map(c => ({ ...c, passwordHash: undefined })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/assignments/customers", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") return res.status(403).json({ message: "Admin only" });
      const { email, name, bunches } = req.body;
      if (!email) return res.status(400).json({ message: "email required" });
      const customer = await storage.createCustomerUser({ companyId, email, name });
      if (bunches && bunches.length > 0) {
        const ids: number[] = [];
        for (const b of bunches) {
          const rec = await storage.getOrCreateLocationAssignment(companyId, b.identifier, b.address);
          ids.push(rec.id);
        }
        await storage.setCustomerLocationAccess(customer.id, companyId, ids);
      }
      const { passwordHash: _, ...safe } = customer;
      res.status(201).json({ ...safe, assignmentBunches: bunches ?? [] });
    } catch (e: any) {
      if (e.message?.includes('unique')) return res.status(409).json({ message: "A customer with this email already exists" });
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/assignments/customers/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      const { name, bunches, isActive } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (isActive !== undefined) updates.isActive = isActive;
      await storage.updateCustomerUser(id, updates);
      if (bunches !== undefined) {
        const ids: number[] = [];
        for (const b of bunches) {
          const rec = await storage.getOrCreateLocationAssignment(companyId, b.identifier, b.address);
          ids.push(rec.id);
        }
        await storage.setCustomerLocationAccess(id, companyId, ids);
      }
      const updated = await storage.getCustomerUser(id, companyId);
      const { passwordHash: _, ...safe } = updated!;
      res.json({ ...safe, assignmentBunches: bunches ?? [] });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/assignments/customers/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (req.user.role !== "admin" && req.user.role !== "super_admin") return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      await storage.deleteCustomerUser(id, companyId);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Customer Portal Auth (public) ───────────────────────────

  app.post("/api/customer-portal/login", async (req: any, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: "email and password required" });
      const customer = await storage.getCustomerUserByEmail(email);
      if (!customer || !customer.isActive) return res.status(401).json({ message: "Invalid credentials" });
      if (!customer.passwordHash) return res.status(401).json({ message: "Account not set up yet. Please use your invite link." });
      const valid = await bcrypt.compare(password, customer.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      const token = await storage.createCustomerSession(customer.id, customer.companyId);
      const { passwordHash: _, ...safe } = customer;
      res.json({ token, customer: { ...safe } });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/customer-portal/logout", async (req: any, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) await storage.deleteCustomerSession(token);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/customer-portal/me", async (req: any, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ message: "No token" });
      const session = await storage.getCustomerSession(token);
      if (!session) return res.status(401).json({ message: "Session expired" });
      const customer = await storage.getCustomerUser(session.customerId, session.companyId);
      if (!customer || !customer.isActive) return res.status(401).json({ message: "Account inactive" });
      const { passwordHash: _, ...safe } = customer;
      res.json({ ...safe });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Customer invite setup — GET to show form, POST to set password
  app.get("/api/customer-portal/invite/:token", async (req: any, res: Response) => {
    try {
      const customer = await storage.getCustomerUserByInviteToken(req.params.token);
      if (!customer || !customer.inviteTokenExpiry || customer.inviteTokenExpiry < new Date()) {
        return res.status(404).json({ message: "Invalid or expired invite link" });
      }
      const { passwordHash: _, inviteToken: __, ...safe } = customer;
      res.json(safe);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/customer-portal/invite/:token", async (req: any, res: Response) => {
    try {
      const customer = await storage.getCustomerUserByInviteToken(req.params.token);
      if (!customer || !customer.inviteTokenExpiry || customer.inviteTokenExpiry < new Date()) {
        return res.status(400).json({ message: "Invalid or expired invite link" });
      }
      const { password, name } = req.body;
      if (!password || password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      const hash = await bcrypt.hash(password, 10);
      await storage.updateCustomerUser(customer.id, { passwordHash: hash, name: name || customer.name, inviteToken: null, inviteTokenExpiry: null });
      const token = await storage.createCustomerSession(customer.id, customer.companyId);
      const { passwordHash: _ph, inviteToken: _it, ...safe } = customer;
      res.json({ token, customer: { ...safe, name: name || customer.name } });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Customer portal — get their accessible key bunch assignments
  app.get("/api/customer-portal/assignments", async (req: any, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ message: "No token" });
      const session = await storage.getCustomerSession(token);
      if (!session) return res.status(401).json({ message: "Session expired" });
      const assignmentIds = await storage.getCustomerAssignmentIds(session.customerId, session.companyId);
      if (assignmentIds.length === 0) return res.json([]);
      // Fetch assignment records to get identifier + address
      const { db } = await import('./db');
      const { locationAssignments } = await import('@shared/schema');
      const { inArray } = await import('drizzle-orm');
      const rows = await db.select().from(locationAssignments).where(inArray(locationAssignments.id, assignmentIds));
      const result = rows.map(r => ({
        assignmentId: r.id,
        identifier: r.keyBunchIdentifier,
        address: r.keyBunchAddress,
      })).filter(r => r.identifier && r.address);
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Customer portal — get assignment content (by assignment ID)
  app.get("/api/customer-portal/assignment/:assignmentId", async (req: any, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ message: "No token" });
      const session = await storage.getCustomerSession(token);
      if (!session) return res.status(401).json({ message: "Session expired" });
      const assignmentId = parseInt(req.params.assignmentId);
      const myAssignmentIds = await storage.getCustomerAssignmentIds(session.customerId, session.companyId);
      if (!myAssignmentIds.includes(assignmentId)) return res.status(403).json({ message: "Access denied" });
      // Fetch the assignment to get identifier + address
      const { db } = await import('./db');
      const { locationAssignments } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const [assignment] = await db.select().from(locationAssignments).where(eq(locationAssignments.id, assignmentId));
      if (!assignment || !assignment.keyBunchIdentifier || !assignment.keyBunchAddress) return res.status(404).json({ message: "Not found" });
      const result = await storage.getAssignmentWithValues(session.companyId, assignment.keyBunchIdentifier, assignment.keyBunchAddress);
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Customer portal — save assignment content (by assignment ID)
  app.put("/api/customer-portal/assignment/:assignmentId", async (req: any, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ message: "No token" });
      const session = await storage.getCustomerSession(token);
      if (!session) return res.status(401).json({ message: "Session expired" });
      const assignmentId = parseInt(req.params.assignmentId);
      const myAssignmentIds = await storage.getCustomerAssignmentIds(session.customerId, session.companyId);
      if (!myAssignmentIds.includes(assignmentId)) return res.status(403).json({ message: "Access denied" });
      const { values, changes } = req.body;
      if (!Array.isArray(values)) return res.status(400).json({ message: "values must be an array" });
      await storage.saveAssignmentValues(assignmentId, session.companyId, values);
      const customer = await storage.getCustomerUser(session.customerId, session.companyId);
      const editorName = customer?.name || customer?.email || 'Customer';
      if (changes && changes.length > 0) {
        await storage.logAssignmentChange({
          assignmentId,
          locationId: 0,
          companyId: session.companyId,
          editorType: 'customer',
          editorId: session.customerId,
          editorName,
          changes,
        });
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Company Backups (Platform Admin only) ───────────────────────────────────
  // List backups for a company
  app.get("/api/platform/companies/:id/backups", requireAuth, requirePlatformAdmin, async (req: any, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const backups = await listCompanyBackups(companyId);
      res.json(backups);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Trigger a manual backup for a company
  app.post("/api/platform/companies/:id/backups", requireAuth, requirePlatformAdmin, async (req: any, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const result = await createCompanyBackup(companyId, "manual");
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Download a backup as JSON
  app.get("/api/platform/backups/:id/download", requireAuth, requirePlatformAdmin, async (req: any, res: Response) => {
    try {
      const backupId = parseInt(req.params.id);
      const backup = await getBackup(backupId);
      if (!backup) return res.status(404).json({ message: "Backup not found" });
      const filename = `company-${backup.company_id}-backup-${new Date(backup.created_at as string).toISOString().split("T")[0]}.json`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/json");
      res.send(backup.data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Reports module ──────────────────────────────────────────────────────────
  const isAdmin = (u: any) => u?.role === "admin" || u?.role === "super_admin";

  // List all templates (admin) or only ones user has access to (staff)
  app.get("/api/report-templates", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (isAdmin(req.user)) {
        const templates = await storage.getReportTemplates(companyId);
        return res.json(templates.map(t => ({ ...t, canFill: true, canView: true })));
      }
      const rows = await storage.getReportTemplatesForUser(req.user.id, companyId);
      res.json(rows.map(r => ({ ...r.template, canFill: r.canFill, canView: r.canView })));
    } catch (e: any) {
      console.error("GET /api/report-templates error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/report-templates/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const id = parseInt(req.params.id);
      const template = await storage.getReportTemplate(id, companyId);
      if (!template) return res.status(404).json({ message: "Not found" });
      if (!isAdmin(req.user)) {
        const perms = await storage.getUserReportPermissions(req.user.id, companyId);
        const p = perms.find(p => p.templateId === id);
        if (!p || (!p.canFill && !p.canView)) return res.status(403).json({ message: "Access denied" });
      }
      res.json(template);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/report-templates", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (!isAdmin(req.user)) return res.status(403).json({ message: "Admin only" });
      const { name, description, fields } = req.body;
      if (!name || !Array.isArray(fields)) return res.status(400).json({ message: "name and fields required" });
      const template = await storage.createReportTemplate({
        companyId,
        name,
        description: description ?? null,
        fields,
        isActive: true,
        createdBy: req.user.id,
      });
      res.status(201).json(template);
    } catch (e: any) {
      console.error("POST /api/report-templates error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // Simple in-memory per-user rate limiter for the AI generator (5 calls / 10 minutes)
  const aiGenRateLimit = new Map<number, number[]>();
  function checkAiRateLimit(userId: number): { ok: boolean; retryAfterSec: number } {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const limit = 5;
    const arr = (aiGenRateLimit.get(userId) ?? []).filter(t => now - t < windowMs);
    if (arr.length >= limit) {
      const retryAfterSec = Math.ceil((windowMs - (now - arr[0])) / 1000);
      aiGenRateLimit.set(userId, arr);
      return { ok: false, retryAfterSec };
    }
    arr.push(now);
    aiGenRateLimit.set(userId, arr);
    return { ok: true, retryAfterSec: 0 };
  }

  // AI-generate a report template draft from a free-text description / pasted spreadsheet.
  // Saves the result as an INACTIVE template in a single round-trip so admins can review before going live.
  app.post("/api/report-templates/ai-generate", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (!isAdmin(req.user)) return res.status(403).json({ message: "Admin only" });

      const rl = checkAiRateLimit(req.user.id);
      if (!rl.ok) {
        res.setHeader("Retry-After", String(rl.retryAfterSec));
        return res.status(429).json({ message: `Too many AI generations — try again in ${Math.ceil(rl.retryAfterSec / 60)} min` });
      }

      const { description } = req.body ?? {};
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "description is required" });
      }
      if (description.length > 30000) {
        return res.status(400).json({ message: "description is too long (max 30,000 chars)" });
      }

      const { getUncachableOpenAIClient } = await import("./openaiClient");
      const openai = await getUncachableOpenAIClient();

      const systemPrompt = `You design report templates for a key-management & site-operations platform.

Given a user's description of a report (or a pasted spreadsheet of fields/logic), produce a JSON template definition.

Return ONLY valid JSON matching this exact shape (no prose, no code fences):
{
  "name": string,                    // short title for the template
  "description": string,             // optional one-line summary (use empty string if none)
  "fields": Array<Field>
}

Each Field has:
{
  "id": string,                      // a short stable id like "f1", "f2", ...
  "type": "heading" | "text" | "textarea" | "number" | "date" | "time" | "dropdown" | "checkbox" | "image",
  "label": string,
  "required": boolean,               // optional, default false
  "helpText": string,                // optional
  "placeholder": string,             // optional, only for text/textarea/number
  "options": string[],               // REQUIRED only for type="dropdown"
  "followUps": {                     // OPTIONAL conditional follow-up text boxes
    [optionValue: string]: { "label": string, "required": boolean }
  }
}

Rules:
- Use "heading" fields to group related questions (no input, just a section title).
- Use "dropdown" when the input is a fixed set of choices.
- Use "checkbox" for simple yes/no toggles. For checkbox followUps, the key MUST be "true".
- Use "image" when a photo upload is needed (e.g. "photo of damage").
- For dropdowns, add followUps when an option clearly needs more detail (e.g. "Other" → "Please specify"; "No" → "Reason"; "Damage Found" → "Describe the damage").
- For checkboxes, only add followUps["true"] when ticking the box should reveal a follow-up question.
- Keep labels clear and concise. Required = true for anything obviously mandatory.
- Aim for a complete, well-organised template. Do not invent fields not implied by the input, but DO infer obvious follow-ups and groupings.

Output JSON ONLY.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: description },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      console.log("[ai-generate] raw response length:", raw.length, "preview:", raw.slice(0, 500));
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        console.error("[ai-generate] JSON parse failed:", parseErr, "raw:", raw.slice(0, 1000));
        return res.status(502).json({ message: "AI returned invalid JSON" });
      }
      console.log("[ai-generate] parsed name:", parsed?.name, "fields count:", Array.isArray(parsed?.fields) ? parsed.fields.length : "not array");

      // Sanitize and normalise
      const allowedTypes = new Set(["heading", "text", "textarea", "number", "date", "time", "dropdown", "checkbox", "image"]);
      const MAX_FIELDS = 100;
      const MAX_OPTIONS = 50;
      const MAX_OPTION_LEN = 200;

      const rawFields = Array.isArray(parsed.fields) ? parsed.fields.slice(0, MAX_FIELDS) : [];
      const usedIds = new Set<string>();
      const cleanFields = rawFields
        .filter((f: any) => f && typeof f.label === "string" && allowedTypes.has(f.type))
        .map((f: any, idx: number) => {
          // Generate a guaranteed-unique server-side id; never reflect client-supplied ids that could collide
          // with each other or with the FOLLOWUP_KEY suffix ("__followup").
          let id = `f${idx + 1}`;
          let n = idx + 1;
          while (usedIds.has(id)) { n += 1; id = `f${n}`; }
          usedIds.add(id);

          const out: any = {
            id,
            type: f.type,
            label: String(f.label).slice(0, 200),
            required: !!f.required,
          };
          if (typeof f.helpText === "string" && f.helpText) out.helpText = f.helpText.slice(0, 500);
          if ((f.type === "text" || f.type === "textarea" || f.type === "number") &&
              typeof f.placeholder === "string" && f.placeholder) {
            out.placeholder = f.placeholder.slice(0, 200);
          }
          if (f.type === "dropdown") {
            const seen = new Set<string>();
            const opts: string[] = [];
            const rawOpts = Array.isArray(f.options) ? f.options : [];
            for (const o of rawOpts) {
              const v = String(o).trim().slice(0, MAX_OPTION_LEN);
              if (!v || seen.has(v)) continue;
              seen.add(v);
              opts.push(v);
              if (opts.length >= MAX_OPTIONS) break;
            }
            out.options = opts.length > 0 ? opts : ["Option 1"];
          }
          // Follow-ups only on dropdown / checkbox; ignored on every other type
          if ((f.type === "dropdown" || f.type === "checkbox") && f.followUps && typeof f.followUps === "object") {
            const cleaned: Record<string, { label?: string; required?: boolean }> = {};
            for (const [key, val] of Object.entries(f.followUps as Record<string, any>)) {
              if (!val || typeof val !== "object") continue;
              const k = f.type === "checkbox" ? "true" : String(key);
              if (f.type === "dropdown" && !out.options.includes(k)) continue;
              const label = typeof val.label === "string" && val.label.trim() ? val.label.trim().slice(0, 300) : undefined;
              cleaned[k] = { label, required: !!val.required };
              // Checkbox: only one possible key — stop after the first valid entry
              if (f.type === "checkbox") break;
            }
            if (Object.keys(cleaned).length > 0) out.followUps = cleaned;
          }
          return out;
        });

      const cleanName = typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name.trim().slice(0, 200)
        : "Untitled report";
      const cleanDescription = typeof parsed.description === "string" ? parsed.description.slice(0, 500) : "";

      console.log("[ai-generate] cleanFields count after sanitization:", cleanFields.length);

      // Don't save an empty draft — surface an error so the admin can retry / refine the prompt
      if (cleanFields.length === 0) {
        return res.status(502).json({
          message: "The AI didn't return any usable fields. Try giving more detail in the description, or upload a clearer spreadsheet of the fields you need.",
        });
      }

      // Atomic save: persist as INACTIVE so the admin can review in the builder before staff can use it.
      const created = await storage.createReportTemplate({
        companyId,
        name: cleanName,
        description: cleanDescription || null,
        fields: cleanFields,
        isActive: false,
        createdBy: req.user.id,
      });
      res.status(201).json(created);
    } catch (e: any) {
      console.error("POST /api/report-templates/ai-generate error:", e);
      res.status(500).json({ message: "AI generation failed. Please try again." });
    }
  });

  app.patch("/api/report-templates/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (!isAdmin(req.user)) return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      const { name, description, fields, isActive } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (fields !== undefined) updates.fields = fields;
      if (isActive !== undefined) updates.isActive = isActive;
      const updated = await storage.updateReportTemplate(id, companyId, updates);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/report-templates/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (!isAdmin(req.user)) return res.status(403).json({ message: "Admin only" });
      await storage.deleteReportTemplate(parseInt(req.params.id), companyId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Permissions for a template
  app.get("/api/report-templates/:id/permissions", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (!isAdmin(req.user)) return res.status(403).json({ message: "Admin only" });
      const perms = await storage.getReportTemplatePermissions(parseInt(req.params.id), companyId);
      res.json(perms);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.put("/api/report-templates/:id/permissions", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (!isAdmin(req.user)) return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) return res.status(400).json({ message: "permissions array required" });
      // Verify the template belongs to this company before mutating permissions
      const tpl = await storage.getReportTemplate(id, companyId);
      if (!tpl) return res.status(404).json({ message: "Template not found" });
      // Verify each user belongs to this company
      const userIds = Array.from(new Set(permissions.map((p: any) => p.userId)));
      for (const uid of userIds) {
        const u = await storage.getUser(uid);
        if (!u || u.companyId !== companyId) {
          return res.status(400).json({ message: `User ${uid} is not in this company` });
        }
      }
      const cleaned = permissions.map((p: any) => ({
        userId: parseInt(p.userId),
        canFill: !!p.canFill,
        canView: !!p.canView,
      }));
      await storage.setReportTemplatePermissions(id, companyId, cleaned);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Submissions
  app.post("/api/report-templates/:id/submissions", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const templateId = parseInt(req.params.id);
      const template = await storage.getReportTemplate(templateId, companyId);
      if (!template) return res.status(404).json({ message: "Template not found" });
      if (!template.isActive) return res.status(400).json({ message: "This report template is inactive" });
      if (!isAdmin(req.user)) {
        const perms = await storage.getUserReportPermissions(req.user.id, companyId);
        const p = perms.find(p => p.templateId === templateId);
        if (!p?.canFill) return res.status(403).json({ message: "Cannot fill this report" });
      }
      const { data } = req.body;
      if (!data || typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ message: "data required" });
      // Cap payload to ~12MB to prevent abuse via huge base64 images
      if (JSON.stringify(data).length > 12 * 1024 * 1024) {
        return res.status(413).json({ message: "Submission too large (limit ~12MB)" });
      }
      const submission = await storage.createReportSubmission({
        templateId,
        companyId,
        submittedBy: req.user.id,
        data,
      });
      res.status(201).json(submission);
    } catch (e: any) {
      console.error("POST submission error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/report-templates/:id/submissions", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const templateId = parseInt(req.params.id);
      if (!isAdmin(req.user)) {
        const perms = await storage.getUserReportPermissions(req.user.id, companyId);
        const p = perms.find(p => p.templateId === templateId);
        if (!p?.canView) return res.status(403).json({ message: "Cannot view submissions" });
      }
      const submissions = await storage.getReportSubmissions(templateId, companyId);
      res.json(submissions);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/report-submissions/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      const id = parseInt(req.params.id);
      const submission = await storage.getReportSubmission(id, companyId);
      if (!submission) return res.status(404).json({ message: "Not found" });
      if (!isAdmin(req.user)) {
        const perms = await storage.getUserReportPermissions(req.user.id, companyId);
        const p = perms.find(p => p.templateId === submission.templateId);
        if (!p?.canView && submission.submittedBy !== req.user.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      const template = await storage.getReportTemplate(submission.templateId, companyId);
      res.json({ submission, template });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/report-submissions/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) return res.status(403).json({ message: "No company" });
      if (!isAdmin(req.user)) return res.status(403).json({ message: "Admin only" });
      await storage.deleteReportSubmission(parseInt(req.params.id), companyId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Start the daily backup scheduler
  startBackupScheduler();

  const httpServer = createServer(app);
  return httpServer;
}
