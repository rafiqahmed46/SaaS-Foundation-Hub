import { useState } from "react";
import { Link, useLocation } from "wouter";
import OnboardingWizard from "@/components/OnboardingWizard";
import {
  LayoutDashboard, Users, FileText, Settings, LogOut, Menu, X,
  AlertTriangle, ExternalLink, ClipboardList, CheckSquare,
  RefreshCw, Upload, Wallet, Wrench, ClipboardCheck, Box,
  FileCheck, BarChart3, CalendarDays, ChevronDown, ChevronRight, ShieldCheck,
} from "lucide-react";
import { MarwoMark } from "@/components/MarwoLogo";
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

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: ModuleKey | null;
  children?: NavItem[];
};

const ALL_NAV: NavItem[] = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard, module: "dashboard" },
  { href: "/customers",   label: "Customers",   icon: Users,           module: "customers" },
  {
    href: "/operations", label: "Operations", icon: ClipboardCheck, module: null,
    children: [
      { href: "/work-orders", label: "Work Orders",  icon: ClipboardCheck, module: "work-orders" },
      { href: "/tasks",       label: "Tasks",        icon: CheckSquare,    module: "tasks" },
      { href: "/calendar",    label: "Calendar",     icon: CalendarDays,   module: "calendar" },
    ],
  },
  {
    href: "/service", label: "Service", icon: Wrench, module: null,
    children: [
      { href: "/assets",     label: "Assets",     icon: Box,       module: "assets" },
      { href: "/contracts",  label: "Contracts",  icon: FileCheck, module: "contracts" },
      { href: "/technicians",label: "Technicians",icon: Wrench,    module: "technicians" },
    ],
  },
  {
    href: "/billing", label: "Billing", icon: FileText, module: null,
    children: [
      { href: "/invoices",    label: "Invoices",    icon: FileText,      module: "invoices" },
      { href: "/quotations",  label: "Quotations",  icon: ClipboardList, module: "quotations" },
      { href: "/finance",     label: "Finance",     icon: Wallet,        module: "finance" },
    ],
  },
  { href: "/reports",  label: "Reports",     icon: BarChart3, module: "reports" },
  { href: "/import",   label: "Import Data", icon: Upload,    module: null },
  { href: "/settings", label: "Settings",    icon: Settings,  module: "settings" },
];

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim().toLowerCase() ?? "";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [settingUp, setSettingUp] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { user, firestoreError, needsSetup, refreshUser, completeSetup, markOnboardingComplete } = useAuth();
  const { canAccess } = usePermissions();
  const { toast } = useToast();

  const isAdmin = !!ADMIN_EMAIL && !!user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL;
  const showOnboarding = !!user && user.role === "owner" && user.onboardingCompleted === false && !needsSetup && !firestoreError;

  function toggleGroup(href: string) {
    setCollapsedGroups((prev) => ({ ...prev, [href]: !prev[href] }));
  }

  function isGroupActive(item: NavItem): boolean {
    if (item.children) return item.children.some((c) => location === c.href || location.startsWith(c.href + "/"));
    return location === item.href || location.startsWith(item.href + "/");
  }

  async function handleLogout() {
    try { await signOut(auth); navigate("/login"); }
    catch { toast({ title: "Error", description: "Failed to sign out", variant: "destructive" }); }
  }

  async function handleRetry() {
    setRetrying(true);
    try { await refreshUser(); } finally { setRetrying(false); }
  }

  async function handleCompleteSetup() {
    if (!companyName.trim()) { toast({ title: "Company name is required", variant: "destructive" }); return; }
    setSettingUp(true);
    try {
      await completeSetup(companyName.trim());
      setSetupOpen(false); setCompanyName("");
      toast({ title: "Setup complete! Welcome to Marwo." });
    } catch { toast({ title: "Setup failed", description: "Check your Firestore rules and try again.", variant: "destructive" }); }
    finally { setSettingUp(false); }
  }

  const showBanner = firestoreError || needsSetup;

  const filteredNav = ALL_NAV.map((item) => {
    if (item.children) {
      const visibleChildren = item.children.filter((c) => c.module === null || canAccess(c.module));
      if (visibleChildren.length === 0) return null;
      return { ...item, children: visibleChildren };
    }
    if (item.module !== null && !canAccess(item.module)) return null;
    return item;
  }).filter(Boolean) as NavItem[];

  function NavLink({ item, indent = false }: { item: NavItem; indent?: boolean }) {
    const active = location === item.href || location.startsWith(item.href + "/");
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
          indent ? "pl-8 py-1.5" : "",
          active ? "bg-sidebar-primary text-white shadow-sm" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
        )}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        {item.label}
      </Link>
    );
  }

  function renderSidebar(mobile = false) {
    return (
      <div className={cn("flex flex-col h-full bg-sidebar text-sidebar-foreground", mobile ? "w-72" : "w-64")}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <MarwoMark size={32} />
          <div className="flex flex-col leading-none">
            <span className="font-bold text-base tracking-tight text-white">Marwo</span>
            <span className="text-[10px] text-sidebar-foreground/40 tracking-wide uppercase">Field Service</span>
          </div>
          {mobile && (
            <button onClick={() => setMobileOpen(false)} className="ml-auto text-sidebar-foreground/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {filteredNav.map((item) => {
            if (item.children) {
              const groupActive = isGroupActive(item);
              const collapsed = collapsedGroups[item.href] ?? !groupActive;
              return (
                <div key={item.href}>
                  <button
                    onClick={() => toggleGroup(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      groupActive ? "text-white" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5 opacity-50" /> : <ChevronDown className="w-3.5 h-3.5 opacity-50" />}
                  </button>
                  {!collapsed && (
                    <div className="mt-0.5 space-y-0.5">
                      {item.children.map((child) => <NavLink key={child.href} item={child} indent />)}
                    </div>
                  )}
                </div>
              );
            }
            return <NavLink key={item.href} item={item} />;
          })}
        </nav>

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
          {isAdmin && (
            <Link href="/admin" onClick={() => setMobileOpen(false)}>
              <Button
                variant="ghost" size="sm"
                className="w-full justify-start gap-2 text-yellow-400 hover:text-yellow-300 hover:bg-sidebar-accent mb-1"
              >
                <ShieldCheck className="w-4 h-4" /> Super Admin
              </Button>
            </Link>
          )}
          <Button
            variant="ghost" size="sm" onClick={handleLogout}
            className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden md:flex shrink-0">{renderSidebar()}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full z-10 shadow-2xl">{renderSidebar(true)}</aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" data-testid="button-mobile-menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <MarwoMark size={24} />
            <span className="font-bold text-sm">Marwo</span>
          </div>
        </header>

        {showBanner && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 hidden sm:block" />
            <div className="flex-1">
              {needsSetup ? (
                <span><span className="font-semibold">Company setup incomplete.</span>{" "}Your account exists but no company workspace was created yet. Click <strong>Complete Setup</strong> to finish.</span>
              ) : firestoreError === "permission-denied" ? (
                <span><span className="font-semibold">Firestore rules blocking access.</span>{" "}In Firebase Console → Firestore → Rules, set:{" "}<code className="bg-amber-100 px-1 rounded text-xs font-mono">allow read, write: if request.auth != null;</code>{" "}(service must be <strong>cloud.firestore</strong>, not beta1). Then click Retry.</span>
              ) : (
                <span><span className="font-semibold">Firestore not reachable.</span>{" "}Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Firebase Console</a> → Firestore Database → Create database (test mode). Then click Retry.</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {needsSetup ? (
                <Button size="sm" onClick={() => setSetupOpen(true)} className="gap-1.5 h-8">Complete Setup</Button>
              ) : (
                <>
                  <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber-700 underline hover:text-amber-900 text-xs font-medium">Firebase Console <ExternalLink className="w-3 h-3" /></a>
                  <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying} className="gap-1.5 h-8 border-amber-300 text-amber-800 hover:bg-amber-100">
                    <RefreshCw className={cn("w-3 h-3", retrying && "animate-spin")} />{retrying ? "Retrying…" : "Retry"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">{children}</main>
        {showOnboarding && (
          <OnboardingWizard onComplete={() => {
            markOnboardingComplete();
            void refreshUser();
          }} />
        )}
      </div>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Your Setup</DialogTitle>
            <DialogDescription>Enter your company name to finish creating your workspace.</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label htmlFor="setup-company">Company Name *</Label>
            <Input id="setup-company" placeholder="Acme Inc." value={companyName} onChange={(e) => setCompanyName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCompleteSetup()} autoFocus />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSetupOpen(false)} disabled={settingUp}>Cancel</Button>
            <Button onClick={handleCompleteSetup} disabled={settingUp || !companyName.trim()}>{settingUp ? "Setting up…" : "Create Workspace"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
