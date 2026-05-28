import { useState } from "react";
import { Link, useLocation } from "wouter";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const [, navigate] = useLocation();
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

      navigate("/dashboard");
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
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">ClearCRM</span>
        </div>
        <div className="space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-white">1</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Create your account</p>
              <p className="text-sidebar-foreground/50 text-xs mt-0.5">Takes less than 2 minutes</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-white">2</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Add your customers</p>
              <p className="text-sidebar-foreground/50 text-xs mt-0.5">Import or add manually</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-white">3</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Start sending invoices</p>
              <p className="text-sidebar-foreground/50 text-xs mt-0.5">Professional PDFs in seconds</p>
            </div>
          </div>
        </div>
        <p className="text-sidebar-foreground/30 text-xs">
          &copy; {new Date().getFullYear()} ClearCRM
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold">ClearCRM</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Get started — it's free</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-login">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
