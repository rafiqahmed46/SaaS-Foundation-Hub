import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getInvoices, deleteInvoice, Invoice } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, Trash2, FileText } from "lucide-react";
import { getSettings } from "@/lib/firestore";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");

  async function loadInvoices() {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      const [data, sett] = await Promise.all([
        getInvoices(user.companyId),
        getSettings(user.companyId),
      ]);
      setInvoices(data);
      if (sett?.currency) setCurrency(sett.currency);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInvoices(); }, [user?.companyId]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteInvoice(deleteId);
      toast({ title: "Invoice deleted" });
      setDeleteId(null);
      loadInvoices();
    } catch {
      toast({ title: "Error", description: "Could not delete invoice.", variant: "destructive" });
    }
  }

  const filtered = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(search.toLowerCase()) ||
      inv.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"} total
            </p>
          </div>
          <Button onClick={() => navigate("/invoices/new")} className="gap-2 shrink-0" data-testid="button-create-invoice">
            <Plus className="w-4 h-4" />
            New Invoice
          </Button>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by invoice number, customer, or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-invoice"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-4 flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold">{search ? "No invoices found" : "No invoices yet"}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search term." : "Create your first invoice to get started."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden space-y-3">
              {filtered.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-xl border bg-card p-4 flex flex-col gap-3"
                  data-testid={`row-invoice-${inv.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold font-mono text-sm">{inv.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{inv.customerName}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${STATUS_STYLES[inv.status] || STATUS_STYLES.draft}`}>
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Issued: {new Date(inv.createdAt).toLocaleDateString("en-GB")}</p>
                      {inv.dueDate && <p>Due: {new Date(inv.dueDate).toLocaleDateString("en-GB")}</p>}
                    </div>
                    <p className="font-bold text-base">{formatCurrency(inv.total, inv.currency || currency)}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <button
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      data-testid={`button-view-invoice-${inv.id}`}
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => setDeleteId(inv.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      data-testid={`button-delete-invoice-${inv.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Due</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-invoice-${inv.id}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium font-mono">{inv.invoiceNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{inv.customerName}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatCurrency(inv.total, inv.currency || currency)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[inv.status] || STATUS_STYLES.draft}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/invoices/${inv.id}`)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              data-testid={`button-view-invoice-${inv.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteId(inv.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              data-testid={`button-delete-invoice-${inv.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this invoice. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              data-testid="button-confirm-delete-invoice"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
