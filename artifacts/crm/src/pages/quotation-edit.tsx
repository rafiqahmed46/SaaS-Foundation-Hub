import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getQuotation, getCustomers, getSettings, updateQuotation, Customer, Settings } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { getCurrencySymbol } from "@/lib/utils-crm";

interface LineItem { description: string; quantity: number; unitPrice: number; }

export default function QuotationEditPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [, params] = useRoute("/quotations/:id/edit");
  const id = params?.id;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("draft");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(5);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);

  useEffect(() => {
    if (!user?.companyId || !id) return;
    async function load() {
      try {
        const [quot, custs, sett] = await Promise.all([
          getQuotation(id!),
          getCustomers(user!.companyId!),
          getSettings(user!.companyId!),
        ]);
        setCustomers(custs);
        setSettings(sett);
        if (!quot) { toast({ title: "Quotation not found", variant: "destructive" }); navigate("/quotations"); return; }
        setQuoteNumber(quot.quoteNumber);
        setCustomerId(quot.customerId);
        setStatus(quot.status);
        setValidUntil(quot.validUntil || "");
        setNotes(quot.notes || "");
        setItems(quot.items.length > 0 ? quot.items : [{ description: "", quantity: 1, unitPrice: 0 }]);
        setTaxEnabled(quot.taxEnabled);
        setTaxRate(quot.taxRate ?? sett?.taxRate ?? 5);
        setDiscountEnabled(quot.discountEnabled);
        setDiscountType(quot.discountType || "percent");
        setDiscountValue(quot.discountValue || 0);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.companyId, id]);

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
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
    if (!id || !customerId) {
      toast({ title: "Please select a customer", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const selectedCustomer = customers.find((c) => c.id === customerId);
      await updateQuotation(id, {
        customerId,
        customerName: selectedCustomer?.name || "",
        status: status as "draft" | "sent" | "accepted" | "declined" | "expired",
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
        currency,
        notes: notes.trim() || undefined,
        validUntil: validUntil || undefined,
      });
      toast({ title: "Quotation updated", description: `${quoteNumber} has been saved.` });
      navigate(`/quotations/${id}`);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      toast({ title: "Could not update quotation", description: msg || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <Layout>
      <div className="p-6 flex items-center justify-center min-h-96">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(`/quotations/${id}`)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Quotation</h1>
            <p className="text-sm text-muted-foreground font-mono">{quoteNumber}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Quote Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Customer *</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Valid Until <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Line Items</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, { description: "", quantity: 1, unitPrice: 0 }])} className="gap-1.5">
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
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 sm:col-span-5">
                      <Input placeholder="Description" value={item.description} onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))} />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input type="number" min={0} step="0.01" value={item.quantity} onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, quantity: parseFloat(e.target.value) || 0 } : it))} />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Input type="number" min={0} step="0.01" placeholder="0.00" value={item.unitPrice} onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, unitPrice: parseFloat(e.target.value) || 0 } : it))} />
                    </div>
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1">
                      <span className="text-sm font-medium hidden sm:block text-right w-full">{currSymbol} {(item.quantity * item.unitPrice).toFixed(2)}</span>
                      {items.length > 1 && (
                        <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Notes <span className="text-xs text-muted-foreground font-normal">(optional)</span></CardTitle></CardHeader>
              <CardContent>
                <Textarea placeholder="Optional notes for the customer..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-6">
              <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{currSymbol} {subtotal.toFixed(2)}</span>
                  </div>
                  {settings?.taxEnabled && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{taxLabel} {taxEnabled && taxRate ? `(${taxRate}%)` : ""}</span>
                        <div onClick={() => setTaxEnabled(!taxEnabled)} className={`w-8 h-4 rounded-full cursor-pointer relative transition-colors ${taxEnabled ? "bg-primary" : "bg-muted"}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${taxEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                      </div>
                      {taxEnabled && <div className="flex justify-between text-muted-foreground mt-1"><span className="pl-2 text-xs">Amount</span><span>{currSymbol} {taxAmount.toFixed(2)}</span></div>}
                    </div>
                  )}
                  {settings?.discountEnabled && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Discount</span>
                        <div onClick={() => setDiscountEnabled(!discountEnabled)} className={`w-8 h-4 rounded-full cursor-pointer relative transition-colors ${discountEnabled ? "bg-primary" : "bg-muted"}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${discountEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                      </div>
                      {discountEnabled && (
                        <div className="flex gap-2 mt-1">
                          <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="percent">%</SelectItem><SelectItem value="fixed">Fixed</SelectItem></SelectContent>
                          </Select>
                          <Input type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                        </div>
                      )}
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total ({currency})</span>
                    <span>{currSymbol} {total.toFixed(2)}</span>
                  </div>
                </div>
                <Button className="w-full" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate(`/quotations/${id}`)} disabled={saving}>
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
