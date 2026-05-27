import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  AlertTriangle,
  ExternalLink,
  ClipboardList,
  CheckSquare,
  RefreshCw,
  Upload,
  Wallet,
  Wrench,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ModuleKey } from "@/lib/firestore";

const ALL_NAV = [
  { href: "/dashboard",    label: "Dashboard",   icon: LayoutDashboard, module: "dashboard"    as ModuleKey },
  { href: "/customers",    label: "Customers",   icon: Users,           module: "customers"    as ModuleKey },
  { href: "/invoices",     label: "Invoices",    icon: FileText,        module: "invoices"     as ModuleKey },
  { href: "/quotations",   label: "Quotations",  icon: ClipboardList,   module: "quotations"   as ModuleKey },
  { href: "/tasks",        label: "Tasks",       icon: CheckSquare,     module: "tasks"        as ModuleKey },
  { href: "/technicians",  label: "Technicians", icon: Wrench,          module: "technicians"  as ModuleKey },
  { href: "/finance",      label: "Finance",     icon: Wallet,          module: "finance"      as ModuleKey },
  { href: "/import",       label: "Import Data", icon: Upload,          module: null },
  { href: "/settings",     label: "Settings",    icon: Settings,        module: "settings"     as ModuleKey },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [settingUp, setSettingUp] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { user, firestoreError, needsSetup, refreshUser, completeSetup } = useAuth();
  const { canAccess } = usePermissions();
  const { toast } = useToast();
  const navItems = ALL_NAV.filter((item) => item.module === null || canAccess(item.module));

  async function handleLogout() {
    try {
      await signOut(auth);
      navigate("/login");
    } catch {
      toast({ title: "Error", description: "Failed to sign out", variant: "destructive" });
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      await refreshUser();
    } finally {
      setRetrying(false);
    }
  }

  async function handleCompleteSetup() {
    if (!companyName.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    setSettingUp(true);
    try {
      await completeSetup(companyName.trim());
      setSetupOpen(false);
      setCompanyName("");
      toast({ title: "Setup complete! Welcome to ClearCRM." });
    } catch {
      toast({ title: "Setup failed", description: "Check your Firestore rules and try again.", variant: "destructive" });
    } finally {
      setSettingUp(false);
    }
  }

  const showBanner = firestoreError || needsSetup;

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex flex-col h-full bg-sidebar text-sidebar-foreground", mobile ? "w-72" : "w-64")}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight text-white">ClearCRM</span>
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-sidebar-foreground/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active ? "bg-sidebar-primary text-white shadow-sm" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
              )}
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-xs font-bold text-white">
            {(user?.displayName || user?.email || "U")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.displayName || "User"}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex shrink-0"><Sidebar /></aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full z-10 shadow-2xl"><Sidebar mobile /></aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" data-testid="button-mobile-menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Building2 className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm">ClearCRM</span>
          </div>
        </header>

        {/* Setup / Firestore error banner */}
        {showBanner && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 hidden sm:block" />
            <div className="flex-1">
              {needsSetup ? (
                <span>
                  <span className="font-semibold">Company setup incomplete.</span>
                  {" "}Your account exists but no company workspace was created yet. Click <strong>Complete Setup</strong> to finish.
                </span>
              ) : firestoreError === "permission-denied" ? (
                <span>
                  <span className="font-semibold">Firestore rules blocking access.</span>
                  {" "}In Firebase Console → Firestore → Rules, set:{" "}
                  <code className="bg-amber-100 px-1 rounded text-xs font-mono">allow read, write: if request.auth != null;</code>
                  {" "}(service must be <strong>cloud.firestore</strong>, not beta1). Then click Retry.
                </span>
              ) : (
                <span>
                  <span className="font-semibold">Firestore not reachable.</span>
                  {" "}Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Firebase Console</a> → Firestore Database → Create database (test mode). Then click Retry.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {needsSetup ? (
                <Button size="sm" onClick={() => setSetupOpen(true)} className="gap-1.5 h-8">
                  Complete Setup
                </Button>
              ) : (
                <>
                  <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber-700 underline hover:text-amber-900 text-xs font-medium">
                    Firebase Console <ExternalLink className="w-3 h-3" />
                  </a>
                  <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying} className="gap-1.5 h-8 border-amber-300 text-amber-800 hover:bg-amber-100">
                    <RefreshCw className={cn("w-3 h-3", retrying && "animate-spin")} />
                    {retrying ? "Retrying…" : "Retry"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Complete Setup Dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Your Setup</DialogTitle>
            <DialogDescription>
              Enter your company name to finish creating your workspace. This only needs to be done once.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label htmlFor="setup-company">Company Name *</Label>
            <Input
              id="setup-company"
              placeholder="Acme Inc."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCompleteSetup()}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSetupOpen(false)} disabled={settingUp}>Cancel</Button>
            <Button onClick={handleCompleteSetup} disabled={settingUp || !companyName.trim()}>
              {settingUp ? "Setting up…" : "Create Workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
