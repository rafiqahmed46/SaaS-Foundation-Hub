import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTransaction, updateTransaction, deleteTransaction,
  Transaction, INCOME_CATEGORIES, EXPENSE_CATEGORIES,
  getSettings, Settings,
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Trash2, TrendingUp, TrendingDown, Receipt, Calendar, Tag, FileText, Hash, Link2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface FormData {
  type: "income" | "expense";
  category: string;
  amount: string;
  date: string;
  description: string;
  reference: string;
}

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function emptyForm(tx?: Transaction): FormData {
  if (!tx) return { type: "income", category: "", amount: "", date: toYMD(new Date()), description: "", reference: "" };
  return {
    type: tx.type,
    category: tx.category,
    amount: String(tx.amount),
    date: tx.date,
    description: tx.description || "",
    reference: tx.reference || "",
  };
}

export default function FinanceDetailPage() {
  const [, params] = useRoute("/finance/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [incomeCategories, setIncomeCategories] = useState<string[]>([...INCOME_CATEGORIES]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([...EXPENSE_CATEGORIES]);

  const currency = "AED";

  async function load() {
    if (!params?.id) return;
    const [data, sett] = await Promise.all([
      getTransaction(params.id),
      user?.companyId ? getSettings(user.companyId) : Promise.resolve(null),
    ]);
    if (!data) { setNotFound(true); setLoading(false); return; }
    setTx(data);
    setForm(emptyForm(data));
    if (sett?.incomeCategories?.length) setIncomeCategories(sett.incomeCategories);
    if (sett?.expenseCategories?.length) setExpenseCategories(sett.expenseCategories);
    setLoading(false);
  }

  useEffect(() => { load(); }, [params?.id, user?.companyId]);

  function setF<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    const amount = parseFloat(form.amount);
    if (!form.category) { toast({ title: "Category is required", variant: "destructive" }); return; }
    if (!form.amount || isNaN(amount) || amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    if (!form.date) { toast({ title: "Date is required", variant: "destructive" }); return; }
    if (!params?.id) return;
    setSaving(true);
    try {
      await updateTransaction(params.id, {
        type: form.type,
        category: form.category,
        amount,
        date: form.date,
        description: form.description.trim(),
        reference: form.reference.trim() || undefined,
      });
      toast({ title: "Transaction updated" });
      setEditOpen(false);
      load();
    } catch {
      toast({ title: "Error saving", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!params?.id) return;
    try {
      await deleteTransaction(params.id);
      toast({ title: "Transaction deleted" });
      navigate("/finance");
    } catch {
      toast({ title: "Error deleting", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (notFound || !tx) {
    return (
      <Layout>
        <div className="p-4 sm:p-6 max-w-2xl mx-auto text-center py-20">
          <Receipt className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Transaction not found</h2>
          <p className="text-sm text-muted-foreground mt-1">This transaction may have been deleted.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/finance")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Finance
          </Button>
        </div>
      </Layout>
    );
  }

  const isIncome = tx.type === "income";
  const formattedDate = new Date(tx.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const formattedAmount = tx.amount.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedCreated = tx.createdAt
    ? new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">

        {/* Back nav */}
        <button
          onClick={() => navigate("/finance")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Finance
        </button>

        {/* Header card */}
        <div className={cn(
          "rounded-xl border p-6",
          isIncome ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", isIncome ? "bg-emerald-100" : "bg-red-100")}>
                {isIncome
                  ? <TrendingUp className="w-6 h-6 text-emerald-600" />
                  : <TrendingDown className="w-6 h-6 text-red-600" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn("text-xs font-medium border-0", isIncome ? "bg-emerald-200 text-emerald-800" : "bg-red-200 text-red-800")}>
                    {isIncome ? "Income" : "Expense"}
                  </Badge>
                  {tx.source === "invoice" && (
                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">Invoice</Badge>
                  )}
                </div>
                <p className={cn("text-3xl font-bold mt-2", isIncome ? "text-emerald-700" : "text-red-700")}>
                  {isIncome ? "+" : "−"} {currency} {formattedAmount}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{formattedDate}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {tx.source !== "invoice" && (
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)} className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Details card */}
        <div className="rounded-xl border bg-card divide-y">
          <div className="px-5 py-3.5 flex items-center gap-3">
            <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground w-28 shrink-0">Category</span>
            <Badge variant="outline" className={cn("text-xs", isIncome ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-red-300 text-red-700 bg-red-50")}>
              {tx.category}
            </Badge>
          </div>

          <div className="px-5 py-3.5 flex items-start gap-3">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-sm text-muted-foreground w-28 shrink-0">Description</span>
            <span className="text-sm">
              {tx.description || <span className="text-muted-foreground italic">No description</span>}
            </span>
          </div>

          <div className="px-5 py-3.5 flex items-center gap-3">
            <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground w-28 shrink-0">Receipt / Ref</span>
            {tx.source === "invoice" && tx.invoiceId ? (
              <Link href={`/invoices/${tx.invoiceId}`} className="text-sm text-blue-600 hover:underline font-medium flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" /> {tx.reference || tx.invoiceId}
              </Link>
            ) : (
              <span className="text-sm">{tx.reference || <span className="text-muted-foreground">—</span>}</span>
            )}
          </div>

          <div className="px-5 py-3.5 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground w-28 shrink-0">Date</span>
            <span className="text-sm">{formattedDate}</span>
          </div>

          {tx.source === "invoice" && tx.invoiceId && (
            <div className="px-5 py-3.5 flex items-center gap-3">
              <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground w-28 shrink-0">Source</span>
              <Link href={`/invoices/${tx.invoiceId}`} className="text-sm text-blue-600 hover:underline font-medium">
                View Invoice →
              </Link>
            </div>
          )}

          {formattedCreated && (
            <div className="px-5 py-3.5 flex items-center gap-3">
              <Receipt className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground w-28 shrink-0">Created</span>
              <span className="text-sm text-muted-foreground">{formattedCreated}</span>
            </div>
          )}
        </div>

      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>Update the details of this transaction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
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
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.amount} onChange={(e) => setF("amount", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="e.g. Monthly fuel for delivery vehicles"
                value={form.description}
                onChange={(e) => setF("description", e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Receipt / Reference <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input placeholder="Invoice #, receipt no…" value={form.reference} onChange={(e) => setF("reference", e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className={form.type === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this {tx.type} entry of {currency} {formattedAmount}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
