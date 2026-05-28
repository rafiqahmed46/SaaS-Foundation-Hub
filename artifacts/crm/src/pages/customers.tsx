import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getCustomers, addCustomer, updateCustomer, deleteCustomer, Customer, getCustomerPhones } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Plus, Search, Pencil, Trash2, MapPin, Users, ExternalLink, X } from "lucide-react";
import PhoneActionButtons from "@/components/PhoneActionButtons";

type SortKey = "name-asc" | "name-desc" | "newest" | "oldest";

type FormData = {
  name: string;
  email: string;
  phones: string[];
  address: string;
  area: string;
  city: string;
  notes: string;
};

const emptyForm: FormData = { name: "", email: "", phones: [""], address: "", area: "", city: "", notes: "" };

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function CustomersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: boolean; email?: boolean }>({});
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  async function loadCustomers() {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      const data = await getCustomers(user.companyId);
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCustomers(); }, [user?.companyId]);

  function openAdd() {
    setEditCustomer(null);
    setForm(emptyForm);
    setFieldErrors({});
    setDialogOpen(true);
  }

  function openEdit(c: Customer) {
    setEditCustomer(c);
    const phones = getCustomerPhones(c);
    setForm({ name: c.name, email: c.email, phones: phones.length ? phones : [""], address: c.address || "", area: c.area || "", city: c.city || "", notes: c.notes || "" });
    setFieldErrors({});
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!user?.companyId) {
      toast({ title: "Setup incomplete", description: "Your company workspace isn't ready yet. Use the setup banner above.", variant: "destructive" });
      return;
    }
    const errs = { name: !form.name.trim(), email: !form.email.trim() };
    if (errs.name || errs.email) {
      setFieldErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const cleanPhones = form.phones.map((p) => p.trim()).filter(Boolean);
      const primaryPhone = cleanPhones[0] || undefined;
      if (editCustomer) {
        await updateCustomer(editCustomer.id, {
          name: form.name.trim(), email: form.email.trim(),
          phones: cleanPhones.length ? cleanPhones : undefined,
          phone: primaryPhone,
          address: form.address.trim(), area: form.area.trim() || undefined, city: form.city.trim() || undefined, notes: form.notes.trim(),
        });
        toast({ title: "Customer updated" });
      } else {
        await addCustomer({
          companyId: user.companyId, name: form.name.trim(), email: form.email.trim(),
          phones: cleanPhones.length ? cleanPhones : undefined,
          phone: primaryPhone,
          address: form.address.trim() || undefined, area: form.area.trim() || undefined, city: form.city.trim() || undefined, notes: form.notes.trim() || undefined,
        });
        toast({ title: "Customer added" });
      }
      setDialogOpen(false);
      loadCustomers();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const msg = (err as { message?: string })?.message;
      if (code === "permission-denied") {
        toast({ title: "Permission denied", description: "Firestore rules are blocking writes. Fix your rules in Firebase Console and click Retry in the banner.", variant: "destructive" });
      } else {
        toast({ title: "Could not save customer", description: msg || "An unexpected error occurred.", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteCustomer(deleteId);
      toast({ title: "Customer deleted" });
      setDeleteId(null);
      loadCustomers();
    } catch {
      toast({ title: "Error", description: "Could not delete customer.", variant: "destructive" });
    }
  }

  const filtered = customers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        getCustomerPhones(c).some((p) => p.includes(search)) ||
        (c.area ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.city ?? "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortKey === "name-asc") return a.name.localeCompare(b.name);
      if (sortKey === "name-desc") return b.name.localeCompare(a.name);
      if (sortKey === "oldest") return (a.createdAt || "").localeCompare(b.createdAt || "");
      return (b.createdAt || "").localeCompare(a.createdAt || ""); // newest
    });

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {customers.length} {customers.length === 1 ? "customer" : "customers"} total
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2 shrink-0" data-testid="button-add-customer">
            <Plus className="w-4 h-4" />
            Add Customer
          </Button>
        </div>

        <div className="flex gap-2 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-customer"
            />
          </div>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-40 shrink-0 gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name-asc">Name A → Z</SelectItem>
              <SelectItem value="name-desc">Name Z → A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-4 flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold">{search ? "No customers found" : "No customers yet"}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search term." : "Add your first customer to get started."}
            </p>
            {!search && (
              <Button onClick={openAdd} className="mt-4 gap-2" variant="outline">
                <Plus className="w-4 h-4" /> Add Customer
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Address</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-customer-${c.id}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/customers/${c.id}`)}
                          className="flex items-center gap-3 text-left group"
                        >
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">{c.name[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium group-hover:text-primary transition-colors flex items-center gap-1">
                              {c.name}
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </p>
                            <p className="text-xs text-muted-foreground md:hidden">{c.email}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.email}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {(() => {
                          const ph = getCustomerPhones(c);
                          if (!ph.length) return "—";
                          return (
                            <span className="flex items-center gap-1.5">
                              {ph[0]}
                              {ph.length > 1 && (
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">+{ph.length - 1}</span>
                              )}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground max-w-xs truncate">
                        {[c.area, c.city].filter(Boolean).join(", ") || c.address || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <PhoneActionButtons phones={getCustomerPhones(c)} variant="icon" />
                          {c.address && (
                            <a
                              href={mapsUrl(c.address)}
                              target="_blank" rel="noopener noreferrer"
                              title="View on Google Maps"
                              className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 transition-colors"
                              data-testid={`button-maps-${c.id}`}
                            >
                              <MapPin className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            data-testid={`button-edit-customer-${c.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(c.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            data-testid={`button-delete-customer-${c.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
            <DialogDescription>
              {editCustomer ? "Update customer details below." : "Fill in the details for the new customer."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="c-name" className={fieldErrors.name ? "text-destructive" : ""}>
                Name <span className={fieldErrors.name ? "text-destructive font-medium" : "text-muted-foreground font-normal text-xs"}>*</span>
              </Label>
              <Input
                id="c-name" value={form.name} placeholder="Jane Smith"
                data-testid="input-customer-name"
                className={fieldErrors.name ? "border-red-500 ring-2 ring-red-400/50 focus-visible:ring-red-500" : ""}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); if (fieldErrors.name) setFieldErrors((fe) => ({ ...fe, name: false })); }}
              />
              {fieldErrors.name && <p className="text-xs text-red-500 font-medium">Name is required</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email" className={fieldErrors.email ? "text-destructive" : ""}>
                Email <span className={fieldErrors.email ? "text-destructive font-medium" : "text-muted-foreground font-normal text-xs"}>*</span>
              </Label>
              <Input
                id="c-email" type="email" value={form.email} placeholder="jane@example.com"
                data-testid="input-customer-email"
                className={fieldErrors.email ? "border-red-500 ring-2 ring-red-400/50 focus-visible:ring-red-500" : ""}
                onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); if (fieldErrors.email) setFieldErrors((fe) => ({ ...fe, email: false })); }}
              />
              {fieldErrors.email && <p className="text-xs text-red-500 font-medium">Email is required</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Phone Numbers <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              </div>
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
                      data-testid={i === 0 ? "input-customer-phone" : undefined}
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
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium mt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another number
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-area">Area <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input id="c-area" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="Jumeirah, JLT…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-city">City <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input id="c-city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Dubai, Abu Dhabi…" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-address">Full Address <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input id="c-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Building, Street, Area, City" data-testid="input-customer-address" />
              {form.address && (
                <a href={mapsUrl(form.address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-orange-500 hover:underline">
                  <MapPin className="w-3 h-3" /> Preview on Google Maps
                </a>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-notes">Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Textarea id="c-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes about this customer..." rows={3} data-testid="input-customer-notes" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-customer">
              {saving ? "Saving..." : editCustomer ? "Save Changes" : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this customer. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" data-testid="button-confirm-delete-customer">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
