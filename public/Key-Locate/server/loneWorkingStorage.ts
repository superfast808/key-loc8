import { db } from "./db";
import { eq, and, desc, gte, lte, isNull, isNotNull, lt, sql } from "drizzle-orm";
import {
  lwJobs, lwAssignments, lwShifts, lwCheckIns, lwContacts, lwAlerts,
  users, locations,
  type LwJob, type LwAssignment, type LwShift, type LwCheckIn, type LwContact, type LwAlert,
  type InsertLwJob, type InsertLwAssignment, type InsertLwShift,
  type InsertLwCheckIn, type InsertLwContact, type InsertLwAlert,
} from "@shared/schema";

// ─── Jobs ────────────────────────────────────────────────────────────────────

export async function getLwJobs(companyId: number) {
  const rows = await db
    .select({
      job: lwJobs,
      location: locations,
    })
    .from(lwJobs)
    .leftJoin(locations, eq(lwJobs.locationId, locations.id))
    .where(eq(lwJobs.companyId, companyId))
    .orderBy(lwJobs.name);
  return rows.map(r => ({ ...r.job, location: r.location }));
}

export async function getLwJob(id: number, companyId: number) {
  const [row] = await db
    .select({ job: lwJobs, location: locations })
    .from(lwJobs)
    .leftJoin(locations, eq(lwJobs.locationId, locations.id))
    .where(and(eq(lwJobs.id, id), eq(lwJobs.companyId, companyId)));
  return row ? { ...row.job, location: row.location } : undefined;
}

export async function createLwJob(data: InsertLwJob & { companyId: number }) {
  const [job] = await db.insert(lwJobs).values(data).returning();
  return job;
}

export async function updateLwJob(id: number, data: Partial<LwJob>, companyId: number) {
  const [updated] = await db
    .update(lwJobs)
    .set(data)
    .where(and(eq(lwJobs.id, id), eq(lwJobs.companyId, companyId)))
    .returning();
  return updated;
}

export async function deleteLwJob(id: number, companyId: number) {
  await db.update(lwJobs).set({ isActive: false }).where(and(eq(lwJobs.id, id), eq(lwJobs.companyId, companyId)));
}

// ─── Assignments ─────────────────────────────────────────────────────────────

export async function getLwAssignments(companyId: number) {
  const rows = await db
    .select({ assignment: lwAssignments, user: users, job: lwJobs })
    .from(lwAssignments)
    .leftJoin(users, eq(lwAssignments.userId, users.id))
    .leftJoin(lwJobs, eq(lwAssignments.jobId, lwJobs.id))
    .where(eq(lwAssignments.companyId, companyId))
    .orderBy(users.firstName);
  return rows.map(r => ({ ...r.assignment, user: r.user, job: r.job }));
}

export async function getLwAssignmentsByUser(userId: number, companyId: number) {
  const rows = await db
    .select({ assignment: lwAssignments, job: lwJobs, location: locations })
    .from(lwAssignments)
    .leftJoin(lwJobs, eq(lwAssignments.jobId, lwJobs.id))
    .leftJoin(locations, eq(lwJobs.locationId, locations.id))
    .where(and(
      eq(lwAssignments.userId, userId),
      eq(lwAssignments.companyId, companyId),
      eq(lwAssignments.isActive, true),
    ));
  return rows.map(r => ({ ...r.assignment, job: { ...r.job!, location: r.location } }));
}

export async function createLwAssignment(data: InsertLwAssignment & { companyId: number }) {
  const [a] = await db.insert(lwAssignments).values(data).returning();
  return a;
}

export async function updateLwAssignment(id: number, data: Partial<LwAssignment>, companyId: number) {
  const [updated] = await db
    .update(lwAssignments)
    .set(data)
    .where(and(eq(lwAssignments.id, id), eq(lwAssignments.companyId, companyId)))
    .returning();
  return updated;
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function getLwShifts(companyId: number, filters?: { userId?: number; from?: Date; to?: Date }) {
  const conditions: any[] = [eq(lwShifts.companyId, companyId)];
  if (filters?.userId) conditions.push(eq(lwShifts.userId, filters.userId));
  if (filters?.from) conditions.push(gte(lwShifts.scheduledStart, filters.from));
  if (filters?.to) conditions.push(lte(lwShifts.scheduledStart, filters.to));

  const rows = await db
    .select({ shift: lwShifts, user: users, contact: lwContacts, job: lwJobs })
    .from(lwShifts)
    .leftJoin(users, eq(lwShifts.userId, users.id))
    .leftJoin(lwContacts, eq(lwShifts.contactId, lwContacts.id))
    .leftJoin(lwJobs, eq(lwShifts.jobId, lwJobs.id))
    .where(and(...conditions))
    .orderBy(desc(lwShifts.scheduledStart));
  return rows.map(r => ({ ...r.shift, user: r.user, contact: r.contact, job: r.job }));
}

export async function getLwShiftsByUser(userId: number, companyId: number) {
  const rows = await db
    .select({ shift: lwShifts, job: lwJobs })
    .from(lwShifts)
    .leftJoin(lwJobs, eq(lwShifts.jobId, lwJobs.id))
    .where(and(eq(lwShifts.userId, userId), eq(lwShifts.companyId, companyId)))
    .orderBy(lwShifts.scheduledStart); // ascending so soonest is first
  return rows.map(r => ({ ...r.shift, job: r.job }));
}

export async function deleteLwShift(id: number, companyId: number) {
  // Delete linked alerts first using raw SQL to satisfy the foreign key constraint
  await db.execute(sql`DELETE FROM lw_alerts WHERE shift_id = ${id} AND company_id = ${companyId}`);
  await db.execute(sql`DELETE FROM lw_shifts WHERE id = ${id} AND company_id = ${companyId}`);
}

export async function createLwShift(data: InsertLwShift & { companyId: number }) {
  const [shift] = await db.insert(lwShifts).values(data).returning();
  return shift;
}

export async function updateLwShift(id: number, data: Partial<LwShift>, companyId: number) {
  const [updated] = await db
    .update(lwShifts)
    .set(data)
    .where(and(eq(lwShifts.id, id), eq(lwShifts.companyId, companyId)))
    .returning();
  return updated;
}

// ─── Check-ins ────────────────────────────────────────────────────────────────

export async function getActiveLwCheckIn(userId: number, companyId: number) {
  const [row] = await db
    .select({ checkIn: lwCheckIns, job: lwJobs, location: locations })
    .from(lwCheckIns)
    .leftJoin(lwJobs, eq(lwCheckIns.jobId, lwJobs.id))
    .leftJoin(locations, eq(lwJobs.locationId, locations.id))
    .where(and(
      eq(lwCheckIns.userId, userId),
      eq(lwCheckIns.companyId, companyId),
      eq(lwCheckIns.status, "checked_in"),
    ))
    .orderBy(desc(lwCheckIns.checkInTime))
    .limit(1);
  return row ? { ...row.checkIn, job: { ...row.job!, location: row.location } } : null;
}

export async function getLwCheckIns(companyId: number) {
  const rows = await db
    .select({ checkIn: lwCheckIns, user: users, job: lwJobs })
    .from(lwCheckIns)
    .leftJoin(users, eq(lwCheckIns.userId, users.id))
    .leftJoin(lwJobs, eq(lwCheckIns.jobId, lwJobs.id))
    .where(eq(lwCheckIns.companyId, companyId))
    .orderBy(desc(lwCheckIns.checkInTime));
  return rows.map(r => ({ ...r.checkIn, user: r.user, job: r.job }));
}

export async function createLwCheckIn(data: InsertLwCheckIn & { companyId: number; userId: number }) {
  const [checkIn] = await db.insert(lwCheckIns).values(data).returning();
  return checkIn;
}

export async function updateLwCheckIn(id: number, data: Partial<LwCheckIn>, companyId: number) {
  const [updated] = await db
    .update(lwCheckIns)
    .set(data)
    .where(and(eq(lwCheckIns.id, id), eq(lwCheckIns.companyId, companyId)))
    .returning();
  return updated;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getLwContacts(companyId: number, userId?: number) {
  const conditions: any[] = [eq(lwContacts.companyId, companyId)];
  if (userId) conditions.push(eq(lwContacts.userId, userId));
  return db.select().from(lwContacts).where(and(...conditions)).orderBy(lwContacts.contactType);
}

export async function createLwContact(data: InsertLwContact & { companyId: number }) {
  const [contact] = await db.insert(lwContacts).values(data).returning();
  return contact;
}

export async function updateLwContact(id: number, data: Partial<LwContact>, companyId: number) {
  const [updated] = await db
    .update(lwContacts)
    .set(data)
    .where(and(eq(lwContacts.id, id), eq(lwContacts.companyId, companyId)))
    .returning();
  return updated;
}

export async function deleteLwContact(id: number, companyId: number) {
  await db.delete(lwContacts).where(and(eq(lwContacts.id, id), eq(lwContacts.companyId, companyId)));
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function getLwAlerts(companyId: number) {
  const rows = await db
    .select({ alert: lwAlerts, user: users })
    .from(lwAlerts)
    .leftJoin(users, eq(lwAlerts.userId, users.id))
    .where(eq(lwAlerts.companyId, companyId))
    .orderBy(desc(lwAlerts.alertTime));
  return rows.map(r => ({ ...r.alert, user: r.user }));
}

export async function createLwAlert(data: InsertLwAlert & { companyId: number; userId?: number | null; contactId?: number | null }) {
  const [alert] = await db.insert(lwAlerts).values(data as any).returning();
  return alert;
}

export async function updateLwAlert(id: number, data: Partial<LwAlert>, companyId: number) {
  const [updated] = await db
    .update(lwAlerts)
    .set(data)
    .where(and(eq(lwAlerts.id, id), eq(lwAlerts.companyId, companyId)))
    .returning();
  return updated;
}

// ─── Alert Checker — called on server interval ────────────────────────────────

export async function getPendingMissedCheckInShifts() {
  // Shifts that:
  // 1. Status is "pending"
  // 2. Scheduled start has passed (alert fires immediately when check-in time is missed)
  // 3. No alert has been sent yet
  const now = new Date();

  const overdueShifts = await db
    .select({ shift: lwShifts, user: users, contact: lwContacts, job: lwJobs })
    .from(lwShifts)
    .leftJoin(users, eq(lwShifts.userId, users.id))
    .leftJoin(lwContacts, eq(lwShifts.contactId, lwContacts.id))
    .leftJoin(lwJobs, eq(lwShifts.jobId, lwJobs.id))
    .where(and(
      eq(lwShifts.status, "pending"),
      eq(lwShifts.alertSent, false),
      lt(lwShifts.scheduledStart, now),
    ));

  // Filter out those with a matching active check-in (only applies to shifts with userId)
  const result = [];
  for (const row of overdueShifts) {
    if (row.shift.userId) {
      const checkIn = await db
        .select()
        .from(lwCheckIns)
        .where(and(
          eq(lwCheckIns.userId, row.shift.userId),
          eq(lwCheckIns.companyId, row.shift.companyId),
          eq(lwCheckIns.status, "checked_in"),
          gte(lwCheckIns.checkInTime, row.shift.scheduledStart),
        ))
        .limit(1);
      if (checkIn.length > 0) continue; // Has checked in
    }
    // Shifts with contactId only (no keylocate login) always count as missed — no check-in possible
    result.push({ ...row.shift, user: row.user, contact: row.contact, job: row.job });
  }
  return result;
}

// Phase 2: shifts where employee was alerted but managers haven't been notified yet.
// Returns shifts where employeeAlertAt is set, alertSent is still false,
// and the employee_alert_at was more than MANAGER_DELAY_MS ago.
export const MANAGER_ALERT_DELAY_MS = 5 * 60 * 1000; // 5 minutes after employee alert

export async function getPhase2ManagerAlertShifts() {
  const cutoff = new Date(Date.now() - MANAGER_ALERT_DELAY_MS);

  const rows = await db
    .select({ shift: lwShifts, user: users, contact: lwContacts, job: lwJobs })
    .from(lwShifts)
    .leftJoin(users, eq(lwShifts.userId, users.id))
    .leftJoin(lwContacts, eq(lwShifts.contactId, lwContacts.id))
    .leftJoin(lwJobs, eq(lwShifts.jobId, lwJobs.id))
    .where(and(
      eq(lwShifts.alertSent, false),
      eq(lwShifts.status, "missed"),
      isNotNull(lwShifts.employeeAlertAt),
      lt(lwShifts.employeeAlertAt, cutoff),
    ));

  // Filter out any shifts where the employee has since checked in
  const result = [];
  for (const row of rows) {
    if (row.shift.userId && row.shift.employeeAlertAt) {
      const checkIn = await db
        .select()
        .from(lwCheckIns)
        .where(and(
          eq(lwCheckIns.userId, row.shift.userId),
          eq(lwCheckIns.companyId, row.shift.companyId),
          eq(lwCheckIns.status, "checked_in"),
          gte(lwCheckIns.checkInTime, row.shift.employeeAlertAt),
        ))
        .limit(1);
      if (checkIn.length > 0) {
        // Employee checked in after the alert — cancel manager notification
        await db.update(lwShifts)
          .set({ alertSent: true, status: "active" })
          .where(eq(lwShifts.id, row.shift.id));
        continue;
      }
    }
    result.push({ ...row.shift, user: row.user, contact: row.contact, job: row.job });
  }
  return result;
}

// Admin overview — current state of all employees
export async function getLwOverview(companyId: number) {
  // All active check-ins
  const active = await db
    .select({ checkIn: lwCheckIns, user: users, job: lwJobs })
    .from(lwCheckIns)
    .leftJoin(users, eq(lwCheckIns.userId, users.id))
    .leftJoin(lwJobs, eq(lwCheckIns.jobId, lwJobs.id))
    .where(and(eq(lwCheckIns.companyId, companyId), eq(lwCheckIns.status, "checked_in")))
    .orderBy(desc(lwCheckIns.checkInTime));

  // Today's shifts
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayShifts = await db
    .select({ shift: lwShifts, user: users, job: lwJobs })
    .from(lwShifts)
    .leftJoin(users, eq(lwShifts.userId, users.id))
    .leftJoin(lwJobs, eq(lwShifts.jobId, lwJobs.id))
    .where(and(
      eq(lwShifts.companyId, companyId),
      gte(lwShifts.scheduledStart, todayStart),
      lte(lwShifts.scheduledStart, todayEnd),
    ))
    .orderBy(lwShifts.scheduledStart);

  return {
    activeCheckIns: active.map(r => ({ ...r.checkIn, user: r.user, job: r.job })),
    todayShifts: todayShifts.map(r => ({ ...r.shift, user: r.user, job: r.job })),
  };
}
