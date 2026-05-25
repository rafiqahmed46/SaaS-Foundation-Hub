import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { getInvoice, getSettings, updateInvoice, Invoice, Settings } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const CURRENCIES: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "C$", AUD: "A$", INR: "₹", BRL: "R$",
};

export default function InvoiceDetailPage() {
  const [, params] = useRoute("/invoices/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const id = params?.id;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!id || !user?.companyId) return;
    async function load() {
      const [inv, sett] = await Promise.all([
        getInvoice(id!),
        getSettings(user!.companyId!),
      ]);
      setInvoice(inv);
      setSettings(sett);
      setLoading(false);
    }
    load();
  }, [id, user?.companyId]);

  async function handleStatusChange(newStatus: string) {
    if (!id || !invoice) return;
    setUpdatingStatus(true);
    try {
      await updateInvoice(id, { status: newStatus as Invoice["status"] });
      setInvoice((prev) => prev ? { ...prev, status: newStatus as Invoice["status"] } : prev);
      toast({ title: "Status updated" });
    } catch {
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDownloadPDF() {
    if (!invoice || !settings) return;
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const currSymbol = CURRENCIES[settings.currency] || settings.currency;

      // Header
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(settings.companyName || "Company", 14, 22);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      let y = 30;
      if (settings.address) { doc.text(settings.address, 14, y); y += 5; }
      if (settings.phone) { doc.text(`Phone: ${settings.phone}`, 14, y); y += 5; }
      if (settings.email) { doc.text(`Email: ${settings.email}`, 14, y); y += 5; }

      // Invoice info (right side)
      doc.setTextColor(0);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("INVOICE", 196, 22, { align: "right" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Invoice #: ${invoice.invoiceNumber}`, 196, 30, { align: "right" });
      doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 196, 36, { align: "right" });
      if (invoice.dueDate) {
        doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, 196, 42, { align: "right" });
      }
      doc.text(`Status: ${invoice.status.toUpperCase()}`, 196, 48, { align: "right" });

      // Bill To
      doc.setTextColor(0);
      y = Math.max(y + 10, 60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Bill To:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(invoice.customerName, 14, y + 6);

      y += 20;
      doc.setDrawColor(220);
      doc.line(14, y, 196, y);
      y += 8;

      // Items table
      autoTable(doc, {
        startY: y,
        head: [["Description", "Qty", "Unit Price", "Total"]],
        body: invoice.items.map((item) => [
          item.description,
          item.quantity.toString(),
          `${currSymbol}${item.unitPrice.toFixed(2)}`,
          `${currSymbol}${(item.quantity * item.unitPrice).toFixed(2)}`,
        ]),
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: "auto" },
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: 35, halign: "right" },
          3: { cellWidth: 35, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

      // Totals
      const rightCol = 196;
      const leftCol = 130;
      let ty = finalY;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text("Subtotal:", leftCol, ty, { align: "right" });
      doc.setTextColor(0);
      doc.text(`${currSymbol}${invoice.subtotal.toFixed(2)}`, rightCol, ty, { align: "right" });

      if (invoice.taxEnabled && invoice.taxAmount) {
        ty += 6;
        doc.setTextColor(100);
        doc.text(`Tax (${invoice.taxRate}%):`, leftCol, ty, { align: "right" });
        doc.setTextColor(0);
        doc.text(`${currSymbol}${invoice.taxAmount.toFixed(2)}`, rightCol, ty, { align: "right" });
      }

      if (invoice.discountEnabled && invoice.discountAmount) {
        ty += 6;
        doc.setTextColor(100);
        doc.text(`Discount:`, leftCol, ty, { align: "right" });
        doc.setTextColor(0);
        doc.text(`-${currSymbol}${invoice.discountAmount.toFixed(2)}`, rightCol, ty, { align: "right" });
      }

      ty += 8;
      doc.setDrawColor(30, 64, 175);
      doc.line(leftCol - 10, ty - 3, rightCol, ty - 3);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 175);
      doc.text("Total:", leftCol, ty + 4, { align: "right" });
      doc.text(`${currSymbol}${invoice.total.toFixed(2)}`, rightCol, ty + 4, { align: "right" });

      if (invoice.notes) {
        ty += 20;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Notes:", 14, ty);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(invoice.notes, 14, ty + 6, { maxWidth: 180 });
      }

      doc.save(`${invoice.invoiceNumber}.pdf`);
      toast({ title: "PDF downloaded" });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Could not generate PDF.", variant: "destructive" });
    }
  }

  const currSymbol = CURRENCIES[settings?.currency || "USD"] || "$";

  if (loading) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!invoice) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Invoice not found.</p>
          <Button variant="link" onClick={() => navigate("/invoices")}>Back to Invoices</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/invoices")} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-tight">{invoice.invoiceNumber}</h1>
              <p className="text-sm text-muted-foreground">
                Created {new Date(invoice.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={invoice.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
              <SelectTrigger className="w-32" data-testid="select-invoice-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleDownloadPDF} className="gap-2" data-testid="button-download-pdf">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Invoice card */}
        <Card>
          <CardContent className="p-6 sm:p-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between gap-6 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-lg">{settings?.companyName || "Your Company"}</span>
                </div>
                {settings?.address && <p className="text-sm text-muted-foreground">{settings.address}</p>}
                {settings?.phone && <p className="text-sm text-muted-foreground">{settings.phone}</p>}
                {settings?.email && <p className="text-sm text-muted-foreground">{settings.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary mb-1">INVOICE</p>
                <p className="text-sm font-mono font-semibold">{invoice.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Issued: {new Date(invoice.createdAt).toLocaleDateString()}
                </p>
                {invoice.dueDate && (
                  <p className="text-sm text-muted-foreground">
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                )}
                <span className={`inline-flex mt-2 items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[invoice.status]}`}>
                  {invoice.status}
                </span>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
              <p className="font-semibold">{invoice.customerName}</p>
            </div>

            <Separator className="mb-6" />

            {/* Items */}
            <div className="mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-3 font-semibold text-muted-foreground">Description</th>
                    <th className="text-center pb-3 font-semibold text-muted-foreground w-16">Qty</th>
                    <th className="text-right pb-3 font-semibold text-muted-foreground w-24">Unit Price</th>
                    <th className="text-right pb-3 font-semibold text-muted-foreground w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {invoice.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-3">{item.description}</td>
                      <td className="py-3 text-center text-muted-foreground">{item.quantity}</td>
                      <td className="py-3 text-right text-muted-foreground">{currSymbol}{item.unitPrice.toFixed(2)}</td>
                      <td className="py-3 text-right font-medium">{currSymbol}{(item.quantity * item.unitPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{currSymbol}{invoice.subtotal.toFixed(2)}</span>
                </div>
                {invoice.taxEnabled && invoice.taxAmount != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
                    <span>{currSymbol}{invoice.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {invoice.discountEnabled && invoice.discountAmount != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span>-{currSymbol}{invoice.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary">{currSymbol}{invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-8 pt-6 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
