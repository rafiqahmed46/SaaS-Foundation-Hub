import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Building2, Briefcase, ArrowLeft, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    currency: "AED",
    period: "/ month",
    description: "Perfect for freelancers and solo operators",
    icon: Zap,
    color: "border-gray-200",
    badge: null,
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
    price: 99,
    currency: "AED",
    period: "/ month",
    description: "For growing teams that need more power",
    icon: Briefcase,
    color: "border-blue-500",
    badge: "Most Popular",
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
    price: 199,
    currency: "AED",
    period: "/ month",
    description: "For established companies with full needs",
    icon: Building2,
    color: "border-gray-200",
    badge: null,
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

export default function PricingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    if (!user) {
      navigate("/signup");
      return;
    }

    setLoading(planId);
    try {
      const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          companyId: user.companyId ?? user.uid,
          companyName: user.displayName ?? "",
          email: user.email ?? "",
          successUrl: `${baseUrl}/settings`,
          cancelUrl: `${baseUrl}/pricing`,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to start checkout");
      }

      const data = await res.json() as { url: string };
      window.location.href = data.url;
    } catch (err: unknown) {
      toast({
        title: "Could not start checkout",
        description: (err as Error).message,
        variant: "destructive",
      });
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold text-gray-900 text-lg">ClearCRM</span>
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
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get started free</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Promo banner */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white text-center py-3 px-4">
        <p className="text-sm font-semibold flex items-center justify-center gap-2">
          <Tag className="w-4 h-4" />
          Limited time offer — <span className="underline underline-offset-2">50% off your first 3 months</span> on any plan. No coupon code needed.
        </p>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero text */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            No setup fees. No hidden charges. Pay monthly, cancel anytime.
            All plans include a 14-day free trial.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isPro = plan.id === "pro";
            const discountedPrice = Math.round(plan.price * 0.5);

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border-2 ${plan.color} p-7 flex flex-col ${
                  isPro ? "shadow-lg shadow-blue-100" : "shadow-sm"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white px-4 py-1 text-xs font-semibold">
                      {plan.badge}
                    </Badge>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${isPro ? "bg-blue-100" : "bg-gray-100"}`}>
                  <Icon className={`w-5 h-5 ${isPro ? "text-blue-600" : "text-gray-600"}`} />
                </div>

                <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                <p className="text-sm text-gray-500 mt-1 mb-5">{plan.description}</p>

                {/* Price with discount */}
                <div className="mb-2">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-gray-900">{discountedPrice}</span>
                    <div className="mb-1">
                      <span className="text-sm text-gray-500">{plan.currency} / month</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-400 line-through">
                      {plan.price} {plan.currency}
                    </span>
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs px-2 py-0 border-0">
                      50% off
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Then {plan.price} {plan.currency}/mo from month 4
                  </p>
                </div>

                <ul className="space-y-2.5 mb-8 flex-1 mt-4">
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
                  {loading === plan.id ? "Redirecting…" : "Claim 50% off"}
                </Button>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
          {[
            { q: "How does the 50% off work?", a: "The discount is applied automatically to your first 3 monthly payments. No coupon code needed — just click the button and checkout." },
            { q: "Do I need a credit card to start?", a: "No. Your 14-day trial starts the moment you sign up. Card details only needed when the trial ends." },
            { q: "Can I cancel any time?", a: "Yes. Cancel from your billing settings at any time. You keep access until the end of the paid period." },
            { q: "Is my data safe?", a: "All data is stored in Google Firebase with company-level isolation. No other company can see your data." },
          ].map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold text-gray-900 mb-1">{q}</h3>
              <p className="text-gray-500">{a}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
