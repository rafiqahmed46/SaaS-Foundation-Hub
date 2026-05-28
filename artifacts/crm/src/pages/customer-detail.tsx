import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCustomer, updateCustomer, getInvoices, getQuotations,
  getCustomerVisits, addCustomerVisit,
  getTasks, addTask, updateTask, deleteTask,
  Customer, Invoice, Quotation, Settings, CustomerVisit, Task, getSettings,
  getCustomerPhones,
} from "@/lib/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Phone, MessageCircle, MapPin, Mail, FileText,
  FileCheck, Pencil, TrendingUp, Receipt, ClipboardList, Navigation,
  CheckSquare, Circle, Clock, CheckCircle2, AlertTriangle, Trash2, Plus, Download, Eye, ChevronDown, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrencySymbol, fmtDate } from "@/lib/utils-crm";
import CustomerMap from "@/components/CustomerMap";
import PhoneActionButtons from "@/components/PhoneActionButtons";

// ── Status pill colours ──────────────────────────────────────────────────────

const INVOICE_STATUS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
};
const QUOTE_STATUS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

type TimelineItem =
  | { kind: "invoice"; data: Invoice }
  | { kind: "quotation"; data: Quotation };

// ── Component ────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const [, params] = useRoute("/customers/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const id = params?.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phones: [""], address: "", area: "", city: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const emptyTaskForm = { title: "", description: "", status: "todo" as Task["status"], priority: "medium" as Task["priority"], dueDate: "" };
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [savingTask, setSavingTask] = useState(false);
  const [taskDeleteId, setTaskDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user?.companyId) return;
    async function load() {
      try {
        const [cust, invs, quots, sett, vis, allTasks] = await Promise.all([
          getCustomer(id!),
          getInvoices(user!.companyId!),
          getQuotations(user!.companyId!),
          getSettings(user!.companyId!),
          getCustomerVisits(id!),
          getTasks(user!.companyId!),
        ]);
        setCustomer(cust);
        setInvoices(invs.filter((i) => i.customerId === id));
        setQuotations(quots.filter((q) => q.customerId === id));
        setSettings(sett);
        setVisits(vis);
        const byDate = (a: Task, b: Task) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        };
        setTasks(allTasks.filter((t) => t.customerId === id).sort(byDate));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, user?.companyId]);

  async function handleSaveLocation(lat: number, lng: number) {
    if (!id) return;
    try {
      await updateCustomer(id, { lat, lng });
      setCustomer((prev) => prev ? { ...prev, lat, lng } : prev);
      toast({ title: "Location saved!", description: "GPS coordinates pinned to this customer's profile." });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "permission-denied") {
        throw err; // Let CustomerMap handle the error display
      }
      throw err;
    }
  }

  async function handleCheckIn(lat: number, lng: number) {
    if (!id) return;
    try {
      await addCustomerVisit(id, {
        customerId: id,
        lat,
        lng,
        timestamp: new Date().toISOString(),
      });
      // Prepend to visits list
      setVisits((prev) => [
        { id: Date.now().toString(), customerId: id, lat, lng, timestamp: new Date().toISOString() },
        ...prev,
      ]);
      toast({ title: "Checked in!", description: "Visit recorded for this customer." });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "permission-denied") {
        toast({ title: "Permission denied", description: "Fix Firestore rules to allow subcollection writes.", variant: "destructive" });
      } else {
        toast({ title: "Could not record visit", variant: "destructive" });
      }
    }
  }

  function openEdit() {
    if (!customer) return;
    const phones = getCustomerPhones(customer);
    setForm({
      name: customer.name,
      email: customer.email,
      phones: phones.length ? phones : [""],
      address: customer.address || "",
      area: customer.area || "",
      city: customer.city || "",
      notes: customer.notes || "",
    });
    setEditOpen(true);
  }

  async function handleSave() {
    if (!customer || !user?.companyId) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: "Name and email are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const cleanPhones = form.phones.map((p) => p.trim()).filter(Boolean);
      const primaryPhone = cleanPhones[0] || undefined;
      await updateCustomer(customer.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phones: cleanPhones.length ? cleanPhones : undefined,
        phone: primaryPhone,
        address: form.address.trim(),
        area: form.area.trim() || undefined,
        city: form.city.trim() || undefined,
        notes: form.notes.trim(),
      });
      setCustomer((prev) =>
        prev
          ? { ...prev, name: form.name.trim(), email: form.email.trim(), phones: cleanPhones.length ? cleanPhones : undefined, phone: primaryPhone, address: form.address.trim() || undefined, area: form.area.trim() || undefined, city: form.city.trim() || undefined, notes: form.notes.trim() || undefined }
          : prev
      );
      toast({ title: "Customer updated" });
      setEditOpen(false);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "permission-denied") {
        toast({ title: "Permission denied", description: "Fix Firestore rules in Firebase Console.", variant: "destructive" });
      } else {
        toast({ title: "Could not save", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Task handlers ────────────────────────────────────────────────────────

  const TASK_STATUS = {
    todo: { label: "To Do", Icon: Circle, color: "text-gray-500", bg: "bg-gray-100" },
    "in-progress": { label: "In Progress", Icon: Clock, color: "text-blue-600", bg: "bg-blue-100" },
    done: { label: "Done", Icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
  };
  const TASK_PRIORITY = {
    low: { label: "Low", color: "text-gray-500", dot: "bg-gray-400" },
    medium: { label: "Medium", color: "text-amber-600", dot: "bg-amber-400" },
    high: { label: "High", color: "text-red-600", dot: "bg-red-500" },
  };

  function openAddTask() {
    setEditTask(null);
    setTaskForm(emptyTaskForm);
    setTaskDialogOpen(true);
  }

  function openEditTask(t: Task) {
    setEditTask(t);
    setTaskForm({ title: t.title, description: t.description || "", status: t.status, priority: t.priority, dueDate: t.dueDate || "" });
    setTaskDialogOpen(true);
  }

  async function handleTaskSave() {
    if (!user?.companyId || !customer) return;
    if (!taskForm.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSavingTask(true);
    try {
      const payload: Omit<Task, "id" | "createdAt"> = {
        companyId: user.companyId,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        customerId: id,
        customerName: customer.name,
        status: taskForm.status,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
      };
      if (editTask) {
        await updateTask(editTask.id, payload);
        setTasks((prev) => prev.map((t) => t.id === editTask.id ? { ...t, ...payload } : t));
        toast({ title: "Task updated" });
      } else {
        const ref = await addTask(payload);
        setTasks((prev) => [{ id: (ref as { id: string }).id, ...payload, createdAt: new Date().toISOString() }, ...prev]);
        toast({ title: "Task created" });
      }
      setTaskDialogOpen(false);
    } catch {
      toast({ title: "Could not save task", variant: "destructive" });
    } finally {
      setSavingTask(false);
    }
  }

  async function handleTaskStatusToggle(task: Task) {
    const next: Task["status"] = task.status === "todo" ? "in-progress" : task.status === "in-progress" ? "done" : "todo";
    try {
      await updateTask(task.id, { status: next });
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
    } catch {
      toast({ title: "Could not update task", variant: "destructive" });
    }
  }

  async function handleTaskDelete() {
    if (!taskDeleteId) return;
    try {
      await deleteTask(taskDeleteId);
      setTasks((prev) => prev.filter((t) => t.id !== taskDeleteId));
      toast({ title: "Task deleted" });
    } catch {
      toast({ title: "Could not delete task", variant: "destructive" });
    } finally {
      setTaskDeleteId(null);
    }
  }

  async function buildSchedulePDF() {
    if (!customer) throw new Error("No customer");
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();   // 210 mm
      const pageH = doc.internal.pageSize.getHeight();  // 297 mm
      const M = 18; // margin
      const brandR = 30, brandG = 64, brandB = 175;
      const today = new Date();
      const todayStr = today.toLocaleDateString("en-GB"); // DD/MM/YYYY UAE format

      // ── Header bar (54 mm) ─────────────────────────────────────────────────
      doc.setFillColor(brandR, brandG, brandB);
      doc.rect(0, 0, pageW, 54, "F");

      // Logo (if available)
      let logoEndX = M;
      if (settings?.companyLogo) {
        try {
          const fmt = settings.companyLogo.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(settings.companyLogo, fmt, M, 7, 30, 30);
          logoEndX = M + 36;
        } catch { /* skip logo on error */ }
      }

      // Company name
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(settings?.companyName || "Your Company", logoEndX, 22);

      // Company sub-details (address, tel, email, website)
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 215, 255);
      let hY = 32;
      const companyLines: string[] = [];
      if (settings?.address) companyLines.push(settings.address);
      if (settings?.phone)   companyLines.push(`Tel: ${settings.phone}`);
      if (settings?.email)   companyLines.push(settings.email);
      if (settings?.website) companyLines.push(settings.website);
      companyLines.forEach((line) => { doc.text(line, logoEndX, hY); hY += 5.5; });

      // TRN + title top-right
      doc.setTextColor(180, 205, 255);
      doc.setFontSize(10);
      const showTrn = settings?.taxEnabled && settings?.trn;
      if (showTrn) {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`TRN: ${settings.trn}`, pageW - M, 16, { align: "right" });
      }
      doc.setFontSize(26);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("SERVICE SCHEDULE", pageW - M, showTrn ? 30 : 24, { align: "right" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 205, 255);
      doc.text(`Date: ${todayStr}`, pageW - M, showTrn ? 42 : 36, { align: "right" });

      // ── Prepared For / Customer block ───────────────────────────────────────
      let y = 68;

      // Left: customer
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(150);
      doc.text("PREPARED FOR:", M, y);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20);
      doc.text(customer.name, M, y + 8);

      doc.setFontSize(10.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      let cy2 = y + 17;
      if (customer.phone)   { doc.text(`Tel: ${customer.phone}`, M, cy2);    cy2 += 6; }
      if (customer.email)   { doc.text(`Email: ${customer.email}`, M, cy2);  cy2 += 6; }
      if (customer.address) {
        const addrLines = doc.splitTextToSize(`Address: ${customer.address}`, 95);
        doc.text(addrLines, M, cy2);
        cy2 += addrLines.length * 6;
      }

      // Right: Schedule meta
      const metaX = pageW - M;
      const metaLabelX = pageW - 70;
      let my = y + 8;
      const meta: [string, string][] = [
        ["Schedule Date:", todayStr],
        ["Total Tasks:", String(tasks.length)],
        ["Completed:", String(tasks.filter((t) => t.status === "done").length)],
        ["In Progress:", String(tasks.filter((t) => t.status === "in-progress").length)],
        ["Pending:", String(tasks.filter((t) => t.status === "todo").length)],
      ];
      meta.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(120);
        doc.text(label, metaLabelX, my, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(20);
        doc.text(value, metaX, my, { align: "right" });
        my += 7;
      });

      // Divider
      y = Math.max(cy2, my) + 6;
      doc.setDrawColor(brandR, brandG, brandB);
      doc.setLineWidth(0.5);
      doc.line(M, y, pageW - M, y);
      y += 7;

      // Section heading
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(brandR, brandG, brandB);
      doc.text("SERVICE TASK SCHEDULE", M, y);
      y += 6;

      // ── Tasks table ─────────────────────────────────────────────────────────
      const tableRows = tasks.map((t, i) => [
        String(i + 1),
        t.title,
        t.description || "—",
        TASK_STATUS[t.status].label,
        TASK_PRIORITY[t.priority].label,
        t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB") : "—",
      ]);

      autoTable(doc, {
        startY: y,
        head: [["#", "Task / Service", "Description", "Status", "Priority", "Due Date"]],
        body: tableRows,
        headStyles: { fillColor: [brandR, brandG, brandB], textColor: 255, fontStyle: "bold", fontSize: 10.5 },
        bodyStyles: { fontSize: 10.5, textColor: 40 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 42 },
          2: { cellWidth: 56 },
          3: { cellWidth: 26, halign: "center" },
          4: { cellWidth: 22, halign: "center" },
          5: { cellWidth: 26, halign: "center" },
        },
        margin: { left: M, right: M },
        styles: { cellPadding: 4 },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 3) {
            const val = data.cell.raw as string;
            if (val === "Done")        { data.cell.styles.textColor = [22, 163, 74];  data.cell.styles.fontStyle = "bold"; }
            if (val === "In Progress") { data.cell.styles.textColor = [37, 99, 235];  data.cell.styles.fontStyle = "bold"; }
            if (val === "To Do")       { data.cell.styles.textColor = [107, 114, 128]; }
          }
          if (data.section === "body" && data.column.index === 4) {
            const val = data.cell.raw as string;
            if (val === "High")   { data.cell.styles.textColor = [220, 38, 38];  data.cell.styles.fontStyle = "bold"; }
            if (val === "Medium") { data.cell.styles.textColor = [217, 119, 6];  data.cell.styles.fontStyle = "bold"; }
          }
        },
      });

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      // ── Summary bar ──────────────────────────────────────────────────────────
      const sumY = finalY + 8;
      const done = tasks.filter((t) => t.status === "done").length;
      const inProg = tasks.filter((t) => t.status === "in-progress").length;
      const todo = tasks.filter((t) => t.status === "todo").length;
      doc.setFillColor(240, 244, 255);
      doc.roundedRect(M, sumY, pageW - M * 2, 16, 2, 2, "F");
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(brandR, brandG, brandB);
      doc.text(
        `Total: ${tasks.length}   ·   Completed: ${done}   ·   In Progress: ${inProg}   ·   Pending: ${todo}`,
        pageW / 2, sumY + 10, { align: "center" }
      );

      // ── Notes ────────────────────────────────────────────────────────────────
      let footY = sumY + 26;
      if (settings?.invoiceFooter || settings?.paymentTerms) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(80);
        doc.text("Notes:", M, footY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120);
        const noteText = [settings.invoiceFooter, settings.paymentTerms].filter(Boolean).join("  |  ");
        const noteLines = doc.splitTextToSize(noteText, pageW - M * 2);
        doc.setFontSize(10.5);
        doc.text(noteLines, M, footY + 7);
      }

      // ── Page footer ──────────────────────────────────────────────────────────
      doc.setDrawColor(200, 210, 240);
      doc.setLineWidth(0.3);
      doc.line(M, pageH - 18, pageW - M, pageH - 18);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150);
      doc.text(settings?.companyName || "", M, pageH - 10);
      if (settings?.taxEnabled && settings?.trn) {
        doc.text(`TRN: ${settings.trn}`, pageW / 2, pageH - 10, { align: "center" });
      }
      doc.text("Page 1", pageW - M, pageH - 10, { align: "right" });

      return doc;
  }

  const schedulePDFFilename = () =>
    `service-schedule-${customer?.name.replace(/\s+/g, "-").toLowerCase() ?? "customer"}.pdf`;

  async function handleViewSchedulePDF() {
    if (!customer) return;
    try {
      const doc = await buildSchedulePDF();
      const url = doc.output("bloburl");
      window.open(url as unknown as string, "_blank");
    } catch (err) {
      console.error(err);
      toast({ title: "Could not generate PDF", variant: "destructive" });
    }
  }

  async function handleDownloadSchedulePDF() {
    if (!customer) return;
    try {
      const doc = await buildSchedulePDF();
      doc.save(schedulePDFFilename());
      toast({ title: "Service Schedule PDF downloaded" });
    } catch (err) {
      console.error(err);
      toast({ title: "Could not generate PDF", variant: "destructive" });
    }
  }

  function buildWhatsAppText() {
    const today = new Date().toLocaleDateString("en-GB");
    const company = settings?.companyName || "Our Company";
    const trn = (settings?.taxEnabled && settings?.trn) ? `TRN: ${settings.trn}` : "";
    const statusEmoji = { todo: "🔲", "in-progress": "🔄", done: "✅" } as Record<string, string>;
    const priorityTag = { low: "[Low]", medium: "[Med]", high: "[HIGH]" } as Record<string, string>;
    const taskLines = tasks.map((t, i) => {
      const due = t.dueDate ? ` | Due: ${new Date(t.dueDate).toLocaleDateString("en-GB")}` : "";
      return `${i + 1}. ${statusEmoji[t.status]} ${t.title}${due} ${priorityTag[t.priority]}`;
    }).join("\n");
    const done = tasks.filter((t) => t.status === "done").length;
    return [
      `*SERVICE SCHEDULE*`,
      `*${company}*${trn ? `\n${trn}` : ""}`,
      ``,
      `*Prepared for:* ${customer?.name ?? ""}`,
      customer?.phone   ? `Tel: ${customer.phone}`     : "",
      customer?.email   ? `Email: ${customer.email}`   : "",
      customer?.address ? `Address: ${customer.address}` : "",
      ``,
      `*Date:* ${today}`,
      ``,
      `*TASKS:*`,
      taskLines,
      ``,
      `*Summary:* ${tasks.length} tasks | ✅ Done: ${done} | 🔄 In Progress: ${tasks.filter((t) => t.status === "in-progress").length} | 🔲 Pending: ${tasks.filter((t) => t.status === "todo").length}`,
    ].filter(Boolean).join("\n");
  }

  async function handleWhatsAppSchedule() {
    if (!customer) return;
    try {
      const doc = await buildSchedulePDF();
      const filename = schedulePDFFilename();
      const msg = buildWhatsAppText();

      // Mobile: use native OS share sheet so the PDF lands directly in WhatsApp
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        const blob = doc.output("blob");
        const file = new File([blob], filename, { type: "application/pdf" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Service Schedule – ${customer.name}` });
          return;
        }
      }

      // Desktop fallback: save PDF locally then open WhatsApp with pre-filled text
      doc.save(filename);
      const phone = (customer.phone || "").replace(/\D/g, "");
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      setTimeout(() => window.open(waUrl, "_blank"), 500);
      toast({ title: "PDF saved — WhatsApp opening", description: "Attach the downloaded PDF in the chat." });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      console.error(err);
      toast({ title: "Could not generate PDF", variant: "destructive" });
    }
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  const currency = settings?.currency || "AED";
  const sym = getCurrencySymbol(currency);

  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.total, 0);

  const totalBilled = invoices
    .filter((i) => i.status !== "cancelled")
    .reduce((sum, i) => sum + i.total, 0);

  const timeline: TimelineItem[] = [
    ...invoices.map((i): TimelineItem => ({ kind: "invoice", data: i })),
    ...quotations.map((q): TimelineItem => ({ kind: "quotation", data: q })),
  ].sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt));

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-56" /></div>
        </div>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </Layout>
  );

  if (!customer) return (
    <Layout>
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Customer not found.</p>
        <Button variant="link" onClick={() => navigate("/customers")}>Back to Customers</Button>
      </div>
    </Layout>
  );

  const initials = customer.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/customers")}
              className="p-2 rounded-lg hover:bg-muted transition-colors self-start mt-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-primary">{initials}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                <p className="text-sm text-muted-foreground">Customer since {fmtDate(customer.createdAt)}</p>
              </div>
            </div>
          </div>
          <Button onClick={openEdit} variant="outline" className="gap-2 shrink-0">
            <Pencil className="w-4 h-4" /> Edit
          </Button>
        </div>

        {/* ── Profile card ── */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Mail className="w-4 h-4 shrink-0 text-primary/60" />
                <a href={`mailto:${customer.email}`} className="hover:underline hover:text-foreground truncate">{customer.email}</a>
              </div>
              {getCustomerPhones(customer).map((ph, i) => (
                <div key={i} className="flex items-center gap-2.5 text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0 text-primary/60" />
                  <a href={`tel:${ph}`} className="hover:underline hover:text-foreground">{ph}</a>
                </div>
              ))}
              {(customer.area || customer.city) && (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0 text-primary/60" />
                  <span>{[customer.area, customer.city].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-2.5 text-muted-foreground sm:col-span-2">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-primary/60 opacity-40" />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="hover:underline hover:text-foreground text-xs"
                  >
                    {customer.address}
                  </a>
                </div>
              )}
              {customer.notes && (
                <div className="sm:col-span-2 bg-muted/40 rounded-lg px-3 py-2 text-muted-foreground italic text-xs">
                  {customer.notes}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              {/* Navigate — uses saved GPS or address */}
              {(customer.lat != null || customer.address) && (() => {
                const navUrl = customer.lat != null
                  ? `https://www.google.com/maps/dir/?api=1&destination=${customer.lat},${customer.lng}&travelmode=driving`
                  : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address!)}&travelmode=driving`;
                return (
                  <a
                    href={navUrl}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Navigate
                  </a>
                );
              })()}
              <PhoneActionButtons phones={getCustomerPhones(customer)} variant="label" />
            </div>
          </CardContent>
        </Card>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Billed", value: `${sym} ${totalBilled.toFixed(2)}`, icon: TrendingUp, color: "text-primary" },
            { label: "Total Paid",   value: `${sym} ${totalRevenue.toFixed(2)}`, icon: Receipt,    color: "text-green-600" },
            { label: "Invoices",     value: String(invoices.length),             icon: FileText,   color: "text-blue-600" },
            { label: "Quotations",   value: String(quotations.length),           icon: ClipboardList, color: "text-amber-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                </div>
                <p className={`font-bold text-lg ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Location Map ── */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold">Location & Visits</h2>
              {visits.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                  {visits.length} visit{visits.length !== 1 ? "s" : ""} recorded
                </span>
              )}
            </div>
            <CustomerMap
              customerId={id!}
              address={customer.address}
              savedLat={customer.lat}
              savedLng={customer.lng}
              visits={visits}
              onCheckIn={handleCheckIn}
              onSaveLocation={handleSaveLocation}
            />
          </CardContent>
        </Card>

        {/* ── Service Tasks ── */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold">Service Tasks</h2>
                {tasks.length > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                    {tasks.filter((t) => t.status === "done").length}/{tasks.length} done
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {tasks.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                        <Download className="w-3.5 h-3.5" /> Schedule <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={handleViewSchedulePDF} className="gap-2 cursor-pointer">
                        <Eye className="w-4 h-4 text-blue-600" />
                        <span>View PDF</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDownloadSchedulePDF} className="gap-2 cursor-pointer">
                        <Download className="w-4 h-4 text-primary" />
                        <span>Download PDF</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleWhatsAppSchedule} className="gap-2 cursor-pointer">
                        <MessageCircle className="w-4 h-4 text-green-600" />
                        <span>Send via WhatsApp</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button size="sm" onClick={openAddTask} className="gap-1.5 text-xs h-8">
                  <Plus className="w-3.5 h-3.5" /> Add Task
                </Button>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <CheckSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="font-medium text-sm">No tasks yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add service tasks to schedule work for this customer.</p>
                <Button size="sm" variant="outline" onClick={openAddTask} className="mt-3 gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add First Task
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const { Icon, color, bg, label: statusLabel } = TASK_STATUS[task.status];
                  const { label: priLabel, color: priColor, dot: priDot } = TASK_PRIORITY[task.priority];
                  const isOverdue = task.dueDate && task.status !== "done" && new Date(task.dueDate) < new Date();
                  return (
                    <div key={task.id} className={cn("rounded-xl border bg-background p-3.5 flex items-start gap-3 hover:border-primary/30 transition-colors", isOverdue && "border-red-200 bg-red-50/30")}>
                      <button
                        onClick={() => handleTaskStatusToggle(task)}
                        className={cn("mt-0.5 shrink-0 transition-colors hover:opacity-70", color)}
                        title="Click to advance status"
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("font-medium text-sm leading-tight", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={cn("flex items-center gap-1 text-xs font-medium", priColor)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", priDot)} />
                              {priLabel}
                            </span>
                            <span className={cn("ml-1 px-2 py-0.5 rounded-full text-xs font-medium", bg, color)}>{statusLabel}</span>
                          </div>
                        </div>
                        {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
                        {task.dueDate && (
                          <p className={cn("text-xs mt-1 flex items-center gap-1", isOverdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
                            {isOverdue && <AlertTriangle className="w-3 h-3" />}
                            Due {new Date(task.dueDate).toLocaleDateString("en-GB")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => openEditTask(task)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setTaskDeleteId(task.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Activity Timeline ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Activity Timeline</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/invoices/new?customerId=${id}`)} className="gap-1.5 text-xs h-8">
                <FileText className="w-3.5 h-3.5" /> New Invoice
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/quotations/new?customerId=${id}`)} className="gap-1.5 text-xs h-8">
                <FileCheck className="w-3.5 h-3.5" /> New Quote
              </Button>
            </div>
          </div>

          {timeline.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <FileText className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-sm">No activity yet</p>
              <p className="text-xs text-muted-foreground mt-1">Invoices and quotations for this customer will appear here.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-3">
                {timeline.map((item, idx) => {
                  const isInvoice = item.kind === "invoice";
                  const inv = isInvoice ? (item.data as Invoice) : null;
                  const quot = !isInvoice ? (item.data as Quotation) : null;
                  const number = inv ? inv.invoiceNumber : quot!.quoteNumber;
                  const status = inv ? inv.status : quot!.status;
                  const total = item.data.total;
                  const date = item.data.createdAt;
                  const href = isInvoice ? `/invoices/${item.data.id}` : `/quotations/${item.data.id}`;
                  const statusStyles = isInvoice ? INVOICE_STATUS : QUOTE_STATUS;

                  return (
                    <div key={`${item.kind}-${item.data.id}`} className="relative flex items-start gap-4 pl-2">
                      <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isInvoice ? "bg-blue-50 border-2 border-blue-200" : "bg-amber-50 border-2 border-amber-200"}`}>
                        {isInvoice
                          ? <FileText className="w-3.5 h-3.5 text-blue-600" />
                          : <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                        }
                      </div>
                      <button
                        onClick={() => navigate(href)}
                        className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left bg-background border rounded-xl px-4 py-3 hover:border-primary/40 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-sm font-semibold group-hover:text-primary transition-colors">{number}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusStyles[status] || "bg-gray-100 text-gray-600"}`}>
                            {status}
                          </span>
                          <span className="hidden sm:inline text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted capitalize">
                            {isInvoice ? "Invoice" : "Quotation"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-sm">{sym} {total.toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(date)}</span>
                        </div>
                      </button>
                      {idx === timeline.length - 1 && (
                        <div className="absolute left-5 top-7 bottom-0 w-px bg-background" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <Separator className="my-8" />
      </div>

      {/* ── Task Dialog ── */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask ? "Edit Task" : "New Task"}</DialogTitle>
            <DialogDescription>
              {editTask ? "Update this service task." : `Create a task for ${customer?.name}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. AC filter replacement" />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Textarea value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} placeholder="Additional details..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={taskForm.status} onValueChange={(v) => setTaskForm((f) => ({ ...f, status: v as Task["status"] }))}>
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
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v as Task["priority"] }))}>
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
              <Label>Due Date <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)} disabled={savingTask}>Cancel</Button>
            <Button onClick={handleTaskSave} disabled={savingTask}>{savingTask ? "Saving…" : editTask ? "Save Changes" : "Create Task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Task Delete Confirm ── */}
      <AlertDialog open={!!taskDeleteId} onOpenChange={(open) => !open && setTaskDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this task. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTaskDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update the details for {customer.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Numbers <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <div className="space-y-2">
                {form.phones.map((ph, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={ph}
                      onChange={(e) => {
                        const updated = [...form.phones];
                        updated[i] = e.target.value;
                        setForm((f) => ({ ...f, phones: updated }));
                      }}
                      placeholder="+971 50 000 0000"
                    />
                    {form.phones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, phones: f.phones.filter((_, j) => j !== i) }))}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, phones: [...f.phones, ""] }))}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another number
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Area <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="Jumeirah, JLT…" />
              </div>
              <div className="space-y-1.5">
                <Label>City <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Dubai, Abu Dhabi…" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Full Address <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Building, Street, Area, City" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
