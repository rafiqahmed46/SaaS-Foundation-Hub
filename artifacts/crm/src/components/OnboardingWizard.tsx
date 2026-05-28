import { useState } from "react";
import { doc, updateDoc, setDoc, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Building2, Settings, Users, CheckCircle2, ChevronRight, ChevronLeft,
  Phone, MapPin, Globe, FileText, Percent, Tag, Sparkles, ArrowRight,
} from "lucide-react";
import { MarwoMark } from "@/components/MarwoLogo";

const CURRENCIES = [
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "QAR", label: "QAR — Qatari Riyal" },
  { value: "KWD", label: "KWD — Kuwaiti Dinar" },
  { value: "BHD", label: "BHD — Bahraini Dinar" },
  { value: "OMR", label: "OMR — Omani Rial" },
];

const STEPS = [
  { id: 1, label: "Company",  icon: Building2 },
  { id: 2, label: "Settings", icon: Settings },
  { id: 3, label: "Team",     icon: Users },
  { id: 4, label: "Done",     icon: CheckCircle2 },
];

interface CompanyForm {
  companyName: string;
  phone: string;
  address: string;
  website: string;
  currency: string;
}

interface BizForm {
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  discountEnabled: boolean;
  invoicePrefix: string;
}

interface TeamForm {
  name: string;
  role: string;
  phone: string;
}

interface Props {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [company, setCompany] = useState<CompanyForm>({
    companyName: "",
    phone: "",
    address: "",
    website: "",
    currency: "AED",
  });

  const [biz, setBiz] = useState<BizForm>({
    taxEnabled: true,
    taxRate: 5,
    taxLabel: "VAT",
    discountEnabled: false,
    invoicePrefix: "INV-",
  });

  const [team, setTeam] = useState<TeamForm>({ name: "", role: "Technician", phone: "" });

  function setC<K extends keyof CompanyForm>(k: K, v: CompanyForm[K]) { setCompany(p => ({ ...p, [k]: v })); }
  function setB<K extends keyof BizForm>(k: K, v: BizForm[K]) { setBiz(p => ({ ...p, [k]: v })); }
  function setT<K extends keyof TeamForm>(k: K, v: TeamForm[K]) { setTeam(p => ({ ...p, [k]: v })); }

  async function handleFinish(skipTeam = false) {
    if (!user?.companyId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", user.companyId), {
        companyName: company.companyName || user.displayName || "My Company",
        companyLogo: "",
        currency: company.currency,
        invoicePrefix: biz.invoicePrefix,
        taxEnabled: biz.taxEnabled,
        taxRate: biz.taxRate,
        taxLabel: biz.taxLabel,
        discountEnabled: biz.discountEnabled,
        address: company.address,
        phone: company.phone,
        email: user.email ?? "",
        website: company.website,
      }, { merge: true });

      if (!skipTeam && team.name.trim()) {
        await addDoc(collection(db, "technicians"), {
          companyId: user.companyId,
          name: team.name.trim(),
          role: team.role,
          phone: team.phone,
          email: "",
          status: "active",
          skills: [],
          notes: "",
          createdAt: new Date().toISOString(),
        });
      }

      await updateDoc(doc(db, "users", user.uid), { onboardingCompleted: true });
      onComplete();
      toast({ title: "All set! Welcome to Marwo." });
    } catch {
      toast({ title: "Could not save settings", description: "You can update them in Settings anytime.", variant: "destructive" });
      onComplete();
    } finally {
      setSaving(false);
    }
  }

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-6 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <MarwoMark size={28} />
            <span className="text-white font-bold text-base">Marwo</span>
          </div>
          <h2 className="text-white text-xl font-bold leading-tight">
            {step === 1 && "Welcome! Let's set up your workspace"}
            {step === 2 && "Configure your business settings"}
            {step === 3 && "Add your first team member"}
            {step === 4 && "You're all set! 🎉"}
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {step === 1 && "Takes less than 2 minutes — you can update everything later."}
            {step === 2 && "These drive your invoices and tax calculations."}
            {step === 3 && "Add a technician now or skip and do it later."}
            {step === 4 && "Your workspace is ready. Here's what you can do next."}
          </p>

          {/* Progress bar */}
          <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-between mt-3">
            {STEPS.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                  step > s.id ? "bg-white" : step === s.id ? "bg-white/30 ring-2 ring-white" : "bg-white/10"
                )}>
                  {step > s.id
                    ? <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    : <s.icon className={cn("w-3.5 h-3.5", step === s.id ? "text-white" : "text-white/50")} />
                  }
                </div>
                <span className={cn("text-xs", step >= s.id ? "text-white" : "text-white/40")}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 min-h-[280px]">

          {/* ── Step 1: Company Profile ── */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ob-company" className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-gray-400" /> Company name *</Label>
                <Input id="ob-company" placeholder="e.g. Al Noor Technical Services" value={company.companyName} onChange={e => setC("companyName", e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-phone" className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> Phone</Label>
                  <Input id="ob-phone" placeholder="+971 50 000 0000" value={company.phone} onChange={e => setC("phone", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-website" className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-gray-400" /> Website</Label>
                  <Input id="ob-website" placeholder="www.yourcompany.ae" value={company.website} onChange={e => setC("website", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-address" className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /> Address</Label>
                <Input id="ob-address" placeholder="Dubai, UAE" value={company.address} onChange={e => setC("address", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-gray-400" /> Currency</Label>
                <Select value={company.currency} onValueChange={v => setC("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── Step 2: Business Settings ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><Percent className="w-3.5 h-3.5 text-blue-500" /> Tax / VAT enabled</p>
                  <p className="text-xs text-gray-500 mt-0.5">Adds tax line to every invoice</p>
                </div>
                <Switch checked={biz.taxEnabled} onCheckedChange={v => setB("taxEnabled", v)} />
              </div>

              {biz.taxEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tax rate (%)</Label>
                    <Input type="number" min={0} max={99} value={biz.taxRate} onChange={e => setB("taxRate", Number(e.target.value))} />
                    <p className="text-xs text-gray-400">e.g. 5 for UAE VAT</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tax label</Label>
                    <Input placeholder="VAT" value={biz.taxLabel} onChange={e => setB("taxLabel", e.target.value)} />
                    <p className="text-xs text-gray-400">Appears on PDF invoices</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">Discounts enabled</p>
                  <p className="text-xs text-gray-500 mt-0.5">Allow discount field on invoices</p>
                </div>
                <Switch checked={biz.discountEnabled} onCheckedChange={v => setB("discountEnabled", v)} />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-gray-400" /> Invoice number prefix</Label>
                <Input placeholder="INV-" value={biz.invoicePrefix} onChange={e => setB("invoicePrefix", e.target.value)} />
                <p className="text-xs text-gray-400">e.g. INV- → INV-001, or MRW- → MRW-001</p>
              </div>
            </div>
          )}

          {/* ── Step 3: First Team Member ── */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-700">Add a technician or staff member. You can add as many as you need later from the <strong>Technicians</strong> page.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-name">Full name</Label>
                <Input id="ob-name" placeholder="Ahmed Al Rashid" value={team.name} onChange={e => setT("name", e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={team.role} onValueChange={v => setT("role", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Technician","Senior Technician","Supervisor","Manager","Admin","Sales","Driver","Helper"].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-tphone">Phone</Label>
                  <Input id="ob-tphone" placeholder="+971 50 000 0000" value={team.phone} onChange={e => setT("phone", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Workspace ready</p>
                  <p className="text-xs text-green-700">Settings saved. Your team can start using Marwo right now.</p>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-700 mt-2">Start here:</p>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { icon: Users,     label: "Add your first customer",  hint: "Store contact details, track history",  href: "/customers" },
                  { icon: FileText,  label: "Create your first invoice", hint: "Send a professional PDF invoice",        href: "/invoices/new" },
                  { icon: Settings,  label: "Complete your profile",     hint: "Add logo, address, more",               href: "/settings" },
                ].map(item => (
                  <a key={item.href} href={item.href}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                      <item.icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.hint}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
          {step > 1 && step < 4 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} disabled={saving}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step === 3 && (
              <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => { setStep(4); }} disabled={saving}>
                Skip
              </Button>
            )}

            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!company.companyName.trim()}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={() => { setStep(4); handleFinish(false); }} disabled={saving}>
                {saving ? "Saving…" : <>Save & Continue <ChevronRight className="w-4 h-4 ml-1" /></>}
              </Button>
            )}
            {step === 4 && (
              <Button onClick={onComplete} className="gap-2 bg-green-600 hover:bg-green-700">
                <Sparkles className="w-4 h-4" /> Start using Marwo
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
