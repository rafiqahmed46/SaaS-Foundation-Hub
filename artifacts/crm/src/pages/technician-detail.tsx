import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getTechnician, updateTechnician, getTasks, addTask, updateTask, Technician, Task } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone, Wrench, Pencil, CheckCircle2, Clock, Circle, AlertTriangle, User, Plus, X, Search } from "lucide-react";
import PhoneActionButtons from "@/components/PhoneActionButtons";
import { useLocation, useParams } from "wouter";
import { cn } from "@/lib/utils";

const SPECIALIZATIONS = ["AC Technician", "Electrician", "Plumber", "CCTV & Security", "Networking & IT", "General Maintenance", "Carpenter", "Painter", "Other"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  todo:          { label: "To Do",       color: "text-gray-500",  bg: "bg-gray-100"  },
  "in-progress": { label: "In Progress", color: "text-blue-600",  bg: "bg-blue-100"  },
  done:          { label: "Done",        color: "text-green-600", bg: "bg-green-100" },
};

function initials(name: string) { return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2); }

export default function TechnicianDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "tasks">("overview");

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", phones: [] as string[], specialization: "", status: "active" as "active" | "inactive", notes: "" });
  const [saving, setSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);

  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({ title: "", description: "", priority: "medium" as Task["priority"], dueDate: "" });
  const [creatingTask, setCreatingTask] = useState(false);

  async function load() {
    if (!user?.companyId || !params.id) return;
    try {
      const [tech, fetchedTasks] = await Promise.all([getTechnician(params.id), getTasks(user.companyId)]);
      setTechnician(tech);
      setAllTasks(fetchedTasks);
      setTasks(fetchedTasks.filter((t) => t.assignedTo === params.id));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [params.id, user?.companyId]);

  function openEdit() {
    if (!technician) return;
    setForm({
      name: technician.name,
      email: technician.email,
      phone: technician.phone || "",
      phones: technician.phones?.filter(Boolean) ?? [],
      specialization: technician.specialization || "",
      status: technician.status,
      notes: technician.notes || "",
    });
    setEditOpen(true);
  }

  async function handleSave() {
    if (!technician) return;
    if (!form.name.trim() || !form.email.trim()) { toast({ title: "Name and email are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const extraPhones = form.phones.map((p) => p.trim()).filter(Boolean);
      const upd = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        phones: extraPhones.length ? extraPhones : undefined,
        specialization: form.specialization || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      };
      await updateTechnician(technician.id, upd);
      setTechnician((prev) => prev ? { ...prev, ...upd } : prev);
      toast({ title: "Technician updated" });
      setEditOpen(false);
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleAssign(task: Task) {
    if (!technician) return;
    setAssigning(task.id);
    try {
      await updateTask(task.id, { assignedTo: technician.id, assignedToName: technician.name });
      toast({ title: "Task assigned", description: `"${task.title}" assigned to ${technician.name}` });
      await load();
    } catch { toast({ title: "Error assigning task", variant: "destructive" }); }
    finally { setAssigning(null); }
  }

  async function handleUnassign(task: Task) {
    setAssigning(task.id);
    try {
      await updateTask(task.id, { assignedTo: undefined, assignedToName: undefined });
      toast({ title: "Task unassigned" });
      await load();
    } catch { toast({ title: "Error unassigning task", variant: "destructive" }); }
    finally { setAssigning(null); }
  }

  async function handleCreateTask() {
    if (!user?.companyId || !technician) return;
    if (!newTaskForm.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setCreatingTask(true);
    try {
      await addTask({
        companyId: user.companyId,
        title: newTaskForm.title.trim(),
        description: newTaskForm.description.trim() || undefined,
        priority: newTaskForm.priority,
        dueDate: newTaskForm.dueDate || undefined,
        status: "todo",
        assignedTo: technician.id,
        assignedToName: technician.name,
      });
      toast({ title: "Task created and assigned" });
      setNewTaskOpen(false);
      setNewTaskForm({ title: "", description: "", priority: "medium", dueDate: "" });
      await load();
      setActiveTab("tasks");
    } catch { toast({ title: "Error creating task", variant: "destructive" }); }
    finally { setCreatingTask(false); }
  }

  const stats = { total: tasks.length, todo: tasks.filter((t) => t.status === "todo").length, inProgress: tasks.filter((t) => t.status === "in-progress").length, done: tasks.filter((t) => t.status === "done").length };
  const isOverdue = (t: Task) => t.dueDate && t.status !== "done" && new Date(t.dueDate) < new Date();

  const unassignedTasks = allTasks.filter((t) => !t.assignedTo && t.status !== "done");
  const filteredUnassigned = unassignedTasks.filter((t) =>
    t.title.toLowerCase().includes(assignSearch.toLowerCase()) ||
    (t.customerName || "").toLowerCase().includes(assignSearch.toLowerCase())
  );

  if (loading) return (
    <Layout><div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <Skeleton className="h-7 w-32" /><Skeleton className="h-44 w-full rounded-xl" />
      <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
    </div></Layout>
  );

  if (!technician) return (
    <Layout><div className="p-4 sm:p-6 max-w-4xl mx-auto text-center py-20">
      <Wrench className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
      <h2 className="font-semibold text-lg">Technician not found</h2>
      <Button variant="outline" onClick={() => navigate("/technicians")} className="mt-4">Back to Technicians</Button>
    </div></Layout>
  );

  const isActive = technician.status === "active";

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <button onClick={() => navigate("/technicians")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Technicians
        </button>

        <Card className="mb-5">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className={cn("w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shrink-0", isActive ? "bg-primary" : "bg-muted-foreground/40")}>{initials(technician.name)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold tracking-tight">{technician.name}</h1>
                  <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Active" : "Inactive"}</Badge>
                </div>
                {technician.specialization && <p className="text-sm text-muted-foreground mb-3">{technician.specialization}</p>}
                <div className="flex flex-wrap gap-4 items-center">
                  {technician.email && (
                    <a href={`mailto:${technician.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                      <Mail className="w-4 h-4 shrink-0 text-primary/60" />{technician.email}
                    </a>
                  )}
                  {(technician.phone || (technician.phones ?? []).length > 0) && (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4 shrink-0 text-primary/60" />
                      <span>{technician.phone || technician.phones?.[0]}</span>
                      <PhoneActionButtons phones={[technician.phone, ...(technician.phones ?? [])].filter(Boolean) as string[]} variant="label" />
                    </span>
                  )}
                </div>
                {technician.notes && <p className="text-sm text-muted-foreground mt-2 italic">{technician.notes}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={openEdit} className="gap-1.5 shrink-0"><Pencil className="w-3.5 h-3.5" /> Edit</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total Tasks", value: stats.total,      icon: Wrench,       color: "text-primary"   },
            { label: "To Do",       value: stats.todo,       icon: Circle,       color: "text-gray-500"  },
            { label: "In Progress", value: stats.inProgress, icon: Clock,        color: "text-blue-600"  },
            { label: "Completed",   value: stats.done,       icon: CheckCircle2, color: "text-green-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1.5"><Icon className={cn("w-4 h-4", color)} /><span className="text-xs text-muted-foreground font-medium">{label}</span></div>
              <p className={cn("font-bold text-2xl", color)}>{value}</p>
            </CardContent></Card>
          ))}
        </div>

        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-4 w-fit">
          {(["overview", "tasks"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors", activeTab === tab ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tab === "tasks" ? `Assigned Tasks (${stats.total})` : "Overview"}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4" /> Profile Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Full Name</p><p className="font-medium">{technician.name}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p><Badge variant={isActive ? "default" : "secondary"} className="text-xs">{isActive ? "Active" : "Inactive"}</Badge></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p><p className="font-medium">{technician.email || "—"}</p></div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Phone</p>
                  {[technician.phone, ...(technician.phones ?? [])].filter(Boolean).length > 0
                    ? [technician.phone, ...(technician.phones ?? [])].filter(Boolean).map((p, i) => <p key={i} className="font-medium">{p}</p>)
                    : <p className="font-medium">—</p>
                  }
                </div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Specialization</p><p className="font-medium">{technician.specialization || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Date Added</p><p className="font-medium">{new Date(technician.createdAt).toLocaleDateString("en-GB")}</p></div>
              </div>
              {technician.notes && <div className="pt-4 border-t mt-4"><p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p><p className="text-sm">{technician.notes}</p></div>}
            </CardContent>
          </Card>
        )}

        {activeTab === "tasks" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{stats.total} task{stats.total !== 1 ? "s" : ""} assigned</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setAssignSearch(""); setAssignOpen(true); }} className="gap-1.5">
                  <Search className="w-3.5 h-3.5" /> Assign Existing
                </Button>
                <Button size="sm" onClick={() => { setNewTaskForm({ title: "", description: "", priority: "medium", dueDate: "" }); setNewTaskOpen(true); }} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> New Task
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="font-medium">No tasks assigned yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">Create a new task or assign an existing one to this technician.</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={() => { setAssignSearch(""); setAssignOpen(true); }} className="gap-1.5">
                      <Search className="w-3.5 h-3.5" /> Assign Existing
                    </Button>
                    <Button size="sm" onClick={() => { setNewTaskForm({ title: "", description: "", priority: "medium", dueDate: "" }); setNewTaskOpen(true); }} className="gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> New Task
                    </Button>
                  </div>
                </div>
              ) : tasks.map((task) => {
                const overdue = isOverdue(task);
                const sc = STATUS_CFG[task.status] ?? STATUS_CFG.todo;
                return (
                  <div key={task.id} className={cn("rounded-xl border bg-card p-4 flex items-start gap-3", overdue && "border-red-200 bg-red-50/30")}>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className={cn("font-medium", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</p>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", sc.bg, sc.color)}>{sc.label}</span>
                      </div>
                      {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {task.customerName && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {task.customerName}</span>}
                        {task.dueDate && <span className={cn("flex items-center gap-1", overdue && "text-red-600 font-medium")}>{overdue && <AlertTriangle className="w-3 h-3" />}Due {new Date(task.dueDate).toLocaleDateString("en-GB")}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnassign(task)}
                      disabled={assigning === task.id}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 mt-0.5"
                      title="Unassign task"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit Technician Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Technician</DialogTitle><DialogDescription>Update this technician's profile information.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5"><Label>Full Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
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
              <div className="space-y-1.5">
                <Label>Specialization</Label>
                <Select value={form.specialization || "none"} onValueChange={(v) => setForm((f) => ({ ...f, specialization: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / General</SelectItem>
                    {SPECIALIZATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Existing Task Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Existing Task</DialogTitle>
            <DialogDescription>Pick an unassigned task to assign to {technician.name}.</DialogDescription>
          </DialogHeader>
          <div className="py-1 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} placeholder="Search tasks..." className="pl-9" autoFocus />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredUnassigned.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {assignSearch ? "No matching unassigned tasks." : "No unassigned tasks available."}
                </div>
              ) : filteredUnassigned.map((task) => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary/40 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    {task.customerName && <p className="text-xs text-muted-foreground mt-0.5">{task.customerName}</p>}
                    {task.dueDate && <p className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString("en-GB")}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={assigning === task.id}
                    onClick={async () => { await handleAssign(task); setAssignOpen(false); }}
                    className="shrink-0 gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Assign
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Task Dialog */}
      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Create a task and assign it directly to {technician.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={newTaskForm.title} onChange={(e) => setNewTaskForm((f) => ({ ...f, title: e.target.value }))} placeholder="Task title" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={newTaskForm.description} onChange={(e) => setNewTaskForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional details..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={newTaskForm.priority} onValueChange={(v) => setNewTaskForm((f) => ({ ...f, priority: v as Task["priority"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={newTaskForm.dueDate} onChange={(e) => setNewTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewTaskOpen(false)} disabled={creatingTask}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={creatingTask}>{creatingTask ? "Creating..." : "Create & Assign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
