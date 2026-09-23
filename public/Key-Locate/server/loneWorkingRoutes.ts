import type { Express, Request, Response } from "express";
import twilio from "twilio";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { db } from "./db";
import { users } from "../shared/schema";
import {
  getLwJobs, getLwJob, createLwJob, updateLwJob, deleteLwJob,
  getLwAssignments, getLwAssignmentsByUser, createLwAssignment, updateLwAssignment,
  getLwShifts, getLwShiftsByUser, createLwShift, updateLwShift, deleteLwShift,
  getActiveLwCheckIn, getLwCheckIns, createLwCheckIn, updateLwCheckIn,
  getLwContacts, createLwContact, updateLwContact, deleteLwContact,
  getLwAlerts, createLwAlert, updateLwAlert,
  getPendingMissedCheckInShifts, getPhase2ManagerAlertShifts, MANAGER_ALERT_DELAY_MS, getLwOverview,
} from "./loneWorkingStorage";

// ─── Twilio helpers ───────────────────────────────────────────────────────────

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

interface AlertDetails {
  employeeName: string;
  locationName: string;
  shiftTime: string;
}

function buildEmployeeCallMessage({ employeeName, locationName, shiftTime }: AlertDetails): string {
  return `This is an automated alert from Keylocate. ${employeeName}, you have not checked in for your shift at ${locationName}, scheduled for ${shiftTime}. Please check in or inform a manager immediately.`;
}

function buildEmployeeSmsMessage({ employeeName, locationName, shiftTime }: AlertDetails): string {
  return `Keylocate Alert: ${employeeName}, you have not checked in at ${locationName} for your ${shiftTime} shift. Please check in or inform a manager.`;
}

function buildManagerCallMessage({ employeeName, locationName, shiftTime }: AlertDetails): string {
  return `This is an automated alert from Keylocate. ${employeeName} has not checked in for their shift at ${locationName}, scheduled for ${shiftTime}. Please investigate immediately.`;
}

function buildManagerSmsMessage({ employeeName, locationName, shiftTime }: AlertDetails): string {
  return `Keylocate Alert: ${employeeName} has not checked in at ${locationName} for their ${shiftTime} shift. Please investigate immediately.`;
}

async function makeAlertCall(to: string, details: AlertDetails, isEmployee = false): Promise<string | null> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!client || !from) {
    console.log(`[LW Alert] Twilio not configured. Would call ${to} about ${details.employeeName}`);
    return null;
  }
  try {
    const msg = isEmployee ? buildEmployeeCallMessage(details) : buildManagerCallMessage(details);
    const call = await client.calls.create({
      to,
      from,
      twiml: `<Response><Say>${msg}</Say><Pause length="1"/><Say>${msg}</Say></Response>`,
    });
    console.log(`[LW Alert] Call placed to ${to}: ${call.sid}`);
    return call.sid;
  } catch (err) {
    console.error(`[LW Alert] Twilio call error to ${to}:`, err);
    return null;
  }
}

/** Convert a UK local number (07xxx) to E.164 (+447xxx) for SMS routing. */
function toE164UK(phone: string): string {
  const digits = phone.replace(/\D/g, ""); // strip spaces, dashes, etc.
  if (digits.startsWith("44")) return `+${digits}`;
  if (digits.startsWith("0")) return `+44${digits.slice(1)}`;
  return `+${digits}`; // assume already international
}

async function makeAlertSms(to: string, details: AlertDetails, isEmployee = false): Promise<void> {
  const client = getTwilioClient();
  if (!client) {
    console.log(`[LW Alert] Twilio not configured. Would SMS ${to} about ${details.employeeName}`);
    return;
  }

  // Use TWILIO_SMS_FROM_NUMBER if set, otherwise fall back to TWILIO_FROM_NUMBER.
  // The number must be SMS-capable (e.g. UK mobile, US long code).
  const smsFrom = process.env.TWILIO_SMS_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;
  if (!smsFrom) {
    console.warn(`[LW Alert] SMS skipped — neither TWILIO_SMS_FROM_NUMBER nor TWILIO_FROM_NUMBER is set.`);
    return;
  }

  try {
    const toE164 = toE164UK(to);
    const body = isEmployee ? buildEmployeeSmsMessage(details) : buildManagerSmsMessage(details);
    console.log(`[LW Alert] Sending SMS from ${smsFrom}: ${to} → ${toE164}`);
    const sms = await client.messages.create({ to: toE164, from: smsFrom, body });
    console.log(`[LW Alert] SMS sent to ${toE164}: ${sms.sid}`);
  } catch (err) {
    console.error(`[LW Alert] Twilio SMS error to ${toE164UK(to)}:`, err);
  }
}

// ─── Alert checker — runs every 30 seconds ────────────────────────────────────
// Two-phase alert system:
//   Phase 1 (immediate): Employee gets called + texted as soon as check-in is missed.
//   Phase 2 (5 min later): If employee still hasn't checked in, call receiver managers are alerted.

function resolveAlertDetails(shift: any): AlertDetails {
  const contact = shift.contact;
  const job = shift.job;
  const employeeName = shift.user
    ? `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim() || shift.user.email || "Unknown"
    : contact?.name || "Unknown Employee";
  const locationName = job?.name || "Unknown Location";
  const shiftTime = shift.scheduledStart
    ? shift.scheduledStart.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" })
    : "Unknown Time";
  return { employeeName, locationName, shiftTime };
}

export function startAlertChecker() {
  setInterval(async () => {
    try {
      // ── Phase 1: Alert employees immediately on missed check-in ──────────────
      const missedShifts = await getPendingMissedCheckInShifts();
      for (const shift of missedShifts) {
        const contact = (shift as any).contact;
        const alertDetails = resolveAlertDetails(shift);
        const delayMinutes = Math.round(MANAGER_ALERT_DELAY_MS / 60_000);

        console.log(`[LW Alert P1] Missed check-in: ${alertDetails.employeeName} shift ${shift.id} — alerting employee, managers in ${delayMinutes} min`);

        // Create the alert record
        const alert = await createLwAlert({
          companyId: shift.companyId,
          userId: shift.userId ?? null,
          contactId: (shift as any).contactId ?? null,
          shiftId: shift.id,
          alertType: "missed_checkin",
          message: `${alertDetails.employeeName} did not check in for their scheduled shift at ${alertDetails.locationName}, starting at ${alertDetails.shiftTime}.`,
        });

        // Resolve employee contact
        let empContact: any = null;
        if (shift.userId) {
          const empContacts = await getLwContacts(shift.companyId, shift.userId);
          empContact = empContacts.find((c: any) => c.contactType === "employee" && c.isActive && c.alertEnabled !== false);
        } else if (contact && contact.phone && contact.alertEnabled !== false) {
          empContact = contact;
        }

        // If alerts disabled, skip straight to done
        if (!empContact && contact?.alertEnabled === false) {
          console.log(`[LW Alert P1] Skipping shift ${shift.id} — alerts disabled`);
          await updateLwShift(shift.id, { alertSent: true, status: "missed", employeeAlertAt: new Date() }, shift.companyId);
          continue;
        }

        let callSid: string | null = null;
        if (empContact) {
          const [sid] = await Promise.all([
            makeAlertCall(empContact.phone, alertDetails, true),
            makeAlertSms(empContact.phone, alertDetails, true),
          ]);
          callSid = sid;
        }

        // Mark phase 1 done — status "missed", employeeAlertAt set, alertSent still false (managers pending)
        await updateLwShift(shift.id, { status: "missed", employeeAlertAt: new Date() } as any, shift.companyId);
        await updateLwAlert(alert.id, {
          status: callSid ? "calling" : "sent",
          ...(callSid ? { callSid } : {}),
        }, shift.companyId);
      }

      // ── Phase 2: Alert managers if employee still hasn't checked in ──────────
      const managerAlertShifts = await getPhase2ManagerAlertShifts();
      for (const shift of managerAlertShifts) {
        const alertDetails = resolveAlertDetails(shift);
        console.log(`[LW Alert P2] ${alertDetails.employeeName} still not checked in — alerting managers`);

        const allCompanyContacts = await getLwContacts(shift.companyId);
        const managerContacts = allCompanyContacts.filter((c: any) =>
          c.contactType === "call_receiver_manager" && c.isActive && c.phone && c.alertEnabled !== false
        );

        console.log(`[LW Alert P2] Notifying ${managerContacts.length} call receiver manager(s)`);

        await Promise.all(
          managerContacts.flatMap((mgr: any) => [
            makeAlertCall(mgr.phone, alertDetails),
            makeAlertSms(mgr.phone, alertDetails),
          ])
        );

        // Phase 2 complete — mark alertSent so we don't re-alert
        await updateLwShift(shift.id, { alertSent: true }, shift.companyId);
      }

    } catch (err) {
      console.error("[LW Alert Checker] Error:", err);
    }
  }, 30_000);
}

// ─── Route registration ────────────────────────────────────────────────────────

export function registerLoneWorkingRoutes(app: Express, requireAuth: any, requirePermission: any, PERMISSIONS: any) {

  // Inline admin check — allows both admin and super_admin roles
  const requireLwAdmin = (req: any, res: Response, next: any) => {
    const role = req.user?.role;
    if (role === "admin" || role === "super_admin") return next();
    return res.status(403).json({ message: "Admin access required" });
  };

  // ── Employee & admin: get their active check-in status and available jobs ──
  app.get("/api/lw/status", requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.companyId;
      const [activeCheckIn, allJobs] = await Promise.all([
        getActiveLwCheckIn(userId, companyId),
        getLwJobs(companyId),
      ]);
      const jobs = allJobs.filter((j: any) => j.isActive);
      res.json({ activeCheckIn, jobs });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Employee & admin: get their scheduled shifts ──
  app.get("/api/lw/my-shifts", requireAuth, async (req: any, res: Response) => {
    try {
      const shifts = await getLwShiftsByUser(req.user.id, req.user.companyId);
      res.json(shifts);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Employee & admin: check in ──
  app.post("/api/lw/check-in", requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.companyId;
      const { jobId, shiftId, lat, lng, notes } = req.body;
      if (!jobId) return res.status(400).json({ message: "jobId is required" });

      // Verify the job belongs to this company (for admins) or is assigned to the user
      const jobs = await getLwJobs(companyId);
      const jobBelongsToCompany = jobs.some((j: any) => j.id === jobId);
      if (!jobBelongsToCompany) return res.status(403).json({ message: "Job not found" });

      // Any user can check into any active job in their company

      // Close any stale active check-ins
      const existing = await getActiveLwCheckIn(userId, companyId);
      if (existing) {
        await updateLwCheckIn(existing.id, { status: "checked_out", checkOutTime: new Date() }, companyId);
      }

      const checkIn = await createLwCheckIn({
        companyId, userId, jobId,
        shiftId: shiftId || undefined,
        checkInLat: lat ? String(lat) : undefined,
        checkInLng: lng ? String(lng) : undefined,
        notes,
      });

      if (shiftId) {
        await updateLwShift(shiftId, { status: "active" }, companyId);
      }

      res.json(checkIn);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Employee & admin: check out ──
  app.post("/api/lw/check-out", requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.companyId;
      const { lat, lng, notes } = req.body;

      const active = await getActiveLwCheckIn(userId, companyId);
      if (!active) return res.status(404).json({ message: "No active check-in found" });

      const updated = await updateLwCheckIn(active.id, {
        status: "checked_out",
        checkOutTime: new Date(),
        checkOutLat: lat ? String(lat) : undefined,
        checkOutLng: lng ? String(lng) : undefined,
        notes: notes || active.notes,
      }, companyId);

      if (active.shiftId) {
        await updateLwShift(active.shiftId, { status: "completed" }, companyId);
      }

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Admin: jobs CRUD ──
  app.get("/api/lw/jobs", requireAuth, async (req: any, res: Response) => {
    try {
      res.json(await getLwJobs(req.user.companyId));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/lw/jobs", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const { name, jobType, description, color } = req.body;
      const locationId = req.body.locationId && req.body.locationId !== "none"
        ? parseInt(req.body.locationId)
        : null;
      const job = await createLwJob({
        name,
        jobType: jobType || "mobile",
        description: description || null,
        locationId,
        color: color || null,
        companyId: req.user.companyId,
      });
      res.json(job);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/lw/jobs/:id", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const updates: any = { ...req.body };
      if ("locationId" in updates) {
        updates.locationId = updates.locationId && updates.locationId !== "none"
          ? parseInt(updates.locationId)
          : null;
      }
      const job = await updateLwJob(parseInt(req.params.id), updates, req.user.companyId);
      res.json(job);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/lw/jobs/:id", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      await deleteLwJob(parseInt(req.params.id), req.user.companyId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Admin: assignments CRUD ──
  app.get("/api/lw/assignments", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      res.json(await getLwAssignments(req.user.companyId));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/lw/assignments", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const a = await createLwAssignment({
        ...req.body,
        companyId: req.user.companyId,
        assignedBy: req.user.id,
      });
      res.json(a);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/lw/assignments/:id", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const a = await updateLwAssignment(parseInt(req.params.id), req.body, req.user.companyId);
      res.json(a);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Admin: shifts CRUD ──
  app.get("/api/lw/shifts", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      res.json(await getLwShifts(req.user.companyId));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/lw/shifts", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const shift = await createLwShift({
        ...req.body,
        companyId: req.user.companyId,
        createdBy: req.user.id,
        scheduledStart: new Date(req.body.scheduledStart),
        scheduledEnd: new Date(req.body.scheduledEnd),
      });
      res.json(shift);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/lw/shifts/:id", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const updates: any = { ...req.body };
      if (updates.scheduledStart) updates.scheduledStart = new Date(updates.scheduledStart);
      if (updates.scheduledEnd) updates.scheduledEnd = new Date(updates.scheduledEnd);
      const shift = await updateLwShift(parseInt(req.params.id), updates, req.user.companyId);
      res.json(shift);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/lw/shifts/:id", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      await deleteLwShift(parseInt(req.params.id), req.user.companyId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Admin: contacts ──
  app.get("/api/lw/contacts", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      res.json(await getLwContacts(req.user.companyId, userId));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/lw/contacts", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const c = await createLwContact({ ...req.body, companyId: req.user.companyId });
      res.json(c);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/lw/contacts/:id", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const c = await updateLwContact(parseInt(req.params.id), req.body, req.user.companyId);
      res.json(c);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/lw/contacts/:id", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      await deleteLwContact(parseInt(req.params.id), req.user.companyId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Admin: create a keylocate login from a Deputy-synced contact ──
  app.post("/api/lw/contacts/:id/create-login", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const contactId = parseInt(req.params.id);
      const companyId = req.user.companyId;

      // Load the contact
      const contacts = await getLwContacts(companyId);
      const contact = contacts.find((c: any) => c.id === contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (contact.userId) return res.status(409).json({ message: "This contact already has a keylocate login" });

      const { email, role = "officer" } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required to create a login" });

      // Check email not already in use
      const { eq: drizzleEq } = await import("drizzle-orm");
      const [existingUser] = await db.select({ id: users.id }).from(users)
        .where(drizzleEq(users.email, email.toLowerCase().trim()))
        .limit(1);
      if (existingUser) return res.status(409).json({ message: "A user with this email already exists" });

      // Generate temp password
      const tempPassword = crypto.randomBytes(8).toString("hex");
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Create user
      const nameParts = contact.name.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const [newUser] = await db.insert(users).values({
        companyId,
        email: email.toLowerCase().trim(),
        firstName,
        lastName,
        role,
        password: hashedPassword,
        isActive: true,
        permissions: [],
        allowedLocationIds: [],
      } as any).returning();

      // Link contact → user
      await updateLwContact(contactId, { userId: newUser.id }, companyId);

      res.json({ user: newUser, temporaryPassword: tempPassword });
    } catch (e: any) {
      console.error("[LW Create Login] Error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── Admin: test call ──
  app.post("/api/lw/test-call", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const { phone, name } = req.body;
      if (!phone) return res.status(400).json({ message: "Phone number is required" });

      const from = process.env.TWILIO_FROM_NUMBER;
      const client = getTwilioClient();

      if (!client || !from) {
        return res.status(503).json({ message: "Twilio is not configured. Check your environment variables." });
      }

      const contactName = name || "this contact";
      const call = await client.calls.create({
        to: phone,
        from,
        twiml: `<Response><Say>This is a test call from keylocate lone working. Your alert system is working correctly. ${contactName} will receive calls like this when a lone worker misses their scheduled check-in. This concludes the test.</Say></Response>`,
      });

      res.json({ success: true, callSid: call.sid, status: call.status });
    } catch (e: any) {
      console.error("[LW Test Call] Error:", e);
      res.status(500).json({ message: e.message || "Call failed. Check the phone number format (+441234567890)." });
    }
  });

  // ── Admin: check-in history ──
  app.get("/api/lw/check-ins", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      res.json(await getLwCheckIns(req.user.companyId));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Admin: alerts ──
  app.get("/api/lw/alerts", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      res.json(await getLwAlerts(req.user.companyId));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/lw/alerts/:id/resolve", requireAuth, requireLwAdmin, async (req: any, res: Response) => {
    try {
      const alert = await updateLwAlert(parseInt(req.params.id), {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: req.user.id,
      }, req.user.companyId);
      res.json(alert ?? { success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
