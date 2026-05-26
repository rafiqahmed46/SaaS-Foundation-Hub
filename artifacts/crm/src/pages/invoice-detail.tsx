import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { getInvoice, getSettings, updateInvoice, Invoice, Settings } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Building2, Receipt, Palette } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

import { CURRENCIES, getCurrencySymbol, fmtDate } from "@/lib/utils-crm";

type RGB = [number, number, number];

const PDF_THEMES: { id: string; name: string; rgb: RGB; dot: string }[] = [
  { id: "blue",    name: "Classic Blue",  rgb: [30, 64, 175],   dot: "#1e40af" },
  { id: "emerald", name: "Emerald",       rgb: [4, 120, 87],    dot: "#047857" },
  { id: "midnight",name: "Midnight",      rgb: [15, 23, 42],    dot: "#0f172a" },
  { id: "ruby",    name: "Ruby",          rgb: [185, 28, 28],   dot: "#b91c1c" },
  { id: "violet",  name: "Violet",        rgb: [88, 28, 135],   dot: "#581c87" },
  { id: "amber",   name: "Amber",         rgb: [120, 53, 15],   dot: "#78350f" },
];

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
  const [pdfThemeId, setPdfThemeId] = useState<string>(
    () => localStorage.getItem("invoicePdfTheme") || "blue"
  );

  function selectTheme(id: string) {
    setPdfThemeId(id);
    localStorage.setItem("invoicePdfTheme", id);
  }

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [inv, sett] = await Promise.all([
          getInvoice(id!),
          user?.companyId ? getSettings(user.companyId) : Promise.resolve(null),
        ]);
        setInvoice(inv);
        setSettings(sett);
      } finally {
        setLoading(false);
      }
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
    if (!invoice) return;
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const currency = settings?.currency || "AED";
      const currSymbol = CURRENCIES[currency] || currency;
      const taxLabel = settings?.taxLabel || "VAT";
      const pageW = doc.internal.pageSize.getWidth();
      const theme = PDF_THEMES.find((t) => t.id === pdfThemeId) || PDF_THEMES[0];
      const [pr, pg, pb] = theme.rgb;

      // Header bar
      doc.setFillColor(pr, pg, pb);
      doc.rect(0, 0, pageW, 38, "F");

      // Company name
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(settings?.companyName || "Company", 14, 16);

      // INVOICE label
      doc.setFontSize(24);
      doc.text("INVOICE", pageW - 14, 16, { align: "right" });

      // Company info below header bar
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 210, 255);
      let headerY = 25;
      if (settings?.address) { doc.text(settings.address, 14, headerY); headerY += 4.5; }
      if (settings?.phone) { doc.text(`Tel: ${settings.phone}`, 14, headerY); headerY += 4.5; }
      if (settings?.email) { doc.text(settings.email, 14, headerY); }
      if (settings?.trn) {
        doc.text(`TRN: ${settings.trn}`, pageW - 14, 25, { align: "right" });
      }

      // Invoice meta
      doc.setTextColor(150, 175, 255);
      doc.setFontSize(8.5);
      doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageW - 14, 31, { align: "right" });
      doc.text(`Date: ${fmtDate(invoice.createdAt)}`, pageW - 14, 36, { align: "right" });

      // Bill to + invoice details
      doc.setTextColor(0);
      let y = 50;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Bill To:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(invoice.customerName || "—", 14, y + 5);

      // Right side meta
      const rightMeta: [string, string][] = [
        ["Invoice No:", invoice.invoiceNumber],
        ["Date:", fmtDate(invoice.createdAt)],
      ];
      if (invoice.dueDate) rightMeta.push(["Due Date:", fmtDate(invoice.dueDate)]);
      if ((invoice as unknown as { poNumber?: string }).poNumber) rightMeta.push(["PO No:", (invoice as unknown as { poNumber: string }).poNumber]);
      rightMeta.push(["Status:", invoice.status.toUpperCase()]);

      let ry = y;
      rightMeta.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100);
        doc.text(label, pageW - 70, ry, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        doc.text(value, pageW - 14, ry, { align: "right" });
        ry += 6;
      });

      y += 22;
      doc.setDrawColor(220);
      doc.line(14, y, pageW - 14, y);
      y += 6;

      // Line items table
      autoTable(doc, {
        startY: y,
        head: [["#", "Description", "Qty", `Unit Price (${currency})`, `Total (${currency})`]],
        body: invoice.items.map((item, i) => [
          String(i + 1),
          item.description || "—",
          item.quantity.toString(),
          `${currSymbol} ${item.unitPrice.toFixed(2)}`,
          `${currSymbol} ${(item.quantity * item.unitPrice).toFixed(2)}`,
        ]),
        headStyles: { fillColor: [pr, pg, pb], textColor: 255, fontStyle: "bold", fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          2: { cellWidth: 15, halign: "center" },
          3: { cellWidth: 38, halign: "right" },
          4: { cellWidth: 38, halign: "right" },
        },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9 },
      });

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      const rightCol = pageW - 14;
      const labelCol = pageW - 65;
      let ty = finalY;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text("Subtotal:", labelCol, ty, { align: "right" });
      doc.setTextColor(0);
      doc.text(`${currSymbol} ${invoice.subtotal.toFixed(2)}`, rightCol, ty, { align: "right" });

      if (invoice.taxEnabled && invoice.taxAmount != null) {
        ty += 6;
        doc.setTextColor(100);
        doc.text(`${taxLabel} (${invoice.taxRate}%):`, labelCol, ty, { align: "right" });
        doc.setTextColor(0);
        doc.text(`${currSymbol} ${invoice.taxAmount.toFixed(2)}`, rightCol, ty, { align: "right" });
      }
      if (invoice.discountEnabled && invoice.discountAmount != null) {
        ty += 6;
        doc.setTextColor(100);
        doc.text("Discount:", labelCol, ty, { align: "right" });
        doc.setTextColor(0);
        doc.text(`- ${currSymbol} ${invoice.discountAmount.toFixed(2)}`, rightCol, ty, { align: "right" });
      }

      ty += 4;
      doc.setDrawColor(pr, pg, pb);
      doc.line(labelCol - 20, ty, rightCol, ty);
      ty += 6;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(pr, pg, pb);
      doc.text(`Total (${currency}):`, labelCol, ty, { align: "right" });
      doc.text(`${currSymbol} ${invoice.total.toFixed(2)}`, rightCol, ty, { align: "right" });

      // Bank details
      if (settings?.bankName || settings?.bankIban || settings?.bankAccount) {
        ty += 14;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(pr, pg, pb);
        doc.text("Payment Details:", 14, ty);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60);
        ty += 5;
        if (settings.bankName) { doc.text(`Bank: ${settings.bankName}`, 14, ty); ty += 5; }
        if (settings.bankAccount) { doc.text(`Account: ${settings.bankAccount}`, 14, ty); ty += 5; }
        if (settings.bankIban) { doc.text(`IBAN: ${settings.bankIban}`, 14, ty); ty += 5; }
      }

      // Notes
      if (invoice.notes || settings?.invoiceFooter || settings?.paymentTerms) {
        ty += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Notes:", 14, ty);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        ty += 5;
        const noteLines = [invoice.notes, settings?.paymentTerms, settings?.invoiceFooter].filter(Boolean).join(" | ");
        const split = doc.splitTextToSize(noteLines, pageW - 28);
        doc.text(split, 14, ty);
      }

      // TRN footer
      if (settings?.trn) {
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(`TRN: ${settings.trn}`, pageW / 2, pageH - 10, { align: "center" });
      }

      doc.save(`${invoice.invoiceNumber}.pdf`);
      toast({ title: "Invoice PDF downloaded" });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Could not generate PDF.", variant: "destructive" });
    }
  }

  async function handleDownloadReceipt() {
    if (!invoice) return;
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ format: "a5" });
      const currency = settings?.currency || "AED";
      const currSymbol = CURRENCIES[currency] || currency;
      const taxLabel = settings?.taxLabel || "VAT";
      const pageW = doc.internal.pageSize.getWidth();
      const cx = pageW / 2;

      // Header
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageW, 30, "F");
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("RECEIPT VOUCHER", cx, 13, { align: "center" });
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(settings?.companyName || "Company", cx, 22, { align: "center" });
      if (settings?.trn) {
        doc.setFontSize(7.5);
        doc.text(`TRN: ${settings.trn}`, cx, 27, { align: "center" });
      }

      let y = 40;
      doc.setTextColor(0);
      doc.setFontSize(9);

      // Grid of meta fields
      const metaLeft: [string, string][] = [
        ["Receipt For:", invoice.customerName || "—"],
        ["Date:", fmtDate(new Date().toISOString())],
      ];
      const metaRight: [string, string][] = [
        ["Invoice #:", invoice.invoiceNumber],
        ["Status:", invoice.status.toUpperCase()],
      ];
      if ((invoice as unknown as { poNumber?: string }).poNumber) {
        metaLeft.push(["PO No:", (invoice as unknown as { poNumber: string }).poNumber]);
      }
      metaLeft.forEach(([label, val], i) => {
        doc.setFont("helvetica", "bold"); doc.setTextColor(100);
        doc.text(label, 14, y + i * 12);
        doc.setFont("helvetica", "normal"); doc.setTextColor(0);
        doc.text(val, 14, y + i * 12 + 5.5);
      });
      metaRight.forEach(([label, val], i) => {
        doc.setFont("helvetica", "bold"); doc.setTextColor(100);
        doc.text(label, cx + 5, y + i * 12);
        doc.setFont("helvetica", "normal"); doc.setTextColor(0);
        doc.text(val, cx + 5, y + i * 12 + 5.5);
      });

      y += Math.max(metaLeft.length, metaRight.length) * 12 + 6;

      doc.setDrawColor(200);
      doc.line(14, y, pageW - 14, y);
      y += 7;

      // Items
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("DESCRIPTION", 14, y);
      doc.text(`AMOUNT (${currency})`, pageW - 14, y, { align: "right" });
      y += 4.5;
      doc.setDrawColor(220);
      doc.line(14, y, pageW - 14, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      invoice.items.forEach((item) => {
        const lineTotal = item.quantity * item.unitPrice;
        const desc = item.description ? (item.quantity > 1 ? `${item.description} (×${item.quantity})` : item.description) : `Item (×${item.quantity})`;
        doc.text(desc, 14, y, { maxWidth: pageW - 60 });
        doc.text(`${currSymbol} ${lineTotal.toFixed(2)}`, pageW - 14, y, { align: "right" });
        y += 7;
      });

      doc.line(14, y, pageW - 14, y);
      y += 5;

      // Subtotals
      if (invoice.taxEnabled && invoice.taxAmount != null) {
        doc.setTextColor(100);
        doc.text(`Subtotal`, 14, y);
        doc.text(`${currSymbol} ${invoice.subtotal.toFixed(2)}`, pageW - 14, y, { align: "right" });
        y += 6;
        doc.text(`${taxLabel} (${invoice.taxRate}%)`, 14, y);
        doc.text(`${currSymbol} ${invoice.taxAmount.toFixed(2)}`, pageW - 14, y, { align: "right" });
        y += 6;
      }
      if (invoice.discountEnabled && invoice.discountAmount != null) {
        doc.setTextColor(100);
        doc.text("Discount", 14, y);
        doc.text(`- ${currSymbol} ${invoice.discountAmount.toFixed(2)}`, pageW - 14, y, { align: "right" });
        y += 6;
      }

      // Total box
      doc.setFillColor(240, 245, 255);
      doc.roundedRect(14, y, pageW - 28, 14, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 64, 175);
      doc.text("TOTAL", 20, y + 9);
      doc.text(`${currSymbol} ${invoice.total.toFixed(2)}`, pageW - 20, y + 9, { align: "right" });
      y += 20;

      // Bank details
      if (settings?.bankName || settings?.bankIban) {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(60);
        doc.text("Pay to:", 14, y); y += 4.5;
        doc.setFont("helvetica", "normal");
        if (settings?.bankName) { doc.text(`Bank: ${settings.bankName}`, 14, y); y += 4; }
        if (settings?.bankAccount) { doc.text(`Account: ${settings.bankAccount}`, 14, y); y += 4; }
        if (settings?.bankIban) { doc.text(`IBAN: ${settings.bankIban}`, 14, y); y += 4; }
        y += 2;
      }

      // Footer
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150);
      doc.text("Thank you for your business!", cx, y + 4, { align: "center" });
      if (settings?.email) { doc.text(settings.email, cx, y + 9, { align: "center" }); }
      if (settings?.phone) { doc.text(settings.phone, cx, y + 13, { align: "center" }); }
      if (settings?.trn) { doc.text(`TRN: ${settings.trn}`, cx, y + 17, { align: "center" }); }

      doc.save(`receipt-${invoice.invoiceNumber}.pdf`);
      toast({ title: "Receipt Voucher downloaded" });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Could not generate receipt.", variant: "destructive" });
    }
  }

  const currency = settings?.currency || "AED";
  const currSymbol = CURRENCIES[currency] || currency;

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

  const taxLabel = settings?.taxLabel || "VAT";
  const poNumber = (invoice as unknown as { poNumber?: string }).poNumber;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/invoices")} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-tight">{invoice.invoiceNumber}</h1>
              <p className="text-sm text-muted-foreground">Created {fmtDate(invoice.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* PDF Theme picker */}
            <div className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 bg-background">
              <Palette className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {PDF_THEMES.map((t) => (
                <button
                  key={t.id}
                  title={t.name}
                  onClick={() => selectTheme(t.id)}
                  style={{ background: t.dot }}
                  className={`w-5 h-5 rounded-full transition-all duration-150 ${
                    pdfThemeId === t.id
                      ? "ring-2 ring-offset-1 ring-foreground scale-110"
                      : "hover:scale-110 opacity-70 hover:opacity-100"
                  }`}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
                {PDF_THEMES.find((t) => t.id === pdfThemeId)?.name}
              </span>
            </div>

            <Select value={invoice.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
              <SelectTrigger className="w-32" data-testid="select-invoice-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleDownloadReceipt} className="gap-2" data-testid="button-download-receipt">
              <Receipt className="w-4 h-4" />
              Receipt Voucher
            </Button>
            <Button onClick={handleDownloadPDF} className="gap-2" data-testid="button-download-pdf">
              <Download className="w-4 h-4" />
              Invoice PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 sm:p-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between gap-6 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {settings?.companyLogo ? (
                    <img src={settings.companyLogo} alt="logo" className="h-10 object-contain" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <span className="font-bold text-lg">{settings?.companyName || "Your Company"}</span>
                </div>
                {settings?.address && <p className="text-sm text-muted-foreground">{settings.address}</p>}
                {settings?.phone && <p className="text-sm text-muted-foreground">{settings.phone}</p>}
                {settings?.email && <p className="text-sm text-muted-foreground">{settings.email}</p>}
                {settings?.trn && <p className="text-sm text-muted-foreground font-medium">TRN: {settings.trn}</p>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary mb-1">INVOICE</p>
                <p className="text-sm font-mono font-semibold">{invoice.invoiceNumber}</p>
                {poNumber && <p className="text-xs text-muted-foreground">PO: {poNumber}</p>}
                <p className="text-sm text-muted-foreground mt-1">Issued: {fmtDate(invoice.createdAt)}</p>
                {invoice.dueDate && <p className="text-sm text-muted-foreground">Due: {fmtDate(invoice.dueDate)}</p>}
                <span className={`inline-flex mt-2 items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[invoice.status]}`}>
                  {invoice.status}
                </span>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
              <p className="font-semibold">{invoice.customerName || "—"}</p>
            </div>

            <Separator className="mb-6" />

            {/* Line Items */}
            <div className="mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-3 font-semibold text-muted-foreground">Description</th>
                    <th className="text-center pb-3 font-semibold text-muted-foreground w-16">Qty</th>
                    <th className="text-right pb-3 font-semibold text-muted-foreground w-28">Unit Price</th>
                    <th className="text-right pb-3 font-semibold text-muted-foreground w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {invoice.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-3">{item.description || "—"}</td>
                      <td className="py-3 text-center text-muted-foreground">{item.quantity}</td>
                      <td className="py-3 text-right text-muted-foreground">{currSymbol} {item.unitPrice.toFixed(2)}</td>
                      <td className="py-3 text-right font-medium">{currSymbol} {(item.quantity * item.unitPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({currency})</span><span>{currSymbol} {invoice.subtotal.toFixed(2)}</span></div>
                {invoice.taxEnabled && invoice.taxAmount != null && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{taxLabel} ({invoice.taxRate}%)</span><span>{currSymbol} {invoice.taxAmount.toFixed(2)}</span></div>
                )}
                {invoice.discountEnabled && invoice.discountAmount != null && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- {currSymbol} {invoice.discountAmount.toFixed(2)}</span></div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total ({currency})</span>
                  <span className="text-primary">{currSymbol} {invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Bank details */}
            {(settings?.bankName || settings?.bankIban || settings?.bankAccount) && (
              <div className="mt-8 pt-6 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Details</p>
                <div className="text-sm space-y-0.5 text-muted-foreground">
                  {settings.bankName && <p>Bank: <span className="text-foreground font-medium">{settings.bankName}</span></p>}
                  {settings.bankAccount && <p>Account: <span className="text-foreground font-medium">{settings.bankAccount}</span></p>}
                  {settings.bankIban && <p>IBAN: <span className="text-foreground font-medium">{settings.bankIban}</span></p>}
                </div>
              </div>
            )}

            {/* Notes */}
            {(invoice.notes || settings?.paymentTerms || settings?.invoiceFooter) && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                {invoice.notes && <p className="text-sm text-muted-foreground">{invoice.notes}</p>}
                {settings?.paymentTerms && <p className="text-sm text-muted-foreground mt-1">{settings.paymentTerms}</p>}
                {settings?.invoiceFooter && <p className="text-sm text-muted-foreground mt-1">{settings.invoiceFooter}</p>}
              </div>
            )}

            {/* Receipt prompt */}
            <div className="mt-6 pt-6 border-t flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3">
              <Receipt className="w-5 h-5 shrink-0 text-blue-600" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-blue-800">Receipt Voucher</p>
                <p className="text-xs text-blue-600">Download a receipt voucher for this invoice at any time.</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleDownloadReceipt} className="border-blue-300 text-blue-700 hover:bg-blue-100 gap-1.5 shrink-0">
                <Receipt className="w-3.5 h-3.5" /> Download
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
