import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Users,
  FileText,
  UserCheck,
  Search,
  LogOut,
  TrendingUp,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

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

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

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
          const userCount = userDocs.filter((u) => u.companyId === d.id).length;
          const customerCount = customerDocs.filter((c) => c.companyId === d.id).length;
          const invoiceCount = invoiceDocs.filter((i) => i.companyId === d.id).length;

          return {
            id: d.id,
            name: data.name ?? "Unnamed",
            ownerId: data.ownerId,
            createdAt: data.createdAt ?? "",
            ownerEmail: owner?.email ?? "—",
            ownerName: owner?.displayName ?? "—",
            userCount,
            customerCount,
            invoiceCount,
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
    load();
  }, []);

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.ownerEmail.toLowerCase().includes(search.toLowerCase())
  );

  const newThisMonth = thisMonthCount(companies);
  const totalUsers = companies.reduce((s, c) => s + c.userCount, 0);
  const totalInvoices = companies.reduce((s, c) => s + c.invoiceCount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">ClearCRM Super Admin</h1>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
            Admin
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Go to My CRM
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => signOut(auth)}
          >
            <LogOut className="w-4 h-4 mr-1" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Total Companies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{companies.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Users className="w-4 h-4" /> Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> New This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{newThisMonth}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Total Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalInvoices}</p>
            </CardContent>
          </Card>
        </div>

        {/* Companies table */}
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
              <div className="px-6 py-4 text-sm text-red-600 bg-red-50 border-b border-red-100">
                {error}
              </div>
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
                      <th className="text-center px-4 py-3 font-medium text-gray-500">
                        <UserCheck className="w-4 h-4 inline" /> Users
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500">
                        <Users className="w-4 h-4 inline" /> Customers
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500">
                        <FileText className="w-4 h-4 inline" /> Invoices
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-gray-500">
                        <Calendar className="w-4 h-4 inline mr-1" /> Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => (
                      <tr
                        key={c.id}
                        className={`border-b border-gray-50 hover:bg-blue-50/40 transition-colors ${
                          i % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                        }`}
                      >
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
                          <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                            {c.userCount}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-medium text-gray-700">{c.customerCount}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-medium text-gray-700">{c.invoiceCount}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-xs">
                          {formatDate(c.createdAt)}
                        </td>
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
