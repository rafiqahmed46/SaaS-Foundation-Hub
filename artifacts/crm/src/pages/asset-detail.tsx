import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getAsset, updateAsset, Asset, getWorkOrders, WorkOrder, getCustomers, Customer } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, ClipboardCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ASSET_TYPES = ["AC Unit","CCTV Camera","Elevator","Generator","Water Heater","Electrical Panel","Fire System","Networking Equipment","Pump","Other"];

function fmt(d: string) { return new Date(d).toLocaleDateString("en-GB"); }
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [location, setLocation] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");

  async function load() {
    if (!id || !user?.companyId) return;
    setLoading(true);
    try {
      const [a, wo, cust] = await Promise.all([
        getAsset(id),
        getWorkOrders(user.companyId),
        getCustomers(user.companyId),
      ]);
      if (!a) { navigate("/assets"); return; }
      setAsset(a);
      setName(a.name); setType(a.type || ""); setBrand(a.brand || ""); setModel(a.model || "");
      setSerialNumber(a.serialNumber || ""); setInstallDate(a.installDate || "");
      setWarrantyExpiry(a.warrantyExpiry || ""); setLocation(a.location || "");
      setNextServiceDate(a.nextServiceDate || ""); setNotes(a.notes || "");
      setStatus(a.status); setCustomerId(a.customerId); setCustomerName(a.customerName);
      setWorkOrders(wo.filter((w) => w.assetId === id || w.customerId === a.customerId));
      setCustomers(cust);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id, user?.companyId]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      const c = customers.find((x) => x.id === customerId);
      await updateAsset(id, {
        name: name.trim() || asset?.name,
        type: type || undefined, brand: brand || undefined, model: model || undefined,
        serialNumber: serialNumber || undefined, installDate: installDate || undefined,
        warrantyExpiry: warrantyExpiry || undefined, location: location || undefined,
        nextServiceDate: nextServiceDate || undefined, notes: notes || undefined,
        status, customerId, customerName: c?.name || customerName,
        lastServiceDate: workOrders.filter((w) => w.status === "completed" && w.assetId === id)
          .sort((a, b) => (b.completedDate || "").localeCompare(a.completedDate || ""))[0]?.completedDate || undefined,
      });
      toast({ title: "Asset saved" });
      load();
    } catch { toast({ title: "Error", description: "Could not save.", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <Layout><div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <Skeleton className="h-7 w-40" /><Skeleton className="h-48 w-full rounded-xl" />
    </div></Layout>
  );

  if (!asset) return null;

  const today = new Date().toISOString().slice(0, 10);
  const warrantyDays = warrantyExpiry ? daysUntil(warrantyExpiry) : null;
  const serviceOverdue = nextServiceDate && nextServiceDate < today;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/assets")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Assets
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{asset.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{asset.customerName}</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>

        {/* Alert banners */}
        <div className="space-y-2 mb-5">
          {serviceOverdue && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Service overdue since {fmt(nextServiceDate!)} — schedule a work order
            </div>
          )}
          {warrantyDays !== null && warrantyDays <= 30 && warrantyDays >= 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Warranty expires in {warrantyDays} day{warrantyDays !== 1 ? "s" : ""} ({fmt(warrantyExpiry!)})
            </div>
          )}
          {warrantyDays !== null && warrantyDays < 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Warranty expired {Math.abs(warrantyDays)} days ago
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Asset Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type || "__none__"} onValueChange={(v) => setType(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Floor 3, Roof…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Brand</Label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Model</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Serial Number</Label>
                  <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Customer</Label>
                  <Select value={customerId} onValueChange={(v) => setCustomerId(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Dates & Service Schedule</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Install Date</Label>
                <Input type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Warranty Expiry</Label>
                <Input type="date" value={warrantyExpiry} onChange={(e) => setWarrantyExpiry(e.target.value)} className={cn(warrantyDays !== null && warrantyDays <= 30 ? "border-amber-400" : "")} />
              </div>
              <div className="space-y-1.5">
                <Label>Next Service Date</Label>
                <Input type="date" value={nextServiceDate} onChange={(e) => setNextServiceDate(e.target.value)} className={cn(serviceOverdue ? "border-red-400" : "")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Maintenance notes, special instructions…" />
            </CardContent>
          </Card>

          {/* Work Order History */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" /> Service History</CardTitle></CardHeader>
            <CardContent>
              {workOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No work orders yet for this asset.</p>
              ) : (
                <div className="space-y-2">
                  {workOrders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((wo) => (
                    <button
                      key={wo.id}
                      onClick={() => navigate(`/work-orders/${wo.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      {wo.status === "completed"
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        : <ClipboardCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{wo.title}</p>
                        <p className="text-xs text-muted-foreground">{wo.workOrderNumber} · {fmt(wo.createdAt)}</p>
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0",
                        wo.status === "completed" ? "bg-green-100 text-green-700" :
                        wo.status === "in-progress" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      )}>{wo.status.replace("-", " ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
