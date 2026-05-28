import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  getWorkOrders, addWorkOrder, deleteWorkOrder, WorkOrder,
  getCustomers, Customer, getTechnicians, Technician,
  getNextWorkOrderNumber, getAssets, Asset,
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Plus, Search, Trash2, ClipboardCheck, ChevronRight, ArrowUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = WorkOrder["status"];
type Priority = WorkOrder["priority"];

const STATUS_STYLES: Record<Status, string> = {
  pending:     "bg-yellow-100 text-yellow-700",
  "in-progress":"bg-blue-100 text-blue-700",
  completed:   "bg-green-100 text-green-700",
  cancelled:   "bg-gray-100 text-gray-500",
};
const PRIORITY_DOT: Record<Priority, string> = {
  low: "bg-gray-400", medium: "bg-amber-400", high: "bg-red-500",
};

type FormData = {
  title: string; description: string; customerId: string; customerName: string;
  assetId: string; assetName: string; assignedTo: string; assignedToName: string;
  status: Status; priority: Priority; scheduledDate: string; notes: string;
};
const empty: FormData = {
  title: "", description: "", customerId: "", customerName: "", assetId: "", assetName: "",
  assignedTo: "", assignedToName: "", status: "pending", priority: "medium", scheduledDate: "", notes: "",
};

function fmt(d: string) { return new Date(d).toLocaleDateString("en-GB"); }

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
  const [sortKey, setSortKey] = useState<"newest" | "scheduled" | "priority">("newest");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const customerAssets = useMemo(() =>
    assets.filter((a) => a.customerId === form.customerId),
    [assets, form.customerId]
  );

  async function load() {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      const [wo, cust, tech, ast] = await Promise.all([
        getWorkOrders(user.companyId),
        getCustomers(user.companyId),
        getTechnicians(user.companyId),
        getAssets(user.companyId),
      ]);
      setWorkOrders(wo); setCustomers(cust); setTechnicians(tech); setAssets(ast);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      toast({
        title: code === "permission-denied" ? "Firestore: Permission denied" : "Failed to load work orders",
        description: code === "permission-denied"
          ? "Your Firestore security rules are blocking reads. See the banner at the top."
          : "Check your connection and try again.",
        variant: "destructive",
      });
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [user?.companyId]);

  async function handleSave() {
    if (!user?.companyId || !form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const num = await getNextWorkOrderNumber(user.companyId);
      await addWorkOrder({
        companyId: user.companyId,
        workOrderNumber: num,
        title: form.title.trim(),
        description: form.description || undefined,
        customerId: form.customerId || undefined,
        customerName: form.customerName || undefined,
        assetId: form.assetId || undefined,
        assetName: form.assetName || undefined,
        assignedTo: form.assignedTo || undefined,
        assignedToName: form.assignedToName || undefined,
        status: form.status,
        priority: form.priority,
        scheduledDate: form.scheduledDate || undefined,
        notes: form.notes || undefined,
        parts: [],
      });
      toast({ title: "Work order created" });
      setDialogOpen(false); setForm(empty); load();
    } catch { toast({ title: "Error", description: "Could not create work order.", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await deleteWorkOrder(deleteId); toast({ title: "Work order deleted" }); setDeleteId(null); load(); }
    catch { toast({ title: "Error", description: "Could not delete.", variant: "destructive" }); }
  }

  const counts = {
    all: workOrders.length,
    pending: workOrders.filter((w) => w.status === "pending").length,
    "in-progress": workOrders.filter((w) => w.status === "in-progress").length,
    completed: workOrders.filter((w) => w.status === "completed").length,
    cancelled: workOrders.filter((w) => w.status === "cancelled").length,
  };

  const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  const filtered = workOrders
    .filter((w) => filterStatus === "all" || w.status === filterStatus)
    .filter((w) => !search || w.title.toLowerCase().includes(search.toLowerCase()) || (w.customerName || "").toLowerCase().includes(search.toLowerCase()) || w.workOrderNumber.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === "scheduled") return (a.scheduledDate || "9999").localeCompare(b.scheduledDate || "9999");
      if (sortKey === "priority") return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      return b.createdAt.localeCompare(a.createdAt);
    });

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Work Orders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{counts.all} total · {counts.pending} pending · {counts["in-progress"]} in progress · {counts.completed} completed</p>
          </div>
          <Button onClick={() => { setForm(empty); setDialogOpen(true); }} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> New Work Order
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search work orders…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | Status)}>
            <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({counts.all})</SelectItem>
              <SelectItem value="pending">Pending ({counts.pending})</SelectItem>
              <SelectItem value="in-progress">In Progress ({counts["in-progress"]})</SelectItem>
              <SelectItem value="completed">Completed ({counts.completed})</SelectItem>
              <SelectItem value="cancelled">Cancelled ({counts.cancelled})</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
            <SelectTrigger className="w-36 shrink-0 gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="scheduled">By Schedule</SelectItem>
              <SelectItem value="priority">By Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <ClipboardCheck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold">No work orders{filterStatus !== "all" ? ` with status "${filterStatus}"` : ""}</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first work order to track field service jobs.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((wo) => (
              <div
                key={wo.id}
                onClick={() => navigate(`/work-orders/${wo.id}`)}
                className="rounded-xl border bg-card p-4 flex items-start gap-4 cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all group"
              >
                <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", PRIORITY_DOT[wo.priority])} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{wo.workOrderNumber}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_STYLES[wo.status])}>{wo.status.replace("-", " ")}</span>
                  </div>
                  <p className="font-semibold truncate group-hover:text-primary transition-colors">{wo.title}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {wo.customerName && <span>{wo.customerName}</span>}
                    {wo.assignedToName && <span>→ {wo.assignedToName}</span>}
                    {wo.scheduledDate && <span>📅 {fmt(wo.scheduledDate)}</span>}
                    {wo.assetName && <span>📦 {wo.assetName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setDeleteId(wo.id); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Work Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Work Order</DialogTitle>
            <DialogDescription>Create a new field service work order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="AC service, CCTV installation…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Scheduled Date</Label>
                <Input type="date" value={form.scheduledDate} onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={form.customerId} onValueChange={(v) => {
                const c = customers.find((x) => x.id === v);
                setForm((f) => ({ ...f, customerId: v, customerName: c?.name || "", assetId: "", assetName: "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select customer (optional)" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.customerId && customerAssets.length > 0 && (
              <div className="space-y-1.5">
                <Label>Asset / Equipment</Label>
                <Select value={form.assetId} onValueChange={(v) => {
                  const a = assets.find((x) => x.id === v);
                  setForm((f) => ({ ...f, assetId: v, assetName: a?.name || "" }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select asset (optional)" /></SelectTrigger>
                  <SelectContent>
                    {customerAssets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.brand ? ` — ${a.brand}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select value={form.assignedTo} onValueChange={(v) => {
                const t = technicians.find((x) => x.id === v);
                setForm((f) => ({ ...f, assignedTo: v, assignedToName: t?.name || "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select technician (optional)" /></SelectTrigger>
                <SelectContent>
                  {technicians.filter((t) => t.status === "active").map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.specialization ? ` — ${t.specialization}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the work to be done…" rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Creating…" : "Create Work Order"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Order</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this work order. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
