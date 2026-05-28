import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Briefcase, Building2, ArrowLeft, Tag } from "lucide-react";
import { MarwoMark } from "@/components/MarwoLogo";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

interface PromoConfig {
  enabled: boolean;
  percentOff: number;
  durationMonths: number;
  message: string;
  expiresAt: string;
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 9.99,
    symbol: "$",
    description: "Perfect for freelancers and solo operators",
    icon: Zap,
    color: "border-gray-200",
    badge: null as string | null,
    features: [
      "Up to 50 customers",
      "Unlimited invoices & quotations",
      "Work orders & tasks",
      "PDF invoice export",
      "Client payment portal",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 14.99,
    symbol: "$",
    description: "For growing teams that need more power",
    icon: Briefcase,
    color: "border-blue-500",
    badge: "Most Popular" as string | null,
    features: [
      "Unlimited customers",
      "Unlimited invoices & quotations",
      "Work orders, tasks & calendar",
      "Asset & contract management",
      "Team members (up to 5)",
      "Reports & analytics",
      "PDF invoice export",
      "Client payment portal",
      "Priority support",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 24.99,
    symbol: "$",
    description: "For established companies with full needs",
    icon: Building2,
    color: "border-gray-200",
    badge: null as string | null,
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Custom invoice branding",
      "Advanced reports & exports",
      "CSV import/export",
      "Dedicated onboarding",
      "Phone & chat support",
    ],
  },
];

const PADDLE_PRICE_IDS: Record<string, string | undefined> = {
  starter: import.meta.env.VITE_PADDLE_PRICE_STARTER as string | undefined,
  pro: import.meta.env.VITE_PADDLE_PRICE_PRO as string | undefined,
  business: import.meta.env.VITE_PADDLE_PRICE_BUSINESS as string | undefined,
};

export default function PricingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [promo, setPromo] = useState<PromoConfig | null>(null);
  const [paddle, setPaddle] = useState<Paddle | undefined>();

  useEffect(() => {
    getDoc(doc(db, "adminConfig", "promotions"))
      .then((snap) => { if (snap.exists()) setPromo(snap.data() as PromoConfig); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
    if (!token) return;
    const env = import.meta.env.VITE_PADDLE_ENVIRONMENT as string | undefined;
    initializePaddle({
      environment: env === "sandbox" ? "sandbox" : "production",
      token,
    })
      .then((instance) => { if (instance) setPaddle(instance); })
      .catch(() => {});
  }, []);

  const isPromoActive = promo?.enabled === true;
  const percentOff = promo?.percentOff ?? 50;
  const durationMonths = promo?.durationMonths ?? 3;
  const bannerMessage = (promo?.message ?? "")
    .replace("{percent}", String(percentOff))
    .replace("{months}", String(durationMonths));

  function handleSubscribe(planId: string) {
    if (!user) { navigate("/signup"); return; }

    const priceId = PADDLE_PRICE_IDS[planId];
    if (!priceId) {
      toast({
        title: "Plan not yet active",
        description: "Contact support to subscribe to this plan.",
        variant: "destructive",
      });
      return;
    }

    if (!paddle) {
      toast({ title: "Payment loading…", description: "Please wait a moment and try again.", variant: "destructive" });
      return;
    }

    setLoading(planId);
    const baseUrl = window.location.origin + (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    try {
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: { email: user.email ?? "" },
        customData: { companyId: user.companyId ?? user.uid, planId },
        settings: {
          successUrl: `${baseUrl}/settings?subscription=success`,
          displayMode: "overlay",
          theme: "light",
          locale: "en",
        },
      });
    } catch (err: unknown) {
      toast({ title: "Could not open checkout", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MarwoMark size={32} />
          <span className="font-semibold text-gray-900 text-lg">Marwo</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
              <Link href="/signup"><Button size="sm">Get started free</Button></Link>
            </>
          )}
        </div>
      </header>

      {/* Promo banner */}
      {isPromoActive && (
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white text-center py-3 px-4">
          <p className="text-sm font-semibold flex items-center justify-center gap-2">
            <Tag className="w-4 h-4 shrink-0" />
            {bannerMessage || `Limited time — ${percentOff}% off your first ${durationMonths} months. No coupon code needed.`}
          </p>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            No setup fees. No hidden charges. Pay monthly, cancel anytime.
            All plans include a 14-day free trial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isPro = plan.id === "pro";
            const discountedPrice = isPromoActive
              ? Math.round(plan.price * (1 - percentOff / 100) * 100) / 100
              : null;

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border-2 ${plan.color} p-7 flex flex-col ${isPro ? "shadow-lg shadow-blue-100" : "shadow-sm"}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white px-4 py-1 text-xs font-semibold">{plan.badge}</Badge>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${isPro ? "bg-blue-100" : "bg-gray-100"}`}>
                  <Icon className={`w-5 h-5 ${isPro ? "text-blue-600" : "text-gray-600"}`} />
                </div>

                <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                <p className="text-sm text-gray-500 mt-1 mb-5">{plan.description}</p>

                {/* Price display */}
                {isPromoActive && discountedPrice !== null ? (
                  <div className="mb-4">
                    <div className="flex items-end gap-0.5">
                      <span className="text-xl font-bold text-gray-900 mb-0.5">{plan.symbol}</span>
                      <span className="text-4xl font-bold text-gray-900">{discountedPrice.toFixed(2)}</span>
                      <span className="text-sm text-gray-500 mb-1 ml-1">/ month</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-400 line-through">{plan.symbol}{plan.price.toFixed(2)}</span>
                      <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs px-2 py-0 border-0">
                        {percentOff}% off
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Then {plan.symbol}{plan.price.toFixed(2)}/mo from month {durationMonths + 1}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-end gap-0.5 mb-6">
                    <span className="text-xl font-bold text-gray-900 mb-0.5">{plan.symbol}</span>
                    <span className="text-4xl font-bold text-gray-900">{plan.price.toFixed(2)}</span>
                    <span className="text-sm text-gray-500 mb-1 ml-1">/ month</span>
                  </div>
                )}

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${isPro ? "text-blue-600" : "text-green-500"}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${isPro ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                  variant={isPro ? "default" : "outline"}
                  disabled={loading === plan.id}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {loading === plan.id ? "Opening checkout…" : isPromoActive ? `Claim ${percentOff}% off` : "Start free trial"}
                </Button>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
          {[
            isPromoActive
              ? { q: `How does the ${percentOff}% off work?`, a: `The discount is applied automatically to your first ${durationMonths} months. No coupon code needed — just click the button and checkout.` }
              : { q: "Is there a free trial?", a: "Yes — all plans include a 14-day free trial. No credit card required to start." },
            { q: "Can I cancel any time?", a: "Yes. Cancel from your billing settings at any time. You keep access until the end of the paid period." },
            { q: "Can I switch plans?", a: "Yes, upgrade or downgrade any time. Changes take effect at the next billing cycle." },
            { q: "Is my data safe?", a: "All data is stored in Google Firebase with company-level isolation. No other company can see your data." },
          ].map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold text-gray-900 mb-1">{q}</h3>
              <p className="text-gray-500">{a}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <span>
            © {new Date().getFullYear()} Marwo. All rights reserved.{" "}
            Payments processed by{" "}
            <a href="https://www.paddle.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Paddle</a>.
          </span>
          <div className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-gray-700 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-gray-700 transition-colors">Privacy Policy</Link>
            <Link href="/refund" className="hover:text-gray-700 transition-colors">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
