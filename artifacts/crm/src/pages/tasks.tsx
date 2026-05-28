import React, { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getTasks, addTask, updateTask, deleteTask, getCustomers, getTechnicians, Task, Customer, Technician } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckSquare, Pencil, Trash2, Clock, CheckCircle2, AlertTriangle, User, Wrench, UserCheck, X, MapPin, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  todo:         { label: "To Do",       icon: CheckSquare,  color: "text-gray-500",  bg: "bg-gray-100"  },
  pending:      { label: "To Do",       icon: CheckSquare,  color: "text-gray-500",  bg: "bg-gray-100"  },
  "in-progress":{ label: "In Progress", icon: Clock,        color: "text-blue-600",  bg: "bg-blue-100"  },
  done:         { label: "Done",        icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
  completed:    { label: "Done",        icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
  cancelled:    { label: "Done",        icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
};

const PRIORITY_CONFIG = {
  low:    { label: "Low",    color: "text-gray-500",  dot: "bg-gray-400"  },
  medium: { label: "Medium", color: "text-amber-600", dot: "bg-amber-400" },
  high:   { label: "High",   color: "text-red-600",   dot: "bg-red-500"   },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

type SortKey = "due-date" | "priority" | "area" | "customer";

type FormData = {
  title: string;
  description: string;
  customerId: string;
  assignedTo: string;
  status: Task["status"];
  priority: Task["priority"];
  dueDate: string;
};

const emptyForm: FormData = { title: "", description: "", customerId: "", assignedTo: "", status: "todo", priority: "medium", dueDate: "" };

export default function TasksPage() {
  const { user } = useAuth();
  const { isTechnician } = usePermissions();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Task["status"]>("all");
  const [sortKey, setSortKey] = useState<SortKey>("due-date");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTechId, setBulkTechId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  async function load() {
    if (!user?.companyId) return;
    const [t, c, techs] = await Promise.all([getTasks(user.companyId), getCustomers(user.companyId), getTechnicians(user.companyId)]);
    const visibleTasks = isTechnician && user.technicianId ? t.filter((task) => task.assignedTo === user.technicianId) : t;
    setTasks(visibleTasks);
    setCustomers(c);
    setTechnicians(techs);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.companyId]);

  function openAdd() { setEditTask(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(t: Task) {
    setEditTask(t);
    setForm({ title: t.title, description: t.description || "", customerId: t.customerId || "", assignedTo: t.assignedTo || "", status: t.status, priority: t.priority, dueDate: t.dueDate || "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!user?.companyId) {
      toast({ title: "Setup incomplete", description: "Your company workspace isn't ready yet. Use the setup banner above.", variant: "destructive" });
      return;
    }
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const selectedCustomer = customers.find((c) => c.id === form.customerId);
      const selectedTech = technicians.find((t) => t.id === form.assignedTo);
      const payload: Omit<Task, "id" | "createdAt"> = {
        companyId: user.companyId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        customerId: form.customerId || undefined,
        customerName: selectedCustomer?.name,
        assignedTo: form.assignedTo || undefined,
        assignedToName: selectedTech?.name,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
      };
      if (editTask) {
        await updateTask(editTask.id, payload);
        toast({ title: "Task updated" });
      } else {
        await addTask(payload);
        toast({ title: "Task created" });
      }
      setDialogOpen(false);
      load();
    } catch {
      toast({ title: "Error", description: "Could not save task.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignTech(task: Task, techId: string) {
    const tech = technicians.find((t) => t.id === techId);
    const update = techId === "unassigned"
      ? { assignedTo: undefined, assignedToName: undefined }
      : { assignedTo: techId, assignedToName: tech?.name };
    try {
      await updateTask(task.id, update);
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...update } : t));
      toast({ title: techId === "unassigned" ? "Task unassigned" : `Assigned to ${tech?.name}` });
    } catch {
      toast({ title: "Error updating assignment", variant: "destructive" });
    }
  }

  async function handleStatusChange(task: Task, status: Task["status"]) {
    if (status !== "todo" && !task.assignedTo) {
      toast({ title: "Assign a technician first", description: "A task must be assigned before it can be marked In Progress or Done.", variant: "destructive" });
      return;
    }
    try {
      await updateTask(task.id, { status });
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status } : t));
    } catch {
      toast({ title: "Error updating status", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteTask(deleteId);
      toast({ title: "Task deleted" });
      setDeleteId(null);
      load();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  // ── Multi-select helpers ──────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  }

  async function handleBulkAssign() {
    if (!bulkTechId || selectedIds.size === 0) return;
    const tech = technicians.find((t) => t.id === bulkTechId);
    if (!tech) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          updateTask(id, { assignedTo: tech.id, assignedToName: tech.name })
        )
      );
      setTasks((prev) =>
        prev.map((t) =>
          selectedIds.has(t.id) ? { ...t, assignedTo: tech.id, assignedToName: tech.name } : t
        )
      );
      toast({ title: `${selectedIds.size} task${selectedIds.size > 1 ? "s" : ""} assigned to ${tech.name}` });
      setSelectedIds(new Set());
      setBulkTechId("");
    } catch {
      toast({ title: "Error assigning tasks", variant: "destructive" });
    } finally {
      setBulkSaving(false);
    }
  }

  // ── Sort / Filter ─────────────────────────────────────────────────────
  const counts = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    "in-progress": tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  const getArea = (task: Task) => {
    const cust = customerMap.get(task.customerId ?? "");
    return cust?.area || cust?.city || "zzz_no_area";
  };

  const sorters: Record<SortKey, (a: Task, b: Task) => number> = {
    "due-date": (a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    },
    priority: (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
    area: (a, b) => getArea(a).localeCompare(getArea(b)),
    customer: (a, b) => (a.customerName ?? "").localeCompare(b.customerName ?? ""),
  };

  const filtered = (filter === "all" ? tasks : tasks.filter((t) => t.status === filter))
    .slice()
    .sort(sorters[sortKey]);

  const isOverdue = (task: Task) => task.dueDate && task.status !== "done" && new Date(task.dueDate) < new Date();

  // Group label for area sort
  function areaGroupLabel(task: Task) {
    const area = getArea(task);
    return area === "zzz_no_area" ? "No Area" : area;
  }

  // When sorting by area/customer, group visually
  const showGroupHeaders = sortKey === "area" || sortKey === "customer";
  let lastGroupKey = "";

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{counts.all} total · {counts.todo} to do · {counts["in-progress"]} in progress · {counts.done} done</p>
          </div>
          <Button onClick={openAdd} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> New Task
          </Button>
        </div>

        {/* Filter tabs + Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {(["all", "todo", "in-progress", "done"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  filter === s ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s].label}
                <span className="ml-1.5 text-xs opacity-60">{counts[s]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due-date">By Due Date</SelectItem>
                <SelectItem value="priority">By Priority</SelectItem>
                <SelectItem value="area">By Area</SelectItem>
                <SelectItem value="customer">By Customer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <CheckSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold">{filter === "all" ? "No tasks yet" : `No ${STATUS_CONFIG[filter as Task["status"]]?.label} tasks`}</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first task to stay organized.</p>
            {filter === "all" && <Button onClick={openAdd} variant="outline" className="mt-4 gap-2"><Plus className="w-4 h-4" /> New Task</Button>}
          </div>
        ) : (
          <>
            {/* Select-all row */}
            {!isTechnician && (
              <div className="flex items-center gap-2 px-1 mb-2">
                <Checkbox
                  checked={allSelected}
                  data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all tasks"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                </span>
              </div>
            )}

            <div className="space-y-1">
              {filtered.map((task) => {
                const overdue = isOverdue(task);
                const isSelected = selectedIds.has(task.id);

                // Group header for area/customer sort
                const groupKey = sortKey === "area" ? areaGroupLabel(task) : (task.customerName ?? "No Customer");
                const showHeader = showGroupHeaders && groupKey !== lastGroupKey;
                if (showGroupHeaders) lastGroupKey = groupKey;

                return (
                  <React.Fragment key={task.id}>
                    {showHeader && (
                      <div className="flex items-center gap-2 pt-3 pb-1 px-1">
                        {sortKey === "area" ? <MapPin className="w-3.5 h-3.5 text-primary/60" /> : <User className="w-3.5 h-3.5 text-primary/60" />}
                        <span className="text-xs font-semibold text-primary/70 uppercase tracking-wide">{groupKey}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <div className={cn(
                      "rounded-xl border bg-card p-4 flex items-start gap-3 transition-colors",
                      overdue ? "border-red-200 bg-red-50/30" : "hover:border-primary/30",
                      isSelected && "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    )}>
                      {!isTechnician && (
                        <div className="mt-0.5 shrink-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(task.id)}
                            aria-label={`Select task ${task.title}`}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("font-medium leading-tight", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={cn("flex items-center gap-1 text-xs font-medium", PRIORITY_CONFIG[task.priority].color)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_CONFIG[task.priority].dot)} />
                              {PRIORITY_CONFIG[task.priority].label}
                            </span>
                          </div>
                        </div>
                        {task.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {task.customerName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground"><User className="w-3 h-3" />{task.customerName}</span>
                          )}
                          {sortKey === "area" && task.customerId && customerMap.get(task.customerId)?.address && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground/70 italic">
                              <MapPin className="w-3 h-3" />{areaGroupLabel(task)}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className={cn("flex items-center gap-1 text-xs", overdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
                              {overdue && <AlertTriangle className="w-3 h-3" />}
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          <Select value={task.status} onValueChange={(v) => handleStatusChange(task, v as Task["status"])}>
                            <SelectTrigger className={cn("h-6 text-xs px-2 gap-1 border rounded-full w-auto", STATUS_CONFIG[task.status].bg, STATUS_CONFIG[task.status].color)}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                          {!isTechnician && technicians.length > 0 && (
                            <Select value={task.assignedTo || "unassigned"} onValueChange={(v) => handleAssignTech(task, v)}>
                              <SelectTrigger className={cn(
                                "h-6 text-xs px-2 gap-1 border rounded-full w-auto min-w-[110px] max-w-[160px]",
                                task.assignedTo ? "border-primary/40 bg-primary/5 text-primary" : "border-dashed text-muted-foreground"
                              )}>
                                <UserCheck className="w-3 h-3 shrink-0" />
                                <SelectValue placeholder="Assign…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {technicians.filter((t) => t.status === "active").map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}{t.specialization ? ` — ${t.specialization}` : ""}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {isTechnician && task.assignedToName && (
                            <span className="flex items-center gap-1 text-xs text-primary"><Wrench className="w-3 h-3" />{task.assignedToName}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(task)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(task.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Bulk-assign floating bar ─────────────────────────────────────── */}
      {selectedIds.size > 0 && !isTechnician && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border shadow-xl rounded-2xl px-4 py-3 animate-in slide-in-from-bottom-4 duration-200">
          <span className="text-sm font-medium text-foreground shrink-0">
            {selectedIds.size} task{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <div className="w-px h-5 bg-border" />
          <Select value={bulkTechId} onValueChange={setBulkTechId}>
            <SelectTrigger className="h-8 text-sm w-48">
              <SelectValue placeholder="Pick technician…" />
            </SelectTrigger>
            <SelectContent>
              {technicians.filter((t) => t.status === "active").map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}{t.specialization ? ` — ${t.specialization}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleBulkAssign} disabled={!bulkTechId || bulkSaving} className="shrink-0">
            {bulkSaving ? "Assigning…" : "Assign"}
          </Button>
          <button
            onClick={() => { setSelectedIds(new Set()); setBulkTechId(""); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask ? "Edit Task" : "New Task"}</DialogTitle>
            <DialogDescription>Fill in the task details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Task title" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional details..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Task["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Task["priority"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Customer (optional)</Label>
              <Select value={form.customerId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!isTechnician && technicians.length > 0 && (
              <div className="space-y-1.5">
                <Label>Assign To (optional)</Label>
                <Select value={form.assignedTo || "none"} onValueChange={(v) => setForm((f) => ({ ...f, assignedTo: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select technician..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {technicians.filter((t) => t.status === "active").map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.specialization ? ` — ${t.specialization}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editTask ? "Save Changes" : "Create Task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this task.</AlertDialogDescription>
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
