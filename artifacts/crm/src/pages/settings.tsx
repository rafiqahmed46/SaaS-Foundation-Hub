import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSettings, saveSettings, Settings,
  getTeamInvites, addTeamInvite, deleteTeamInvite, TeamInvite, TeamRole,
  DEFAULT_PERMISSIONS, RolePermissions, ModuleKey, RoleKey,
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building2, Save, Percent, Tag, Globe, CreditCard, Upload, X, ShieldCheck, Users, Mail, Trash2, Clock, CheckCircle2, Plus, Zap } from "lucide-react";

const CURRENCIES = [
  { value: "AED", label: "AED — UAE Dirham (AED)" },
  { value: "SAR", label: "SAR — Saudi Riyal (SAR)" },
  { value: "QAR", label: "QAR — Qatari Riyal (QAR)" },
  { value: "KWD", label: "KWD — Kuwaiti Dinar (KWD)" },
  { value: "BHD", label: "BHD — Bahraini Dinar (BHD)" },
  { value: "OMR", label: "OMR — Omani Rial (OMR)" },
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
  { value: "PKR", label: "PKR — Pakistani Rupee (₨)" },
  { value: "EGP", label: "EGP — Egyptian Pound (E£)" },
];

const DEFAULT_SETTINGS: Partial<Settings> = {
  companyName: "",
  companyLogo: "",
  currency: "AED",
  invoicePrefix: "INV-",
  quotationPrefix: "QT-",
  taxEnabled: true,
  taxRate: 5,
  taxLabel: "VAT",
  trn: "",
  discountEnabled: false,
  address: "",
  phone: "",
  email: "",
  website: "",
  bankName: "",
  bankAccount: "",
  bankIban: "",
  paymentTerms: "",
  invoiceFooter: "",
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Partial<Settings>>(DEFAULT_SETTINGS);
  const [rolePerms, setRolePerms] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Team management
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("technician");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [deleteInviteId, setDeleteInviteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;
    async function load() {
      try {
        const [sett, inv] = await Promise.all([
          getSettings(user!.companyId!),
          getTeamInvites(user!.companyId!),
        ]);
        setSettings(sett || DEFAULT_SETTINGS);
        if (sett?.rolePermissions) setRolePerms(sett.rolePermissions);
        setInvites(inv);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.companyId]);

  async function handleSendInvite() {
    if (!user?.companyId) return;
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast({ title: "Enter a valid email address", variant: "destructive" }); return;
    }
    setSendingInvite(true);
    try {
      await addTeamInvite({ companyId: user.companyId, email: inviteEmail.trim().toLowerCase(), role: inviteRole, status: "pending", invitedBy: user.uid || "" });
      toast({ title: "Invite created", description: "Share the login link with your team member." });
      setInviteEmail("");
      const updated = await getTeamInvites(user.companyId);
      setInvites(updated);
    } catch { toast({ title: "Could not create invite", variant: "destructive" }); }
    finally { setSendingInvite(false); }
  }

  async function handleDeleteInvite() {
    if (!deleteInviteId || !user?.companyId) return;
    try {
      await deleteTeamInvite(deleteInviteId);
      setDeleteInviteId(null);
      const updated = await getTeamInvites(user.companyId);
      setInvites(updated);
      toast({ title: "Invite removed" });
    } catch { toast({ title: "Could not remove invite", variant: "destructive" }); }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function resizeImage(dataUrl: string, maxW: number, maxH: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = dataUrl;
    });
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please choose an image under 2 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      let dataUrl = ev.target?.result as string;
      if (file.size > 300 * 1024) dataUrl = await resizeImage(dataUrl, 500, 250);
      update("companyLogo", dataUrl as Settings["companyLogo"]);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!user?.companyId) {
      toast({ title: "Setup incomplete", description: "Your company workspace isn't ready yet. Use the setup banner above.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveSettings(user.companyId, { ...settings, rolePermissions: rolePerms } as Settings);
      toast({ title: "Settings saved" });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "permission-denied") {
        toast({ title: "Permission denied", description: "Fix Firestore rules in Firebase Console.", variant: "destructive" });
      } else {
        toast({ title: "Could not save settings", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your company profile, invoice preferences, and more</p>
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
              <CardDescription>This information appears on your invoices, quotations, and receipts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-company-name">Company Name</Label>
                  <Input id="s-company-name" value={settings.companyName || ""} onChange={(e) => update("companyName", e.target.value)} placeholder="Your Company LLC" data-testid="input-company-name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-trn">TRN <span className="text-xs text-muted-foreground font-normal">(Tax Registration No.)</span></Label>
                  <Input id="s-trn" value={settings.trn || ""} onChange={(e) => update("trn", e.target.value)} placeholder="100-123456-7-000" data-testid="input-trn" />
                  <p className="text-xs text-muted-foreground">UAE VAT / Tax Registration Number — printed on invoices.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-email">Business Email</Label>
                  <Input id="s-email" type="email" value={settings.email || ""} onChange={(e) => update("email", e.target.value)} placeholder="info@company.ae" data-testid="input-business-email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-phone">Phone</Label>
                  <Input id="s-phone" value={settings.phone || ""} onChange={(e) => update("phone", e.target.value)} placeholder="+971 50 000 0000" data-testid="input-business-phone" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-website">Website</Label>
                  <Input id="s-website" value={settings.website || ""} onChange={(e) => update("website", e.target.value)} placeholder="https://company.ae" data-testid="input-website" />
                </div>
                <div className="space-y-1.5">
                  <Label>Company Logo</Label>
                  {settings.companyLogo ? (
                    <div className="flex items-center gap-3">
                      <img src={settings.companyLogo} alt="logo" className="h-16 w-auto max-w-[160px] object-contain rounded border bg-white p-1" />
                      <Button type="button" variant="outline" size="sm" onClick={() => update("companyLogo", "" as Settings["companyLogo"])}>
                        <X className="w-4 h-4 mr-1" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors" data-testid="input-logo-upload">
                      <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Tap to choose from gallery or files</span>
                      <span className="text-xs text-muted-foreground mt-0.5">PNG, JPG — max 2 MB</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-address">Company Address</Label>
                <Input id="s-address" value={settings.address || ""} onChange={(e) => update("address", e.target.value)} placeholder="Building, Street, Area, Dubai, UAE" data-testid="input-address" />
              </div>
            </CardContent>
          </Card>

          {/* Invoice Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Invoice & Quotation Settings</CardTitle>
              </div>
              <CardDescription>Configure numbering, currency, and formatting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-prefix">Invoice Prefix</Label>
                  <Input id="s-prefix" value={settings.invoicePrefix || "INV-"} onChange={(e) => update("invoicePrefix", e.target.value)} placeholder="INV-" data-testid="input-invoice-prefix" />
                  <p className="text-xs text-muted-foreground">e.g. INV-0001</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-qt-prefix">Quotation Prefix</Label>
                  <Input id="s-qt-prefix" value={settings.quotationPrefix || "QT-"} onChange={(e) => update("quotationPrefix", e.target.value)} placeholder="QT-" data-testid="input-quotation-prefix" />
                  <p className="text-xs text-muted-foreground">e.g. QT-0001</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={settings.currency || "AED"} onValueChange={(v) => update("currency", v)}>
                    <SelectTrigger data-testid="select-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-footer">Invoice Footer Text <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea id="s-footer" value={settings.invoiceFooter || ""} onChange={(e) => update("invoiceFooter", e.target.value)} placeholder="Thank you for your business! Payment terms: 30 days." rows={2} data-testid="input-invoice-footer" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-payment-terms">Default Payment Terms <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="s-payment-terms" value={settings.paymentTerms || ""} onChange={(e) => update("paymentTerms", e.target.value)} placeholder="e.g. Net 30 days, Payment due upon receipt" data-testid="input-payment-terms" />
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
              <CardDescription>Configure VAT/tax settings for UAE compliance. These are defaults — you can override per invoice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Tax */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                <div>
                  <p className="font-medium text-sm">Tax / VAT</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Apply tax to invoice subtotals (UAE VAT is 5%)</p>
                </div>
                <Switch checked={settings.taxEnabled || false} onCheckedChange={(v) => update("taxEnabled", v)} data-testid="switch-tax-enabled" />
              </div>
              {settings.taxEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-tax-label">Tax Label</Label>
                    <Input id="s-tax-label" value={settings.taxLabel || "VAT"} onChange={(e) => update("taxLabel", e.target.value)} placeholder="VAT" data-testid="input-tax-label" />
                    <p className="text-xs text-muted-foreground">e.g. VAT, GST, Tax</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-tax-rate">Default Rate (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input id="s-tax-rate" type="number" min={0} max={100} step="0.1" value={settings.taxRate ?? 5} onChange={(e) => update("taxRate", parseFloat(e.target.value) || 0)} className="w-24" data-testid="input-tax-rate" />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Can be changed per invoice.</p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Discount */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                <div>
                  <p className="font-medium text-sm">Discount</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow discounts (% or fixed) on invoices</p>
                </div>
                <Switch checked={settings.discountEnabled || false} onCheckedChange={(v) => update("discountEnabled", v)} data-testid="switch-discount-enabled" />
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Bank Details</CardTitle>
              </div>
              <CardDescription>Printed on invoices to help customers make payments. All optional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-bank-name">Bank Name</Label>
                  <Input id="s-bank-name" value={settings.bankName || ""} onChange={(e) => update("bankName", e.target.value)} placeholder="Emirates NBD" data-testid="input-bank-name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-bank-account">Account Number</Label>
                  <Input id="s-bank-account" value={settings.bankAccount || ""} onChange={(e) => update("bankAccount", e.target.value)} placeholder="1234567890" data-testid="input-bank-account" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-bank-iban">IBAN</Label>
                <Input id="s-bank-iban" value={settings.bankIban || ""} onChange={(e) => update("bankIban", e.target.value)} placeholder="AE070331234567890123456" data-testid="input-bank-iban" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-payment-link">Online Payment Link <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="s-payment-link"
                  value={settings.paymentLink || ""}
                  onChange={(e) => update("paymentLink", e.target.value)}
                  placeholder="https://paypal.me/yourname  or any payment URL"
                  data-testid="input-payment-link"
                />
                <p className="text-xs text-muted-foreground">When set, a "Pay Now" button appears on your client portal. Works with PayPal.me, Tap, Telr, or any payment page link.</p>
              </div>
            </CardContent>
          </Card>

          {/* Team Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Team Management</CardTitle>
              </div>
              <CardDescription>Invite team members by email. They sign up and are linked to your company.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Invite form */}
              <div className="rounded-lg border p-4 bg-muted/20">
                <p className="text-sm font-medium mb-3">Invite a Team Member</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="colleague@company.ae"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="pl-9"
                      data-testid="input-invite-email"
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendInvite(); }}
                    />
                  </div>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                    <SelectTrigger className="w-36" data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleSendInvite} disabled={sendingInvite} className="gap-2 shrink-0" data-testid="button-send-invite">
                    <Plus className="w-4 h-4" /> {sendingInvite ? "Saving..." : "Add Invite"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">After adding, share your app link. The team member signs up and is auto-linked when their email matches a pending invite.</p>
              </div>

              {/* Invite list */}
              {invites.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
                  No team invites yet. Add your first team member above.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Role</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {invites.map((inv) => (
                        <tr key={inv.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{inv.email}</td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">{inv.role}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {inv.status === "accepted" ? (
                              <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setDeleteInviteId(inv.id)}
                              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              data-testid={`button-delete-invite-${inv.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Roles & Permissions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Roles & Permissions</CardTitle>
              </div>
              <CardDescription>Control which modules each role can access. Owners always have full access.</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const roles: { key: RoleKey; label: string }[] = [
                  { key: "admin",      label: "Admin"      },
                  { key: "manager",    label: "Manager"    },
                  { key: "technician", label: "Technician" },
                  { key: "viewer",     label: "Viewer"     },
                ];
                const modules: { key: ModuleKey; label: string }[] = [
                  { key: "dashboard",    label: "Dashboard"    },
                  { key: "customers",    label: "Customers"    },
                  { key: "quotations",   label: "Quotations"   },
                  { key: "invoices",     label: "Invoices"     },
                  { key: "finance",      label: "Finance"      },
                  { key: "tasks",        label: "Tasks"        },
                  { key: "work-orders",  label: "Work Orders"  },
                  { key: "assets",       label: "Assets"       },
                  { key: "contracts",    label: "Contracts"    },
                  { key: "reports",      label: "Reports"      },
                  { key: "calendar",     label: "Calendar"     },
                  { key: "technicians",  label: "Technicians"  },
                  { key: "settings",     label: "Settings"     },
                ];
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-36">Module</th>
                          {roles.map((r) => <th key={r.key} className="text-center py-2 px-3 font-medium text-muted-foreground">{r.label}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {modules.map((mod) => (
                          <tr key={mod.key} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 pr-4 font-medium">{mod.label}</td>
                            {roles.map((role) => (
                              <td key={role.key} className="py-2.5 px-3 text-center">
                                <Switch
                                  checked={rolePerms[role.key]?.[mod.key] ?? DEFAULT_PERMISSIONS[role.key][mod.key] ?? false}
                                  onCheckedChange={(v) => setRolePerms((prev) => ({
                                    ...prev,
                                    [role.key]: { ...prev[role.key], [mod.key]: v },
                                  }))}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Regional */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Regional</CardTitle>
              </div>
              <CardDescription>Regional formatting preferences.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Date format: <span className="font-medium text-foreground">DD/MM/YYYY</span> (UAE standard — applied to all invoices and PDFs)</p>
            </CardContent>
          </Card>

          {/* Subscription / Billing */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Subscription & Billing</CardTitle>
              </div>
              <CardDescription>Manage your ClearCRM subscription plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-dashed border-blue-300 bg-blue-50 p-4">
                <div>
                  <p className="font-medium text-blue-900">Free Trial</p>
                  <p className="text-sm text-blue-700 mt-0.5">You are currently on the free trial. Upgrade to keep full access.</p>
                </div>
                <a href="/pricing">
                  <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                    <Zap className="w-4 h-4" /> View Plans
                  </button>
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                All plans include a 14-day free trial. No credit card required to start.
              </p>
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

      {/* Delete invite dialog */}
      <AlertDialog open={!!deleteInviteId} onOpenChange={(open) => !open && setDeleteInviteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Invite</AlertDialogTitle>
            <AlertDialogDescription>This will remove the team invite. The team member will lose access if they haven't signed up yet.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvite} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
