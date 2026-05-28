import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getContract, updateContract, Contract, ContractVisit, getCustomers, Customer, getTechnicians, Technician } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<Contract["status"], string> = {
  active:    "bg-green-100 text-green-700 border-green-200",
  expired:   "bg-red-100 text-red-700 border-red-200",
  pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};
const TYPE_LABEL: Record<Contract["type"], string> = { amc: "AMC", warranty: "Warranty", rental: "Rental", service: "Service" };

function fmt(d: string) { return new Date(d).toLocaleDateString("en-GB"); }
function formatCurrency(n: number, cur = "AED") {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: cur }).format(n);
}
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [contract, setContract] = useState<Contract | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Contract["status"]>("active");
  const [type, setType] = useState<Contract["type"]>("amc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [value, setValue] = useState("");
  const [visitsIncluded, setVisitsIncluded] = useState("0");
  const [autoRenew, setAutoRenew] = useState(false);
  const [notes, setNotes] = useState("");

  // New visit form
  const [visitDate, setVisitDate] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [visitTech, setVisitTech] = useState("");
  const [addingVisit, setAddingVisit] = useState(false);

  async function load() {
    if (!id || !user?.companyId) return;
    setLoading(true);
    try {
      const [c, cust, tech] = await Promise.all([
        getContract(id),
        getCustomers(user.companyId),
        getTechnicians(user.companyId),
      ]);
      if (!c) { navigate("/contracts"); return; }
      setContract(c);
      setTitle(c.title); setDescription(c.description || ""); setStatus(c.status); setType(c.type);
      setStartDate(c.startDate); setEndDate(c.endDate); setValue(String(c.value));
      setVisitsIncluded(String(c.visitsIncluded)); setAutoRenew(c.autoRenew || false); setNotes(c.notes || "");
      setCustomers(cust); setTechnicians(tech);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id, user?.companyId]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      await updateContract(id, {
        title: title.trim() || contract?.title,
        description: description || undefined,
        status, type,
        startDate, endDate,
        value: parseFloat(value) || 0,
        visitsIncluded: parseInt(visitsIncluded) || 0,
        autoRenew, notes: notes || undefined,
      });
      toast({ title: "Contract saved" }); load();
    } catch { toast({ title: "Error", description: "Could not save.", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleLogVisit() {
    if (!id || !visitDate || !contract) return;
    setAddingVisit(true);
    try {
      const newVisit: ContractVisit = {
        id: `v_${Date.now()}`,
        date: visitDate,
        notes: visitNotes || undefined,
        technicianName: visitTech ? technicians.find((t) => t.id === visitTech)?.name : undefined,
      };
      const updatedVisits = [...(contract.visits || []), newVisit];
      await updateContract(id, {
        visits: updatedVisits,
        visitsUsed: updatedVisits.length,
      });
      toast({ title: "Visit logged" });
      setVisitDate(""); setVisitNotes(""); setVisitTech(""); load();
    } catch { toast({ title: "Error", description: "Could not log visit.", variant: "destructive" }); }
    finally { setAddingVisit(false); }
  }

  if (loading) return (
    <Layout><div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <Skeleton className="h-7 w-40" /><Skeleton className="h-48 w-full rounded-xl" />
    </div></Layout>
  );

  if (!contract) return null;

  const days = daysUntil(contract.endDate);
  const isExpiringSoon = contract.status === "active" && days <= 30 && days >= 0;
  const isExpired = days < 0;
  const visitsLeft = contract.visitsIncluded - contract.visitsUsed;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/contracts")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Contracts
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-muted-foreground">{contract.contractNumber}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", STATUS_STYLES[status])}>{status}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{TYPE_LABEL[type]}</span>
            </div>
            <h1 className="text-2xl font-bold">{contract.title}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{contract.customerName}</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>

        {/* Alerts */}
        <div className="space-y-2 mb-5">
          {isExpiringSoon && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Contract expires in {days} day{days !== 1 ? "s" : ""} — consider renewal
            </div>
          )}
          {isExpired && contract.status === "active" && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Contract has expired — update status or renew
            </div>
          )}
          {contract.visitsIncluded > 0 && visitsLeft === 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              All {contract.visitsIncluded} included visits have been used
            </div>
          )}
        </div>

        {/* Visit progress */}
        {contract.visitsIncluded > 0 && (
          <div className="flex gap-4 mb-5">
            {[
              { label: "Visits Included", value: contract.visitsIncluded, color: "text-foreground" },
              { label: "Visits Used", value: contract.visitsUsed, color: "text-primary" },
              { label: "Visits Left", value: Math.max(0, visitsLeft), color: visitsLeft <= 0 ? "text-red-600" : "text-green-600" },
            ].map((s) => (
              <div key={s.label} className="flex-1 bg-muted/40 rounded-xl p-4 text-center">
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Contract Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as Contract["status"])}>
                    <SelectTrigger className={cn("border", STATUS_STYLES[status])}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as Contract["type"])}>
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
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Value ({contract.currency || "AED"})</Label>
                  <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Visits Included</Label>
                  <Input type="number" value={visitsIncluded} onChange={(e) => setVisitsIncluded(e.target.value)} min="0" />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="rounded" />
                    <span className="text-sm font-medium">Auto-renew</span>
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* Visit Log */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-base">Visit Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add visit form */}
              <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                <p className="text-sm font-medium">Log a Visit</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Date *</Label>
                    <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Technician</Label>
                    <Select value={visitTech || "__none__"} onValueChange={(v) => setVisitTech(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} placeholder="Work done…" className="h-9" />
                  </div>
                </div>
                <Button onClick={handleLogVisit} disabled={addingVisit || !visitDate} size="sm" variant="outline" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> {addingVisit ? "Logging…" : "Log Visit"}
                </Button>
              </div>

              {/* Visit history */}
              {(contract.visits || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No visits logged yet</p>
              ) : (
                <div className="space-y-2">
                  {(contract.visits || []).slice().reverse().map((v) => (
                    <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{fmt(v.date)}</span>
                          {v.technicianName && <span className="text-xs text-muted-foreground">by {v.technicianName}</span>}
                        </div>
                        {v.notes && <p className="text-xs text-muted-foreground mt-0.5">{v.notes}</p>}
                      </div>
                    </div>
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
