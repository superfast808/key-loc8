import { spawn } from "node:child_process";
import type { Response } from "express";

// Avoid running multiple resource-intensive full backups concurrently.
let exportInProgress = false;

/**
 * Stream a PostgreSQL 16 custom-format archive directly to the administrator.
 * Nothing is written to the application filesystem or stored in Git.
 *
 * This is an entire-database export (all tenants), NOT the per-company JSON
 * snapshot. Active session records are deliberately omitted so restoring an
 * archive does not transplant authenticated browser sessions.
 */
export function streamDatabaseExport(res: Response, adminUserId: number): void {
  if (exportInProgress) {
    res.status(429).json({ message: "A database export is already running. Try again when it finishes." });
    return;
  }

  let connection: URL;
  try {
    connection = new URL(process.env.DATABASE_URL || "");
    if (!["postgres:", "postgresql:"].includes(connection.protocol)) {
      throw new Error("Unsupported PostgreSQL connection URL");
    }
  } catch {
    res.status(503).json({ message: "Database export is not configured" });
    return;
  }

  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: connection.hostname,
    PGPORT: connection.port || "5432",
    PGUSER: decodeURIComponent(connection.username),
    PGPASSWORD: decodeURIComponent(connection.password),
    PGDATABASE: decodeURIComponent(connection.pathname.replace(/^\//, "")),
    PGCONNECT_TIMEOUT: "10",
  };
  const sslMode = connection.searchParams.get("sslmode");
  if (sslMode) environment.PGSSLMODE = sslMode;

  const filename = `keyloc8-database-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`;
  const args = [
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--lock-wait-timeout=10000",
    "--exclude-table-data=public.sessions",
  ];

  // Never put the database URL/password in the command arguments or logs.
  exportInProgress = true;
  const dump = spawn("pg_dump", args, {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let completed = false;
  let downloadedBytes = 0;
  let errorOutput = "";

  dump.stderr.on("data", (chunk: Buffer) => {
    errorOutput = (errorOutput + chunk.toString("utf8")).slice(-2048);
  });

  dump.stdout.on("data", (chunk: Buffer) => {
    if (res.destroyed) return;
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.status(200);
    }

    downloadedBytes += chunk.length;
    if (!res.write(chunk)) dump.stdout.pause();
  });

  res.on("drain", () => dump.stdout.resume());
  res.on("close", () => {
    // A cancelled download must not leave pg_dump running on the database.
    if (!completed) dump.kill("SIGTERM");
  });

  dump.on("error", (error: Error) => {
    exportInProgress = false;
    console.error(`[DB-EXPORT] Cannot run pg_dump for admin ${adminUserId}: ${(error as NodeJS.ErrnoException).code || "unknown error"}`);
    if (!res.destroyed && !res.headersSent) {
      res.status(503).json({ message: "Database export is unavailable (pg_dump could not start)" });
    } else if (!res.destroyed) {
      res.destroy();
    }
  });

  dump.on("close", (code) => {
    completed = true;
    exportInProgress = false;
    if (res.destroyed || res.writableEnded) return;
    if (code === 0) {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Cache-Control", "private, no-store, max-age=0");
      }
      res.end();
      console.info(`[DB-EXPORT] Admin ${adminUserId} exported ${downloadedBytes} bytes`);
    } else {
      // Do not expose or log database credentials or arbitrary stderr text.
      console.error(`[DB-EXPORT] pg_dump failed for admin ${adminUserId} (exit ${code}, stderr length ${errorOutput.length})`);
      if (!res.headersSent) {
        res.status(500).json({ message: "Database export failed. Check the server logs." });
      } else {
        // A partially transmitted archive must be treated as failed.
        res.destroy();
      }
    }
  });
}
