import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getCustomers, getSettings, addQuotation, getNextQuoteNumber, Customer, Settings } from "@/lib/firestore";
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

export default function QuotationNewPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const preselectedCustomerId = new URLSearchParams(window.location.search).get("customerId") || "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("draft");
  const [errors, setErrors] = useState<{ customer?: boolean; items?: boolean[] }>({});
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);

  useEffect(() => {
    if (!user?.companyId) return;
    async function load() {
      const [custs, sett] = await Promise.all([getCustomers(user!.companyId!), getSettings(user!.companyId!)]);
      setCustomers(custs);
      setSettings(sett);
      if (sett) { setTaxEnabled(sett.taxEnabled); setDiscountEnabled(sett.discountEnabled); }
      if (preselectedCustomerId && custs.find((c) => c.id === preselectedCustomerId)) {
        setCustomerId(preselectedCustomerId);
      }
      setLoading(false);
    }
    load();
  }, [user?.companyId]);

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxRate = settings?.taxRate || 0;
  const taxAmount = taxEnabled ? (subtotal * taxRate) / 100 : 0;
  const afterTax = subtotal + taxAmount;
  const discountAmount = discountEnabled ? (discountType === "percent" ? (afterTax * discountValue) / 100 : discountValue) : 0;
  const total = Math.max(0, afterTax - discountAmount);
  const currSymbol = getCurrencySymbol(settings?.currency || "AED");

  async function handleSave() {
    if (!user?.companyId) {
      toast({ title: "Setup incomplete", description: "Your company workspace isn't ready yet. Use the setup banner above.", variant: "destructive" });
      return;
    }
    const newItemErrors = items.map((i) => !i.description.trim());
    const hasErrors = !customerId || newItemErrors.some(Boolean);
    if (hasErrors) {
      setErrors({ customer: !customerId, items: newItemErrors });
      return;
    }
    setSaving(true);
    try {
      const selectedCustomer = customers.find((c) => c.id === customerId);
      const quoteNumber = await getNextQuoteNumber(user.companyId, settings?.invoicePrefix || "");
      await addQuotation({
        companyId: user.companyId,
        customerId,
        customerName: selectedCustomer?.name || "",
        quoteNumber,
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
        notes: notes.trim() || undefined,
        validUntil: validUntil || undefined,
      });
      toast({ title: "Quotation created" });
      navigate("/quotations");
    } catch {
      toast({ title: "Error", description: "Could not create quotation.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Layout><div className="p-6 flex items-center justify-center min-h-96"><p className="text-muted-foreground text-sm">Loading...</p></div></Layout>;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/quotations")} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Quotation</h1>
            <p className="text-sm text-muted-foreground">Create a quote to send to your customer</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Quote Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className={errors.customer ? "text-destructive" : ""}>
                      Customer <span className={errors.customer ? "text-destructive font-medium" : ""}>*</span>
                    </Label>
                    <Select value={customerId} onValueChange={(v) => { setCustomerId(v); if (errors.customer) setErrors((e) => ({ ...e, customer: false })); }}>
                      <SelectTrigger className={errors.customer ? "border-destructive ring-1 ring-destructive" : ""}>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.customer && <p className="text-xs text-destructive">Please select a customer</p>}
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
                  <Label>Valid Until</Label>
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
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium px-1">
                  <span className={`col-span-5 ${errors.items?.some(Boolean) ? "text-destructive" : "text-muted-foreground"}`}>
                    Description{errors.items?.some(Boolean) && " — required"}
                  </span>
                  <span className="col-span-2 text-center text-muted-foreground">Qty</span>
                  <span className="col-span-3 text-right text-muted-foreground">Unit Price</span>
                  <span className="col-span-2 text-right text-muted-foreground">Total</span>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className={`grid grid-cols-12 gap-2 items-center rounded-lg ${errors.items?.[idx] ? "bg-destructive/5 ring-1 ring-destructive/30 p-1" : ""}`}>
                    <div className="col-span-12 sm:col-span-5">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        className={errors.items?.[idx] ? "border-destructive focus-visible:ring-destructive placeholder:text-destructive/60" : ""}
                        onChange={(e) => {
                          setItems((p) => p.map((it, i) => i === idx ? { ...it, description: e.target.value } : it));
                          if (errors.items?.[idx] && e.target.value.trim()) {
                            setErrors((er) => ({ ...er, items: er.items?.map((v, i) => i === idx ? false : v) }));
                          }
                        }}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input type="number" min={0.01} step="0.01" value={item.quantity} onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, quantity: parseFloat(e.target.value) || 0 } : it))} />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Input type="number" min={0} step="0.01" placeholder={`${currSymbol}0.00`} value={item.unitPrice} onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, unitPrice: parseFloat(e.target.value) || 0 } : it))} />
                    </div>
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1">
                      <span className="text-sm font-medium hidden sm:block text-right w-full">{currSymbol}{(item.quantity * item.unitPrice).toFixed(2)}</span>
                      {items.length > 1 && <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="p-1 text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{currSymbol}{subtotal.toFixed(2)}</span></div>
                  {settings?.taxEnabled && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tax {taxEnabled && taxRate ? `(${taxRate}%)` : ""}</span>
                        <div onClick={() => setTaxEnabled(!taxEnabled)} className={`w-8 h-4 rounded-full cursor-pointer relative transition-colors ${taxEnabled ? "bg-primary" : "bg-muted"}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${taxEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                      </div>
                      {taxEnabled && <div className="flex justify-between text-muted-foreground mt-1"><span className="pl-2 text-xs">Amount</span><span>{currSymbol}{taxAmount.toFixed(2)}</span></div>}
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
                  <div className="flex justify-between font-bold text-base"><span>Total</span><span>{currSymbol}{total.toFixed(2)}</span></div>
                </div>
                <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? "Creating..." : "Create Quotation"}</Button>
                <Button variant="outline" className="w-full" onClick={() => navigate("/quotations")} disabled={saving}>Cancel</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
