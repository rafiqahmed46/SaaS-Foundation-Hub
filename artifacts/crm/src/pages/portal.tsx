import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { getInvoice, Invoice, getSettings, Settings } from "@/lib/firestore";
import { Building2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-700",
  sent:      "bg-blue-100 text-blue-700",
  paid:      "bg-green-100 text-green-700",
  overdue:   "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function formatCurrency(amount: number, currency = "AED") {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency }).format(amount);
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-GB"); }

export default function PortalPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params.invoiceId;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      try {
        const inv = await getInvoice(invoiceId);
        if (!inv) { setNotFound(true); return; }
        setInvoice(inv);
        const sett = await getSettings(inv.companyId);
        setSettings(sett);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    })();
  }, [invoiceId]);

  function downloadPDF() {
    if (!invoice || !settings) return;
    const pdf = new jsPDF();
    const currency = invoice.currency || settings.currency || "AED";

    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text(settings.companyName || "Invoice", 14, 20);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100);
    if (settings.address) pdf.text(settings.address, 14, 28);
    if (settings.phone) pdf.text(settings.phone, 14, 34);
    if (settings.trn) pdf.text(`TRN: ${settings.trn}`, 14, 40);

    pdf.setTextColor(0);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("INVOICE", 140, 20);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`#${invoice.invoiceNumber}`, 140, 28);
    pdf.text(`Date: ${fmtDate(invoice.createdAt)}`, 140, 34);
    if (invoice.dueDate) pdf.text(`Due: ${fmtDate(invoice.dueDate)}`, 140, 40);
    pdf.text(`Status: ${invoice.status.toUpperCase()}`, 140, 46);

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Bill To:", 14, 60);
    pdf.setFont("helvetica", "normal");
    pdf.text(invoice.customerName, 14, 68);

    autoTable(pdf, {
      startY: 80,
      head: [["Description", "Qty", "Unit Price", "Total"]],
      body: invoice.items.map((item) => [
        item.description,
        item.quantity,
        formatCurrency(item.unitPrice, currency),
        formatCurrency(item.quantity * item.unitPrice, currency),
      ]),
      foot: [
        ["", "", "Subtotal", formatCurrency(invoice.subtotal, currency)],
        ...(invoice.taxEnabled && invoice.taxAmount ? [["", "", `VAT (${invoice.taxRate}%)`, formatCurrency(invoice.taxAmount, currency)]] : []),
        ...(invoice.discountEnabled && invoice.discountAmount ? [["", "", "Discount", `-${formatCurrency(invoice.discountAmount, currency)}`]] : []),
        [{ content: "TOTAL", colSpan: 2 }, "", formatCurrency(invoice.total, currency)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    pdf.save(`${invoice.invoiceNumber}.pdf`);
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center p-6">
      <div>
        <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Invoice not found</h2>
        <p className="text-sm text-muted-foreground mt-1">This invoice link may have expired or been removed.</p>
      </div>
    </div>
  );

  if (!invoice) return null;

  const currency = invoice.currency || settings?.currency || "AED";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm">{settings?.companyName || "Invoice"}</span>
          </div>
          <Button onClick={downloadPDF} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> Download PDF
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Invoice card */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-primary/5 px-6 py-5 border-b">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Invoice from</p>
                <h2 className="text-xl font-bold mt-0.5">{settings?.companyName}</h2>
                {settings?.address && <p className="text-sm text-muted-foreground mt-1">{settings.address}</p>}
                {settings?.trn && <p className="text-xs text-muted-foreground mt-0.5">TRN: {settings.trn}</p>}
              </div>
              <div className="text-left sm:text-right">
                <p className="font-mono text-lg font-semibold">#{invoice.invoiceNumber}</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize mt-1 ${STATUS_STYLES[invoice.status] || STATUS_STYLES.draft}`}>
                  {invoice.status}
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Bill To</p>
                <p className="font-medium">{invoice.customerName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Invoice Date</p>
                <p className="font-medium">{fmtDate(invoice.createdAt)}</p>
              </div>
              {invoice.dueDate && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Due Date</p>
                  <p className="font-medium">{fmtDate(invoice.dueDate)}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="rounded-lg border overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Description</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Qty</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Unit Price</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoice.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5">
                        <p>{item.description}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{item.quantity} × {formatCurrency(item.unitPrice, currency)}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right hidden sm:table-cell">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right hidden sm:table-cell">{formatCurrency(item.unitPrice, currency)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(item.quantity * item.unitPrice, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full sm:w-64 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal, currency)}</span>
                </div>
                {invoice.taxEnabled && invoice.taxAmount != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT ({invoice.taxRate}%)</span>
                    <span>{formatCurrency(invoice.taxAmount, currency)}</span>
                  </div>
                )}
                {invoice.discountEnabled && invoice.discountAmount != null && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(invoice.discountAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total, currency)}</span>
                </div>
                {invoice.amountPaid != null && invoice.amountPaid > 0 && (
                  <>
                    <div className="flex justify-between text-green-600 text-sm">
                      <span>Paid</span>
                      <span>-{formatCurrency(invoice.amountPaid, currency)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t pt-2">
                      <span>Balance Due</span>
                      <span className="text-red-600">{formatCurrency(invoice.total - invoice.amountPaid, currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            )}
            {settings?.bankName && (
              <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Bank Details</p>
                <p>Bank: {settings.bankName}</p>
                {settings.bankAccount && <p>Account: {settings.bankAccount}</p>}
                {settings.bankIban && <p>IBAN: {settings.bankIban}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Feedback section */}
        {!submitted ? (
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold mb-1">Rate Our Service</h3>
            <p className="text-sm text-muted-foreground mb-4">How would you rate your experience?</p>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-3xl transition-transform hover:scale-110 ${star <= rating ? "text-amber-400" : "text-gray-200"}`}
                >
                  ★
                </button>
              ))}
            </div>
            {rating > 0 && (
              <>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Any comments? (optional)"
                  rows={3}
                  className="w-full text-sm border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button onClick={() => setSubmitted(true)} className="mt-3 w-full sm:w-auto">Submit Feedback</Button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-2xl mb-2">🙏</p>
            <h3 className="font-semibold text-green-700">Thank you for your feedback!</h3>
            <p className="text-sm text-green-600 mt-1">We appreciate you taking the time to share your experience.</p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">Powered by ClearCRM</p>
      </div>
    </div>
  );
}
