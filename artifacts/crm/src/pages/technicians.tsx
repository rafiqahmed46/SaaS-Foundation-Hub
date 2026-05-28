import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getTechnicians, addTechnician, updateTechnician, deleteTechnician, getTasks, Technician, Task } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, Wrench, Mail, Phone, ChevronRight, CheckCircle2, Clock, X } from "lucide-react";
import PhoneActionButtons from "@/components/PhoneActionButtons";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const SPECIALIZATIONS = [
  "AC Technician", "Electrician", "Plumber", "CCTV & Security",
  "Networking & IT", "General Maintenance", "Carpenter", "Painter", "Other",
];

type FormData = {
  name: string; email: string; phone: string; phones: string[];
  specialization: string; status: "active" | "inactive"; notes: string;
};

const emptyForm: FormData = { name: "", email: "", phone: "", phones: [], specialization: "", status: "active", notes: "" };

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function TechniciansPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTech, setEditTech] = useState<Technician | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: boolean; email?: boolean }>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!user?.companyId) return;
    const [techs, allTasks] = await Promise.all([getTechnicians(user.companyId), getTasks(user.companyId)]);
    setTechnicians(techs);
    setTasks(allTasks);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.companyId]);

  function openAdd() { setEditTech(null); setForm(emptyForm); setErrors({}); setDialogOpen(true); }

  function openEdit(t: Technician) {
    setEditTech(t);
    setForm({ name: t.name, email: t.email, phone: t.phone || "", phones: t.phones?.filter(Boolean) ?? [], specialization: t.specialization || "", status: t.status, notes: t.notes || "" });
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSave() {
    const errs = { name: !form.name.trim(), email: !form.email.trim() };
    if (errs.name || errs.email) { setErrors(errs); return; }
    if (!user?.companyId) return;
    setSaving(true);
    try {
      const extraPhones = form.phones.map((p) => p.trim()).filter(Boolean);
      const payload = { companyId: user.companyId, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, phones: extraPhones.length ? extraPhones : undefined, specialization: form.specialization || undefined, status: form.status, notes: form.notes.trim() || undefined };
      if (editTech) { await updateTechnician(editTech.id, payload); toast({ title: "Technician updated" }); }
      else { await addTechnician(payload); toast({ title: "Technician added" }); }
      setDialogOpen(false);
      load();
    } catch { toast({ title: "Error", description: "Could not save technician.", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await deleteTechnician(deleteId); toast({ title: "Technician deleted" }); setDeleteId(null); load(); }
    catch { toast({ title: "Error", variant: "destructive" }); }
  }

  const filtered = technicians
    .filter((t) => statusFilter === "all" || t.status === statusFilter)
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || (t.email || "").toLowerCase().includes(search.toLowerCase()) || (t.specialization || "").toLowerCase().includes(search.toLowerCase()));

  function getStats(id: string) {
    const tt = tasks.filter((t) => t.assignedTo === id);
    return { total: tt.length, active: tt.filter((t) => t.status !== "done").length, done: tt.filter((t) => t.status === "done").length };
  }

  const counts = { all: technicians.length, active: technicians.filter((t) => t.status === "active").length, inactive: technicians.filter((t) => t.status === "inactive").length };

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Technicians</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{counts.all} total · {counts.active} active · {counts.inactive} inactive</p>
          </div>
          <Button onClick={openAdd} className="gap-2 shrink-0"><Plus className="w-4 h-4" /> Add Technician</Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or specialization..." className="pl-9" />
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {(["all", "active", "inactive"] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize", statusFilter === s ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {s} <span className="ml-1 text-xs opacity-60">{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-14 text-center">
            <Wrench className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold">{search || statusFilter !== "all" ? "No matching technicians" : "No technicians yet"}</h3>
            <p className="text-sm text-muted-foreground mt-1">Add your field service technicians to assign them to tasks and jobs.</p>
            {!search && statusFilter === "all" && <Button onClick={openAdd} variant="outline" className="mt-4 gap-2"><Plus className="w-4 h-4" /> Add Technician</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((tech) => {
              const stats = getStats(tech.id);
              const isActive = tech.status === "active";
              return (
                <div key={tech.id} className="rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group flex flex-col" onClick={() => navigate(`/technicians/${tech.id}`)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0", isActive ? "bg-primary" : "bg-muted-foreground/40")}>{initials(tech.name)}</div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{tech.name}</p>
                        {tech.specialization && <p className="text-xs text-muted-foreground truncate">{tech.specialization}</p>}
                      </div>
                    </div>
                    <Badge variant={isActive ? "default" : "secondary"} className="shrink-0 text-xs ml-2">{isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="space-y-1.5 mb-4 flex-1">
                    {tech.email && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{tech.email}</span></div>}
                    {(tech.phone || (tech.phones ?? []).length > 0) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1 truncate">{tech.phone || tech.phones?.[0]}</span>
                        <PhoneActionButtons phones={[tech.phone, ...(tech.phones ?? [])].filter(Boolean) as string[]} variant="icon" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 pt-3 border-t border-border/60">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5 text-blue-500" /><span><strong className="text-foreground">{stats.active}</strong> active</span></div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span><strong className="text-foreground">{stats.done}</strong> done</span></div>
                    <div className="ml-auto flex items-center gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(tech); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteId(tech.id); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors ml-0.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editTech ? "Edit Technician" : "Add Technician"}</DialogTitle><DialogDescription>Fill in the technician's profile details.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((er) => ({ ...er, name: false })); }} placeholder="John Smith" className={errors.name ? "border-red-400" : ""} />
                {errors.name && <p className="text-xs text-red-500">Name is required</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setErrors((er) => ({ ...er, email: false })); }} placeholder="john@company.ae" className={errors.email ? "border-red-400" : ""} />
                {errors.email && <p className="text-xs text-red-500">Email is required</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Phone</Label>
                <div className="space-y-2">
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+971 50 000 0000" />
                  {form.phones.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={p} onChange={(e) => { const arr = [...form.phones]; arr[i] = e.target.value; setForm((f) => ({ ...f, phones: arr })); }} placeholder="+971 50 000 0000" className="flex-1" />
                      <button type="button" onClick={() => setForm((f) => ({ ...f, phones: f.phones.filter((_, j) => j !== i) }))} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setForm((f) => ({ ...f, phones: [...f.phones, ""] }))} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Add another number
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "inactive" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Specialization</Label>
                <Select value={form.specialization || "none"} onValueChange={(v) => setForm((f) => ({ ...f, specialization: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select specialization..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / General</SelectItem>
                    {SPECIALIZATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Skills, certifications, availability notes..." rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editTech ? "Save Changes" : "Add Technician"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Technician</AlertDialogTitle><AlertDialogDescription>This will permanently remove this technician. Their assigned tasks will remain but the assignment will be unlinked.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
