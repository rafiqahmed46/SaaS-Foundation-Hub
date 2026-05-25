import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getSettings, saveSettings, Settings } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Building2, Save, Percent, Tag, Globe } from "lucide-react";

const CURRENCIES = [
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "GBP", label: "GBP — British Pound (£)" },
  { value: "JPY", label: "JPY — Japanese Yen (¥)" },
  { value: "CAD", label: "CAD — Canadian Dollar (C$)" },
  { value: "AUD", label: "AUD — Australian Dollar (A$)" },
  { value: "INR", label: "INR — Indian Rupee (₹)" },
  { value: "BRL", label: "BRL — Brazilian Real (R$)" },
  { value: "MXN", label: "MXN — Mexican Peso (MX$)" },
  { value: "SGD", label: "SGD — Singapore Dollar (S$)" },
  { value: "CHF", label: "CHF — Swiss Franc (CHF)" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.companyId) return;
    async function load() {
      const sett = await getSettings(user!.companyId!);
      setSettings(sett || {
        companyName: "",
        companyLogo: "",
        currency: "USD",
        invoicePrefix: "INV-",
        taxEnabled: false,
        taxRate: 10,
        discountEnabled: false,
        address: "",
        phone: "",
        email: "",
        website: "",
      });
      setLoading(false);
    }
    load();
  }, [user?.companyId]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!user?.companyId) {
      toast({ title: "Setup incomplete", description: "Your company workspace isn't ready yet. Use the setup banner above.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveSettings(user.companyId, settings as Settings);
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your company profile and preferences</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0" data-testid="button-save-settings">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Company Profile */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Company Profile</CardTitle>
              </div>
              <CardDescription>This information appears on your invoices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-company-name">Company Name *</Label>
                  <Input
                    id="s-company-name"
                    value={settings.companyName || ""}
                    onChange={(e) => update("companyName", e.target.value)}
                    placeholder="Acme Inc."
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-email">Business Email</Label>
                  <Input
                    id="s-email"
                    type="email"
                    value={settings.email || ""}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="contact@company.com"
                    data-testid="input-business-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-phone">Phone</Label>
                  <Input
                    id="s-phone"
                    value={settings.phone || ""}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+1 555 000 0000"
                    data-testid="input-business-phone"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-website">Website</Label>
                  <Input
                    id="s-website"
                    value={settings.website || ""}
                    onChange={(e) => update("website", e.target.value)}
                    placeholder="https://company.com"
                    data-testid="input-website"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-address">Address</Label>
                <Input
                  id="s-address"
                  value={settings.address || ""}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="123 Main St, City, State, ZIP"
                  data-testid="input-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-logo">Company Logo URL</Label>
                <Input
                  id="s-logo"
                  value={settings.companyLogo || ""}
                  onChange={(e) => update("companyLogo", e.target.value)}
                  placeholder="https://... (URL to your logo image)"
                  data-testid="input-logo-url"
                />
                <p className="text-xs text-muted-foreground">Provide a URL to your logo image (PNG, JPG, SVG).</p>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Invoice Settings</CardTitle>
              </div>
              <CardDescription>Configure how invoices are numbered and formatted.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-prefix">Invoice Prefix</Label>
                  <Input
                    id="s-prefix"
                    value={settings.invoicePrefix || "INV-"}
                    onChange={(e) => update("invoicePrefix", e.target.value)}
                    placeholder="INV-"
                    data-testid="input-invoice-prefix"
                  />
                  <p className="text-xs text-muted-foreground">e.g. INV-0001, BILL-0001</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={settings.currency || "USD"} onValueChange={(v) => update("currency", v)}>
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax & Discount */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Tax & Discount</CardTitle>
              </div>
              <CardDescription>
                Toggle these on to enable tax and discount fields on invoices. When disabled, these fields are hidden from the invoice form.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Tax */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                <div>
                  <p className="font-medium text-sm">Tax</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Apply a tax percentage to invoice subtotals
                  </p>
                </div>
                <Switch
                  checked={settings.taxEnabled || false}
                  onCheckedChange={(v) => update("taxEnabled", v)}
                  data-testid="switch-tax-enabled"
                />
              </div>
              {settings.taxEnabled && (
                <div className="space-y-1.5 pl-4">
                  <Label htmlFor="s-tax-rate">Default Tax Rate (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="s-tax-rate"
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={settings.taxRate ?? 10}
                      onChange={(e) => update("taxRate", parseFloat(e.target.value) || 0)}
                      className="w-32"
                      data-testid="input-tax-rate"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This rate can be overridden per invoice.
                  </p>
                </div>
              )}

              <Separator />

              {/* Discount */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                <div>
                  <p className="font-medium text-sm">Discount</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Allow discounts (% or fixed amount) on invoices
                  </p>
                </div>
                <Switch
                  checked={settings.discountEnabled || false}
                  onCheckedChange={(v) => update("discountEnabled", v)}
                  data-testid="switch-discount-enabled"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save at bottom on mobile */}
        <div className="mt-6 sm:hidden">
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2" data-testid="button-save-settings-mobile">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
