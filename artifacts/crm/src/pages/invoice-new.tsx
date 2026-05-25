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
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

const CURRENCIES: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "C$", AUD: "A$", INR: "₹", BRL: "R$",
};

function getCurrencySymbol(currency: string) {
  return CURRENCIES[currency] || currency;
}

export default function InvoiceNewPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("draft");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);

  useEffect(() => {
    if (!user?.companyId) return;
    async function load() {
      const [custs, sett] = await Promise.all([
        getCustomers(user!.companyId!),
        getSettings(user!.companyId!),
      ]);
      setCustomers(custs);
      setSettings(sett);
      if (sett) {
        setTaxEnabled(sett.taxEnabled);
        setDiscountEnabled(sett.discountEnabled);
      }
      setLoading(false);
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
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxRate = settings?.taxRate || 0;
  const taxAmount = taxEnabled ? (subtotal * taxRate) / 100 : 0;
  const afterTax = subtotal + taxAmount;
  const discountAmount = discountEnabled
    ? discountType === "percent"
      ? (afterTax * discountValue) / 100
      : discountValue
    : 0;
  const total = Math.max(0, afterTax - discountAmount);

  const currSymbol = getCurrencySymbol(settings?.currency || "USD");

  async function handleSave() {
    if (!user?.companyId) {
      toast({ title: "Setup incomplete", description: "Your company workspace isn't ready yet. Use the setup banner above.", variant: "destructive" });
      return;
    }
    if (!customerId) {
      toast({ title: "Select a customer", variant: "destructive" });
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      toast({ title: "Fill in all item descriptions", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const selectedCustomer = customers.find((c) => c.id === customerId);
      const invoiceNumber = await getNextInvoiceNumber(user.companyId, settings?.invoicePrefix || "INV-");
      await addInvoice({
        companyId: user.companyId,
        customerId,
        customerName: selectedCustomer?.name || "",
        invoiceNumber,
        status: status as Invoice["status"],
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
      });
      toast({ title: "Invoice created" });
      navigate("/invoices");
    } catch {
      toast({ title: "Error", description: "Could not create invoice.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
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
            <p className="text-sm text-muted-foreground">Fill in the details below</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Main form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer + Status */}
            <Card>
              <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Customer *</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger data-testid="select-customer">
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due-date">Due Date</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    data-testid="input-due-date"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Line Items</CardTitle>
                  <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5" data-testid="button-add-item">
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Header row */}
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span className="col-span-5">Description</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-3 text-right">Unit Price</span>
                  <span className="col-span-2 text-right">Total</span>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center" data-testid={`row-item-${idx}`}>
                    <div className="col-span-12 sm:col-span-5">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        data-testid={`input-item-description-${idx}`}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                        data-testid={`input-item-qty-${idx}`}
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={`${currSymbol}0.00`}
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        data-testid={`input-item-price-${idx}`}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-1">
                      <span className="text-sm font-medium hidden sm:block text-right w-full">
                        {currSymbol}{(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                          data-testid={`button-remove-item-${idx}`}
                        >
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
              <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Optional notes to include on the invoice..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  data-testid="input-invoice-notes"
                />
              </CardContent>
            </Card>
          </div>

          {/* Right: Summary */}
          <div className="space-y-4">
            <Card className="sticky top-6">
              <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{currSymbol}{subtotal.toFixed(2)}</span>
                  </div>

                  {/* Tax */}
                  {settings?.taxEnabled !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">
                          Tax {taxEnabled && taxRate ? `(${taxRate}%)` : ""}
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-xs text-muted-foreground">{taxEnabled ? "On" : "Off"}</span>
                          <div
                            role="checkbox"
                            aria-checked={taxEnabled}
                            onClick={() => setTaxEnabled(!taxEnabled)}
                            className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${taxEnabled ? "bg-primary" : "bg-muted"} relative`}
                            data-testid="toggle-tax"
                          >
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${taxEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                          </div>
                        </label>
                      </div>
                      {taxEnabled && (
                        <div className="flex justify-between text-muted-foreground">
                          <span className="pl-2 text-xs">Amount</span>
                          <span>{currSymbol}{taxAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Discount */}
                  {settings?.discountEnabled !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">Discount</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-xs text-muted-foreground">{discountEnabled ? "On" : "Off"}</span>
                          <div
                            role="checkbox"
                            aria-checked={discountEnabled}
                            onClick={() => setDiscountEnabled(!discountEnabled)}
                            className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${discountEnabled ? "bg-primary" : "bg-muted"} relative`}
                            data-testid="toggle-discount"
                          >
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${discountEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                          </div>
                        </label>
                      </div>
                      {discountEnabled && (
                        <div className="flex gap-2 mt-1">
                          <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                            <SelectTrigger className="w-24 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent">%</SelectItem>
                              <SelectItem value="fixed">Fixed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs"
                            data-testid="input-discount-value"
                          />
                        </div>
                      )}
                      {discountEnabled && discountAmount > 0 && (
                        <div className="flex justify-between text-muted-foreground mt-1">
                          <span className="pl-2 text-xs">Amount off</span>
                          <span>-{currSymbol}{discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>{currSymbol}{total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={saving}
                  data-testid="button-save-invoice"
                >
                  {saving ? "Creating..." : "Create Invoice"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/invoices")}
                  disabled={saving}
                >
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

// needed for type
type Invoice = { status: "draft" | "sent" | "paid" | "overdue" | "cancelled" };
