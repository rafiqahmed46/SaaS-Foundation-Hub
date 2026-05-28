import { useEffect, useState } from "react";
import { Link } from "wouter";
import { query, where, collection } from "firebase/firestore";
import { getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getInvoices, getSettings } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Clock, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Summary {
  totalCustomers: number;
  totalInvoices: number;
  pendingInvoices: number;
  paidInvoices: number;
  totalRevenue: number;
  pendingRevenue: number;
}

function formatCurrency(amount: number, currency = "AED") {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency }).format(amount);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("AED");

  useEffect(() => {
    if (!user?.companyId) return;
    async function load() {
      setLoading(true);
      try {
        const companyId = user!.companyId!;
        const custCountQ = query(collection(db, "customers"), where("companyId", "==", companyId));
        const [custCountSnap, invoices, sett] = await Promise.all([
          getCountFromServer(custCountQ),
          getInvoices(companyId),
          getSettings(companyId),
        ]);

        if (sett?.currency) setCurrency(sett.currency);

        let totalRevenue = 0;
        let pendingRevenue = 0;
        let pendingInvoices = 0;
        let paidInvoices = 0;

        invoices.forEach((inv) => {
          const total = inv.total || 0;
          if (inv.status === "paid") {
            totalRevenue += total;
            paidInvoices++;
          } else if (inv.status === "sent" || inv.status === "draft" || inv.status === "overdue") {
            pendingRevenue += total;
            pendingInvoices++;
          }
        });

        setSummary({
          totalCustomers: custCountSnap.data().count,
          totalInvoices: invoices.length,
          pendingInvoices,
          paidInvoices,
          totalRevenue,
          pendingRevenue,
        });
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        setSummary(null);
        if (code === "permission-denied") {
          console.error("Firestore permission denied on dashboard load — check security rules");
        } else {
          console.error("Dashboard load error:", err);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.companyId]);

  const cards = summary
    ? [
        {
          title: "Total Customers",
          value: summary.totalCustomers.toString(),
          icon: Users,
          color: "text-blue-600",
          bg: "bg-blue-50",
          description: "All registered customers",
          href: "/customers",
        },
        {
          title: "Total Invoices",
          value: summary.totalInvoices.toString(),
          icon: FileText,
          color: "text-violet-600",
          bg: "bg-violet-50",
          description: `${summary.paidInvoices} paid`,
          href: "/invoices",
        },
        {
          title: "Pending Services",
          value: summary.pendingInvoices.toString(),
          icon: Clock,
          color: "text-amber-600",
          bg: "bg-amber-50",
          description: "Awaiting payment",
          href: "/invoices",
        },
        {
          title: "Total Revenue",
          value: formatCurrency(summary.totalRevenue, currency),
          icon: DollarSign,
          color: "text-green-600",
          bg: "bg-green-50",
          description: "From paid invoices",
          href: "/invoices",
        },
        {
          title: "Pending Revenue",
          value: formatCurrency(summary.pendingRevenue, currency),
          icon: TrendingUp,
          color: "text-orange-600",
          bg: "bg-orange-50",
          description: "Invoices outstanding",
          href: "/invoices",
        },
        {
          title: "Overdue Risk",
          value: summary.pendingInvoices > 0 ? "Active" : "Clear",
          icon: AlertCircle,
          color: summary.pendingInvoices > 0 ? "text-red-600" : "text-green-600",
          bg: summary.pendingInvoices > 0 ? "bg-red-50" : "bg-green-50",
          description: summary.pendingInvoices > 0 ? "Follow up needed" : "All up to date",
          href: "/invoices",
        },
      ]
    : [];

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Overview of your business — {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-28" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-20 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </CardContent>
                </Card>
              ))
            : cards.map((card) => (
                <Link key={card.title} href={card.href}>
                  <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer" data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {card.title}
                      </CardTitle>
                      <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                        <card.icon className={`w-5 h-5 ${card.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold tracking-tight" data-testid={`value-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        {card.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
        </div>

        {!loading && summary?.totalCustomers === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
            <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold text-lg">Get started</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first customer to start building your CRM.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
