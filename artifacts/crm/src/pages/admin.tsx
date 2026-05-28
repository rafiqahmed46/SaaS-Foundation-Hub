import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, Users, FileText, UserCheck, Search, LogOut,
  TrendingUp, Calendar, ShieldCheck, Tag, Copy, ExternalLink, Save,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

interface CompanyRow {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  ownerEmail: string;
  ownerName: string;
  userCount: number;
  customerCount: number;
  invoiceCount: number;
}

interface PromoConfig {
  enabled: boolean;
  percentOff: number;
  durationMonths: number;
  message: string;
  expiresAt: string;
}

const DEFAULT_PROMO: PromoConfig = {
  enabled: false,
  percentOff: 50,
  durationMonths: 3,
  message: "Limited time offer — {percent}% off your first {months} months on any plan. No coupon code needed.",
  expiresAt: "",
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function thisMonthCount(rows: { createdAt: string }[]) {
  const now = new Date();
  return rows.filter((r) => {
    const d = new Date(r.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [promo, setPromo] = useState<PromoConfig>(DEFAULT_PROMO);
  const [promoLoading, setPromoLoading] = useState(true);
  const [promoSaving, setPromoSaving] = useState(false);

  const pricingUrl = typeof window !== "undefined"
    ? `${window.location.origin}${import.meta.env.BASE_URL?.replace(/\/$/, "")}/pricing`
    : "/pricing";

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [companiesSnap, usersSnap, customersSnap, invoicesSnap] = await Promise.all([
          getDocs(collection(db, "companies")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "customers")),
          getDocs(collection(db, "invoices")),
        ]);

        const userDocs = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as {
          id: string; email: string; displayName: string; companyId: string; role: string;
        }));
        const customerDocs = customersSnap.docs.map((d) => d.data() as { companyId: string });
        const invoiceDocs = invoicesSnap.docs.map((d) => d.data() as { companyId: string });

        const rows: CompanyRow[] = companiesSnap.docs.map((d) => {
          const data = d.data() as { name: string; ownerId: string; createdAt: string };
          const owner = userDocs.find((u) => u.id === data.ownerId);
          return {
            id: d.id,
            name: data.name ?? "Unnamed",
            ownerId: data.ownerId,
            createdAt: data.createdAt ?? "",
            ownerEmail: owner?.email ?? "—",
            ownerName: owner?.displayName ?? "—",
            userCount: userDocs.filter((u) => u.companyId === d.id).length,
            customerCount: customerDocs.filter((c) => c.companyId === d.id).length,
            invoiceCount: invoiceDocs.filter((i) => i.companyId === d.id).length,
          };
        });
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCompanies(rows);
        setError(null);
      } catch (e: unknown) {
        setError((e as Error).message ?? "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    async function loadPromo() {
      try {
        const snap = await getDoc(doc(db, "adminConfig", "promotions"));
        if (snap.exists()) setPromo({ ...DEFAULT_PROMO, ...(snap.data() as PromoConfig) });
      } catch { /* no promo doc yet — use defaults */ }
      finally { setPromoLoading(false); }
    }

    load();
    loadPromo();
  }, []);

  async function handleSavePromo() {
    setPromoSaving(true);
    try {
      await setDoc(doc(db, "adminConfig", "promotions"), promo);
      toast({ title: "Promotion saved", description: promo.enabled ? "Offer is now LIVE on the pricing page." : "Offer is hidden from the pricing page." });
    } catch {
      toast({ title: "Could not save promotion", variant: "destructive" });
    } finally {
      setPromoSaving(false);
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(pricingUrl);
    toast({ title: "Link copied!", description: "Share this URL with your customers." });
  }

  function updatePromo<K extends keyof PromoConfig>(key: K, value: PromoConfig[K]) {
    setPromo((p) => ({ ...p, [key]: value }));
  }

  const filtered = companies.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.ownerEmail.toLowerCase().includes(search.toLowerCase())
  );

  const newThisMonth = thisMonthCount(companies);
  const totalUsers = companies.reduce((s, c) => s + c.userCount, 0);
  const totalInvoices = companies.reduce((s, c) => s + c.invoiceCount, 0);

  const previewMessage = promo.message
    .replace("{percent}", String(promo.percentOff))
    .replace("{months}", String(promo.durationMonths));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Marwo Super Admin</h1>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">Admin</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">Go to My CRM</Button>
          </Link>
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => signOut(auth)}>
            <LogOut className="w-4 h-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2"><Building2 className="w-4 h-4" /> Total Companies</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold text-gray-900">{companies.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2"><Users className="w-4 h-4" /> Total Users</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold text-gray-900">{totalUsers}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> New This Month</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold text-green-600">{newThisMonth}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2"><FileText className="w-4 h-4" /> Total Invoices</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold text-gray-900">{totalInvoices}</p></CardContent>
          </Card>
        </div>

        {/* ── Promotions management ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-orange-500" />
              <CardTitle className="text-base font-semibold">Promotions & Offers</CardTitle>
            </div>
            <CardDescription>
              Control the discount shown on your public pricing page. Changes take effect immediately — no code needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {promoLoading ? (
              <p className="text-sm text-gray-400">Loading promotion settings…</p>
            ) : (
              <>
                {/* Offer active toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">Offer active</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      When ON, the promo banner and discounted prices appear on the pricing page and the discount is applied at Stripe checkout.
                    </p>
                  </div>
                  <Switch
                    checked={promo.enabled}
                    onCheckedChange={(v) => updatePromo("enabled", v)}
                  />
                </div>

                {/* Offer live indicator */}
                {promo.enabled && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Offer is LIVE — customers see the discount on the pricing page right now.
                  </div>
                )}

                {/* Discount settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Discount Percentage</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={1} max={99}
                        value={promo.percentOff}
                        onChange={(e) => updatePromo("percentOff", Number(e.target.value))}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                    <p className="text-xs text-gray-400">e.g. 50 = half price</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duration (months)</Label>
                    <Input
                      type="number"
                      min={1} max={12}
                      value={promo.durationMonths}
                      onChange={(e) => updatePromo("durationMonths", Number(e.target.value))}
                    />
                    <p className="text-xs text-gray-400">How many months the discount applies</p>
                  </div>
                </div>

                {/* Banner message */}
                <div className="space-y-1.5">
                  <Label>Banner message</Label>
                  <Textarea
                    value={promo.message}
                    onChange={(e) => updatePromo("message", e.target.value)}
                    rows={2}
                    placeholder="Limited time offer — {percent}% off your first {months} months..."
                  />
                  <p className="text-xs text-gray-400">
                    Use <code className="bg-gray-100 px-1 rounded">{"{percent}"}</code> and <code className="bg-gray-100 px-1 rounded">{"{months}"}</code> as placeholders.
                  </p>
                  {promo.message && (
                    <div className="mt-2 text-xs bg-orange-50 border border-orange-200 rounded px-3 py-2 text-orange-800">
                      Preview: {previewMessage}
                    </div>
                  )}
                </div>

                {/* Expiry date */}
                <div className="space-y-1.5">
                  <Label>Expiry date <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input
                    type="date"
                    value={promo.expiresAt}
                    onChange={(e) => updatePromo("expiresAt", e.target.value)}
                  />
                  <p className="text-xs text-gray-400">Just for your reference — does not auto-disable the offer.</p>
                </div>

                <Button onClick={handleSavePromo} disabled={promoSaving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {promoSaving ? "Saving…" : "Save Promotion Settings"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Pricing page link ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-base font-semibold">Your Public Pricing Page</CardTitle>
            </div>
            <CardDescription>Share this link with potential customers — no login needed to view it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input value={pricingUrl} readOnly className="text-sm text-gray-600 bg-gray-50" />
              <Button variant="outline" size="sm" onClick={copyUrl} className="gap-2 shrink-0">
                <Copy className="w-4 h-4" /> Copy
              </Button>
              <a href="/pricing" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2 shrink-0">
                  <ExternalLink className="w-4 h-4" /> Preview
                </Button>
              </a>
            </div>
            <p className="text-xs text-gray-400">
              You can share this in WhatsApp messages, emails, social media, or add it to your website.
            </p>
          </CardContent>
        </Card>

        {/* ── Companies table ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">All Tenant Companies</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search company or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <div className="px-6 py-4 text-sm text-red-600 bg-red-50 border-b border-red-100">{error}</div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                Loading all tenants…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-400">No companies found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Company</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Owner</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500"><UserCheck className="w-4 h-4 inline" /> Users</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500"><Users className="w-4 h-4 inline" /> Customers</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500"><FileText className="w-4 h-4 inline" /> Invoices</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-500"><Calendar className="w-4 h-4 inline mr-1" /> Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => (
                      <tr key={c.id} className={`border-b border-gray-50 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{c.name}</p>
                              <p className="text-xs text-gray-400 font-mono">{c.id.slice(0, 8)}…</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-800">{c.ownerName}</p>
                          <p className="text-xs text-gray-400">{c.ownerEmail}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge variant="secondary" className="bg-purple-50 text-purple-700">{c.userCount}</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-medium text-gray-700">{c.customerCount}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-medium text-gray-700">{c.invoiceCount}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-xs">{formatDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && filtered.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400">
                Showing {filtered.length} of {companies.length} companies
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
