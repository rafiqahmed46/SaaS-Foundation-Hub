import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getQuotations, deleteQuotation, Quotation } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Eye, ClipboardList, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/utils-crm";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

export default function QuotationsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!user?.companyId) return;
    const data = await getQuotations(user.companyId);
    setQuotations(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.companyId]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteQuotation(deleteId);
      toast({ title: "Quotation deleted" });
      setDeleteId(null);
      load();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  const filtered = quotations.filter(
    (q) =>
      q.customerName.toLowerCase().includes(search.toLowerCase()) ||
      q.quoteNumber.toLowerCase().includes(search.toLowerCase())
  );

  const totals = { all: quotations.length, accepted: quotations.filter((q) => q.status === "accepted").length };

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totals.all} total · {totals.accepted} accepted
            </p>
          </div>
          <Button onClick={() => navigate("/quotations/new")} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> New Quotation
          </Button>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search by customer or quote number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold">{search ? "No quotations found" : "No quotations yet"}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search." : "Create your first quotation to send to a customer."}
            </p>
            {!search && (
              <Button onClick={() => navigate("/quotations/new")} variant="outline" className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> New Quotation
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quote #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Valid Until</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((q) => (
                    <tr key={q.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                      <td className="px-4 py-3 font-mono text-sm font-medium">{q.quoteNumber}</td>
                      <td className="px-4 py-3 font-medium">{q.customerName}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                        {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLES[q.status])}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {getCurrencySymbol(q.currency || "AED")}{q.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => navigate(`/quotations/${q.id}`)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/quotations/${q.id}/edit`); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteId(q.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
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
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quotation</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this quotation.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
