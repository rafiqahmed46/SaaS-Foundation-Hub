import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { MarwoMark } from "@/components/MarwoLogo";

interface LegalLayoutProps {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}

const LEGAL_PATHS = ["/terms", "/privacy", "/refund"];

export default function LegalLayout({ title, effectiveDate, children }: LegalLayoutProps) {
  const [location] = useLocation();

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/pricing";
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <MarwoMark size={28} />
            <span className="font-bold text-gray-900">Marwo</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              View Pricing
            </Link>
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 sm:px-10 py-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-sm text-gray-400 mb-8">Effective date: {effectiveDate}</p>
          <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-6">
            {children}
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-400">
        <span>© {new Date().getFullYear()} Marwo. All rights reserved.</span>
        <div className="flex items-center gap-4">
          {!LEGAL_PATHS.includes(location) || location !== "/terms" ? (
            <Link href="/terms" className="hover:text-gray-700 transition-colors">Terms of Service</Link>
          ) : null}
          {location !== "/privacy" ? (
            <Link href="/privacy" className="hover:text-gray-700 transition-colors">Privacy Policy</Link>
          ) : null}
          {location !== "/refund" ? (
            <Link href="/refund" className="hover:text-gray-700 transition-colors">Refund Policy</Link>
          ) : null}
          {location !== "/pricing" ? (
            <Link href="/pricing" className="hover:text-gray-700 text-blue-500 transition-colors font-medium">Pricing</Link>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
