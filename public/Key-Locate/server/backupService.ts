import { db } from "./db";
import { sql } from "drizzle-orm";

const MAX_BACKUPS_PER_COMPANY = 30;

// ─── Snapshot a single company's data ───────────────────────────────────────
export async function createCompanyBackup(companyId: number, triggeredBy: "scheduled" | "manual" = "scheduled") {
  // Fetch all company-scoped tables
  const [
    users,
    locations,
    keyBunches,
    archivedKeyBunches,
    movementHistory,
    settings,
    policies,
    policyPermissions,
    uniformCatalogue,
    uniformStock,
    uniformIssues,
    uniformIssueItems,
    assignmentTemplateSections,
    assignmentSectionValues,
    locationAssignments,
    lwJobs,
    lwContacts,
  ] = await Promise.all([
    db.execute(sql`SELECT * FROM users WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM locations WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM key_bunches WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM archived_key_bunches WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM movement_history WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM settings WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT id, company_id, name, description, is_active, created_at, file_name, file_type, file_size FROM policies WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT pp.* FROM policy_permissions pp JOIN policies p ON pp.policy_id = p.id WHERE p.company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM uniform_catalogue WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM uniform_stock WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM uniform_issues WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT uii.* FROM uniform_issue_items uii JOIN uniform_issues ui ON uii.issue_id = ui.id WHERE ui.company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM assignment_template_sections WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT asv.* FROM assignment_section_values asv JOIN assignment_template_sections ats ON asv.section_id = ats.id WHERE ats.company_id = ${companyId}`),
    db.execute(sql`SELECT la.* FROM location_assignments la JOIN locations l ON la.location_id = l.id WHERE l.company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM lw_jobs WHERE company_id = ${companyId}`),
    db.execute(sql`SELECT * FROM lw_contacts WHERE company_id = ${companyId}`),
  ]);

  const snapshot = {
    version: 1,
    companyId,
    snapshotAt: new Date().toISOString(),
    tables: {
      users: users.rows,
      locations: locations.rows,
      keyBunches: keyBunches.rows,
      archivedKeyBunches: archivedKeyBunches.rows,
      movementHistory: movementHistory.rows,
      settings: settings.rows,
      policies: policies.rows,
      policyPermissions: policyPermissions.rows,
      uniformCatalogue: uniformCatalogue.rows,
      uniformStock: uniformStock.rows,
      uniformIssues: uniformIssues.rows,
      uniformIssueItems: uniformIssueItems.rows,
      assignmentTemplateSections: assignmentTemplateSections.rows,
      assignmentSectionValues: assignmentSectionValues.rows,
      locationAssignments: locationAssignments.rows,
      lwJobs: lwJobs.rows,
      lwContacts: lwContacts.rows,
    },
  };

  const recordCounts = JSON.stringify({
    users: users.rows.length,
    locations: locations.rows.length,
    keyBunches: keyBunches.rows.length,
    movementHistory: movementHistory.rows.length,
    policies: policies.rows.length,
    uniformItems: uniformCatalogue.rows.length,
  });

  const dataJson = JSON.stringify(snapshot);
  const sizeBytes = Buffer.byteLength(dataJson, "utf8");

  await db.execute(sql`
    INSERT INTO company_backups (company_id, triggered_by, size_bytes, record_counts, data)
    VALUES (${companyId}, ${triggeredBy}, ${sizeBytes}, ${recordCounts}, ${dataJson})
  `);

  // Prune old backups — keep only the most recent MAX_BACKUPS_PER_COMPANY
  await db.execute(sql`
    DELETE FROM company_backups
    WHERE company_id = ${companyId}
      AND id NOT IN (
        SELECT id FROM company_backups
        WHERE company_id = ${companyId}
        ORDER BY created_at DESC
        LIMIT ${MAX_BACKUPS_PER_COMPANY}
      )
  `);

  console.log(`[Backup] Company ${companyId} — ${(sizeBytes / 1024).toFixed(1)} KB, triggered by ${triggeredBy}`);
  return { sizeBytes, recordCounts };
}

// ─── List backups for a company (metadata only, no data) ─────────────────────
export async function listCompanyBackups(companyId: number) {
  const result = await db.execute(sql`
    SELECT id, company_id, created_at, triggered_by, size_bytes, record_counts
    FROM company_backups
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
    LIMIT 30
  `);
  return result.rows;
}

// ─── Fetch a single backup (with full data) ───────────────────────────────────
export async function getBackup(backupId: number) {
  const result = await db.execute(sql`
    SELECT * FROM company_backups WHERE id = ${backupId}
  `);
  return result.rows[0] || null;
}

// ─── Run nightly backup for all companies ─────────────────────────────────────
export async function performNightlyBackups() {
  console.log("[Backup] Starting nightly backup for all companies…");
  const companies = await db.execute(sql`SELECT id FROM companies WHERE is_active = true`);
  let success = 0;
  let failed = 0;

  for (const company of companies.rows) {
    try {
      await createCompanyBackup(company.id as number, "scheduled");
      success++;
    } catch (err: any) {
      console.error(`[Backup] Failed for company ${company.id}:`, err.message);
      failed++;
    }
  }
  console.log(`[Backup] Nightly complete — ${success} succeeded, ${failed} failed`);
}

// ─── Schedule daily backups ────────────────────────────────────────────────────
export function startBackupScheduler() {
  // Run immediately at startup (so first backup happens quickly), then every 24h
  const msUntilMidnight = (() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(2, 0, 0, 0); // 2am
    if (midnight <= now) midnight.setDate(midnight.getDate() + 1);
    return midnight.getTime() - now.getTime();
  })();

  console.log(`[Backup] First backup scheduled in ${Math.round(msUntilMidnight / 60000)}m`);

  setTimeout(() => {
    performNightlyBackups();
    setInterval(performNightlyBackups, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}
