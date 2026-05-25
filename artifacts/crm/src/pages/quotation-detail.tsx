import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { getQuotation, getSettings, updateQuotation, Quotation, Settings } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Building2, FileCheck } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

const CURRENCIES: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "C$", AUD: "A$", INR: "₹", BRL: "R$" };

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

  useEffect(() => {
    if (!id || !user?.companyId) return;
    async function load() {
      const [q, s] = await Promise.all([getQuotation(id!), getSettings(user!.companyId!)]);
      setQuotation(q);
      setSettings(s);
      setLoading(false);
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

  async function handleDownloadPDF() {
    if (!quotation || !settings) return;
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const currSymbol = CURRENCIES[settings.currency] || "$";

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

      doc.setTextColor(0);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("QUOTATION", 196, 22, { align: "right" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Quote #: ${quotation.quoteNumber}`, 196, 30, { align: "right" });
      doc.text(`Date: ${new Date(quotation.createdAt).toLocaleDateString()}`, 196, 36, { align: "right" });
      if (quotation.validUntil) doc.text(`Valid Until: ${new Date(quotation.validUntil).toLocaleDateString()}`, 196, 42, { align: "right" });
      doc.text(`Status: ${quotation.status.toUpperCase()}`, 196, 48, { align: "right" });

      doc.setTextColor(0);
      y = Math.max(y + 10, 60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Prepared For:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(quotation.customerName, 14, y + 6);

      y += 20;
      autoTable(doc, {
        startY: y,
        head: [["Description", "Qty", "Unit Price", "Total"]],
        body: quotation.items.map((item) => [item.description, item.quantity.toString(), `${currSymbol}${item.unitPrice.toFixed(2)}`, `${currSymbol}${(item.quantity * item.unitPrice).toFixed(2)}`]),
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 1: { cellWidth: 20, halign: "center" }, 2: { cellWidth: 35, halign: "right" }, 3: { cellWidth: 35, halign: "right" } },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      const rightCol = 196, leftCol = 130;
      let ty = finalY;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text("Subtotal:", leftCol, ty, { align: "right" });
      doc.setTextColor(0);
      doc.text(`${currSymbol}${quotation.subtotal.toFixed(2)}`, rightCol, ty, { align: "right" });
      if (quotation.taxEnabled && quotation.taxAmount) { ty += 6; doc.setTextColor(100); doc.text(`Tax (${quotation.taxRate}%):`, leftCol, ty, { align: "right" }); doc.setTextColor(0); doc.text(`${currSymbol}${quotation.taxAmount.toFixed(2)}`, rightCol, ty, { align: "right" }); }
      if (quotation.discountEnabled && quotation.discountAmount) { ty += 6; doc.setTextColor(100); doc.text("Discount:", leftCol, ty, { align: "right" }); doc.setTextColor(0); doc.text(`-${currSymbol}${quotation.discountAmount.toFixed(2)}`, rightCol, ty, { align: "right" }); }
      ty += 8;
      doc.setDrawColor(30, 64, 175);
      doc.line(leftCol - 10, ty - 3, rightCol, ty - 3);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 175);
      doc.text("Total:", leftCol, ty + 4, { align: "right" });
      doc.text(`${currSymbol}${quotation.total.toFixed(2)}`, rightCol, ty + 4, { align: "right" });
      if (quotation.notes) { ty += 20; doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0); doc.text("Notes:", 14, ty); doc.setFont("helvetica", "normal"); doc.setTextColor(100); doc.text(quotation.notes, 14, ty + 6, { maxWidth: 180 }); }

      doc.save(`${quotation.quoteNumber}.pdf`);
      toast({ title: "PDF downloaded" });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Could not generate PDF.", variant: "destructive" });
    }
  }

  const currSymbol = CURRENCIES[settings?.currency || "USD"] || "$";

  if (loading) return <Layout><div className="p-6 max-w-4xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div></Layout>;
  if (!quotation) return <Layout><div className="p-6 text-center"><p className="text-muted-foreground">Quotation not found.</p><Button variant="link" onClick={() => navigate("/quotations")}>Back</Button></div></Layout>;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/quotations")} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-4 h-4" /></button>
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-tight">{quotation.quoteNumber}</h1>
              <p className="text-sm text-muted-foreground">Created {new Date(quotation.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <Button onClick={handleDownloadPDF} className="gap-2"><Download className="w-4 h-4" />Download PDF</Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between gap-6 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center"><Building2 className="w-4 h-4 text-white" /></div>
                  <span className="font-bold text-lg">{settings?.companyName || "Your Company"}</span>
                </div>
                {settings?.address && <p className="text-sm text-muted-foreground">{settings.address}</p>}
                {settings?.phone && <p className="text-sm text-muted-foreground">{settings.phone}</p>}
                {settings?.email && <p className="text-sm text-muted-foreground">{settings.email}</p>}
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 mb-1">
                  <FileCheck className="w-5 h-5 text-primary" />
                  <p className="text-3xl font-bold text-primary">QUOTATION</p>
                </div>
                <p className="text-sm font-mono font-semibold">{quotation.quoteNumber}</p>
                <p className="text-sm text-muted-foreground mt-1">Issued: {new Date(quotation.createdAt).toLocaleDateString()}</p>
                {quotation.validUntil && <p className="text-sm text-muted-foreground">Valid Until: {new Date(quotation.validUntil).toLocaleDateString()}</p>}
                <span className={`inline-flex mt-2 items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[quotation.status]}`}>{quotation.status}</span>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Prepared For</p>
              <p className="font-semibold">{quotation.customerName}</p>
            </div>

            <Separator className="mb-6" />

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
                  {quotation.items.map((item, i) => (
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

            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{currSymbol}{quotation.subtotal.toFixed(2)}</span></div>
                {quotation.taxEnabled && quotation.taxAmount != null && <div className="flex justify-between"><span className="text-muted-foreground">Tax ({quotation.taxRate}%)</span><span>{currSymbol}{quotation.taxAmount.toFixed(2)}</span></div>}
                {quotation.discountEnabled && quotation.discountAmount != null && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{currSymbol}{quotation.discountAmount.toFixed(2)}</span></div>}
                <Separator />
                <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-primary">{currSymbol}{quotation.total.toFixed(2)}</span></div>
              </div>
            </div>

            {quotation.notes && (
              <div className="mt-8 pt-6 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{quotation.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
