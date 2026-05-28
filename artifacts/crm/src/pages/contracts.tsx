import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getContracts, addContract, deleteContract, Contract, getCustomers, Customer, getNextContractNumber, getSettings } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Plus, Search, Trash2, FileCheck, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ContractStatus = Contract["status"];
type ContractType = Contract["type"];

const STATUS_STYLES: Record<ContractStatus, string> = {
  active:    "bg-green-100 text-green-700",
  expired:   "bg-red-100 text-red-700",
  pending:   "bg-yellow-100 text-yellow-700",
  cancelled: "bg-gray-100 text-gray-500",
};
const TYPE_LABEL: Record<ContractType, string> = {
  amc: "AMC", warranty: "Warranty", rental: "Rental", service: "Service",
};

type FormData = {
  customerId: string; customerName: string; title: string; description: string;
  type: ContractType; startDate: string; endDate: string; value: string;
  visitsIncluded: string; autoRenew: boolean; notes: string;
};
const empty: FormData = {
  customerId: "", customerName: "", title: "", description: "",
  type: "amc", startDate: "", endDate: "", value: "", visitsIncluded: "0", autoRenew: false, notes: "",
};

function formatCurrency(amount: number, currency = "AED") {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency }).format(amount);
}
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

export default function ContractsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currency, setCurrency] = useState("AED");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | ContractStatus>("all");
  const [filterType, setFilterType] = useState<"all" | ContractType>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      const [c, cust, sett] = await Promise.all([getContracts(user.companyId), getCustomers(user.companyId), getSettings(user.companyId)]);
      setContracts(c); setCustomers(cust);
      if (sett?.currency) setCurrency(sett.currency);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [user?.companyId]);

  async function handleSave() {
    if (!user?.companyId || !form.customerId || !form.title.trim() || !form.startDate || !form.endDate) {
      toast({ title: "Customer, title, start and end dates are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const num = await getNextContractNumber(user.companyId);
      await addContract({
        companyId: user.companyId,
        contractNumber: num,
        customerId: form.customerId,
        customerName: form.customerName,
        title: form.title.trim(),
        description: form.description || undefined,
        type: form.type,
        status: new Date(form.startDate) > new Date() ? "pending" : "active",
        startDate: form.startDate,
        endDate: form.endDate,
        value: parseFloat(form.value) || 0,
        currency,
        visitsIncluded: parseInt(form.visitsIncluded) || 0,
        visitsUsed: 0,
        visits: [],
        autoRenew: form.autoRenew,
        notes: form.notes || undefined,
      });
      toast({ title: "Contract created" });
      setDialogOpen(false); setForm(empty); load();
    } catch { toast({ title: "Error", description: "Could not create contract.", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await deleteContract(deleteId); toast({ title: "Contract deleted" }); setDeleteId(null); load(); }
    catch { toast({ title: "Error", description: "Could not delete.", variant: "destructive" }); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const expiringCount = contracts.filter((c) => c.status === "active" && daysUntil(c.endDate) <= 30).length;

  const counts = { all: contracts.length, active: 0, expired: 0, pending: 0, cancelled: 0 };
  contracts.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });

  const filtered = contracts
    .filter((c) => filterStatus === "all" || c.status === filterStatus)
    .filter((c) => filterType === "all" || c.type === filterType)
    .filter((c) => !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.contractNumber.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{counts.all} total · {counts.active} active · {counts.expired} expired</p>
          </div>
          <Button onClick={() => { setForm(empty); setDialogOpen(true); }} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> New Contract
          </Button>
        </div>

        {expiringCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2 rounded-lg mb-5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {expiringCount} contract{expiringCount > 1 ? "s" : ""} expiring within 30 days — consider renewal
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-5">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search contracts…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active ({counts.active})</SelectItem>
              <SelectItem value="pending">Pending ({counts.pending})</SelectItem>
              <SelectItem value="expired">Expired ({counts.expired})</SelectItem>
              <SelectItem value="cancelled">Cancelled ({counts.cancelled})</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="amc">AMC</SelectItem>
              <SelectItem value="warranty">Warranty</SelectItem>
              <SelectItem value="rental">Rental</SelectItem>
              <SelectItem value="service">Service</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <FileCheck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold">No contracts found</h3>
            <p className="text-sm text-muted-foreground mt-1">Create AMC and service contracts to track recurring revenue.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const days = daysUntil(c.endDate);
              const isExpiringSoon = c.status === "active" && days <= 30;
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/contracts/${c.id}`)}
                  className="rounded-xl border bg-card p-4 flex items-start gap-4 cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">{c.contractNumber}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[c.status])}>{c.status}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{TYPE_LABEL[c.type]}</span>
                      {c.autoRenew && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Auto-renew</span>}
                    </div>
                    <p className="font-semibold truncate group-hover:text-primary transition-colors">{c.title}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      <span>{c.customerName}</span>
                      <span>{new Date(c.startDate).toLocaleDateString("en-GB")} → {new Date(c.endDate).toLocaleDateString("en-GB")}</span>
                      <span className="font-medium text-foreground">{formatCurrency(c.value, c.currency)}</span>
                      {c.visitsIncluded > 0 && <span>{c.visitsUsed}/{c.visitsIncluded} visits used</span>}
                    </div>
                    {isExpiringSoon && <p className="text-xs text-amber-600 font-medium mt-1">⚠️ Expires in {days} day{days !== 1 ? "s" : ""}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Contract</DialogTitle>
            <DialogDescription>Create an AMC, warranty, or service contract.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={form.customerId} onValueChange={(v) => {
                const c = customers.find((x) => x.id === v);
                setForm((f) => ({ ...f, customerId: v, customerName: c?.name || "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contract Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Annual AC Maintenance Contract…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as ContractType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amc">AMC</SelectItem>
                    <SelectItem value="warranty">Warranty</SelectItem>
                    <SelectItem value="rental">Rental</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contract Value ({currency})</Label>
                <Input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date *</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Visits Included</Label>
                <Input type="number" value={form.visitsIncluded} onChange={(e) => setForm((f) => ({ ...f, visitsIncluded: e.target.value }))} min="0" />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input type="checkbox" checked={form.autoRenew} onChange={(e) => setForm((f) => ({ ...f, autoRenew: e.target.checked }))} className="rounded" />
                  <span className="text-sm font-medium">Auto-renew</span>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Creating…" : "Create Contract"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Contract</AlertDialogTitle><AlertDialogDescription>This will permanently delete this contract.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
