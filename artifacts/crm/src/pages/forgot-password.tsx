import { useState } from "react";
import { Link } from "wouter";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch {
      setError("Could not send reset email. Please check the address and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold">Marwo</span>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">Check your email</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the instructions.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="text-reset-error">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  data-testid="input-email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-send-reset">
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3 h-3" />
                Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
