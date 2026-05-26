import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getCustomers, getSettings, addInvoice, getNextInvoiceNumber, Customer, Settings } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { getCurrencySymbol } from "@/lib/utils-crm";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function InvoiceNewPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState("none");
  const [status, setStatus] = useState("draft");
  const [dueDate, setDueDate] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(5);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);

  useEffect(() => {
    if (!user?.companyId) return;
    async function load() {
      try {
        const [custs, sett] = await Promise.all([
          getCustomers(user!.companyId!),
          getSettings(user!.companyId!),
        ]);
        setCustomers(custs);
        setSettings(sett);
        if (sett) {
          setTaxEnabled(sett.taxEnabled);
          setTaxRate(sett.taxRate ?? 5);
          setDiscountEnabled(sett.discountEnabled);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.companyId]);

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = taxEnabled ? (subtotal * taxRate) / 100 : 0;
  const afterTax = subtotal + taxAmount;
  const discountAmount = discountEnabled
    ? discountType === "percent" ? (afterTax * discountValue) / 100 : discountValue
    : 0;
  const total = Math.max(0, afterTax - discountAmount);

  const currency = settings?.currency || "AED";
  const currSymbol = getCurrencySymbol(currency);
  const taxLabel = settings?.taxLabel || "VAT";

  async function handleSave() {
    if (!user?.companyId) {
      toast({ title: "Setup incomplete", description: "Your company workspace isn't ready yet. Use the setup banner above.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const resolvedCustomerId = customerId === "none" ? "" : customerId;
      const selectedCustomer = customers.find((c) => c.id === resolvedCustomerId);
      const invoiceNumber = await getNextInvoiceNumber(user.companyId, settings?.invoicePrefix || "INV-");
      await addInvoice({
        companyId: user.companyId,
        customerId: resolvedCustomerId,
        customerName: selectedCustomer?.name || "",
        invoiceNumber,
        status: status as "draft" | "sent" | "paid" | "overdue" | "cancelled",
        items,
        subtotal,
        taxEnabled,
        taxRate: taxEnabled ? taxRate : undefined,
        taxAmount: taxEnabled ? taxAmount : undefined,
        discountEnabled,
        discountType: discountEnabled ? discountType : undefined,
        discountValue: discountEnabled ? discountValue : undefined,
        discountAmount: discountEnabled ? discountAmount : undefined,
        total,
        notes: notes.trim() || undefined,
        dueDate: dueDate || undefined,
        poNumber: poNumber.trim() || undefined,
      });
      toast({ title: "Invoice created", description: `${invoiceNumber} has been saved.` });
      navigate("/invoices");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const msg = (err as { message?: string })?.message;
      if (code === "permission-denied") {
        toast({ title: "Permission denied", description: "Firestore rules are blocking writes. Fix your rules in Firebase Console.", variant: "destructive" });
      } else {
        toast({ title: "Could not create invoice", description: msg || "An unexpected error occurred.", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading && user?.companyId) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center min-h-96">
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/invoices")} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Invoice</h1>
            <p className="text-sm text-muted-foreground">All fields are optional — save as draft anytime</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left */}
          <div className="lg:col-span-2 space-y-6">
            {/* Invoice Details */}
            <Card>
              <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Customer <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger data-testid="select-customer">
                        <SelectValue placeholder="Select customer..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— No customer —</SelectItem>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="due-date">Due Date <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="input-due-date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="po-number">PO / Reference No. <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="po-number" placeholder="e.g. PO-2024-001" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} data-testid="input-po-number" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Line Items</CardTitle>
                  <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5" data-testid="button-add-item">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span className="col-span-5">Description</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-3 text-right">Unit Price ({currency})</span>
                  <span className="col-span-2 text-right">Total</span>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center" data-testid={`row-item-${idx}`}>
                    <div className="col-span-12 sm:col-span-5">
                      <Input placeholder="Item description (optional)" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} data-testid={`input-item-description-${idx}`} />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input type="number" min={0} step="0.01" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} data-testid={`input-item-qty-${idx}`} />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Input type="number" min={0} step="0.01" placeholder="0.00" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)} data-testid={`input-item-price-${idx}`} />
                    </div>
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1">
                      <span className="text-sm font-medium hidden sm:block text-right w-full">
                        {currSymbol} {(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="p-1 text-muted-foreground hover:text-destructive shrink-0" data-testid={`button-remove-item-${idx}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader><CardTitle className="text-base">Notes <span className="text-xs text-muted-foreground font-normal">(optional)</span></CardTitle></CardHeader>
              <CardContent>
                <Textarea placeholder="Payment terms, bank details, or any other notes to include on the invoice..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} data-testid="input-invoice-notes" />
              </CardContent>
            </Card>
          </div>

          {/* Right: Summary */}
          <div className="space-y-4">
            <Card className="sticky top-6">
              <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{currSymbol} {subtotal.toFixed(2)}</span>
                  </div>

                  {/* Tax */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{taxLabel} {taxEnabled && taxRate ? `(${taxRate}%)` : ""}</span>
                      <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} data-testid="toggle-tax" />
                    </div>
                    {taxEnabled && (
                      <div className="flex items-center gap-2 pl-2">
                        <Input
                          type="number" min={0} max={100} step="0.1"
                          value={taxRate}
                          onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                          className="h-7 w-20 text-xs"
                          data-testid="input-tax-rate"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <span className="text-xs text-muted-foreground ml-auto">{currSymbol} {taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Discount */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <Switch checked={discountEnabled} onCheckedChange={setDiscountEnabled} data-testid="toggle-discount" />
                    </div>
                    {discountEnabled && (
                      <div className="flex gap-2 pl-2">
                        <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                          <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">%</SelectItem>
                            <SelectItem value="fixed">Fixed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="number" min={0} step="0.01" value={discountValue} onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)} className="h-7 text-xs flex-1" data-testid="input-discount-value" />
                        {discountAmount > 0 && <span className="text-xs text-muted-foreground self-center">-{currSymbol} {discountAmount.toFixed(2)}</span>}
                      </div>
                    )}
                  </div>

                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total ({currency})</span>
                    <span>{currSymbol} {total.toFixed(2)}</span>
                  </div>
                </div>

                <Button className="w-full" onClick={handleSave} disabled={saving} data-testid="button-save-invoice">
                  {saving ? "Creating..." : "Create Invoice"}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate("/invoices")} disabled={saving}>
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
