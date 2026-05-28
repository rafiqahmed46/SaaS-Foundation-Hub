import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  getWorkOrder, updateWorkOrder, WorkOrder, WorkOrderPart,
  getCustomers, Customer, getTechnicians, Technician,
  getAssets, Asset,
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Save, CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  pending:      { label: "Pending",     icon: Clock,         color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  "in-progress":{ label: "In Progress", icon: AlertTriangle, color: "text-blue-600 bg-blue-50 border-blue-200" },
  completed:    { label: "Completed",   icon: CheckCircle2,  color: "text-green-600 bg-green-50 border-green-200" },
  cancelled:    { label: "Cancelled",   icon: XCircle,       color: "text-gray-500 bg-gray-50 border-gray-200" },
} as const;

const PRIORITY_COLORS = { low: "text-gray-500", medium: "text-amber-500", high: "text-red-500" };

function fmt(d: string) { return new Date(d).toLocaleDateString("en-GB"); }
function formatCurrency(n: number, cur = "AED") {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: cur }).format(n);
}

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techNotes, setTechNotes] = useState("");
  const [status, setStatus] = useState<WorkOrder["status"]>("pending");
  const [priority, setPriority] = useState<WorkOrder["priority"]>("medium");
  const [scheduledDate, setScheduledDate] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [assetId, setAssetId] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [assignedToName, setAssignedToName] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [laborRate, setLaborRate] = useState("");
  const [parts, setParts] = useState<WorkOrderPart[]>([]);
  const [notes, setNotes] = useState("");

  async function load() {
    if (!id || !user?.companyId) return;
    setLoading(true);
    try {
      const [w, cust, tech, ast] = await Promise.all([
        getWorkOrder(id),
        getCustomers(user.companyId),
        getTechnicians(user.companyId),
        getAssets(user.companyId),
      ]);
      if (!w) { navigate("/work-orders"); return; }
      setWo(w);
      setTitle(w.title); setDescription(w.description || ""); setTechNotes(w.technicianNotes || "");
      setStatus(w.status); setPriority(w.priority); setScheduledDate(w.scheduledDate || "");
      setCompletedDate(w.completedDate || ""); setCustomerId(w.customerId || "");
      setCustomerName(w.customerName || ""); setAssetId(w.assetId || ""); setAssetName(w.assetName || "");
      setAssignedTo(w.assignedTo || ""); setAssignedToName(w.assignedToName || "");
      setLaborHours(w.laborHours != null ? String(w.laborHours) : "");
      setLaborRate(w.laborRate != null ? String(w.laborRate) : "");
      setParts(w.parts || []); setNotes(w.notes || "");
      setCustomers(cust); setTechnicians(tech); setAssets(ast);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id, user?.companyId]);

  const customerAssets = assets.filter((a) => a.customerId === customerId);

  function addPart() { setParts((p) => [...p, { name: "", quantity: 1, unitPrice: 0 }]); }
  function removePart(i: number) { setParts((p) => p.filter((_, j) => j !== i)); }
  function updatePart(i: number, field: keyof WorkOrderPart, value: string | number) {
    setParts((p) => p.map((part, j) => j === i ? { ...part, [field]: value } : part));
  }

  const partsTotal = parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  const laborTotal = (parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0);
  const grandTotal = partsTotal + laborTotal;

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      const update: Partial<WorkOrder> = {
        title: title.trim() || wo?.title,
        description: description || undefined,
        technicianNotes: techNotes || undefined,
        status, priority,
        scheduledDate: scheduledDate || undefined,
        completedDate: status === "completed" ? (completedDate || new Date().toISOString().slice(0, 10)) : undefined,
        customerId: customerId || undefined,
        customerName: customerName || undefined,
        assetId: assetId || undefined,
        assetName: assetName || undefined,
        assignedTo: assignedTo || undefined,
        assignedToName: assignedToName || undefined,
        laborHours: parseFloat(laborHours) || undefined,
        laborRate: parseFloat(laborRate) || undefined,
        parts,
        totalPartsAmount: partsTotal || undefined,
        totalAmount: grandTotal || undefined,
        notes: notes || undefined,
      };
      await updateWorkOrder(id, update);
      toast({ title: "Work order saved" });
      load();
    } catch { toast({ title: "Error", description: "Could not save.", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <Layout><div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <Skeleton className="h-7 w-40" /><Skeleton className="h-48 w-full rounded-xl" />
    </div></Layout>
  );

  if (!wo) return null;

  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = statusCfg.icon;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/work-orders")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Work Orders
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-sm font-mono text-muted-foreground">{wo.workOrderNumber}</p>
            <h1 className="text-2xl font-bold mt-0.5">{wo.title}</h1>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>

        <div className="space-y-5">
          {/* Status + Priority + Dates */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Job Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as WorkOrder["status"])}>
                    <SelectTrigger className={cn("gap-2", statusCfg.color)}>
                      <StatusIcon className="w-4 h-4 shrink-0" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(STATUS_CONFIG) as [WorkOrder["status"], typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as WorkOrder["priority"])}>
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
                  <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Completed Date</Label>
                  <Input type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe the scope of work…" />
              </div>
            </CardContent>
          </Card>

          {/* Customer + Asset + Technician */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Assignment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Customer</Label>
                  <Select value={customerId || "__none__"} onValueChange={(v) => {
                    if (v === "__none__") { setCustomerId(""); setCustomerName(""); setAssetId(""); setAssetName(""); return; }
                    const c = customers.find((x) => x.id === v);
                    setCustomerId(v); setCustomerName(c?.name || ""); setAssetId(""); setAssetName("");
                  }}>
                    <SelectTrigger><SelectValue placeholder="No customer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No customer</SelectItem>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Asset / Equipment</Label>
                  <Select value={assetId || "__none__"} onValueChange={(v) => {
                    if (v === "__none__") { setAssetId(""); setAssetName(""); return; }
                    const a = assets.find((x) => x.id === v);
                    setAssetId(v); setAssetName(a?.name || "");
                  }}>
                    <SelectTrigger><SelectValue placeholder="No asset" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No asset</SelectItem>
                      {(customerId ? customerAssets : assets).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.brand ? ` — ${a.brand}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Assigned Technician</Label>
                  <Select value={assignedTo || "__none__"} onValueChange={(v) => {
                    if (v === "__none__") { setAssignedTo(""); setAssignedToName(""); return; }
                    const t = technicians.find((x) => x.id === v);
                    setAssignedTo(v); setAssignedToName(t?.name || "");
                  }}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {technicians.filter((t) => t.status === "active").map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.specialization ? ` — ${t.specialization}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parts & Labor */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Parts & Materials</CardTitle>
              <Button variant="outline" size="sm" onClick={addPart} className="gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Part
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {parts.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No parts added yet</p>}
              {parts.map((part, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Input placeholder="Part name" value={part.name} onChange={(e) => updatePart(i, "name", e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="Qty" value={part.quantity} onChange={(e) => updatePart(i, "quantity", parseFloat(e.target.value) || 0)} className="h-9 text-sm" min="0" />
                  </div>
                  <div className="col-span-4">
                    <Input type="number" placeholder="Unit price" value={part.unitPrice} onChange={(e) => updatePart(i, "unitPrice", parseFloat(e.target.value) || 0)} className="h-9 text-sm" min="0" step="0.01" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button onClick={() => removePart(i)} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Labor */}
              <div className="border-t pt-3 mt-2">
                <p className="text-sm font-medium mb-2">Labor</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Hours</Label>
                    <Input type="number" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} placeholder="0" min="0" step="0.5" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rate per hour (AED)</Label>
                    <Input type="number" value={laborRate} onChange={(e) => setLaborRate(e.target.value)} placeholder="0.00" min="0" step="0.01" className="h-9" />
                  </div>
                </div>
              </div>

              {/* Totals */}
              {(partsTotal > 0 || laborTotal > 0) && (
                <div className="border-t pt-3 mt-2 space-y-1.5 text-sm">
                  {partsTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>Parts</span><span>{formatCurrency(partsTotal)}</span></div>}
                  {laborTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>Labor ({laborHours}h × AED{laborRate})</span><span>{formatCurrency(laborTotal)}</span></div>}
                  <div className="flex justify-between font-bold border-t pt-2"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Technician Notes */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Technician Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={techNotes} onChange={(e) => setTechNotes(e.target.value)} rows={4} placeholder="Work performed, observations, issues found…" />
            </CardContent>
          </Card>

          {/* Internal Notes */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Internal notes, follow-ups…" />
            </CardContent>
          </Card>

          {/* Customer Sign-off */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Customer Sign-off</CardTitle></CardHeader>
            <CardContent>
              {wo.customerSignature ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Customer confirmed completion</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <p className="text-sm text-muted-foreground flex-1">Customer has not yet confirmed this job is complete.</p>
                  <Button variant="outline" size="sm" onClick={async () => {
                    await updateWorkOrder(id!, { customerSignature: "confirmed", status: "completed", completedDate: new Date().toISOString().slice(0, 10) });
                    toast({ title: "Job marked as complete by customer" });
                    load();
                  }}>
                    Mark as Customer Confirmed
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
