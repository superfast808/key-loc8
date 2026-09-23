import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Shirt, Package, Download, Plus, Minus, X, RotateCcw, User,
  ChevronDown, ChevronRight, Edit2, Check, AlertTriangle, ClipboardList,
  History, Settings, Archive, Pencil, TrendingUp, TrendingDown, Layers, Trash2,
  ChevronsUpDown,
} from "lucide-react";
import { format } from "date-fns";

// ─── Signature Pad ────────────────────────────────────────────────────────────

function SignaturePad({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    drawing.current = true;
    const canvas = canvasRef.current!;
    lastPos.current = getPos(e, canvas);
    e.preventDefault();
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  }, []);

  const stopDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL());
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);
    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDraw);
      canvas.removeEventListener("mouseleave", stopDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDraw);
    };
  }, [startDraw, draw, stopDraw]);

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="w-full touch-none cursor-crosshair"
          style={{ display: "block" }}
        />
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-sm">Sign here</span>
          </div>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={clear} className="text-xs text-gray-500">
        <RotateCcw className="h-3 w-3 mr-1" /> Clear
      </Button>
    </div>
  );
}

// ─── Size options ──────────────────────────────────────────────────────────────

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"];

const REASON_LABELS: Record<string, string> = {
  new_starter: "New Starter",
  new_item: "New Item",
  replacement: "Replacement Item",
  temporary_loan: "Temporary Loan",
  other: "Other",
};

function reasonLabel(r: string) { return REASON_LABELS[r] ?? r; }
function fmt(d: string | null | undefined) { return d ? format(new Date(d), "dd/MM/yyyy HH:mm") : "—"; }

// ─── Main Component ────────────────────────────────────────────────────────────

export default function UniformPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";

  // ── Data queries ──────────────────────────────────────────────────────────────
  const { data: catalogue = [] } = useQuery<any[]>({ queryKey: ["/api/uniform/catalogue"] });
  const { data: stock = [] } = useQuery<any[]>({ queryKey: ["/api/uniform/stock"] });
  const { data: issues = [], isLoading: issuesLoading } = useQuery<any[]>({ queryKey: ["/api/uniform/issues"] });
  const { data: holdings = [] } = useQuery<any[]>({ queryKey: ["/api/uniform/holdings"] });
  const { data: sysUsers = [] } = useQuery<any[]>({ queryKey: ["/api/uniform/staff-directory"] });

  // ── Active tab ────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("stock");

  // ── Stock overview ─────────────────────────────────────────────────────────────
  const totalInStock = stock.reduce((a: number, s: any) => a + s.quantityInStock, 0);
  const totalIssued = stock.reduce((a: number, s: any) => a + (s.totalQuantity - s.quantityInStock), 0);
  const totalItems = stock.reduce((a: number, s: any) => a + s.totalQuantity, 0);
  const lowStock = stock.filter((s: any) => s.quantityInStock > 0 && s.quantityInStock <= 2 && s.isActive).length;

  // ── Issue form state ───────────────────────────────────────────────────────────
  const [issueForm, setIssueForm] = useState({
    employeeId: "",
    employeeName: "",
    employeeNumber: "",
    jobTitle: "",
    department: "",
    reason: "",
    reasonOther: "",
    notes: "",
    employeeSignature: "",
  });
  const [issueItems, setIssueItems] = useState<{ stockId: string; quantity: number }[]>([]);

  const addIssueItem = () => setIssueItems(prev => [...prev, { stockId: "", quantity: 1 }]);
  const removeIssueItem = (i: number) => setIssueItems(prev => prev.filter((_, idx) => idx !== i));
  const updateIssueItem = (i: number, key: string, val: any) =>
    setIssueItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const issueMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/uniform/issues", data),
    onSuccess: () => {
      toast({ title: "Items issued successfully" });
      qc.invalidateQueries({ queryKey: ["/api/uniform/issues"] });
      qc.invalidateQueries({ queryKey: ["/api/uniform/stock"] });
      qc.invalidateQueries({ queryKey: ["/api/uniform/holdings"] });
      setIssueForm({ employeeId: "", employeeName: "", employeeNumber: "", jobTitle: "", department: "", reason: "", reasonOther: "", notes: "", employeeSignature: "" });
      setIssueItems([]);
      setTab("history");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [staffPickerOpen, setStaffPickerOpen] = useState(false);

  const handleIssueSubmit = () => {
    if (!issueForm.employeeId) return toast({ title: "Please select a registered staff member", variant: "destructive" });
    if (!issueForm.reason) return toast({ title: "Reason required", variant: "destructive" });
    if (issueItems.length === 0) return toast({ title: "Add at least one item", variant: "destructive" });
    for (const it of issueItems) {
      if (!it.stockId) return toast({ title: "Select item for each row", variant: "destructive" });
    }
    issueMutation.mutate({
      ...issueForm,
      employeeId: parseInt(issueForm.employeeId),
      items: issueItems.map(it => ({ stockId: parseInt(it.stockId), quantity: it.quantity })),
    });
  };

  // Auto-fill employee details when selecting a system user. Staff must always
  // be linked to a registered user — manual name entry is not allowed.
  const handleEmployeeSelect = (userId: string) => {
    const u = sysUsers.find((u: any) => String(u.id) === userId);
    if (u) {
      setIssueForm(prev => ({
        ...prev,
        employeeId: userId,
        employeeName: `${u.firstName} ${u.lastName}`.trim(),
        jobTitle: prev.jobTitle || u.role || "",
      }));
    } else {
      setIssueForm(prev => ({ ...prev, employeeId: "", employeeName: "", jobTitle: "" }));
    }
    setStaffPickerOpen(false);
  };

  // ── Return dialog ──────────────────────────────────────────────────────────────
  const [returnDialog, setReturnDialog] = useState<{ issueId: number; item: any } | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnSig, setReturnSig] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  const returnMutation = useMutation({
    mutationFn: ({ issueId, itemId, data }: any) =>
      apiRequest("POST", `/api/uniform/issues/${issueId}/items/${itemId}/return`, data),
    onSuccess: () => {
      toast({ title: "Return processed" });
      qc.invalidateQueries({ queryKey: ["/api/uniform/issues"] });
      qc.invalidateQueries({ queryKey: ["/api/uniform/stock"] });
      qc.invalidateQueries({ queryKey: ["/api/uniform/holdings"] });
      setReturnDialog(null);
      setReturnSig("");
      setReturnNotes("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openReturn = (issueId: number, item: any) => {
    setReturnDialog({ issueId, item });
    setReturnQty(item.quantity - item.returnedQty);
    setReturnSig("");
    setReturnNotes("");
  };

  // Outstanding items to return (across all issues)
  const outstanding = issues.flatMap((issue: any) =>
    (issue.items || [])
      .filter((it: any) => it.quantity - it.returnedQty > 0)
      .map((it: any) => ({ ...it, issuedAt: issue.issuedAt, employeeName: issue.employeeName, issueId: issue.id }))
  );

  // Group outstanding by employee
  const outstandingByEmployee = (() => {
    const map = new Map<string, { name: string; totalOutstanding: number; items: any[] }>();
    for (const it of outstanding) {
      const key = it.employeeName;
      if (!map.has(key)) map.set(key, { name: key, totalOutstanding: 0, items: [] });
      const grp = map.get(key)!;
      grp.items.push(it);
      grp.totalOutstanding += it.quantity - it.returnedQty;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  // ── Bulk return dialog ─────────────────────────────────────────────────────────
  const [expandedReturn, setExpandedReturn] = useState<string | null>(null);
  const [bulkReturnDialog, setBulkReturnDialog] = useState<{ empName: string; items: any[] } | null>(null);
  const [bulkReturnSig, setBulkReturnSig] = useState("");
  const [bulkReturnNotes, setBulkReturnNotes] = useState("");

  const bulkReturnMutation = useMutation({
    mutationFn: async ({ items, sig, notes }: { items: any[]; sig: string; notes: string }) => {
      for (const it of items) {
        await apiRequest("POST", `/api/uniform/issues/${it.issueId}/items/${it.id}/return`, {
          returnedQty: it.quantity - it.returnedQty,
          managerSignature: sig || null,
          returnNotes: notes || null,
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Return processed successfully" });
      qc.invalidateQueries({ queryKey: ["/api/uniform/issues"] });
      qc.invalidateQueries({ queryKey: ["/api/uniform/stock"] });
      qc.invalidateQueries({ queryKey: ["/api/uniform/holdings"] });
      setBulkReturnDialog(null);
      setBulkReturnSig("");
      setBulkReturnNotes("");
      setExpandedReturn(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── History expand ────────────────────────────────────────────────────────────
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  // ── By-employee grouping ────────────────────────────────────────────────────────
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const employeeGroups = (() => {
    const map = new Map<string, { key: string; name: string; number: string | null; jobTitle: string | null; totalItems: number; lastIssued: string | null; items: any[] }>();
    for (const h of (holdings as any[])) {
      const key = String(h.employee_id ?? h.employee_name);
      if (!map.has(key)) {
        map.set(key, { key, name: h.employee_name, number: h.employee_number ?? null, jobTitle: h.job_title ?? null, totalItems: 0, lastIssued: null, items: [] });
      }
      const grp = map.get(key)!;
      grp.items.push(h);
      grp.totalItems += Number(h.held_qty) || 0;
      if (h.last_issued && (!grp.lastIssued || h.last_issued > grp.lastIssued)) grp.lastIssued = h.last_issued;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  // ── Catalogue dialog ──────────────────────────────────────────────────────────
  const [catDialog, setCatDialog] = useState<{ mode: "add" | "edit"; item?: any } | null>(null);
  const [catForm, setCatForm] = useState({ name: "", category: "uniform", hasSizes: false, description: "" });
  const [stockDialog, setStockDialog] = useState<{ catalogueId: number; name: string; hasSizes: boolean } | null>(null);
  const [stockRows, setStockRows] = useState<{ size: string; total: number; inStock: number; id?: number }[]>([]);
  const [addSizeValue, setAddSizeValue] = useState("");
  const [customSizeInput, setCustomSizeInput] = useState("");

  const catMutation = useMutation({
    mutationFn: (data: any) =>
      catDialog?.mode === "edit"
        ? apiRequest("PATCH", `/api/uniform/catalogue/${catDialog.item.id}`, data)
        : apiRequest("POST", "/api/uniform/catalogue", data),
    onSuccess: () => {
      toast({ title: catDialog?.mode === "edit" ? "Item updated" : "Item added" });
      qc.invalidateQueries({ queryKey: ["/api/uniform/catalogue"] });
      setCatDialog(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<any>(null);
  const deleteCatMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/uniform/catalogue/${id}`, {}),
    onSuccess: () => {
      toast({ title: "Item deleted" });
      qc.invalidateQueries({ queryKey: ["/api/uniform/catalogue"] });
      qc.invalidateQueries({ queryKey: ["/api/uniform/stock"] });
      setDeleteConfirmItem(null);
    },
    onError: (e: any) => {
      toast({ title: "Cannot delete", description: e.message, variant: "destructive" });
      setDeleteConfirmItem(null);
    },
  });

  const stockMutation = useMutation({
    mutationFn: ({ catalogueId, rows }: { catalogueId: number; rows: any[] }) =>
      apiRequest("PUT", "/api/uniform/stock/bulk", { catalogueId, rows }),
    onSuccess: () => {
      toast({ title: "Stock levels saved successfully" });
      qc.invalidateQueries({ queryKey: ["/api/uniform/stock"] });
      setStockDialog(null);
    },
    onError: (e: any) => toast({ title: "Failed to save stock", description: e.message, variant: "destructive" }),
  });

  // ── Adjust Stock dialog ────────────────────────────────────────────────────
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustStockId, setAdjustStockId] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add");
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNotes, setAdjustNotes] = useState("");

  const openAdjustDialog = (stockId?: number) => {
    setAdjustStockId(stockId ? String(stockId) : "");
    setAdjustType("add");
    setAdjustQty(1);
    setAdjustNotes("");
    setAdjustDialog(true);
  };

  const adjustMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/uniform/stock/adjust", data),
    onSuccess: () => {
      toast({ title: adjustType === "add" ? "Stock added successfully" : "Stock removed successfully" });
      qc.invalidateQueries({ queryKey: ["/api/uniform/stock"] });
      setAdjustDialog(false);
    },
    onError: (e: any) => toast({ title: "Error adjusting stock", description: e.message, variant: "destructive" }),
  });

  const handleAdjustSubmit = () => {
    if (!adjustStockId) return toast({ title: "Please select an item", variant: "destructive" });
    if (adjustQty < 1) return toast({ title: "Quantity must be at least 1", variant: "destructive" });
    adjustMutation.mutate({ stockId: parseInt(adjustStockId), type: adjustType, quantity: adjustQty, notes: adjustNotes });
  };

  // Selected stock row info for the adjust dialog
  const adjustStockRow = stock.find((s: any) => String(s.id) === adjustStockId) as any;

  const openStockDialog = (catItem: any) => {
    setStockDialog({ catalogueId: catItem.id, name: catItem.name, hasSizes: catItem.hasSizes });
    const existing = stock.filter((s: any) => s.catalogueId === catItem.id);
    if (existing.length > 0) {
      setStockRows(existing.map((s: any) => ({ id: s.id, size: s.size ?? "", total: s.totalQuantity, inStock: s.quantityInStock })));
    } else if (!catItem.hasSizes) {
      // Non-sized item: start with one blank row
      setStockRows([{ size: "", total: 0, inStock: 0 }]);
    } else {
      // Sized item: start empty, user adds sizes they need
      setStockRows([]);
    }
    setAddSizeValue("");
    setCustomSizeInput("");
  };

  const addSizeRow = (size: string) => {
    if (!size || stockRows.some(r => r.size === size)) return;
    setStockRows(prev => [...prev, { size, total: 0, inStock: 0 }]);
    setAddSizeValue("");
    setCustomSizeInput("");
  };

  const removeSizeRow = (i: number) => setStockRows(prev => prev.filter((_, idx) => idx !== i));

  const handleSaveStock = () => {
    if (!stockDialog) return;
    const rowsToSave = stockRows.filter(r => r.size !== undefined);
    stockMutation.mutate({
      catalogueId: stockDialog.catalogueId,
      rows: rowsToSave.map(r => ({
        id: r.id,
        size: r.size || null,
        totalQuantity: r.total,
        quantityInStock: r.inStock,
      })),
    });
  };

  const openCatEdit = (item: any) => {
    setCatForm({ name: item.name, category: item.category, hasSizes: item.hasSizes, description: item.description || "" });
    setCatDialog({ mode: "edit", item });
  };

  // ── Stock table grouped by category ──────────────────────────────────────────
  const stockByCategory = stock
    .filter((s: any) => s.isActive)
    .reduce((acc: any, s: any) => {
      acc[s.category] = acc[s.category] || [];
      acc[s.category].push(s);
      return acc;
    }, {});

  // ── Issue stock lookup ────────────────────────────────────────────────────────
  const availableStock = stock.filter((s: any) => s.quantityInStock > 0 && s.isActive);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2">
              <Shirt className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Uniform & Equipment</h1>
              <p className="text-sm text-gray-500">Stock control and issue tracking</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => window.open("/api/uniform/export", "_blank")}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Stock", value: totalItems, color: "blue", icon: Package },
            { label: "In Stock", value: totalInStock, color: "green", icon: Check },
            { label: "Currently Issued", value: totalIssued, color: "amber", icon: User },
            { label: "Low Stock Alerts", value: lowStock, color: lowStock > 0 ? "red" : "gray", icon: AlertTriangle },
          ].map(c => (
            <Card key={c.label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                  </div>
                  <c.icon className={`h-8 w-8 text-${c.color}-400`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger value="stock" className="flex items-center gap-1 text-xs sm:text-sm">
              <Package className="h-4 w-4" /> Stock
            </TabsTrigger>
            <TabsTrigger value="issue" className="flex items-center gap-1 text-xs sm:text-sm">
              <Plus className="h-4 w-4" /> Issue Items
            </TabsTrigger>
            <TabsTrigger value="returns" className="flex items-center gap-1 text-xs sm:text-sm">
              <RotateCcw className="h-4 w-4" />
              Returns
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-1 text-xs sm:text-sm">
              <User className="h-4 w-4" /> By Employee
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 text-xs sm:text-sm">
              <History className="h-4 w-4" /> History
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="catalogue" className="flex items-center gap-1 text-xs sm:text-sm">
                <Settings className="h-4 w-4" /> Catalogue
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── STOCK TAB ───────────────────────────────────────────────────── */}
          <TabsContent value="stock" className="space-y-4 mt-4">
            {/* Admin-only adjust stock button */}
            {isAdmin && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAdjustDialog()}
                  className="flex items-center gap-2"
                >
                  <Layers className="h-4 w-4" />
                  Adjust Stock
                </Button>
              </div>
            )}

            {["uniform", "equipment"].map(cat => {
              const catItems = catalogue.filter((c: any) => c.category === cat && c.isActive);
              if (catItems.length === 0) return null;
              return (
                <Card key={cat}>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2">
                      {cat === "uniform" ? <Shirt className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                      {cat === "uniform" ? "Uniform" : "Equipment"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>Item</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                          <TableHead className="text-center">In Stock</TableHead>
                          <TableHead className="text-center">Issued</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          {isAdmin && <TableHead></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catItems.map((item: any) => {
                          const itemStock = stock.filter((s: any) => s.catalogueId === item.id);
                          if (itemStock.length === 0) {
                            return (
                              <TableRow key={`nostock-${item.id}`}>
                                <TableCell className="font-medium text-gray-700">{item.name}</TableCell>
                                <TableCell colSpan={4} className="text-gray-400 text-sm italic">No stock levels set</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="text-xs text-gray-400">Not configured</Badge>
                                </TableCell>
                                {isAdmin && <TableCell />}
                              </TableRow>
                            );
                          }
                          return itemStock.map((s: any, idx: number) => {
                            const issued = s.totalQuantity - s.quantityInStock;
                            const isNoStock = s.totalQuantity === 0 && s.quantityInStock === 0;
                            const isLow = !isNoStock && s.quantityInStock > 0 && s.quantityInStock <= 2;
                            const isEmpty = !isNoStock && s.quantityInStock === 0 && s.totalQuantity > 0;
                            return (
                              <TableRow key={s.id}>
                                <TableCell className="font-medium">{idx === 0 ? item.name : ""}</TableCell>
                                <TableCell className="text-gray-500">{s.size ?? "—"}</TableCell>
                                <TableCell className="text-center">{s.totalQuantity}</TableCell>
                                <TableCell className="text-center font-semibold">{s.quantityInStock}</TableCell>
                                <TableCell className="text-center text-amber-700">{issued}</TableCell>
                                <TableCell className="text-center">
                                  {isNoStock ? (
                                    <Badge className="text-xs bg-gray-100 text-gray-500 border border-gray-300">No Stock</Badge>
                                  ) : isEmpty ? (
                                    <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                                  ) : isLow ? (
                                    <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-300">Low Stock</Badge>
                                  ) : (
                                    <Badge className="text-xs bg-green-100 text-green-800 border border-green-300">OK</Badge>
                                  )}
                                </TableCell>
                                {isAdmin && (
                                  <TableCell className="text-right">
                                    {idx === 0 && (
                                      <Button
                                        size="sm" variant="ghost" className="text-xs h-7 px-2"
                                        onClick={() => openAdjustDialog(s.id)}
                                      >
                                        <Layers className="h-3 w-3 mr-1" /> Adjust
                                      </Button>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          });
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
            {catalogue.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No catalogue items yet. Ask an admin to add items in the Catalogue tab.</p>
              </div>
            )}
          </TabsContent>

          {/* ── ISSUE TAB ───────────────────────────────────────────────────── */}
          <TabsContent value="issue" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Issue Uniform / Equipment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Employee details */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Staff Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Staff Member *</Label>
                      <Popover open={staffPickerOpen} onOpenChange={setStaffPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={staffPickerOpen}
                            className="w-full justify-between font-normal"
                            data-testid="staff-picker-trigger"
                          >
                            {issueForm.employeeName || (
                              <span className="text-muted-foreground">Search registered staff…</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                          <Command
                            filter={(value, search) =>
                              value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                            }
                          >
                            <CommandInput placeholder="Type a name or email…" />
                            <CommandList>
                              <CommandEmpty>No matching staff. Add them in User Management first.</CommandEmpty>
                              <CommandGroup>
                                {(sysUsers as any[]).map((u: any) => {
                                  const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
                                  return (
                                    <CommandItem
                                      key={u.id}
                                      value={`${fullName} ${u.email ?? ""}`}
                                      onSelect={() => handleEmployeeSelect(String(u.id))}
                                      data-testid={`staff-picker-option-${u.id}`}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${String(u.id) === issueForm.employeeId ? "opacity-100" : "opacity-0"}`}
                                      />
                                      <div className="flex flex-col">
                                        <span>{fullName}</span>
                                        {u.email && <span className="text-xs text-muted-foreground">{u.email}</span>}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        Uniform and equipment can only be issued to registered staff. Add new staff in User Management.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label>Employee ID Number</Label>
                      <Input
                        value={issueForm.employeeNumber}
                        onChange={e => setIssueForm(p => ({ ...p, employeeNumber: e.target.value }))}
                        placeholder="E.g. EMP-001"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Job Title / Role</Label>
                      <Input
                        value={issueForm.jobTitle}
                        onChange={e => setIssueForm(p => ({ ...p, jobTitle: e.target.value }))}
                        placeholder="E.g. Security Officer"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Department / Team</Label>
                      <Input
                        value={issueForm.department}
                        onChange={e => setIssueForm(p => ({ ...p, department: e.target.value }))}
                        placeholder="E.g. Operations"
                      />
                    </div>
                  </div>
                </div>

                <hr />

                {/* Reason */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Issue Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Reason for Issue *</Label>
                      <Select value={issueForm.reason} onValueChange={v => setIssueForm(p => ({ ...p, reason: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new_starter">New Starter</SelectItem>
                          <SelectItem value="new_item">New Item</SelectItem>
                          <SelectItem value="replacement">Replacement Item</SelectItem>
                          <SelectItem value="temporary_loan">Temporary Loan</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {issueForm.reason === "other" && (
                      <div className="space-y-1">
                        <Label>Please specify</Label>
                        <Input
                          value={issueForm.reasonOther}
                          onChange={e => setIssueForm(p => ({ ...p, reasonOther: e.target.value }))}
                        />
                      </div>
                    )}
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={issueForm.notes}
                        onChange={e => setIssueForm(p => ({ ...p, notes: e.target.value }))}
                        rows={2}
                        placeholder="Optional notes…"
                      />
                    </div>
                  </div>
                </div>

                <hr />

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Items to Issue</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addIssueItem}>
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>
                  {issueItems.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Click "Add Item" to add items to this issue.</p>
                  )}
                  <div className="space-y-2">
                    {issueItems.map((item, i) => (
                      <div key={i} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg">
                        <Select value={item.stockId} onValueChange={v => updateIssueItem(i, "stockId", v)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select item…" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableStock.map((s: any) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.name}{s.size ? ` — ${s.size}` : ""} ({s.quantityInStock} in stock)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button" variant="outline" size="icon" className="h-8 w-8"
                            onClick={() => updateIssueItem(i, "quantity", Math.max(1, item.quantity - 1))}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                          <Button
                            type="button" variant="outline" size="icon" className="h-8 w-8"
                            onClick={() => updateIssueItem(i, "quantity", item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                          onClick={() => removeIssueItem(i)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <hr />

                {/* Employee signature */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">Employee Signature</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    I confirm that I have received the above items and understand that I am responsible for their care and return (if applicable).
                  </p>
                  <SignaturePad
                    label="Employee Signature"
                    value={issueForm.employeeSignature}
                    onChange={v => setIssueForm(p => ({ ...p, employeeSignature: v }))}
                  />
                </div>

                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleIssueSubmit}
                  disabled={issueMutation.isPending}
                >
                  {issueMutation.isPending ? "Saving…" : "Confirm Issue"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── RETURNS TAB ─────────────────────────────────────────────────── */}
          <TabsContent value="returns" className="mt-4">
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-base">Outstanding Items — Awaiting Return</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {outstandingByEmployee.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Check className="h-10 w-10 mx-auto mb-2 text-green-400 opacity-50" />
                    <p>All issued items have been returned.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_120px] gap-2 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span>Employee</span>
                      <span className="text-center">Items Outstanding</span>
                    </div>

                    {outstandingByEmployee.map(grp => (
                      <div key={grp.name}>
                        {/* Summary row */}
                        <button
                          className="w-full grid grid-cols-[24px_1fr_120px] gap-2 items-center px-4 py-3 hover:bg-gray-50 text-left"
                          onClick={() => setExpandedReturn(expandedReturn === grp.name ? null : grp.name)}
                        >
                          {expandedReturn === grp.name
                            ? <ChevronDown className="h-4 w-4 text-gray-400" />
                            : <ChevronRight className="h-4 w-4 text-gray-400" />
                          }
                          <span className="font-semibold text-sm text-gray-900">{grp.name}</span>
                          <span className="text-center">
                            <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold">
                              {grp.totalOutstanding}
                            </Badge>
                          </span>
                        </button>

                        {/* Expanded items + bulk return button */}
                        {expandedReturn === grp.name && (
                          <div className="bg-gray-50 border-t px-4 sm:px-6 pb-4 overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item</TableHead>
                                  <TableHead>Size</TableHead>
                                  <TableHead className="text-center">Outstanding</TableHead>
                                  <TableHead>Issued</TableHead>
                                  <TableHead></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {grp.items.map((it: any) => (
                                  <TableRow key={it.id}>
                                    <TableCell className="font-medium">{it.itemName}</TableCell>
                                    <TableCell className="text-gray-500">{it.size ?? "—"}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs">
                                        {it.quantity - it.returnedQty}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">{fmt(it.issuedAt)}</TableCell>
                                    <TableCell>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex items-center gap-1 text-xs"
                                        onClick={() => openReturn(it.issueId, it)}
                                      >
                                        <RotateCcw className="h-3 w-3" /> Return
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="mt-3 flex justify-end">
                              <Button
                                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                                onClick={() => {
                                  setBulkReturnDialog({ empName: grp.name, items: grp.items });
                                  setBulkReturnSig("");
                                  setBulkReturnNotes("");
                                }}
                              >
                                <RotateCcw className="h-4 w-4" /> Return All Items
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BY EMPLOYEE TAB ──────────────────────────────────────────────── */}
          <TabsContent value="employees" className="mt-4">
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-base">Current Holdings by Employee</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {employeeGroups.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No current holdings. Issue items to employees to see them here.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {/* Header row */}
                    <div className="grid grid-cols-[1fr_80px] sm:grid-cols-[1fr_120px_120px_80px_100px] gap-2 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span>Employee</span>
                      <span className="hidden sm:block">Employee No.</span>
                      <span className="hidden sm:block">Job Title</span>
                      <span className="text-center">Items Held</span>
                      <span className="hidden sm:block">Last Issued</span>
                    </div>

                    {employeeGroups.map(grp => (
                      <div key={grp.key}>
                        {/* Summary row — clickable */}
                        <button
                          className="w-full grid grid-cols-[24px_1fr_80px] sm:grid-cols-[24px_1fr_120px_120px_80px_100px] gap-2 items-center px-4 py-3 hover:bg-gray-50 text-left"
                          onClick={() => setExpandedEmployee(expandedEmployee === grp.key ? null : grp.key)}
                        >
                          {expandedEmployee === grp.key
                            ? <ChevronDown className="h-4 w-4 text-gray-400" />
                            : <ChevronRight className="h-4 w-4 text-gray-400" />
                          }
                          <span className="font-semibold text-sm text-gray-900 truncate">{grp.name}</span>
                          <span className="hidden sm:block text-sm text-gray-500">{grp.number ?? "—"}</span>
                          <span className="hidden sm:block text-sm text-gray-500 truncate">{grp.jobTitle ?? "—"}</span>
                          <span className="text-center">
                            <Badge variant="outline" className="text-xs font-semibold">{grp.totalItems}</Badge>
                          </span>
                          <span className="hidden sm:block text-sm text-gray-500">{grp.lastIssued ? format(new Date(grp.lastIssued), "dd/MM/yyyy") : "—"}</span>
                        </button>

                        {/* Expanded item detail */}
                        {expandedEmployee === grp.key && (
                          <div className="bg-gray-50 border-t px-4 sm:px-6 pb-4 overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item</TableHead>
                                  <TableHead>Size</TableHead>
                                  <TableHead className="text-center">Qty Held</TableHead>
                                  <TableHead>Last Issued</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {grp.items.map((h: any, i: number) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-medium">{h.item_name}</TableCell>
                                    <TableCell className="text-gray-500">{h.size ?? "—"}</TableCell>
                                    <TableCell className="text-center font-semibold">{h.held_qty}</TableCell>
                                    <TableCell className="text-sm text-gray-500">{h.last_issued ? format(new Date(h.last_issued), "dd/MM/yyyy") : "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── HISTORY TAB ──────────────────────────────────────────────────── */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Full Issue &amp; Return Audit Log</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {issuesLoading ? (
                  <div className="text-center py-8 text-gray-400">Loading…</div>
                ) : issues.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No issue records yet.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {(issues as any[]).map((issue: any) => (
                      <div key={issue.id}>
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                          onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {expandedIssue === issue.id
                              ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                              : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                            }
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">{issue.employeeName}</p>
                              <p className="text-xs text-gray-500">{fmt(issue.issuedAt)} · {reasonLabel(issue.reason)} · {issue.items?.length ?? 0} item(s)</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="ml-2 text-xs shrink-0">
                            {issue.issuedByName ?? "Unknown"}
                          </Badge>
                        </button>

                        {expandedIssue === issue.id && (
                          <div className="px-4 sm:px-6 pb-4 bg-gray-50 border-t overflow-x-auto">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-sm">
                              {issue.employeeNumber && <div><span className="text-gray-500">Employee No: </span>{issue.employeeNumber}</div>}
                              {issue.jobTitle && <div><span className="text-gray-500">Role: </span>{issue.jobTitle}</div>}
                              {issue.department && <div><span className="text-gray-500">Dept: </span>{issue.department}</div>}
                              {issue.notes && <div className="col-span-2"><span className="text-gray-500">Notes: </span>{issue.notes}</div>}
                            </div>

                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item</TableHead>
                                  <TableHead>Size</TableHead>
                                  <TableHead className="text-center">Qty</TableHead>
                                  <TableHead className="text-center">Returned</TableHead>
                                  <TableHead>Return Date</TableHead>
                                  <TableHead>Return Notes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(issue.items || []).map((it: any) => (
                                  <TableRow key={it.id}>
                                    <TableCell>{it.itemName}</TableCell>
                                    <TableCell className="text-gray-500">{it.size ?? "—"}</TableCell>
                                    <TableCell className="text-center">{it.quantity}</TableCell>
                                    <TableCell className="text-center">
                                      {it.returnedQty === it.quantity
                                        ? <Badge className="bg-green-100 text-green-800 text-xs">All returned</Badge>
                                        : it.returnedQty > 0
                                        ? <Badge className="bg-amber-100 text-amber-800 text-xs">Partial ({it.returnedQty})</Badge>
                                        : <Badge variant="outline" className="text-xs">Outstanding</Badge>
                                      }
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">{fmt(it.returnedAt)}</TableCell>
                                    <TableCell className="text-sm text-gray-500">{it.returnNotes ?? "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>

                            {issue.employeeSignature && (
                              <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-1">Employee Signature:</p>
                                <img
                                  src={issue.employeeSignature}
                                  alt="Employee signature"
                                  className="h-16 border rounded bg-white p-1"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── CATALOGUE TAB (admin) ────────────────────────────────────────── */}
          {isAdmin && (
            <TabsContent value="catalogue" className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold text-gray-700">Manage Catalogue Items</h2>
                <Button
                  size="sm"
                  onClick={() => {
                    setCatForm({ name: "", category: "uniform", hasSizes: false, description: "" });
                    setCatDialog({ mode: "add" });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>

              {["uniform", "equipment"].map(cat => {
                const catItems = catalogue.filter((c: any) => c.category === cat);
                return (
                  <Card key={cat}>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        {cat === "uniform" ? "Uniform" : "Equipment"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Name</TableHead>
                            <TableHead>Sizes</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catItems.filter((c: any) => c.isActive).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-gray-400 py-6">No items</TableCell>
                            </TableRow>
                          )}
                          {catItems.filter((c: any) => c.isActive).map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>
                                {item.hasSizes
                                  ? <Badge variant="outline" className="text-xs">Sized</Badge>
                                  : <Badge variant="outline" className="text-xs text-gray-400">One Size</Badge>
                                }
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 justify-end flex-wrap">
                                  {item.hasSizes && (
                                    <Button
                                      size="sm" variant="outline"
                                      className="text-xs h-7 px-2 flex items-center gap-1"
                                      onClick={() => openStockDialog(item)}
                                    >
                                      <Archive className="h-3 w-3" />
                                      Sizes
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => openCatEdit(item)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm" variant="ghost"
                                    className="text-red-500 hover:text-red-700"
                                    onClick={() => setDeleteConfirmItem(item)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ── Return Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={!!returnDialog} onOpenChange={o => !o && setReturnDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
          </DialogHeader>
          {returnDialog && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-gray-500">Employee:</span> {returnDialog.item.employeeName}</p>
                <p><span className="text-gray-500">Item:</span> {returnDialog.item.itemName}{returnDialog.item.size ? ` — ${returnDialog.item.size}` : ""}</p>
                <p><span className="text-gray-500">Outstanding:</span> {returnDialog.item.quantity - returnDialog.item.returnedQty}</p>
              </div>

              <div className="space-y-1">
                <Label>Quantity Returning</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button" variant="outline" size="icon"
                    onClick={() => setReturnQty(q => Math.max(1, q - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-bold text-lg">{returnQty}</span>
                  <Button
                    type="button" variant="outline" size="icon"
                    onClick={() => setReturnQty(q => Math.min(returnDialog.item.quantity - returnDialog.item.returnedQty, q + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Return Notes</Label>
                <Textarea
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder="Condition, reason, etc."
                  rows={2}
                />
              </div>

              <SignaturePad
                label="Manager Signature (confirming return)"
                value={returnSig}
                onChange={setReturnSig}
              />

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setReturnDialog(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={returnMutation.isPending}
                  onClick={() =>
                    returnMutation.mutate({
                      issueId: returnDialog.issueId,
                      itemId: returnDialog.item.id,
                      data: { returnedQty: returnQty, managerSignature: returnSig || null, returnNotes: returnNotes || null },
                    })
                  }
                >
                  {returnMutation.isPending ? "Saving…" : "Confirm Return"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Bulk Return Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!bulkReturnDialog} onOpenChange={o => !o && setBulkReturnDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return All Items — {bulkReturnDialog?.empName}</DialogTitle>
          </DialogHeader>
          {bulkReturnDialog && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-700 mb-2">Items being returned:</p>
                <ul className="space-y-1">
                  {bulkReturnDialog.items.map((it: any) => (
                    <li key={it.id} className="flex justify-between text-gray-600">
                      <span>{it.itemName}{it.size ? ` (${it.size})` : ""}</span>
                      <span className="font-semibold">×{it.quantity - it.returnedQty}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <Label>Return Notes</Label>
                <Textarea
                  value={bulkReturnNotes}
                  onChange={e => setBulkReturnNotes(e.target.value)}
                  placeholder="Condition, reason, etc."
                  rows={2}
                />
              </div>

              <SignaturePad
                label="Manager Signature (confirming return)"
                value={bulkReturnSig}
                onChange={setBulkReturnSig}
              />

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setBulkReturnDialog(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={bulkReturnMutation.isPending}
                  onClick={() => bulkReturnMutation.mutate({ items: bulkReturnDialog.items, sig: bulkReturnSig, notes: bulkReturnNotes })}
                >
                  {bulkReturnMutation.isPending ? "Processing…" : `Confirm Return`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Catalogue Add/Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!catDialog} onOpenChange={o => !o && setCatDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{catDialog?.mode === "edit" ? "Edit Catalogue Item" : "Add Catalogue Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Item Name *</Label>
              <Input
                value={catForm.name}
                onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))}
                placeholder="E.g. High-viz Vest"
              />
            </div>
            <div className="space-y-1">
              <Label>Category *</Label>
              <Select value={catForm.category} onValueChange={v => setCatForm(p => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uniform">Uniform</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="hasSizes"
                checked={catForm.hasSizes}
                onChange={e => setCatForm(p => ({ ...p, hasSizes: e.target.checked }))}
                className="h-4 w-4 accent-amber-600"
              />
              <Label htmlFor="hasSizes" className="cursor-pointer">This item comes in different sizes</Label>
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Textarea
                value={catForm.description}
                onChange={e => setCatForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setCatDialog(null)}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={catMutation.isPending}
                onClick={() => catMutation.mutate(catForm)}
              >
                {catMutation.isPending ? "Saving…" : catDialog?.mode === "edit" ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Adjust Stock Dialog ───────────────────────────────────────────────── */}
      <Dialog open={adjustDialog} onOpenChange={o => !o && setAdjustDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Adjust Stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Item selector */}
            <div className="space-y-1">
              <Label>Select Item</Label>
              <Select value={adjustStockId} onValueChange={setAdjustStockId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose item…" />
                </SelectTrigger>
                <SelectContent>
                  {(["uniform", "equipment"] as const).map(cat => {
                    const catStock = (stock as any[]).filter(s => s.category === cat && s.isActive);
                    if (catStock.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          {cat === "uniform" ? "Uniform" : "Equipment"}
                        </div>
                        {catStock.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}{s.size ? ` — ${s.size}` : ""}
                          </SelectItem>
                        ))}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Current levels preview */}
            {adjustStockRow && (
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Total</p>
                  <p className="font-bold text-gray-800">{adjustStockRow.totalQuantity}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">In Stock</p>
                  <p className="font-bold text-green-700">{adjustStockRow.quantityInStock}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Issued</p>
                  <p className="font-bold text-amber-700">{adjustStockRow.totalQuantity - adjustStockRow.quantityInStock}</p>
                </div>
              </div>
            )}

            {/* Add / Remove toggle */}
            <div className="space-y-1">
              <Label>Adjustment Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType("add")}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-medium transition-colors
                    ${adjustType === "add"
                      ? "border-green-500 bg-green-50 text-green-800"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  <TrendingUp className="h-4 w-4" />
                  Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType("remove")}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-medium transition-colors
                    ${adjustType === "remove"
                      ? "border-red-500 bg-red-50 text-red-800"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  <TrendingDown className="h-4 w-4" />
                  Remove Stock
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {adjustType === "add"
                  ? "Use this when new stock arrives — increases both the total and in-stock count."
                  : "Use this to write off damaged or disposed items — decreases both the total and in-stock count."}
              </p>
            </div>

            {/* Quantity */}
            <div className="space-y-1">
              <Label>Quantity</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button" variant="outline" size="icon"
                  onClick={() => setAdjustQty(q => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={adjustQty}
                  onChange={e => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center text-lg font-bold"
                />
                <Button
                  type="button" variant="outline" size="icon"
                  onClick={() => setAdjustQty(q => q + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Confirm strip */}
            {adjustStockRow && (
              <div className={`rounded-lg px-4 py-3 text-sm text-center font-medium
                ${adjustType === "add" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                {adjustType === "add"
                  ? `After adjustment: Total ${adjustStockRow.totalQuantity + adjustQty} | In Stock ${adjustStockRow.quantityInStock + adjustQty}`
                  : `After adjustment: Total ${Math.max(0, adjustStockRow.totalQuantity - adjustQty)} | In Stock ${adjustStockRow.quantityInStock - adjustQty}`}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setAdjustDialog(false)}>
                Cancel
              </Button>
              <Button
                className={`flex-1 text-white ${adjustType === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                disabled={adjustMutation.isPending || !adjustStockId}
                onClick={handleAdjustSubmit}
              >
                {adjustMutation.isPending ? "Saving…" : adjustType === "add" ? "Add Stock" : "Remove Stock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Stock Level Dialog (size management only) ────────────────────────── */}
      <Dialog open={!!stockDialog} onOpenChange={o => !o && setStockDialog(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Sizes — {stockDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Add or remove the sizes available for this item. To adjust quantities, use <strong>Adjust Stock</strong> on the Stock tab.
            </p>

            {/* Add a size */}
            <div className="flex gap-2 items-center flex-wrap">
              <Select value={addSizeValue} onValueChange={v => { setAddSizeValue(v); if (v !== "__custom__") setCustomSizeInput(""); }}>
                <SelectTrigger className="flex-1 min-w-[160px]">
                  <SelectValue placeholder="Select a size to add…" />
                </SelectTrigger>
                <SelectContent>
                  {CLOTHING_SIZES.filter(sz => !stockRows.some(r => r.size === sz)).map(sz => (
                    <SelectItem key={sz} value={sz}>{sz}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">Custom…</SelectItem>
                </SelectContent>
              </Select>
              {addSizeValue === "__custom__" && (
                <Input
                  className="w-28 h-9"
                  placeholder="e.g. 34S"
                  value={customSizeInput}
                  onChange={e => setCustomSizeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addSizeRow(customSizeInput.trim()); }}
                />
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => addSizeRow(addSizeValue === "__custom__" ? customSizeInput.trim() : addSizeValue)}
                disabled={!addSizeValue || (addSizeValue === "__custom__" && !customSizeInput.trim()) || stockRows.some(r => r.size === (addSizeValue === "__custom__" ? customSizeInput.trim() : addSizeValue))}
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            {/* Size chips */}
            {stockRows.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stockRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1.5">
                    <span className="text-sm font-semibold text-gray-800">{row.size || "One Size"}</span>
                    <button
                      type="button"
                      onClick={() => removeSizeRow(i)}
                      className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${row.size}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                No sizes added yet. Use the dropdown above to add sizes.
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setStockDialog(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={stockMutation.isPending}
                onClick={handleSaveStock}
              >
                {stockMutation.isPending ? "Saving…" : "Save Sizes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete catalogue item confirmation */}
      <Dialog open={!!deleteConfirmItem} onOpenChange={open => { if (!open) setDeleteConfirmItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete item?</DialogTitle>
            <DialogDescription>
              This will permanently remove <strong>{deleteConfirmItem?.name}</strong> from the catalogue.
              This can only be done if there is no stock remaining and nothing is currently issued to staff.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmItem(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteCatMutation.isPending}
              onClick={() => deleteCatMutation.mutate(deleteConfirmItem.id)}
            >
              {deleteCatMutation.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
