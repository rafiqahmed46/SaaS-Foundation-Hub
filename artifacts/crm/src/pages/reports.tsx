import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getInvoices, Invoice, getCustomers, Customer, getTechnicians, Technician, getWorkOrders, WorkOrder, getContracts, Contract, getSettings } from "@/lib/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, Users, FileText, ClipboardCheck, FileCheck, DollarSign, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number, currency = "AED") {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ReportsPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [currency, setCurrency] = useState("AED");
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    if (!user?.companyId) return;
    (async () => {
      setLoading(true);
      try {
        const [inv, cust, tech, wo, con, sett] = await Promise.all([
          getInvoices(user.companyId!),
          getCustomers(user.companyId!),
          getTechnicians(user.companyId!),
          getWorkOrders(user.companyId!),
          getContracts(user.companyId!),
          getSettings(user.companyId!),
        ]);
        setInvoices(inv); setCustomers(cust); setTechnicians(tech);
        setWorkOrders(wo); setContracts(con);
        if (sett?.currency) setCurrency(sett.currency);
      } finally { setLoading(false); }
    })();
  }, [user?.companyId]);

  const years = useMemo(() => {
    const ys = new Set(invoices.map((i) => i.createdAt.slice(0, 4)));
    ys.add(String(new Date().getFullYear()));
    return Array.from(ys).sort().reverse();
  }, [invoices]);

  // Monthly revenue for selected year
  const monthlyRevenue = useMemo(() => {
    return MONTHS.map((_, mi) => {
      const month = String(mi + 1).padStart(2, "0");
      const prefix = `${yearFilter}-${month}`;
      const paid = invoices.filter((i) => i.status === "paid" && i.createdAt.startsWith(prefix));
      return { label: MONTHS[mi], revenue: paid.reduce((s, i) => s + i.total, 0), count: paid.length };
    });
  }, [invoices, yearFilter]);

  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1);

  // KPIs
  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const pendingRevenue = invoices.filter((i) => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + i.total, 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;
  const activeContracts = contracts.filter((c) => c.status === "active").length;
  const contractRevenue = contracts.filter((c) => c.status === "active").reduce((s, c) => s + c.value, 0);
  const completedWO = workOrders.filter((w) => w.status === "completed").length;

  // Invoice aging (outstanding invoices by age)
  const today = new Date();
  function ageBucket(inv: Invoice): string {
    if (!inv.dueDate) return "No due date";
    const days = Math.ceil((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
    if (days < 0) return "Not due yet";
    if (days <= 30) return "0–30 days";
    if (days <= 60) return "31–60 days";
    if (days <= 90) return "61–90 days";
    return "90+ days";
  }
  const outstanding = invoices.filter((i) => ["sent", "overdue"].includes(i.status));
  const aging: Record<string, { count: number; amount: number }> = {};
  const BUCKETS = ["Not due yet", "0–30 days", "31–60 days", "61–90 days", "90+ days", "No due date"];
  BUCKETS.forEach((b) => { aging[b] = { count: 0, amount: 0 }; });
  outstanding.forEach((inv) => { const b = ageBucket(inv); aging[b].count++; aging[b].amount += inv.total; });

  // Top customers by revenue
  const customerRevMap: Record<string, { name: string; revenue: number; invoices: number }> = {};
  invoices.filter((i) => i.status === "paid").forEach((inv) => {
    if (!customerRevMap[inv.customerId]) customerRevMap[inv.customerId] = { name: inv.customerName, revenue: 0, invoices: 0 };
    customerRevMap[inv.customerId].revenue += inv.total;
    customerRevMap[inv.customerId].invoices++;
  });
  const topCustomers = Object.values(customerRevMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Technician performance
  const techMap: Record<string, { name: string; completed: number; inProgress: number }> = {};
  workOrders.forEach((wo) => {
    if (!wo.assignedToName) return;
    const k = wo.assignedTo || wo.assignedToName;
    if (!techMap[k]) techMap[k] = { name: wo.assignedToName, completed: 0, inProgress: 0 };
    if (wo.status === "completed") techMap[k].completed++;
    if (wo.status === "in-progress") techMap[k].inProgress++;
  });
  const techPerf = Object.values(techMap).sort((a, b) => b.completed - a.completed).slice(0, 6);

  if (loading) return (
    <Layout><div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-64 rounded-xl" />
    </div></Layout>
  );

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Business analytics and performance overview</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Revenue", value: formatCurrency(totalRevenue, currency), icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
            { label: "Pending Revenue", value: formatCurrency(pendingRevenue, currency), icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Overdue", value: overdueCount, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
            { label: "Customers", value: customers.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Active Contracts", value: activeContracts, icon: FileCheck, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Jobs Completed", value: completedWO, icon: ClipboardCheck, color: "text-primary", bg: "bg-primary/10" },
          ].map((kpi) => (
            <Card key={kpi.label} className="overflow-hidden">
              <CardContent className="p-4 flex flex-col gap-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", kpi.bg)}>
                  <kpi.icon className={cn("w-4 h-4", kpi.color)} />
                </div>
                <p className="text-xl font-bold leading-tight">{kpi.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Monthly Revenue Chart */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Monthly Revenue</CardTitle>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-48 mt-2">
              {monthlyRevenue.map((m) => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: "160px" }}>
                    <div
                      className="w-full bg-primary/80 rounded-t-sm hover:bg-primary transition-colors min-h-[2px]"
                      style={{ height: `${(m.revenue / maxRevenue) * 100}%` }}
                      title={`${m.label}: ${formatCurrency(m.revenue, currency)} (${m.count} invoices)`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Total paid {yearFilter}: <strong className="text-foreground">{formatCurrency(monthlyRevenue.reduce((s, m) => s + m.revenue, 0), currency)}</strong></span>
              <span>Contract ARR: <strong className="text-foreground">{formatCurrency(contractRevenue, currency)}</strong></span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Invoice Aging */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Invoice Aging</CardTitle>
            </CardHeader>
            <CardContent>
              {outstanding.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No outstanding invoices 🎉</p>
              ) : (
                <div className="space-y-2">
                  {BUCKETS.filter((b) => aging[b].count > 0).map((b) => (
                    <div key={b} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground shrink-0">{b}</div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", b === "90+ days" ? "bg-red-500" : b === "61–90 days" ? "bg-orange-500" : b === "31–60 days" ? "bg-amber-500" : "bg-primary")}
                          style={{ width: `${(aging[b].count / outstanding.length) * 100}%` }} />
                      </div>
                      <div className="text-xs shrink-0 text-right w-28">
                        <span className="font-medium">{formatCurrency(aging[b].amount, currency)}</span>
                        <span className="text-muted-foreground ml-1">({aging[b].count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Top Customers by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No paid invoices yet</p>
              ) : (
                <div className="space-y-3">
                  {topCustomers.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.invoices} invoice{c.invoices !== 1 ? "s" : ""}</p>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(c.revenue, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Technician Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" /> Technician Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {techPerf.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No work orders assigned yet</p>
              ) : (
                <div className="space-y-3">
                  {techPerf.map((t) => (
                    <div key={t.name} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{t.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.inProgress} in progress</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">{t.completed}</p>
                        <p className="text-xs text-muted-foreground">completed</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Status Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Invoice Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No invoices yet</p>
              ) : (
                <div className="space-y-2">
                  {(["paid","sent","overdue","draft","cancelled"] as const).map((status) => {
                    const inv = invoices.filter((i) => i.status === status);
                    const pct = invoices.length ? (inv.length / invoices.length) * 100 : 0;
                    const colors: Record<string, string> = { paid: "bg-green-500", sent: "bg-blue-500", overdue: "bg-red-500", draft: "bg-gray-400", cancelled: "bg-gray-300" };
                    if (inv.length === 0) return null;
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-muted-foreground capitalize shrink-0">{status}</div>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", colors[status])} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs w-24 text-right shrink-0">
                          <span className="font-medium">{inv.length}</span>
                          <span className="text-muted-foreground"> · {pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
