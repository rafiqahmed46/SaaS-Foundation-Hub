import { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTransactions, addTransaction, updateTransaction, deleteTransaction,
  getSettings, saveSettings,
  Transaction, INCOME_CATEGORIES, EXPENSE_CATEGORIES,
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Plus, TrendingUp, TrendingDown, DollarSign, Pencil, Trash2, Calendar, X, Check, Filter, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Date helpers ───────────────────────────────────────────────────────────────

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

type Preset = "this-month" | "last-month" | "this-quarter" | "this-year" | "all";

function presetRange(preset: Preset): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === "this-month") return { from: toYMD(new Date(y, m, 1)), to: toYMD(new Date(y, m + 1, 0)) };
  if (preset === "last-month") return { from: toYMD(new Date(y, m - 1, 1)), to: toYMD(new Date(y, m, 0)) };
  if (preset === "this-quarter") {
    const q = Math.floor(m / 3);
    return { from: toYMD(new Date(y, q * 3, 1)), to: toYMD(new Date(y, q * 3 + 3, 0)) };
  }
  if (preset === "this-year") return { from: toYMD(new Date(y, 0, 1)), to: toYMD(new Date(y, 11, 31)) };
  return null;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Constants ──────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = { income: [...INCOME_CATEGORIES], expense: [...EXPENSE_CATEGORIES] };

type TxType = "all" | "income" | "expense";

interface FormData {
  type: "income" | "expense";
  category: string;
  amount: string;
  date: string;
  description: string;
  reference: string;
}

const emptyForm = (): FormData => ({
  type: "income",
  category: "",
  amount: "",
  date: toYMD(new Date()),
  description: "",
  reference: "",
});

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon: Icon, color, currency }: {
  label: string; value: number; icon: React.ElementType; color: string; currency: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 flex items-start gap-4", color === "green" && "border-emerald-200", color === "red" && "border-red-200", color === "blue" && "border-blue-200")}>
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color === "green" && "bg-emerald-100", color === "red" && "bg-red-100", color === "blue" && "bg-blue-100")}>
        <Icon className={cn("w-5 h-5", color === "green" && "text-emerald-600", color === "red" && "text-red-600", color === "blue" && "text-blue-600")} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className={cn("text-2xl font-bold mt-0.5", color === "green" && "text-emerald-700", color === "red" && "text-red-700", color === "blue" && (value >= 0 ? "text-blue-700" : "text-red-600"))}>
          {currency} {Math.abs(value).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [tab, setTab] = useState<TxType>("all");
  const [preset, setPreset] = useState<Preset>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Custom categories (persisted in settings)
  const [incomeCategories, setIncomeCategories] = useState<string[]>([...INCOME_CATEGORIES]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([...EXPENSE_CATEGORIES]);
  // Category management dialogs
  const [manageCatOpen, setManageCatOpen] = useState(false);
  const [manageCatTab, setManageCatTab] = useState<"income" | "expense">("income");
  const [renamingCat, setRenamingCat] = useState<{ type: "income" | "expense"; original: string } | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [createCatOpen, setCreateCatOpen] = useState(false);
  const [createCatType, setCreateCatType] = useState<"income" | "expense">("income");
  const [createCatName, setCreateCatName] = useState("");

  const currency = "AED";

  async function load() {
    if (!user?.companyId) return;
    const [data, sett] = await Promise.all([
      getTransactions(user.companyId),
      getSettings(user.companyId),
    ]);
    setTransactions(data);
    if (sett?.incomeCategories?.length) setIncomeCategories(sett.incomeCategories);
    if (sett?.expenseCategories?.length) setExpenseCategories(sett.expenseCategories);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.companyId]);

  async function handleCreateCategory() {
    const name = createCatName.trim();
    if (!name || !user?.companyId) return;
    const updated = createCatType === "income"
      ? [...incomeCategories, name]
      : [...expenseCategories, name];
    if (createCatType === "income") setIncomeCategories(updated);
    else setExpenseCategories(updated);
    await saveSettings(user.companyId, createCatType === "income" ? { incomeCategories: updated } : { expenseCategories: updated });
    setCreateCatName("");
    setCreateCatOpen(false);
    toast({ title: `Category "${name}" added` });
  }

  async function handleRenameCategory() {
    if (!renamingCat || !user?.companyId) return;
    const newName = renameVal.trim();
    if (!newName || newName === renamingCat.original) { setRenamingCat(null); return; }
    const updated = renamingCat.type === "income"
      ? incomeCategories.map((c) => c === renamingCat.original ? newName : c)
      : expenseCategories.map((c) => c === renamingCat.original ? newName : c);
    if (renamingCat.type === "income") setIncomeCategories(updated);
    else setExpenseCategories(updated);
    if (catFilter === renamingCat.original) setCatFilter(newName);
    await saveSettings(user.companyId, renamingCat.type === "income" ? { incomeCategories: updated } : { expenseCategories: updated });
    setRenamingCat(null);
    toast({ title: `Renamed to "${newName}"` });
  }

  async function handleDeleteCategory(type: "income" | "expense", cat: string) {
    if (!user?.companyId) return;
    const updated = type === "income"
      ? incomeCategories.filter((c) => c !== cat)
      : expenseCategories.filter((c) => c !== cat);
    if (type === "income") setIncomeCategories(updated);
    else setExpenseCategories(updated);
    if (catFilter === cat) setCatFilter("all");
    await saveSettings(user.companyId, type === "income" ? { incomeCategories: updated } : { expenseCategories: updated });
    toast({ title: `Category "${cat}" removed` });
  }

  // ── Filtering ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = [...transactions];

    // Date range
    const range = preset === "all" ? (customFrom && customTo ? { from: customFrom, to: customTo } : null) : presetRange(preset);
    if (range) list = list.filter((t) => t.date >= range.from && t.date <= range.to);

    // Type
    if (tab !== "all") list = list.filter((t) => t.type === tab);

    // Category
    if (catFilter !== "all") list = list.filter((t) => t.category === catFilter);

    return list;
  }, [transactions, preset, customFrom, customTo, tab, catFilter]);

  const totalIncome = useMemo(() => filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [filtered]);
  const net = totalIncome - totalExpense;

  // ── Chart data (last 6 months from today) ────────────────────────────────────

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = toYMD(d).slice(0, 7); // YYYY-MM
      const monthTx = transactions.filter((t) => t.date.startsWith(key));
      return {
        month: MONTH_LABELS[d.getMonth()],
        Income: monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
        Expense: monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [transactions]);

  // ── Category list for filter pills ────────────────────────────────────────────

  const catOptions = useMemo(() => {
    if (tab === "income") return incomeCategories;
    if (tab === "expense") return expenseCategories;
    return [...incomeCategories, ...expenseCategories.filter((c) => !incomeCategories.includes(c))];
  }, [tab, incomeCategories, expenseCategories]);

  // ── Dialog helpers ────────────────────────────────────────────────────────────

  function openAdd() {
    setEditTx(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(t: Transaction) {
    setEditTx(t);
    setForm({ type: t.type, category: t.category, amount: String(t.amount), date: t.date, description: t.description, reference: t.reference || "" });
    setDialogOpen(true);
  }

  function setF<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    const amount = parseFloat(form.amount);
    if (!form.category) { toast({ title: "Category is required", variant: "destructive" }); return; }
    if (!form.amount || isNaN(amount) || amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    if (!form.date) { toast({ title: "Date is required", variant: "destructive" }); return; }
    if (!user?.companyId) return;

    setSaving(true);
    try {
      const payload = {
        companyId: user.companyId,
        type: form.type,
        category: form.category,
        amount,
        date: form.date,
        description: form.description.trim(),
        reference: form.reference.trim() || undefined,
      };
      if (editTx) {
        await updateTransaction(editTx.id, payload);
        toast({ title: "Transaction updated" });
      } else {
        await addTransaction(payload);
        toast({ title: `${form.type === "income" ? "Income" : "Expense"} added` });
      }
      setDialogOpen(false);
      load();
    } catch {
      toast({ title: "Error saving transaction", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteTransaction(deleteId);
      toast({ title: "Deleted" });
      setDeleteId(null);
      load();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "this-month", label: "This Month" },
    { key: "last-month", label: "Last Month" },
    { key: "this-quarter", label: "This Quarter" },
    { key: "this-year", label: "This Year" },
    { key: "all", label: "All Time" },
  ];

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track income and expenses across your business</p>
          </div>
          <Button onClick={openAdd} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Add Transaction
          </Button>
        </div>

        {/* Date Preset Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  preset === p.key ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === "all" && (
            <div className="flex items-center gap-2 ml-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-7 text-xs w-36" placeholder="From" />
              <span className="text-muted-foreground text-xs">to</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-7 text-xs w-36" placeholder="To" />
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard label="Total Income" value={totalIncome} icon={TrendingUp} color="green" currency={currency} />
          <SummaryCard label="Total Expenses" value={totalExpense} icon={TrendingDown} color="red" currency={currency} />
          <SummaryCard label={net >= 0 ? "Net Profit" : "Net Loss"} value={net} icon={DollarSign} color="blue" currency={currency} />
        </div>

        {/* Chart */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Last 6 Months Overview</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => [`${currency} ${Number(value).toLocaleString("en-AE", { minimumFractionDigits: 2 })}`, undefined]} />
              <Legend />
              <Bar dataKey="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Expense" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Type tabs + Category filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {(["all", "income", "expense"] as TxType[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setCatFilter("all"); }}
                className={cn("px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors",
                  tab === t ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "all" ? `All (${filtered.length})` : t === "income" ? `Income (${filtered.filter(tx => tx.type === "income").length})` : `Expense (${filtered.filter(tx => tx.type === "expense").length})`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Select
              value={catFilter}
              onValueChange={(v) => {
                if (v === "__create__") { setCreateCatOpen(true); return; }
                if (v === "__manage__") { setManageCatOpen(true); return; }
                setCatFilter(v);
              }}
            >
              <SelectTrigger className="h-8 w-52 text-xs">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {catOptions.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Categories</div>
                    {catOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </>
                )}
                <div className="my-1 border-t" />
                <SelectItem value="__create__" className="text-primary font-medium">
                  <span className="flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Create new category</span>
                </SelectItem>
                <SelectItem value="__manage__" className="text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> Manage categories</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Transaction List */}
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <DollarSign className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold">No transactions found</h3>
            <p className="text-sm text-muted-foreground mt-1">Add your first income or expense entry.</p>
            <Button onClick={openAdd} variant="outline" className="mt-4 gap-2"><Plus className="w-4 h-4" /> Add Transaction</Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Reference</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => navigate(`/finance/${tx.id}`)}
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(tx.date + "T00:00:00").toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium leading-tight">{tx.description || <span className="text-muted-foreground italic">No description</span>}</p>
                        {tx.source === "invoice" && (
                          <Badge variant="outline" className="text-xs shrink-0 border-blue-300 text-blue-700 bg-blue-50">Invoice</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="outline" className={cn("text-xs", tx.type === "income" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-red-300 text-red-700 bg-red-50")}>
                        {tx.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                      {tx.source === "invoice" && tx.invoiceId
                        ? <Link href={`/invoices/${tx.invoiceId}`} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline font-medium">{tx.reference}</Link>
                        : tx.reference || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      <span className={tx.type === "income" ? "text-emerald-600" : "text-red-600"}>
                        {tx.type === "income" ? "+" : "-"}{currency} {tx.amount.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(tx); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteId(tx.id); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 ml-1" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/40">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-medium text-muted-foreground">
                    {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    <span className={net >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {net >= 0 ? "+" : "-"}{currency} {Math.abs(net).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTx ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
            <DialogDescription>Record an income or expense entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">

            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setF("type", "income"); setF("category", ""); }}
                className={cn("py-2 rounded-lg border text-sm font-medium transition-colors",
                  form.type === "income" ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-muted-foreground hover:border-emerald-400"
                )}
              >
                + Income
              </button>
              <button
                type="button"
                onClick={() => { setF("type", "expense"); setF("category", ""); }}
                className={cn("py-2 rounded-lg border text-sm font-medium transition-colors",
                  form.type === "expense" ? "bg-red-500 text-white border-red-500" : "border-border text-muted-foreground hover:border-red-400"
                )}
              >
                − Expense
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setF("category", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {(form.type === "income" ? incomeCategories : expenseCategories).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setF("date", e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Amount ({currency}) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setF("amount", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                placeholder="e.g. Monthly fuel for delivery vehicles"
                value={form.description}
                onChange={(e) => setF("description", e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Reference <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input placeholder="Invoice #, receipt no…" value={form.reference} onChange={(e) => setF("reference", e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className={form.type === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"}>
              {saving ? "Saving…" : editTx ? "Save Changes" : form.type === "income" ? "Add Income" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this entry. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Category Dialog */}
      <Dialog open={createCatOpen} onOpenChange={(o) => { setCreateCatOpen(o); if (!o) setCreateCatName(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>Add a custom category for income or expense transactions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreateCatType("income")}
                className={cn("py-2 rounded-lg border text-sm font-medium transition-colors",
                  createCatType === "income" ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-muted-foreground hover:border-emerald-400"
                )}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => setCreateCatType("expense")}
                className={cn("py-2 rounded-lg border text-sm font-medium transition-colors",
                  createCatType === "expense" ? "bg-red-500 text-white border-red-500" : "border-border text-muted-foreground hover:border-red-400"
                )}
              >
                Expense
              </button>
            </div>
            <div className="space-y-1.5">
              <Label>Category name *</Label>
              <Input
                autoFocus
                placeholder="e.g. Freelance, Insurance…"
                value={createCatName}
                onChange={(e) => setCreateCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateCatOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCategory} disabled={!createCatName.trim()}>Create Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={manageCatOpen} onOpenChange={(o) => { setManageCatOpen(o); if (!o) setRenamingCat(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>Rename or delete your income and expense categories.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {/* Tab selector */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
              {(["income", "expense"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setManageCatTab(t); setRenamingCat(null); }}
                  className={cn("px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors",
                    manageCatTab === t ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "income" ? "Income" : "Expense"}
                </button>
              ))}
            </div>

            {/* Category list */}
            <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
              {(manageCatTab === "income" ? incomeCategories : expenseCategories).map((cat) => (
                <div key={cat} className="flex items-center gap-2 px-3 py-2.5">
                  {renamingCat?.original === cat && renamingCat.type === manageCatTab ? (
                    <>
                      <Input
                        autoFocus
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(); if (e.key === "Escape") setRenamingCat(null); }}
                        className="h-7 text-sm flex-1"
                      />
                      <button onClick={handleRenameCategory} className="p-1.5 rounded-md bg-primary text-white hover:bg-primary/90 shrink-0" title="Save">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setRenamingCat(null)} className="p-1.5 rounded-md border hover:bg-muted shrink-0" title="Cancel">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{cat}</span>
                      <button
                        onClick={() => { setRenamingCat({ type: manageCatTab, original: cat }); setRenameVal(cat); }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(manageCatTab, cat)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {(manageCatTab === "income" ? incomeCategories : expenseCategories).length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">No categories yet.</div>
              )}
            </div>

            {/* Quick add at bottom */}
            <div className="flex gap-2">
              <Input
                placeholder="Add new category…"
                value={createCatName}
                onChange={(e) => setCreateCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setCreateCatType(manageCatTab);
                    handleCreateCategory();
                  }
                }}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                className="shrink-0"
                disabled={!createCatName.trim()}
                onClick={() => { setCreateCatType(manageCatTab); handleCreateCategory(); }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageCatOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
