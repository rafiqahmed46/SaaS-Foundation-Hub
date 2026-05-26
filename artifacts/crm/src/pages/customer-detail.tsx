import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCustomer, updateCustomer, getInvoices, getQuotations,
  getCustomerVisits, addCustomerVisit,
  Customer, Invoice, Quotation, Settings, CustomerVisit, getSettings,
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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Phone, MessageCircle, MapPin, Mail, FileText,
  FileCheck, Pencil, TrendingUp, Receipt, ClipboardList, Navigation,
} from "lucide-react";
import { getCurrencySymbol, fmtDate } from "@/lib/utils-crm";
import CustomerMap from "@/components/CustomerMap";

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

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !user?.companyId) return;
    async function load() {
      try {
        const [cust, invs, quots, sett, vis] = await Promise.all([
          getCustomer(id!),
          getInvoices(user!.companyId!),
          getQuotations(user!.companyId!),
          getSettings(user!.companyId!),
          getCustomerVisits(id!),
        ]);
        setCustomer(cust);
        setInvoices(invs.filter((i) => i.customerId === id));
        setQuotations(quots.filter((q) => q.customerId === id));
        setSettings(sett);
        setVisits(vis);
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
    setForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
      address: customer.address || "",
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
      await updateCustomer(customer.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setCustomer((prev) =>
        prev
          ? { ...prev, ...form, phone: form.phone || undefined, address: form.address || undefined, notes: form.notes || undefined }
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
              {customer.phone && (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0 text-primary/60" />
                  <a href={`tel:${customer.phone}`} className="hover:underline hover:text-foreground">{customer.phone}</a>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-2.5 text-muted-foreground sm:col-span-2">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-primary/60" />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="hover:underline hover:text-foreground"
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
              {customer.phone && (
                <a
                  href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              )}
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              )}
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
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+971 50 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Dubai, UAE" />
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
