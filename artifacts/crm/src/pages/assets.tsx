import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getAssets, addAsset, deleteAsset, Asset, getCustomers, Customer } from "@/lib/firestore";
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
import { Plus, Search, Trash2, Box, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const ASSET_TYPES = ["AC Unit", "CCTV Camera", "Elevator", "Generator", "Water Heater", "Electrical Panel", "Fire System", "Networking Equipment", "Pump", "Other"];

type FormData = {
  customerId: string; customerName: string; name: string; type: string;
  brand: string; model: string; serialNumber: string; installDate: string;
  warrantyExpiry: string; location: string; nextServiceDate: string; notes: string;
};
const empty: FormData = {
  customerId: "", customerName: "", name: "", type: "", brand: "", model: "",
  serialNumber: "", installDate: "", warrantyExpiry: "", location: "", nextServiceDate: "", notes: "",
};

function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export default function AssetsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      const [a, c] = await Promise.all([getAssets(user.companyId), getCustomers(user.companyId)]);
      setAssets(a); setCustomers(c);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [user?.companyId]);

  async function handleSave() {
    if (!user?.companyId || !form.name.trim() || !form.customerId) {
      toast({ title: "Name and customer are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await addAsset({
        companyId: user.companyId,
        customerId: form.customerId,
        customerName: form.customerName,
        name: form.name.trim(),
        type: form.type || undefined,
        brand: form.brand || undefined,
        model: form.model || undefined,
        serialNumber: form.serialNumber || undefined,
        installDate: form.installDate || undefined,
        warrantyExpiry: form.warrantyExpiry || undefined,
        location: form.location || undefined,
        nextServiceDate: form.nextServiceDate || undefined,
        notes: form.notes || undefined,
        status: "active",
      });
      toast({ title: "Asset added" });
      setDialogOpen(false); setForm(empty); load();
    } catch { toast({ title: "Error", description: "Could not add asset.", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await deleteAsset(deleteId); toast({ title: "Asset deleted" }); setDeleteId(null); load(); }
    catch { toast({ title: "Error", description: "Could not delete asset.", variant: "destructive" }); }
  }

  const uniqueTypes = Array.from(new Set(assets.map((a) => a.type).filter(Boolean) as string[])).sort();

  const filtered = assets
    .filter((a) => filterStatus === "all" || a.status === filterStatus)
    .filter((a) => filterType === "all" || a.type === filterType)
    .filter((a) => !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.serialNumber || "").toLowerCase().includes(search.toLowerCase())
    );

  const today = new Date().toISOString().slice(0, 10);
  const expiringSoon = assets.filter((a) => a.warrantyExpiry && a.warrantyExpiry >= today && daysUntil(a.warrantyExpiry) <= 30).length;
  const overdue = assets.filter((a) => a.nextServiceDate && a.nextServiceDate < today).length;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{assets.length} total equipment pieces tracked</p>
          </div>
          <Button onClick={() => { setForm(empty); setDialogOpen(true); }} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Add Asset
          </Button>
        </div>

        {/* Alert banners */}
        {(expiringSoon > 0 || overdue > 0) && (
          <div className="flex flex-wrap gap-3 mb-5">
            {overdue > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {overdue} asset{overdue > 1 ? "s" : ""} overdue for service
              </div>
            )}
            {expiringSoon > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {expiringSoon} warranty{expiringSoon > 1 ? "s" : ""} expiring within 30 days
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search assets, customers, serial…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 shrink-0"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <Box className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold">No assets found</h3>
            <p className="text-sm text-muted-foreground mt-1">Track customer equipment to manage service history and warranties.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a) => {
              const isOverdue = a.nextServiceDate && a.nextServiceDate < today;
              const warrantyDays = a.warrantyExpiry ? daysUntil(a.warrantyExpiry) : null;
              return (
                <div
                  key={a.id}
                  onClick={() => navigate(`/assets/${a.id}`)}
                  className="rounded-xl border bg-card p-4 cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all group flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate group-hover:text-primary transition-colors">{a.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{a.customerName}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", a.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>{a.status}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {a.type && <p>📦 {a.type}{a.brand ? ` · ${a.brand}` : ""}{a.model ? ` ${a.model}` : ""}</p>}
                    {a.serialNumber && <p>S/N: {a.serialNumber}</p>}
                    {a.location && <p>📍 {a.location}</p>}
                  </div>
                  <div className="text-xs space-y-1">
                    {isOverdue && <p className="text-red-600 font-medium">⚠️ Service overdue since {new Date(a.nextServiceDate!).toLocaleDateString("en-GB")}</p>}
                    {!isOverdue && a.nextServiceDate && <p className="text-muted-foreground">Next service: {new Date(a.nextServiceDate).toLocaleDateString("en-GB")}</p>}
                    {warrantyDays !== null && warrantyDays >= 0 && warrantyDays <= 90 && (
                      <p className={cn("font-medium", warrantyDays <= 30 ? "text-amber-600" : "text-muted-foreground")}>
                        Warranty: {warrantyDays === 0 ? "expires today" : `${warrantyDays}d left`}
                      </p>
                    )}
                    {warrantyDays !== null && warrantyDays < 0 && <p className="text-red-500 font-medium">Warranty expired</p>}
                  </div>
                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(a.id); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
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
            <DialogTitle>Add Asset</DialogTitle>
            <DialogDescription>Track a piece of equipment or machinery for a customer.</DialogDescription>
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
              <Label>Asset Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Main AC Unit, Elevator No. 2…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Floor 3, Roof…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Daikin, Hikvision…" />
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Serial Number</Label>
              <Input value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Install Date</Label>
                <Input type="date" value={form.installDate} onChange={(e) => setForm((f) => ({ ...f, installDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Warranty Expiry</Label>
                <Input type="date" value={form.warrantyExpiry} onChange={(e) => setForm((f) => ({ ...f, warrantyExpiry: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Next Service Date</Label>
              <Input type="date" value={form.nextServiceDate} onChange={(e) => setForm((f) => ({ ...f, nextServiceDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Add Asset"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Asset</AlertDialogTitle><AlertDialogDescription>This will permanently delete this asset.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
