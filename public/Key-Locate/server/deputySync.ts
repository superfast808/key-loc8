/**
 * Deputy Sync Module
 * 
 * Three layers of sync, all idempotent and running every 15 minutes:
 * 
 * 1. PEOPLE sync   — Deputy employees → lw_contacts (People directory)
 * 2. LOCATIONS sync — Deputy OperationalUnits → lw_jobs (Locations)
 * 3. SHIFTS sync   — Deputy roster → lw_shifts (linked to Users & Locations)
 */

import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  lwShifts, lwJobs, lwContacts, users, companies, companyModules,
} from "@shared/schema";

const DEPUTY_BASE = "https://bee43b10084250.uk.deputy.com/api/v1";
const SYNC_WINDOW_DAYS = 7; // Sync shifts within the next 7 days

// ─── Deputy API helpers ───────────────────────────────────────────────────────

function getDeputyToken(): string | null {
  return process.env.DEPUTY_API_TOKEN ?? null;
}

async function deputyFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getDeputyToken();
  if (!token) throw new Error("DEPUTY_API_TOKEN not configured");

  const res = await fetch(`${DEPUTY_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deputy API ${res.status}: ${body.substring(0, 200)}`);
  }

  return res.json();
}

// ─── Fetch Deputy data ────────────────────────────────────────────────────────

async function fetchDeputyEmployees(): Promise<any[]> {
  const result = await deputyFetch("/resource/Employee");
  return Array.isArray(result) ? result : [];
}

async function fetchDeputyAreas(): Promise<any[]> {
  const result = await deputyFetch("/resource/OperationalUnit");
  return Array.isArray(result) ? result : [];
}

async function fetchDeputyRoster(fromTs: number, toTs: number): Promise<any[]> {
  const result = await deputyFetch("/resource/Roster/QUERY", {
    method: "POST",
    body: JSON.stringify({
      max: 200,
      sort: { StartTime: "asc" },
      search: {
        s1: { field: "StartTime", type: "ge", data: fromTs },
        s2: { field: "StartTime", type: "le", data: toTs },
      },
    }),
  });
  return Array.isArray(result) ? result : [];
}

// ─── Name matching helpers (for shift → user matching) ───────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function nameScore(depFirst: string, depLast: string, user: any): number {
  const fMatch = normalizeName(depFirst || "") === normalizeName(user.firstName || "") ? 2 : 0;
  const lMatch = normalizeName(depLast || "") === normalizeName(user.lastName || "") ? 2 : 0;
  return fMatch + lMatch;
}

// ─── 1. Sync Deputy employees → lw_contacts (People) ─────────────────────────

async function syncDeputyPeople(companyId: number, depEmployees: any[]): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  // Load existing Deputy-synced contacts for this company
  const existingContacts = await db.select()
    .from(lwContacts)
    .where(eq(lwContacts.companyId, companyId));

  const existingByDeputyId = new Map(
    existingContacts
      .filter(c => c.deputyEmployeeId != null)
      .map(c => [c.deputyEmployeeId!, c])
  );

  for (const emp of depEmployees) {
    const name = `${emp.FirstName || ""} ${emp.LastName || ""}`.trim();
    if (!name) continue;

    const phone = emp.Mobile || emp.Phone || emp.HomePhone || "";
    const email = emp.Email || null;

    const existing = existingByDeputyId.get(emp.Id);

    if (existing) {
      // Update name always; only update phone/email from Deputy if they're non-empty
      // (preserves manually-entered values since Deputy often doesn't return contact info)
      const updates: any = {};
      if (existing.name !== name) updates.name = name;
      if (phone && existing.phone !== phone) updates.phone = phone;
      if (email && existing.email !== email) updates.email = email;

      if (Object.keys(updates).length > 0) {
        await db.update(lwContacts)
          .set(updates)
          .where(and(eq(lwContacts.id, existing.id), eq(lwContacts.companyId, companyId)));
        updated++;
      }
    } else {
      // Create new contact — try to match a keylocate user by name for userId
      const klocUsers = await db.select().from(users).where(eq(users.companyId, companyId));
      let matchedUserId: number | null = null;
      let bestScore = 0;
      for (const u of klocUsers) {
        const score = nameScore(emp.FirstName || "", emp.LastName || "", u);
        if (score > bestScore) { bestScore = score; matchedUserId = u.id; }
      }
      if (bestScore < 3) matchedUserId = null; // Require both first+last match

      await db.insert(lwContacts).values({
        companyId,
        userId: matchedUserId ?? undefined,
        contactType: "employee",
        name,
        phone: phone || "",
        email,
        isActive: true,
        deputyEmployeeId: emp.Id,
      });
      added++;
    }
  }

  return { added, updated };
}

// ─── 2. Sync Deputy areas → lw_jobs (Locations) ──────────────────────────────

async function syncDeputyLocations(companyId: number, depAreas: any[]): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  const existingJobs = await db.select()
    .from(lwJobs)
    .where(eq(lwJobs.companyId, companyId));

  const existingByDeputyAreaId = new Map(
    existingJobs
      .filter(j => (j as any).deputyAreaId != null)
      .map(j => [(j as any).deputyAreaId!, j])
  );

  for (const area of depAreas) {
    const name = area.OperationalUnitName || area.Name || "";
    if (!name) continue;

    const existing = existingByDeputyAreaId.get(area.Id);

    if (existing) {
      // Update name if changed in Deputy
      if (existing.name !== name) {
        await db.update(lwJobs)
          .set({ name })
          .where(and(eq(lwJobs.id, existing.id), eq(lwJobs.companyId, companyId)));
        updated++;
      }
    } else {
      // Create new location
      await db.insert(lwJobs).values({
        companyId,
        name,
        jobType: "mobile",
        isActive: true,
        deputyAreaId: area.Id,
      } as any);
      added++;
    }
  }

  return { added, updated };
}

// ─── 3. Sync Deputy roster → lw_shifts ───────────────────────────────────────

async function syncDeputyShifts(companyId: number, depEmployees: any[], depAreas: any[], depRoster: any[]): Promise<{ synced: number; alreadySynced: number; noLocation: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;
  let alreadySyncedCount = 0;
  let noLocation = 0;

  // Load keylocate users and Deputy contacts
  const klocUsers = await db.select().from(users).where(eq(users.companyId, companyId));
  const klocContacts = await db.select().from(lwContacts).where(eq(lwContacts.companyId, companyId));

  // Load all jobs for this company (including newly synced locations)
  const klocJobs = await db.select().from(lwJobs)
    .where(and(eq(lwJobs.companyId, companyId), eq(lwJobs.isActive, true)));

  // Build Deputy area → lw_job map using deputyAreaId
  const deputyAreaToJob = new Map<number, any>();
  for (const area of depAreas) {
    const byId = klocJobs.find(j => (j as any).deputyAreaId === area.Id);
    if (byId) { deputyAreaToJob.set(area.Id, byId); }
  }

  // Build Deputy employee → keylocate user map by name (for employees WITH logins)
  const deputyEmpToUser = new Map<number, any>();
  for (const depEmp of depEmployees) {
    let best: any = null;
    let bestScore = 0;
    for (const u of klocUsers) {
      const score = nameScore(depEmp.FirstName || "", depEmp.LastName || "", u);
      if (score > bestScore) { bestScore = score; best = u; }
    }
    if (best && bestScore >= 3) {
      deputyEmpToUser.set(depEmp.Id, best);
    }
  }

  // Build Deputy employee → lw_contact map (for ALL employees, including those without logins)
  const deputyEmpToContact = new Map<number, any>();
  for (const contact of klocContacts) {
    if ((contact as any).deputyEmployeeId != null) {
      deputyEmpToContact.set((contact as any).deputyEmployeeId, contact);
    }
  }

  // Get already-synced Deputy shift IDs
  const existingDeputyIds = await db.select({ deputyShiftId: lwShifts.deputyShiftId })
    .from(lwShifts)
    .where(and(eq(lwShifts.companyId, companyId), eq(lwShifts.deputySynced, true)));
  const alreadySynced = new Set(existingDeputyIds.map(r => r.deputyShiftId));

  for (const shift of depRoster) {
    if (alreadySynced.has(shift.Id)) {
      alreadySyncedCount++;
      continue;
    }

    const job = deputyAreaToJob.get(shift.OperationalUnit);
    if (!job) {
      noLocation++;
      const area = depAreas.find(a => a.Id === shift.OperationalUnit);
      errors.push(`No location for Deputy area "${area?.OperationalUnitName || shift.OperationalUnit}" (shift ${shift.Id})`);
      continue;
    }

    const user = deputyEmpToUser.get(shift.Employee);
    const contact = deputyEmpToContact.get(shift.Employee);

    if (!user && !contact) {
      // Employee not in Deputy contacts yet (shouldn't happen if people sync ran first)
      const depEmp = depEmployees.find(e => e.Id === shift.Employee);
      const empName = depEmp ? `${depEmp.FirstName} ${depEmp.LastName}` : `ID:${shift.Employee}`;
      errors.push(`No person record for "${empName}" (shift ${shift.Id})`);
      continue;
    }

    try {
      await db.insert(lwShifts).values({
        companyId,
        jobId: job.id,
        userId: user?.id ?? null,
        contactId: !user && contact ? contact.id : null,
        scheduledStart: new Date(shift.StartTime * 1000),
        scheduledEnd: new Date(shift.EndTime * 1000),
        notes: shift.Comment || `Synced from Deputy (shift #${shift.Id})`,
        status: "pending",
        alertSent: false,
        deputyShiftId: shift.Id,
        deputySynced: true,
      } as any);
      synced++;
    } catch (e: any) {
      errors.push(`Failed to create shift ${shift.Id}: ${e.message}`);
    }
  }

  return { synced, alreadySynced: alreadySyncedCount, noLocation, errors };
}

// ─── Main sync orchestrator ───────────────────────────────────────────────────

export async function runDeputySync(companyId: number): Promise<{
  synced: number;
  alreadySynced: number;
  noLocation: number;
  errors: string[];
  notConfigured?: boolean;
  tokenInvalid?: boolean;
  peopleAdded?: number;
  peopleUpdated?: number;
  locationsAdded?: number;
  locationsUpdated?: number;
}> {
  try {
    // Quick check: does this company have any users? If not, skip silently.
    const klocUsers = await db.select({ id: users.id }).from(users).where(eq(users.companyId, companyId));
    if (klocUsers.length === 0) {
      return { synced: 0, alreadySynced: 0, noLocation: 0, errors: [], notConfigured: true };
    }

    // Fetch all Deputy data in parallel — if 401, this company has no Deputy access, skip silently
    let depEmployees: any[], depAreas: any[], depRoster: any[];
    try {
      [depEmployees, depAreas, depRoster] = await Promise.all([
        fetchDeputyEmployees(),
        fetchDeputyAreas(),
        fetchDeputyRoster(
          Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (catch currently active)
          Math.floor(Date.now() / 1000) + SYNC_WINDOW_DAYS * 86400
        ),
      ]);
    } catch (apiErr: any) {
      if (apiErr.message?.includes("401")) {
        // Token is set but Deputy rejected it — return a specific flag
        return { synced: 0, alreadySynced: 0, noLocation: 0, errors: [], notConfigured: true, tokenInvalid: true };
      }
      throw apiErr; // Re-throw other errors
    }

    console.log(`[Deputy Sync] Company ${companyId}: ${depEmployees.length} employees, ${depAreas.length} areas, ${depRoster.length} roster shifts`);

    // 1. Sync people (employees → lw_contacts)
    const { added: peopleAdded, updated: peopleUpdated } = await syncDeputyPeople(companyId, depEmployees);

    // 2. Sync locations (areas → lw_jobs) — MUST happen before shifts
    const { added: locationsAdded, updated: locationsUpdated } = await syncDeputyLocations(companyId, depAreas);

    // 3. Sync shifts (roster → lw_shifts)
    const { synced, alreadySynced, noLocation, errors } = await syncDeputyShifts(companyId, depEmployees, depAreas, depRoster);

    if (peopleAdded > 0) console.log(`[Deputy Sync] Company ${companyId}: ${peopleAdded} people added`);
    if (peopleUpdated > 0) console.log(`[Deputy Sync] Company ${companyId}: ${peopleUpdated} people updated`);
    if (locationsAdded > 0) console.log(`[Deputy Sync] Company ${companyId}: ${locationsAdded} locations added`);
    if (locationsUpdated > 0) console.log(`[Deputy Sync] Company ${companyId}: ${locationsUpdated} locations updated`);
    if (synced > 0) console.log(`[Deputy Sync] Company ${companyId}: ${synced} shifts synced`);

    return { synced, alreadySynced, noLocation, errors, peopleAdded, peopleUpdated, locationsAdded, locationsUpdated };

  } catch (err: any) {
    console.error("[Deputy Sync] Fatal error for company", companyId, ":", err.message);
    return { synced: 0, alreadySynced: 0, noLocation: 0, errors: [err.message] };
  }
}

// ─── Scheduled sync (every 15 minutes) ───────────────────────────────────────

export function startDeputySync() {
  if (!getDeputyToken()) {
    console.log("[Deputy Sync] DEPUTY_API_TOKEN not set — sync disabled");
    return;
  }

  console.log("[Deputy Sync] Starting periodic sync (every 15 minutes)");

  const runForAllCompanies = async () => {
    try {
      // Only sync companies that have the lone_working module enabled
      const lwCompanies = await db
        .select({ id: companyModules.companyId })
        .from(companyModules)
        .where(and(eq(companyModules.moduleId, "lone_working"), eq(companyModules.isEnabled, true)));

      for (const company of lwCompanies) {
        if (!company.id) continue;
        const result = await runDeputySync(company.id);
        if (result.notConfigured) continue;

        // Log any unmatched shift warnings (deduplicated)
        const uniqueErrors = [...new Set(result.errors)].slice(0, 5);
        if (uniqueErrors.length > 0) {
          console.log(`[Deputy Sync] Company ${company.id} unmatched shifts:`, uniqueErrors);
        }
      }
    } catch (err) {
      console.error("[Deputy Sync] Scheduled run error:", err);
    }
  };

  // Run immediately on startup
  runForAllCompanies();

  // Then every 15 minutes
  setInterval(runForAllCompanies, 15 * 60 * 1000);
}
