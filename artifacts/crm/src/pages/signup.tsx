import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { MarwoWordmark, MarwoMark } from "@/components/MarwoLogo";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const returnTo = params.get("returnTo") ?? "/dashboard";
  const [form, setForm] = useState({
    displayName: "",
    companyName: "",
    email: "",
    password: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(cred.user, { displayName: form.displayName });

      // Create company document
      try {
        const companyRef = await addDoc(collection(db, "companies"), {
          name: form.companyName,
          ownerId: cred.user.uid,
          createdAt: new Date().toISOString(),
        });

        // Create user document
        await setDoc(doc(db, "users", cred.user.uid), {
          email: form.email,
          displayName: form.displayName,
          companyId: companyRef.id,
          role: "owner",
          createdAt: new Date().toISOString(),
          onboardingCompleted: false,
        });

        // Create default settings
        await setDoc(doc(db, "settings", companyRef.id), {
          companyName: form.companyName,
          companyLogo: "",
          currency: "AED",
          invoicePrefix: "INV-",
          taxEnabled: true,
          taxRate: 5,
          taxLabel: "VAT",
          discountEnabled: false,
          address: "",
          phone: "",
          email: form.email,
          website: "",
        });
      } catch (fsErr: unknown) {
        const code = (fsErr as { code?: string })?.code ?? "";
        if (code === "unavailable" || code === "permission-denied" || code === "failed-precondition") {
          // Firebase Auth account was created — let them in, show Firestore banner
          navigate("/dashboard");
          return;
        }
        throw fsErr;
      }

      navigate(returnTo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      const code = (err as { code?: string })?.code ?? "";
      if (msg.includes("email-already-in-use") || code === "auth/email-already-in-use") {
        setError("This email is already registered. Try signing in.");
      } else if (msg.includes("weak-password") || code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-sidebar p-12">
        <MarwoWordmark size={40} />
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white leading-snug">Everything your field<br />service team needs.</h2>
            <p className="mt-3 text-sidebar-foreground/60 text-sm leading-relaxed">From first call to final invoice — manage every job, customer, and contract in one place.</p>
          </div>
          <div className="space-y-4">
            {[
              { step: "1", title: "Create your account", sub: "Takes less than 2 minutes" },
              { step: "2", title: "Set up your workspace", sub: "Company info, team, and settings" },
              { step: "3", title: "Start managing jobs", sub: "Work orders, assets, invoices" },
            ].map(({ step, title, sub }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-500/25 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-orange-400">{step}</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{title}</p>
                  <p className="text-sidebar-foreground/50 text-xs mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sidebar-foreground/30 text-xs">
          &copy; {new Date().getFullYear()} Marwo · Field Service Made Simple
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto flex items-start justify-center p-5">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-4">
            <MarwoMark size={28} />
            <span className="text-base font-bold">Marwo</span>
          </div>

          {/* Link bar — always visible at top on mobile */}
          <p className="mb-4 text-center text-xs text-muted-foreground/60">
            <Link href="/pricing" className="hover:underline text-primary/80 font-medium">Pricing</Link>
            {" · "}
            <Link href="/terms" className="hover:underline">Terms</Link>
            {" · "}
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            {" · "}
            <Link href="/refund" className="hover:underline">Refunds</Link>
          </p>

          <div className="mb-5">
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Get started free — no credit card needed</p>
            <div className="mt-2 inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Free forever to start — upgrade only when you're ready
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="text-signup-error">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="displayName">Your name</Label>
              <Input
                id="displayName"
                name="displayName"
                value={form.displayName}
                onChange={onChange}
                placeholder="Jane Smith"
                required
                data-testid="input-display-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                name="companyName"
                value={form.companyName}
                onChange={onChange}
                placeholder="Acme Inc."
                required
                data-testid="input-company-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={onChange}
                placeholder="you@company.com"
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Min. 6 characters"
                  required
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading} data-testid="button-signup">
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground/60">
            By signing up you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
            {" & "}
            <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-login">
              Sign in
            </Link>
          </p>
          <p className="mt-4 pb-6 text-center text-xs text-muted-foreground/60">
            <Link href="/pricing" className="hover:underline text-primary/70">Pricing</Link>
            {" · "}
            <Link href="/terms" className="hover:underline">Terms</Link>
            {" · "}
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            {" · "}
            <Link href="/refund" className="hover:underline">Refunds</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
