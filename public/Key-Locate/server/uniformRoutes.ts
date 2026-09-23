import { type Express, type Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql, isNull, ne } from "drizzle-orm";
import {
  uniformCatalogue, uniformStock, uniformIssues, uniformIssueItems,
  users,
} from "@shared/schema";
import ExcelJS from "exceljs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function companyGuard(req: any, res: Response): number | null {
  const cid = req.user?.companyId;
  if (!cid) { res.status(403).json({ message: "No company" }); return null; }
  return cid;
}

function requireAdmin(req: any, res: Response, next: any) {
  const role = req.user?.role;
  if (role === "admin" || role === "super_admin") return next();
  return res.status(403).json({ message: "Admin access required" });
}

// ─── Register ─────────────────────────────────────────────────────────────────

export function registerUniformRoutes(app: Express, requireAuth: any) {

  // ── CATALOGUE ───────────────────────────────────────────────────────────────

  app.get("/api/uniform/catalogue", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    try {
      const items = await db.select().from(uniformCatalogue)
        .where(eq(uniformCatalogue.companyId, cid))
        .orderBy(uniformCatalogue.category, uniformCatalogue.name);
      res.json(items);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/uniform/catalogue", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    const { name, category, hasSizes, description } = req.body;
    if (!name || !category) return res.status(400).json({ message: "name and category required" });
    try {
      const [item] = await db.insert(uniformCatalogue).values({
        companyId: cid, name, category, hasSizes: !!hasSizes, description: description || null,
      }).returning();
      res.json(item);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/uniform/catalogue/:id", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    const id = parseInt(req.params.id);
    const { name, category, hasSizes, description, isActive } = req.body;
    try {
      const [item] = await db.update(uniformCatalogue)
        .set({ name, category, hasSizes, description, isActive })
        .where(and(eq(uniformCatalogue.id, id), eq(uniformCatalogue.companyId, cid)))
        .returning();
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/uniform/catalogue/:id", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    const id = parseInt(req.params.id);
    try {
      // Verify item belongs to this company
      const [catItem] = await db.select().from(uniformCatalogue)
        .where(and(eq(uniformCatalogue.id, id), eq(uniformCatalogue.companyId, cid)));
      if (!catItem) return res.status(404).json({ message: "Item not found" });

      // Check for any stock with quantity > 0
      const stockRows = await db.select().from(uniformStock)
        .where(and(eq(uniformStock.catalogueId, id), eq(uniformStock.companyId, cid)));
      const hasStock = stockRows.some(s => s.totalQuantity > 0 || s.quantityInStock > 0);
      if (hasStock) {
        return res.status(409).json({
          message: "Cannot delete — this item still has stock recorded. Reduce all quantities to zero using Adjust Stock first.",
        });
      }

      // Check for any outstanding issued items (not fully returned)
      if (stockRows.length > 0) {
        const stockIds = stockRows.map(s => s.id);
        const outstanding = await db.select({ id: uniformIssueItems.id })
          .from(uniformIssueItems)
          .innerJoin(uniformStock, eq(uniformIssueItems.stockId, uniformStock.id))
          .where(sql`${uniformIssueItems.stockId} = ANY(ARRAY[${sql.join(stockIds.map(sid => sql`${sid}`), sql`, `)}]::int[])
            AND (${uniformIssueItems.quantity} - ${uniformIssueItems.returnedQty}) > 0`)
          .limit(1);
        if (outstanding.length > 0) {
          return res.status(409).json({
            message: "Cannot delete — this item has units currently issued to staff. All items must be returned before deleting.",
          });
        }

        // Delete stock rows (no outstanding issues, issue history rows reference stock but qty is 0)
        await db.delete(uniformStock)
          .where(and(eq(uniformStock.catalogueId, id), eq(uniformStock.companyId, cid)));
      }

      // Hard-delete the catalogue item
      await db.delete(uniformCatalogue)
        .where(and(eq(uniformCatalogue.id, id), eq(uniformCatalogue.companyId, cid)));

      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── STOCK ────────────────────────────────────────────────────────────────────

  // Full stock list (joins catalogue name)
  app.get("/api/uniform/stock", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    try {
      const rows = await db
        .select({
          id: uniformStock.id,
          catalogueId: uniformStock.catalogueId,
          size: uniformStock.size,
          totalQuantity: uniformStock.totalQuantity,
          quantityInStock: uniformStock.quantityInStock,
          name: uniformCatalogue.name,
          category: uniformCatalogue.category,
          hasSizes: uniformCatalogue.hasSizes,
          isActive: uniformCatalogue.isActive,
        })
        .from(uniformStock)
        .innerJoin(uniformCatalogue, eq(uniformStock.catalogueId, uniformCatalogue.id))
        .where(and(eq(uniformStock.companyId, cid), ne(uniformStock.isHidden, true)))
        .orderBy(uniformCatalogue.category, uniformCatalogue.name, uniformStock.size);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Upsert stock level for a catalogue item + size
  app.post("/api/uniform/stock", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    const { catalogueId, size, totalQuantity, quantityInStock } = req.body;
    if (!catalogueId) return res.status(400).json({ message: "catalogueId required" });
    try {
      // check if row exists
      const existing = await db.select().from(uniformStock)
        .where(and(
          eq(uniformStock.companyId, cid),
          eq(uniformStock.catalogueId, catalogueId),
          size ? eq(uniformStock.size, size) : isNull(uniformStock.size)
        )).limit(1);

      if (existing.length > 0) {
        const [row] = await db.update(uniformStock)
          .set({ totalQuantity, quantityInStock })
          .where(eq(uniformStock.id, existing[0].id))
          .returning();
        return res.json(row);
      }
      const [row] = await db.insert(uniformStock).values({
        companyId: cid, catalogueId,
        size: size || null,
        totalQuantity: totalQuantity ?? 0,
        quantityInStock: quantityInStock ?? 0,
      }).returning();
      res.json(row);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Bulk upsert all stock rows for a catalogue item in one request
  app.put("/api/uniform/stock/bulk", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    const { catalogueId, rows } = req.body;
    if (!catalogueId || !Array.isArray(rows)) return res.status(400).json({ message: "catalogueId and rows required" });
    try {
      // Verify catalogue item belongs to company
      const [catItem] = await db.select().from(uniformCatalogue)
        .where(and(eq(uniformCatalogue.id, catalogueId), eq(uniformCatalogue.companyId, cid)));
      if (!catItem) return res.status(404).json({ message: "Catalogue item not found" });

      // Delete stock rows that exist in DB but are no longer in the submitted list,
      // unless they are referenced by issue items (foreign key constraint).
      const submittedIds = rows.filter((r: any) => r.id).map((r: any) => r.id);
      const existingRows = await db.select().from(uniformStock)
        .where(and(eq(uniformStock.companyId, cid), eq(uniformStock.catalogueId, catalogueId)));
      for (const existing of existingRows) {
        if (!submittedIds.includes(existing.id)) {
          // Only delete if no issue items reference this stock row
          const refs = await db.select({ id: uniformIssueItems.id })
            .from(uniformIssueItems)
            .where(eq(uniformIssueItems.stockId, existing.id))
            .limit(1);
          if (refs.length === 0) {
            await db.delete(uniformStock).where(eq(uniformStock.id, existing.id));
          } else {
            // Can't delete — has issue history; mark as hidden and zero out quantities
            await db.update(uniformStock)
              .set({ totalQuantity: 0, quantityInStock: 0, isHidden: true })
              .where(eq(uniformStock.id, existing.id));
          }
        }
      }

      const saved = [];
      for (const row of rows) {
        const { size, totalQuantity, quantityInStock, id } = row;
        if (id) {
          const [updated] = await db.update(uniformStock)
            .set({ totalQuantity: totalQuantity ?? 0, quantityInStock: quantityInStock ?? 0 })
            .where(and(eq(uniformStock.id, id), eq(uniformStock.companyId, cid)))
            .returning();
          if (updated) saved.push(updated);
        } else {
          // Check if it already exists (size match)
          const existing = await db.select().from(uniformStock)
            .where(and(
              eq(uniformStock.companyId, cid),
              eq(uniformStock.catalogueId, catalogueId),
              size ? eq(uniformStock.size, size) : isNull(uniformStock.size)
            )).limit(1);
          if (existing.length > 0) {
            const [updated] = await db.update(uniformStock)
              .set({ totalQuantity: totalQuantity ?? 0, quantityInStock: quantityInStock ?? 0 })
              .where(eq(uniformStock.id, existing[0].id))
              .returning();
            if (updated) saved.push(updated);
          } else {
            const [inserted] = await db.insert(uniformStock).values({
              companyId: cid, catalogueId,
              size: size || null,
              totalQuantity: totalQuantity ?? 0,
              quantityInStock: quantityInStock ?? 0,
            }).returning();
            saved.push(inserted);
          }
        }
      }
      res.json(saved);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/uniform/stock/:id", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    const id = parseInt(req.params.id);
    const { totalQuantity, quantityInStock } = req.body;
    try {
      const existing = await db.select().from(uniformStock)
        .innerJoin(uniformCatalogue, eq(uniformStock.catalogueId, uniformCatalogue.id))
        .where(and(eq(uniformStock.id, id), eq(uniformStock.companyId, cid)))
        .limit(1);
      if (!existing.length) return res.status(404).json({ message: "Not found" });
      const [row] = await db.update(uniformStock)
        .set({ totalQuantity, quantityInStock })
        .where(eq(uniformStock.id, id))
        .returning();
      res.json(row);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Stock adjustment — add or remove stock (affects totals)
  app.post("/api/uniform/stock/adjust", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    const { stockId, type, quantity } = req.body;
    if (!stockId || !type || !quantity || quantity < 1)
      return res.status(400).json({ message: "stockId, type and quantity required" });
    if (type !== "add" && type !== "remove")
      return res.status(400).json({ message: "type must be 'add' or 'remove'" });
    try {
      const [existing] = await db.select().from(uniformStock)
        .where(and(eq(uniformStock.id, stockId), eq(uniformStock.companyId, cid)));
      if (!existing) return res.status(404).json({ message: "Stock record not found" });

      let newTotal: number;
      let newInStock: number;

      if (type === "add") {
        newTotal = existing.totalQuantity + quantity;
        newInStock = existing.quantityInStock + quantity;
      } else {
        if (quantity > existing.quantityInStock)
          return res.status(400).json({
            message: `Cannot remove ${quantity} — only ${existing.quantityInStock} currently in stock (not issued)`,
          });
        newTotal = Math.max(0, existing.totalQuantity - quantity);
        newInStock = existing.quantityInStock - quantity;
      }

      const [updated] = await db.update(uniformStock)
        .set({ totalQuantity: newTotal, quantityInStock: newInStock })
        .where(eq(uniformStock.id, stockId))
        .returning();
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── ISSUES ───────────────────────────────────────────────────────────────────

  // List all issues (with items)
  app.get("/api/uniform/issues", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    try {
      const issues = await db.select({
        id: uniformIssues.id,
        employeeId: uniformIssues.employeeId,
        employeeName: uniformIssues.employeeName,
        employeeNumber: uniformIssues.employeeNumber,
        jobTitle: uniformIssues.jobTitle,
        department: uniformIssues.department,
        reason: uniformIssues.reason,
        reasonOther: uniformIssues.reasonOther,
        employeeSignature: uniformIssues.employeeSignature,
        issuedAt: uniformIssues.issuedAt,
        notes: uniformIssues.notes,
        issuedBy: uniformIssues.issuedBy,
        issuedByName: sql<string>`(SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u WHERE u.id = ${uniformIssues.issuedBy})`,
      })
        .from(uniformIssues)
        .where(eq(uniformIssues.companyId, cid))
        .orderBy(desc(uniformIssues.issuedAt));

      // Load items for each issue
      const ids = issues.map(i => i.id);
      let allItems: any[] = [];
      if (ids.length > 0) {
        allItems = await db
          .select({
            id: uniformIssueItems.id,
            issueId: uniformIssueItems.issueId,
            stockId: uniformIssueItems.stockId,
            quantity: uniformIssueItems.quantity,
            returnedQty: uniformIssueItems.returnedQty,
            returnedAt: uniformIssueItems.returnedAt,
            managerSignature: uniformIssueItems.managerSignature,
            returnedBy: uniformIssueItems.returnedBy,
            returnNotes: uniformIssueItems.returnNotes,
            itemName: uniformCatalogue.name,
            size: uniformStock.size,
            category: uniformCatalogue.category,
          })
          .from(uniformIssueItems)
          .innerJoin(uniformStock, eq(uniformIssueItems.stockId, uniformStock.id))
          .innerJoin(uniformCatalogue, eq(uniformStock.catalogueId, uniformCatalogue.id))
          .where(sql`${uniformIssueItems.issueId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::int[])`);
      }

      const itemsByIssue = allItems.reduce((acc: any, item: any) => {
        acc[item.issueId] = acc[item.issueId] || [];
        acc[item.issueId].push(item);
        return acc;
      }, {});

      res.json(issues.map(i => ({ ...i, items: itemsByIssue[i.id] || [] })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Lightweight staff directory used by the issue form's staff picker. Admins
  // need this even though they don't have USER_VIEW, so we expose a minimal,
  // company-scoped list of active users instead of the full /api/users payload.
  app.get("/api/uniform/staff-directory", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    try {
      const staff = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
      }).from(users).where(and(eq(users.companyId, cid), eq(users.isActive, true)));
      console.log(`[staff-directory] company=${cid} rows=${staff.length}`, staff.slice(0, 2));
      res.json(staff);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Create a new issue
  app.post("/api/uniform/issues", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    const {
      employeeId, employeeNumber, jobTitle, department,
      reason, reasonOther, employeeSignature, notes, items,
    } = req.body;

    if (!reason) return res.status(400).json({ message: "reason required" });
    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "At least one item required" });

    // Staff must always be linked to a registered user within the same company.
    const employeeIdNum = Number(employeeId);
    if (!employeeId || !Number.isFinite(employeeIdNum)) {
      return res.status(400).json({ message: "A registered staff member must be selected" });
    }

    try {
      const [employee] = await db.select().from(users)
        .where(and(eq(users.id, employeeIdNum), eq(users.companyId, cid)));
      if (!employee) {
        return res.status(400).json({ message: "Selected staff member was not found in your company" });
      }
      const employeeName = `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || employee.email || "Unknown";

      // Verify stock availability
      for (const item of items) {
        const [stock] = await db.select().from(uniformStock)
          .where(and(eq(uniformStock.id, item.stockId), eq(uniformStock.companyId, cid)));
        if (!stock) return res.status(404).json({ message: `Stock id ${item.stockId} not found` });
        if (stock.quantityInStock < item.quantity)
          return res.status(400).json({ message: `Insufficient stock for item (only ${stock.quantityInStock} available)` });
      }

      // Create issue header
      const [issue] = await db.insert(uniformIssues).values({
        companyId: cid,
        employeeId: employeeIdNum,
        employeeName,
        employeeNumber: employeeNumber || null,
        jobTitle: jobTitle || null,
        department: department || null,
        reason,
        reasonOther: reasonOther || null,
        employeeSignature: employeeSignature || null,
        issuedBy: req.user.id,
        notes: notes || null,
      }).returning();

      // Create line items and deduct stock
      for (const item of items) {
        await db.insert(uniformIssueItems).values({
          issueId: issue.id,
          stockId: item.stockId,
          quantity: item.quantity,
        });
        await db.update(uniformStock)
          .set({ quantityInStock: sql`quantity_in_stock - ${item.quantity}` })
          .where(eq(uniformStock.id, item.stockId));
      }

      res.json({ ...issue, items });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── RETURNS ──────────────────────────────────────────────────────────────────

  // Process return for a specific issue line-item
  app.post("/api/uniform/issues/:issueId/items/:itemId/return", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    const issueId = parseInt(req.params.issueId);
    const itemId = parseInt(req.params.itemId);
    const { returnedQty, managerSignature, returnNotes } = req.body;

    if (!returnedQty || returnedQty < 1) return res.status(400).json({ message: "returnedQty required" });

    try {
      // Verify issue belongs to company
      const [issue] = await db.select().from(uniformIssues)
        .where(and(eq(uniformIssues.id, issueId), eq(uniformIssues.companyId, cid)));
      if (!issue) return res.status(404).json({ message: "Issue not found" });

      const [issueItem] = await db.select().from(uniformIssueItems)
        .where(and(eq(uniformIssueItems.id, itemId), eq(uniformIssueItems.issueId, issueId)));
      if (!issueItem) return res.status(404).json({ message: "Issue item not found" });

      const maxReturn = issueItem.quantity - issueItem.returnedQty;
      if (returnedQty > maxReturn) return res.status(400).json({ message: `Can only return up to ${maxReturn} items` });

      const newReturnedQty = issueItem.returnedQty + returnedQty;
      const [updated] = await db.update(uniformIssueItems)
        .set({
          returnedQty: newReturnedQty,
          returnedAt: new Date(),
          managerSignature: managerSignature || null,
          returnedBy: req.user.id,
          returnNotes: returnNotes || null,
        })
        .where(eq(uniformIssueItems.id, itemId))
        .returning();

      // Add stock back
      await db.update(uniformStock)
        .set({ quantityInStock: sql`quantity_in_stock + ${returnedQty}` })
        .where(eq(uniformStock.id, issueItem.stockId));

      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── PER-EMPLOYEE HOLDINGS ────────────────────────────────────────────────────

  app.get("/api/uniform/employee/:employeeId", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    const employeeId = parseInt(req.params.employeeId);
    try {
      const issues = await db.select({
        id: uniformIssues.id,
        employeeName: uniformIssues.employeeName,
        employeeNumber: uniformIssues.employeeNumber,
        reason: uniformIssues.reason,
        issuedAt: uniformIssues.issuedAt,
        issuedBy: uniformIssues.issuedBy,
        notes: uniformIssues.notes,
      })
        .from(uniformIssues)
        .where(and(eq(uniformIssues.companyId, cid), eq(uniformIssues.employeeId, employeeId)))
        .orderBy(desc(uniformIssues.issuedAt));

      const ids = issues.map(i => i.id);
      let allItems: any[] = [];
      if (ids.length > 0) {
        allItems = await db
          .select({
            id: uniformIssueItems.id,
            issueId: uniformIssueItems.issueId,
            stockId: uniformIssueItems.stockId,
            quantity: uniformIssueItems.quantity,
            returnedQty: uniformIssueItems.returnedQty,
            returnedAt: uniformIssueItems.returnedAt,
            returnNotes: uniformIssueItems.returnNotes,
            itemName: uniformCatalogue.name,
            size: uniformStock.size,
            category: uniformCatalogue.category,
          })
          .from(uniformIssueItems)
          .innerJoin(uniformStock, eq(uniformIssueItems.stockId, uniformStock.id))
          .innerJoin(uniformCatalogue, eq(uniformStock.catalogueId, uniformCatalogue.id))
          .where(sql`${uniformIssueItems.issueId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::int[])`);
      }

      const itemsByIssue = allItems.reduce((acc: any, item: any) => {
        acc[item.issueId] = acc[item.issueId] || [];
        acc[item.issueId].push(item);
        return acc;
      }, {});

      res.json(issues.map(i => ({ ...i, items: itemsByIssue[i.id] || [] })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Currently held items per employee (not fully returned)
  app.get("/api/uniform/holdings", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    try {
      const rows = await db.execute(sql`
        SELECT
          ui.employee_id,
          ui.employee_name,
          ui.employee_number,
          ui.job_title,
          ui.department,
          uc.name AS item_name,
          uc.category,
          us.size,
          SUM(uii.quantity - uii.returned_qty) AS held_qty,
          MAX(ui.issued_at) AS last_issued
        FROM uniform_issue_items uii
        JOIN uniform_issues ui ON ui.id = uii.issue_id
        JOIN uniform_stock us ON us.id = uii.stock_id
        JOIN uniform_catalogue uc ON uc.id = us.catalogue_id
        WHERE ui.company_id = ${cid}
          AND (uii.quantity - uii.returned_qty) > 0
        GROUP BY ui.employee_id, ui.employee_name, ui.employee_number, ui.job_title, ui.department, uc.name, uc.category, us.size
        ORDER BY ui.employee_name, uc.category, uc.name, us.size
      `);
      res.json(rows.rows ?? rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── EXCEL EXPORT ─────────────────────────────────────────────────────────────

  app.get("/api/uniform/export", requireAuth, requireAdmin, async (req: any, res: Response) => {
    const cid = companyGuard(req, res); if (!cid) return;
    try {
      // Sheet 1: Current Stock
      const stockRows = await db
        .select({
          Item: uniformCatalogue.name,
          Category: uniformCatalogue.category,
          Size: uniformStock.size,
          "Total Qty": uniformStock.totalQuantity,
          "In Stock": uniformStock.quantityInStock,
          "Issued": sql<number>`${uniformStock.totalQuantity} - ${uniformStock.quantityInStock}`,
        })
        .from(uniformStock)
        .innerJoin(uniformCatalogue, eq(uniformStock.catalogueId, uniformCatalogue.id))
        .where(and(eq(uniformStock.companyId, cid), eq(uniformCatalogue.isActive, true)))
        .orderBy(uniformCatalogue.category, uniformCatalogue.name, uniformStock.size);

      // Sheet 2: Holdings (what each employee currently has)
      const holdingsResult = await db.execute(sql`
        SELECT
          ui.employee_name AS "Employee Name",
          ui.employee_number AS "Employee No.",
          ui.job_title AS "Job Title",
          ui.department AS "Department",
          uc.category AS "Category",
          uc.name AS "Item",
          us.size AS "Size",
          SUM(uii.quantity - uii.returned_qty) AS "Held Qty",
          TO_CHAR(MAX(ui.issued_at), 'DD/MM/YYYY') AS "Last Issued"
        FROM uniform_issue_items uii
        JOIN uniform_issues ui ON ui.id = uii.issue_id
        JOIN uniform_stock us ON us.id = uii.stock_id
        JOIN uniform_catalogue uc ON uc.id = us.catalogue_id
        WHERE ui.company_id = ${cid}
          AND (uii.quantity - uii.returned_qty) > 0
        GROUP BY ui.employee_name, ui.employee_number, ui.job_title, ui.department, uc.category, uc.name, us.size
        ORDER BY ui.employee_name, uc.category, uc.name, us.size
      `);
      const holdingsRows = holdingsResult.rows ?? holdingsResult;

      // Sheet 3: Full Audit Log
      const auditResult = await db.execute(sql`
        SELECT
          TO_CHAR(ui.issued_at, 'DD/MM/YYYY HH24:MI') AS "Issued At",
          ui.employee_name AS "Employee",
          ui.employee_number AS "Employee No.",
          ui.job_title AS "Job Title",
          uc.name AS "Item",
          us.size AS "Size",
          uii.quantity AS "Qty Issued",
          uii.returned_qty AS "Qty Returned",
          TO_CHAR(uii.returned_at, 'DD/MM/YYYY HH24:MI') AS "Returned At",
          ui.reason AS "Reason",
          ui.notes AS "Notes",
          CONCAT(ub.first_name, ' ', ub.last_name) AS "Issued By"
        FROM uniform_issue_items uii
        JOIN uniform_issues ui ON ui.id = uii.issue_id
        JOIN uniform_stock us ON us.id = uii.stock_id
        JOIN uniform_catalogue uc ON uc.id = us.catalogue_id
        LEFT JOIN users ub ON ub.id = ui.issued_by
        WHERE ui.company_id = ${cid}
        ORDER BY ui.issued_at DESC
      `);
      const auditRows = auditResult.rows ?? auditResult;

      const wb = new ExcelJS.Workbook();

      function addSheet(name: string, rows: any[]) {
        const ws = wb.addWorksheet(name);
        if (rows.length > 0) {
          ws.columns = Object.keys(rows[0]).map(k => ({ header: k, key: k, width: 20 }));
          rows.forEach(r => ws.addRow(r));
        }
      }

      addSheet("Current Stock", stockRows as any[]);
      addSheet("Employee Holdings", holdingsRows as any[]);
      addSheet("Full Audit Log", auditRows as any[]);

      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Disposition", `attachment; filename="uniform-stock-${new Date().toISOString().slice(0,10)}.xlsx"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buf);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
}
