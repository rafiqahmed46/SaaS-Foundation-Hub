import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MarwoMark } from "@/components/MarwoLogo";
import { Zap, ShieldCheck, Clock, ArrowRight, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLocation } from "wouter";

export default function UpgradePage() {
  const { user, subscription, trialDaysLeft } = useAuth();
  const [, navigate] = useLocation();

  async function handleSignOut() {
    await signOut(auth);
    navigate("/login");
  }

  const isTrialExpired = subscription?.status === "trialing" && trialDaysLeft === 0;
  const isCancelled = subscription?.status === "cancelled" || subscription?.status === "paused";
  const noSubscription = !subscription;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MarwoMark size={32} />
          <span className="font-semibold text-gray-900 text-lg">Marwo</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-8 h-8 text-blue-600" />
          </div>

          {/* Headline */}
          {isTrialExpired || noSubscription ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Your free trial has ended</h1>
              <p className="text-gray-500 mb-8">
                Your 14-day trial is over. Subscribe to keep access to all your customers, invoices, work orders, and more.
              </p>
            </>
          ) : isCancelled ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Subscription paused</h1>
              <p className="text-gray-500 mb-8">
                Your subscription is no longer active. Resubscribe to restore full access to your account.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Upgrade to continue</h1>
              <p className="text-gray-500 mb-8">
                Choose a plan to unlock full access to Marwo.
              </p>
            </>
          )}

          {/* CTA */}
          <Link href="/pricing">
            <Button size="lg" className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white mb-4">
              <Zap className="w-5 h-5" />
              View plans & subscribe
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>

          <Link href="/settings">
            <Button variant="ghost" size="sm" className="w-full text-gray-500">
              Go to settings
            </Button>
          </Link>

          {/* Trust badges */}
          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              { icon: Clock, label: "14-day free trial" },
              { icon: ShieldCheck, label: "Cancel anytime" },
              { icon: Zap, label: "Instant access" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>

          {/* Account info */}
          {user?.email && (
            <p className="mt-8 text-xs text-gray-400">
              Signed in as <span className="font-medium text-gray-500">{user.email}</span>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
