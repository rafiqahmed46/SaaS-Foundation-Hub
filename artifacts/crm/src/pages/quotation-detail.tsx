import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { getQuotation, getSettings, updateQuotation, addInvoice, getNextInvoiceNumber, Quotation, Settings } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { ArrowLeft, Download, Building2, FileCheck, ArrowRightLeft, Pencil, Eye, ChevronDown, MessageCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CURRENCIES, getCurrencySymbol, fmtDate } from "@/lib/utils-crm";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

export default function QuotationDetailPage() {
  const [, params] = useRoute("/quotations/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const id = params?.id;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [converting, setConverting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [q, s] = await Promise.all([
          getQuotation(id!),
          user?.companyId ? getSettings(user.companyId) : Promise.resolve(null),
        ]);
        setQuotation(q);
        setSettings(s);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, user?.companyId]);

  async function handleStatusChange(newStatus: string) {
    if (!id || !quotation) return;
    setUpdatingStatus(true);
    try {
      await updateQuotation(id, { status: newStatus as Quotation["status"] });
      setQuotation((prev) => prev ? { ...prev, status: newStatus as Quotation["status"] } : prev);
      toast({ title: "Status updated" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleConvertToInvoice() {
    if (!quotation || !user?.companyId) {
      toast({ title: "Setup incomplete", description: "Company workspace not ready.", variant: "destructive" });
      return;
    }
    setConverting(true);
    try {
      const invoiceNumber = await getNextInvoiceNumber(
        user.companyId,
        settings?.invoicePrefix || "INV-"
      );

      const invoiceRef = await addInvoice({
        companyId: user.companyId,
        customerId: quotation.customerId,
        customerName: quotation.customerName,
        invoiceNumber,
        status: "draft",
        items: quotation.items,
        subtotal: quotation.subtotal,
        taxEnabled: quotation.taxEnabled,
        taxRate: quotation.taxRate,
        taxAmount: quotation.taxAmount,
        discountEnabled: quotation.discountEnabled,
        discountType: quotation.discountType,
        discountValue: quotation.discountValue,
        discountAmount: quotation.discountAmount,
        total: quotation.total,
        notes: quotation.notes,
      });

      // Mark quotation as accepted
      await updateQuotation(id!, { status: "accepted" });
      setQuotation((prev) => prev ? { ...prev, status: "accepted" } : prev);

      toast({
        title: "Invoice created!",
        description: `${invoiceNumber} created from ${quotation.quoteNumber}. Quotation marked as accepted.`,
      });

      // Navigate to the new invoice
      navigate(`/invoices/${invoiceRef.id}`);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "permission-denied") {
        toast({ title: "Permission denied", description: "Fix Firestore rules in Firebase Console.", variant: "destructive" });
      } else {
        toast({ title: "Could not convert", description: "An error occurred. Please try again.", variant: "destructive" });
      }
    } finally {
      setConverting(false);
      setConfirmOpen(false);
    }
  }

  async function buildQuotationPDF() {
    if (!quotation) throw new Error("No quotation");
    {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ format: "a4" });
      const currency = quotation?.currency || settings?.currency || "AED";
      const currSymbol = getCurrencySymbol(currency);
      const taxLabel = settings?.taxLabel || "VAT";
      const pageW = doc.internal.pageSize.getWidth();   // 210 mm
      const pageH = doc.internal.pageSize.getHeight();  // 297 mm
      const M = 18; // margin

      // ── Header bar (54 mm) ─────────────────────────────────────────────────
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageW, 54, "F");

      // Company name (left)
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(settings?.companyName || "Company", M, 22);

      // "QUOTATION" label (right)
      doc.setFontSize(28);
      doc.text("QUOTATION", pageW - M, 24, { align: "right" });

      // Company sub-details
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 215, 255);
      let hy = 32;
      if (settings?.address) { doc.text(settings.address, M, hy); hy += 5.5; }
      if (settings?.phone)   { doc.text(`Tel: ${settings.phone}`, M, hy); hy += 5.5; }
      if (settings?.email)   { doc.text(settings.email, M, hy); }

      // Quote meta (right)
      doc.setTextColor(180, 205, 255);
      doc.setFontSize(10);
      if (settings?.trn) { doc.text(`TRN: ${settings.trn}`, pageW - M, 33, { align: "right" }); }
      doc.text(`Quote #: ${quotation.quoteNumber}`, pageW - M, 42, { align: "right" });
      doc.text(`Date: ${fmtDate(quotation.createdAt)}`, pageW - M, 50, { align: "right" });

      // ── Prepared For + Meta block ──────────────────────────────────────────
      let y = 68;
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(150);
      doc.text("PREPARED FOR", M, y);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20);
      doc.text(quotation.customerName || "—", M, y + 8);

      const metaRight: [string, string][] = [
        ["Quote No:", quotation.quoteNumber],
        ["Date:", fmtDate(quotation.createdAt)],
      ];
      if (quotation.validUntil) metaRight.push(["Valid Until:", fmtDate(quotation.validUntil)]);
      metaRight.push(["Status:", quotation.status.toUpperCase()]);
      let ry = y;
      metaRight.forEach(([label, value]) => {
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold"); doc.setTextColor(120);
        doc.text(label, pageW - 74, ry, { align: "right" });
        doc.setFont("helvetica", "normal"); doc.setTextColor(20);
        doc.text(value, pageW - M, ry, { align: "right" });
        ry += 8;
      });

      y = Math.max(y + 22, ry + 4);
      doc.setDrawColor(220);
      doc.setLineWidth(0.4);
      doc.line(M, y, pageW - M, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [["#", "Description", "Qty", `Unit Price (${currency})`, `Amount (${currency})`]],
        body: quotation.items.map((item, i) => [
          String(i + 1),
          item.description || "—",
          item.quantity.toString(),
          `${currSymbol} ${item.unitPrice.toFixed(2)}`,
          `${currSymbol} ${(item.quantity * item.unitPrice).toFixed(2)}`,
        ]),
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 11 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 42, halign: "right" },
          4: { cellWidth: 42, halign: "right" },
        },
        margin: { left: M, right: M },
        styles: { fontSize: 11, cellPadding: 4.5, textColor: 40 },
      });

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      const rightCol = pageW - M;
      const labelCol = pageW - 72;
      let ty = finalY;

      const totRow = (label: string, value: string) => {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal"); doc.setTextColor(100);
        doc.text(label, labelCol, ty, { align: "right" });
        doc.setTextColor(20);
        doc.text(value, rightCol, ty, { align: "right" });
        ty += 9;
      };
      totRow("Subtotal:", `${currSymbol} ${quotation.subtotal.toFixed(2)}`);
      if (quotation.taxEnabled && quotation.taxAmount != null)
        totRow(`${taxLabel} (${quotation.taxRate}%):`, `${currSymbol} ${quotation.taxAmount.toFixed(2)}`);
      if (quotation.discountEnabled && quotation.discountAmount != null)
        totRow("Discount:", `- ${currSymbol} ${quotation.discountAmount.toFixed(2)}`);

      // Total box (filled)
      ty += 2;
      doc.setFillColor(30, 64, 175);
      doc.roundedRect(labelCol - 26, ty - 7, rightCol - labelCol + 44, 16, 2, 2, "F");
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(`TOTAL (${currency}):`, labelCol, ty + 4, { align: "right" });
      doc.text(`${currSymbol} ${quotation.total.toFixed(2)}`, rightCol - 1, ty + 4, { align: "right" });
      ty += 20;

      if (quotation.notes) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold"); doc.setTextColor(20);
        doc.text("Notes:", M, ty);
        ty += 7;
        doc.setFont("helvetica", "normal"); doc.setTextColor(100);
        const split = doc.splitTextToSize(quotation.notes, pageW - M * 2);
        doc.setFontSize(10.5);
        doc.text(split, M, ty);
      }

      // ── Page footer ────────────────────────────────────────────────────────
      doc.setDrawColor(210, 220, 240);
      doc.setLineWidth(0.3);
      doc.line(M, pageH - 18, pageW - M, pageH - 18);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150);
      doc.text(settings?.companyName || "", M, pageH - 10);
      if (settings?.trn) doc.text(`TRN: ${settings.trn}`, pageW / 2, pageH - 10, { align: "center" });
      doc.text("Page 1", pageW - M, pageH - 10, { align: "right" });

      return doc;
    }
  }

  async function handleViewQuotationPDF() {
    try {
      const doc = await buildQuotationPDF();
      window.open(doc.output("bloburl") as unknown as string, "_blank");
    } catch (err) { console.error(err); toast({ title: "Could not generate PDF", variant: "destructive" }); }
  }

  async function handleDownloadPDF() {
    try {
      const doc = await buildQuotationPDF();
      doc.save(`${quotation!.quoteNumber}.pdf`);
      toast({ title: "Quotation PDF downloaded" });
    } catch (err) { console.error(err); toast({ title: "Could not generate PDF", variant: "destructive" }); }
  }

  async function handleWhatsAppQuotation() {
    try {
      const doc = await buildQuotationPDF();
      const filename = `${quotation!.quoteNumber}.pdf`;
      const sym = getCurrencySymbol(quotation!.currency || settings?.currency || "AED");
      const msg = [
        `*QUOTATION – ${quotation!.quoteNumber}*`,
        `*${settings?.companyName || ""}*`,
        settings?.trn ? `TRN: ${settings.trn}` : "",
        ``,
        `*Prepared For:* ${quotation!.customerName}`,
        quotation!.validUntil ? `*Valid Until:* ${fmtDate(quotation!.validUntil)}` : "",
        `*Amount:* ${sym} ${quotation!.total.toFixed(2)}`,
        `*Status:* ${quotation!.status.toUpperCase()}`,
      ].filter(Boolean).join("\n");

      // Mobile: native share sheet sends the actual PDF file to WhatsApp
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        const blob = doc.output("blob");
        const file = new File([blob], filename, { type: "application/pdf" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return;
        }
      }

      // Desktop fallback: save PDF locally then open WhatsApp with pre-filled text
      doc.save(filename);
      setTimeout(() => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank"), 500);
      toast({ title: "PDF saved — WhatsApp opening", description: "Attach the downloaded PDF in the chat." });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      console.error(err);
      toast({ title: "Could not generate PDF", variant: "destructive" });
    }
  }

  const currency = quotation?.currency || settings?.currency || "AED";
  const currSymbol = getCurrencySymbol(currency);
  const taxLabel = settings?.taxLabel || "VAT";

  if (loading) return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" />
      </div>
    </Layout>
  );

  if (!quotation) return (
    <Layout>
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Quotation not found.</p>
        <Button variant="link" onClick={() => navigate("/quotations")}>Back</Button>
      </div>
    </Layout>
  );

  const alreadyConverted = quotation.status === "accepted";

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/quotations")} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-tight">{quotation.quoteNumber}</h1>
              <p className="text-sm text-muted-foreground">Created {fmtDate(quotation.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={quotation.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => navigate(`/quotations/${quotation.id}/edit`)} className="gap-2">
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              disabled={converting}
              className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
              data-testid="button-convert-to-invoice"
            >
              <ArrowRightLeft className="w-4 h-4" />
              {alreadyConverted ? "Convert Again" : "Convert to Invoice"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2" data-testid="button-download-pdf">
                  <Download className="w-4 h-4" /> Quotation PDF <ChevronDown className="w-3 h-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleViewQuotationPDF} className="gap-2 cursor-pointer">
                  <Eye className="w-4 h-4 text-blue-600" /> View PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPDF} className="gap-2 cursor-pointer">
                  <Download className="w-4 h-4 text-primary" /> Download PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleWhatsAppQuotation} className="gap-2 cursor-pointer">
                  <MessageCircle className="w-4 h-4 text-green-600" /> Send via WhatsApp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <div className="flex items-center justify-end gap-2 mb-1">
                  <FileCheck className="w-5 h-5 text-primary" />
                  <p className="text-3xl font-bold text-primary">QUOTATION</p>
                </div>
                <p className="text-sm font-mono font-semibold">{quotation.quoteNumber}</p>
                <p className="text-sm text-muted-foreground mt-1">Issued: {fmtDate(quotation.createdAt)}</p>
                {quotation.validUntil && <p className="text-sm text-muted-foreground">Valid Until: {fmtDate(quotation.validUntil)}</p>}
                <span className={`inline-flex mt-2 items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[quotation.status]}`}>
                  {quotation.status}
                </span>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Prepared For</p>
              <p className="font-semibold">{quotation.customerName || "—"}</p>
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
                  {quotation.items.map((item, i) => (
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
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({currency})</span><span>{currSymbol} {quotation.subtotal.toFixed(2)}</span></div>
                {quotation.taxEnabled && quotation.taxAmount != null && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{taxLabel} ({quotation.taxRate}%)</span><span>{currSymbol} {quotation.taxAmount.toFixed(2)}</span></div>
                )}
                {quotation.discountEnabled && quotation.discountAmount != null && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- {currSymbol} {quotation.discountAmount.toFixed(2)}</span></div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total ({currency})</span>
                  <span className="text-primary">{currSymbol} {quotation.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {quotation.notes && (
              <div className="mt-8 pt-6 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{quotation.notes}</p>
              </div>
            )}

            {/* Convert to Invoice CTA */}
            <div className="mt-6 pt-6 border-t flex items-center gap-3 bg-green-50 rounded-xl px-4 py-3">
              <ArrowRightLeft className="w-5 h-5 shrink-0 text-green-600" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-green-800">Convert to Invoice</p>
                <p className="text-xs text-green-600">
                  {alreadyConverted
                    ? "This quotation was already accepted. You can still create another invoice from it."
                    : "One click converts this quotation into a draft invoice, copies all items and totals, and marks this quote as accepted."}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={converting}
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5 shrink-0"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {converting ? "Converting…" : "Convert"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new <strong>draft invoice</strong> with all the items, tax, and discount from{" "}
              <strong>{quotation.quoteNumber}</strong>, and mark the quotation as <strong>Accepted</strong>.
              {quotation.customerName && (
                <span> The invoice will be billed to <strong>{quotation.customerName}</strong>.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={converting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertToInvoice} disabled={converting} className="bg-green-600 hover:bg-green-700">
              {converting ? "Converting…" : "Yes, Convert to Invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
